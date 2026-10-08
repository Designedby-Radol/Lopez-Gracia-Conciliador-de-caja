import { Router } from "express";
import { supabaseAdmin, isValidUUID } from "../supabase";
import {
  hashPassword,
  verifyPassword,
  isGerenciaUser,
  setSessionCookie,
  clearSessionCookie,
  requireGerencia,
  loginRateLimitKey,
  isRateLimited,
  registerFailedAttempt,
  clearAttempts,
  MIN_PASSWORD_LENGTH,
  type SessionUser,
} from "../auth";
import { writeAudit } from "../audit";

export const authRouter = Router();

function normalize(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

interface Credencial {
  usuario_id: string;
  password_hash: string | null;
  debe_cambiar: boolean;
  activo: boolean;
}

async function getCredencial(usuarioId: string): Promise<Credencial | null> {
  const { data } = await supabaseAdmin
    .from("credenciales")
    .select("usuario_id, password_hash, debe_cambiar, activo")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  return (data as Credencial) || null;
}

async function upsertCredencial(usuarioId: string, fields: Partial<Omit<Credencial, "usuario_id">>) {
  const { error } = await supabaseAdmin
    .from("credenciales")
    .upsert({ usuario_id: usuarioId, ...fields, updated_at: new Date().toISOString() }, { onConflict: "usuario_id" });
  if (error) throw error;
}

/**
 * Configuración antigua (contraseñas en texto plano guardadas en cierres_caja).
 * Solo se usa para migrar cada usuario a credenciales con hash en su primer login.
 */
async function getLegacySecurityConfig(): Promise<{ passwords: Record<string, string>; statuses: Record<string, string> }> {
  try {
    const { data } = await supabaseAdmin
      .from("cierres_caja")
      .select("novedades")
      .eq("pos_file_name", "SYSTEM_SECURITY_CONFIG")
      .limit(1)
      .maybeSingle();
    if (data?.novedades) {
      const parsed = JSON.parse(data.novedades);
      return { passwords: parsed.passwords || {}, statuses: parsed.statuses || {} };
    }
  } catch {
    /* sin configuración antigua */
  }
  return { passwords: {}, statuses: {} };
}

function toSessionUser(u: any, mustChangePassword: boolean): SessionUser {
  return {
    sub: u.id,
    nombre: u.nombre,
    cargo: u.cargo,
    role: u.role,
    localId: u.local_id ?? null,
    local: u.locales?.nombre || "Chapinero",
    isGerencia: isGerenciaUser(u),
    mustChangePassword,
  };
}

function publicUser(s: SessionUser) {
  return {
    id: s.sub,
    nombre: s.nombre,
    cargo: s.cargo,
    role: s.role,
    local: s.local,
    localId: s.localId,
    isGerencia: s.isGerencia,
    mustChangePassword: s.mustChangePassword,
  };
}

// ---- POST /api/auth/login ----
authRouter.post("/login", async (req, res) => {
  const identifier = normalize(req.body?.identifier);
  const password = String(req.body?.password ?? "");

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: "Ingresa tu correo o cédula y tu contraseña." });
  }

  const rlKey = loginRateLimitKey(req, identifier);
  if (isRateLimited(rlKey)) {
    return res.status(429).json({ success: false, error: "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo." });
  }

  const genericError = () => {
    registerFailedAttempt(rlKey);
    return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos." });
  };

  try {
    const { data: users, error } = await supabaseAdmin.from("usuarios").select("*, locales(nombre)");
    if (error) throw error;

    // Coincidencia EXACTA: cédula, correo o nombre completo (sin tildes ni mayúsculas).
    const matches = (users || []).filter((u: any) =>
      (u.cedula && String(u.cedula).trim() === identifier) ||
      (u.email && normalize(u.email) === identifier) ||
      normalize(u.nombre) === identifier
    );

    if (matches.length !== 1) {
      await writeAudit(req, {
        action: "LOGIN_FAILED",
        targetUser: identifier,
        executedBy: "Sistema Auth",
        description: matches.length > 1 ? "Identificador ambiguo (coincide con varios usuarios)." : "Identificador inexistente.",
        status: "warning",
      });
      return genericError();
    }

    const user: any = matches[0];
    let cred = await getCredencial(user.id);

    // --- Migración desde el esquema antiguo (texto plano) ---
    if (!cred?.password_hash) {
      const legacy = await getLegacySecurityConfig();
      const keys = [String(user.cedula || "").trim().toLowerCase(), String(user.nombre || "").trim().toLowerCase()].filter(Boolean);
      const legacyPass = keys.map((k) => legacy.passwords[k]).find(Boolean);
      const legacySuspended = keys.some((k) => legacy.statuses[k] === "suspended");
      const fallbackPass = isGerenciaUser(user) ? "admin123" : "tienda";
      const expected = legacyPass || fallbackPass;

      if (password !== expected) {
        await writeAudit(req, { action: "LOGIN_FAILED", targetUser: user.nombre, executedBy: "Sistema Auth", description: "Clave incorrecta.", status: "warning" });
        return genericError();
      }

      // Las claves antiguas estuvieron expuestas: se migran a hash y se obliga a cambiarlas.
      await upsertCredencial(user.id, {
        password_hash: hashPassword(password),
        debe_cambiar: true,
        activo: cred ? cred.activo : !legacySuspended,
      });
      cred = await getCredencial(user.id);
    } else if (!verifyPassword(password, cred.password_hash)) {
      await writeAudit(req, { action: "LOGIN_FAILED", targetUser: user.nombre, executedBy: "Sistema Auth", description: "Clave incorrecta.", status: "warning" });
      return genericError();
    }

    if (cred && !cred.activo) {
      await writeAudit(req, { action: "LOGIN_BLOCKED_SUSPENDED", targetUser: user.nombre, executedBy: "Sistema Auth", description: "Cuenta suspendida.", status: "error" });
      return res.status(403).json({ success: false, error: "Esta cuenta está suspendida. Comunícate con Gerencia." });
    }

    clearAttempts(rlKey);
    const session = toSessionUser(user, cred?.debe_cambiar ?? true);
    setSessionCookie(res, session);
    await writeAudit(req, { action: "LOGIN_SUCCESS", targetUser: user.nombre, executedBy: user.nombre, description: `Inicio de sesión como ${user.cargo}.` });

    res.json({ success: true, user: publicUser(session) });
  } catch (err: any) {
    console.error("Error en POST /api/auth/login:", err);
    res.status(500).json({ success: false, error: "Error interno al iniciar sesión." });
  }
});

// ---- GET /api/auth/me ----
authRouter.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ success: false });
  res.json({ success: true, user: publicUser(req.user) });
});

// ---- POST /api/auth/logout ----
authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

// ---- POST /api/auth/change-password (usuario autenticado, incluso con clave temporal) ----
authRouter.post("/change-password", async (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, error: "Sesión no válida." });
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ success: false, error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ success: false, error: "La nueva contraseña debe ser diferente a la actual." });
  }
  if (["tienda", "admin123", "123456", "password"].includes(newPassword.toLowerCase())) {
    return res.status(400).json({ success: false, error: "Esa contraseña es demasiado común. Elige otra." });
  }

  try {
    const cred = await getCredencial(req.user.sub);
    if (!cred || !verifyPassword(currentPassword, cred.password_hash)) {
      return res.status(401).json({ success: false, error: "La contraseña actual no es correcta." });
    }
    await upsertCredencial(req.user.sub, { password_hash: hashPassword(newPassword), debe_cambiar: false });
    const updated = { ...req.user, mustChangePassword: false };
    setSessionCookie(res, updated);
    await writeAudit(req, { action: "PASSWORD_CHANGED", targetUser: req.user.nombre, description: "El usuario cambió su propia contraseña." });
    res.json({ success: true, user: publicUser(updated) });
  } catch (err: any) {
    console.error("Error en POST /api/auth/change-password:", err);
    res.status(500).json({ success: false, error: "No se pudo cambiar la contraseña." });
  }
});

// ---- POST /api/auth/forgot-password ----
// No hay correo transaccional: la clave la restablece Gerencia desde "Seguridad & Roles".
authRouter.post("/forgot-password", (_req, res) => {
  res.json({
    success: true,
    resetEmailSent: false,
    message: "Solicita a Gerencia que restablezca tu contraseña desde el módulo Seguridad & Roles. Recibirás una clave temporal que deberás cambiar al ingresar.",
  });
});

// ---------------------------------------------------------------------------
// Administración de cuentas (solo Gerencia)
// ---------------------------------------------------------------------------
export const adminRouter = Router();
adminRouter.use(requireGerencia);

// Estado de credenciales de todos los usuarios (sin hashes)
adminRouter.get("/credenciales", async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("credenciales").select("usuario_id, debe_cambiar, activo, updated_at");
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data: data || [] });
});

adminRouter.post("/usuarios/:id/password", async (req, res) => {
  const { id } = req.params;
  const newPassword = String(req.body?.password ?? "");
  if (!isValidUUID(id)) return res.status(400).json({ success: false, error: "ID de usuario inválido." });
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ success: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
  }
  try {
    const { data: target } = await supabaseAdmin.from("usuarios").select("nombre").eq("id", id).maybeSingle();
    if (!target) return res.status(404).json({ success: false, error: "Usuario no encontrado." });
    // Clave temporal: el colaborador deberá cambiarla en su próximo ingreso.
    await upsertCredencial(id, { password_hash: hashPassword(newPassword), debe_cambiar: true });
    await writeAudit(req, { action: "PASSWORD_CHANGED", targetUser: target.nombre, description: "Gerencia asignó una clave temporal." });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error asignando clave:", err);
    res.status(500).json({ success: false, error: "No se pudo asignar la contraseña." });
  }
});

adminRouter.post("/usuarios/:id/estado", async (req, res) => {
  const { id } = req.params;
  const activo = Boolean(req.body?.activo);
  if (!isValidUUID(id)) return res.status(400).json({ success: false, error: "ID de usuario inválido." });
  if (id === req.user!.sub && !activo) {
    return res.status(400).json({ success: false, error: "No puedes suspender tu propia cuenta." });
  }
  try {
    const { data: target } = await supabaseAdmin.from("usuarios").select("nombre").eq("id", id).maybeSingle();
    if (!target) return res.status(404).json({ success: false, error: "Usuario no encontrado." });
    await upsertCredencial(id, { activo });
    await writeAudit(req, {
      action: "USER_STATUS_CHANGED",
      targetUser: target.nombre,
      description: `Cuenta ${activo ? "ACTIVADA" : "SUSPENDIDA"}.`,
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error cambiando estado:", err);
    res.status(500).json({ success: false, error: "No se pudo cambiar el estado de la cuenta." });
  }
});

adminRouter.get("/audit", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({
    success: true,
    data: (data || []).map((r: any) => ({
      id: String(r.id),
      timestamp: r.created_at,
      action: r.action,
      targetUser: r.target_user,
      executedBy: r.executed_by,
      description: r.description,
      status: r.status,
      ip: r.ip,
    })),
  });
});

adminRouter.post("/audit", async (req, res) => {
  const { action, targetUser, description, status } = req.body || {};
  if (!action) return res.status(400).json({ success: false, error: "Falta la acción." });
  await writeAudit(req, { action: String(action), targetUser, description, status });
  res.json({ success: true });
});
