import { Router, type Request } from "express";
import { supabaseAdmin, isValidUUID } from "../supabase";
import { requireAuth, requireGerencia } from "../auth";
import { writeAudit } from "../audit";
import { resolverAuxiliares, resolverUsuario, aplanarAuxiliares, type UsuarioEquipo } from "../cierreEquipo";

export const dbRouter = Router();
dbRouter.use(requireAuth);

const fail = (res: any, route: string, err: any, status = 500) => {
  console.error(`Error en ${route}:`, err);
  return res.status(status).json({ success: false, error: err?.message || String(err) });
};

/** Gerencia puede consultar cualquier local; el resto solo el suyo. */
function scopedLocalId(req: Request): string | null {
  const requested = (req.query.local_id || req.query.localId) as string | undefined;
  if (req.user!.isGerencia) return isValidUUID(requested) ? requested : null;
  return req.user!.localId;
}

// ---------------------------------------------------------------------------
// Locales
// ---------------------------------------------------------------------------
dbRouter.get("/locales", async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("locales").select("id, nombre").order("nombre");
  if (error) return fail(res, "GET /locales", error);
  res.json({ success: true, data: data || [] });
});

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
dbRouter.get("/usuarios", async (req, res) => {
  const localId = scopedLocalId(req);
  let query = supabaseAdmin.from("usuarios").select("*, locales(nombre)").order("nombre");
  if (localId) query = query.eq("local_id", localId);
  const { data, error } = await query;
  if (error) return fail(res, "GET /usuarios", error);

  // El estado de la cuenta (activo/suspendido) vive en credenciales.
  const { data: creds } = await supabaseAdmin.from("credenciales").select("usuario_id, activo");
  const activos = new Map((creds || []).map((c: any) => [c.usuario_id, c.activo]));
  res.json({
    success: true,
    data: (data || []).map((u: any) => ({ ...u, activo: activos.get(u.id) ?? true })),
  });
});

dbRouter.post("/usuarios", requireGerencia, async (req, res) => {
  const { id, nombre, cedula, cargo, role, local_id, email } = req.body || {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ success: false, error: "El nombre es obligatorio." });

  const payload: Record<string, unknown> = { nombre: String(nombre).trim() };
  if (isValidUUID(id)) payload.id = id;
  if (cedula !== undefined) payload.cedula = cedula ? String(cedula).trim() : null;
  if (email !== undefined) payload.email = email ? String(email).trim().toLowerCase() : null;
  if (cargo !== undefined) payload.cargo = cargo;
  if (role !== undefined) payload.role = role;
  if (isValidUUID(local_id)) payload.local_id = local_id;

  const { data, error } = await supabaseAdmin.from("usuarios").upsert(payload, { onConflict: "id" }).select().single();
  if (error) return fail(res, "POST /usuarios", error);
  await writeAudit(req, { action: payload.id ? "USER_UPDATED" : "USER_CREATED", targetUser: data.nombre, description: `Cargo: ${data.cargo}` });
  res.json({ success: true, data });
});

dbRouter.patch("/usuarios/:id", requireGerencia, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ success: false, error: "ID inválido." });
  const { role, cargo, nombre, cedula, email } = req.body || {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role !== undefined) updates.role = role;
  if (cargo !== undefined) updates.cargo = cargo;
  if (nombre !== undefined) updates.nombre = nombre;
  if (cedula !== undefined) updates.cedula = cedula;
  if (email !== undefined) updates.email = email;

  if (id === req.user!.sub && role !== undefined && role !== "administrador") {
    return res.status(400).json({ success: false, error: "No puedes quitarte a ti mismo el rol de Gerencia." });
  }

  const { data, error } = await supabaseAdmin.from("usuarios").update(updates).eq("id", id).select().single();
  if (error) return fail(res, "PATCH /usuarios/:id", error);
  await writeAudit(req, { action: "ROLE_UPDATED", targetUser: data.nombre, description: `Rol: ${data.role} · Cargo: ${data.cargo}` });
  res.json({ success: true, data });
});

dbRouter.delete("/usuarios/:id", requireGerencia, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ success: false, error: "ID inválido." });
  if (id === req.user!.sub) return res.status(400).json({ success: false, error: "No puedes eliminar tu propia cuenta." });
  const { data: target } = await supabaseAdmin.from("usuarios").select("nombre").eq("id", id).maybeSingle();
  const { error } = await supabaseAdmin.from("usuarios").delete().eq("id", id);
  if (error) return fail(res, "DELETE /usuarios/:id", error);
  await writeAudit(req, { action: "USER_DELETED", targetUser: target?.nombre || id });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Cierres de caja
// ---------------------------------------------------------------------------

/** Campos que declara la tienda en su arqueo. */
const DECLARED_COLUMNS = [
  "fecha", "efectivo_cierre", "datafono_cierre", "justo_cierre", "rappi_cierre",
  "transferencias_cierre", "propinas", "novedades", "lider_id",
] as const;

/** Campos que solo Gerencia puede escribir (POS, diferencias, auditoría, 60/40). */
const AUDIT_COLUMNS = [
  "estado", "local_id", "colaborador_id", "efectivo_pos", "tarjetas_pos", "justo_pos", "rappi_pos",
  "transferencias_pos", "pos_file_name", "dif_efectivo", "dif_tarjetas", "dif_justo", "dif_rappi",
  "dif_transferencias", "descuadre_lider", "descuadre_auxiliar", "auditado_por", "auditado_at",
  "anulado_por", "anulado_at", "justo_pedidos_pos", "justo_sobrante_efectivo_despacho",
] as const;

const UUID_COLUMNS = new Set(["colaborador_id", "lider_id", "auditado_por", "anulado_por", "local_id"]);
const ESTADO_PENDIENTE = "Pendiente por Cuadrar";
const ESTADOS_VALIDOS = new Set([ESTADO_PENDIENTE, "Cuadrado", "Anulado"]);

function pickColumns(body: any, columns: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (body?.[col] === undefined) continue;
    if (UUID_COLUMNS.has(col) && body[col] !== null && !isValidUUID(body[col])) continue;
    out[col] = body[col];
  }
  return out;
}

const CIERRE_SELECT =
  "*, colaborador:usuarios!colaborador_id(nombre), auditor:usuarios!auditado_por(nombre), lider:usuarios!lider_id(nombre), " +
  "auxiliares:cierre_auxiliares(usuario_id, usuario:usuarios(nombre))";

async function cargarUsuariosEquipo(): Promise<UsuarioEquipo[]> {
  const { data, error } = await supabaseAdmin.from("usuarios").select("id, nombre, email, cedula, local_id");
  if (error) throw error;
  return data || [];
}

/**
 * Equipo del turno enviado por el cliente: `auxiliares_nombres` (nombres o UUID) y
 * `lider_nombre` (solo si no llega un lider_id válido). Devuelve null si no se envió
 * la lista de auxiliares (no se toca cierre_auxiliares). Si un auxiliar no se puede
 * identificar se rechaza el guardado: perderlo deja sin registro quién pagó el 40%.
 */
async function resolverEquipo(body: any, localId: string | null, payload: Record<string, unknown>) {
  const enviaAuxiliares = Array.isArray(body?.auxiliares_nombres);
  const enviaLider = !isValidUUID(payload.lider_id) && typeof body?.lider_nombre === "string" && body.lider_nombre.trim();
  if (!enviaAuxiliares && !enviaLider) return { auxiliares: null as string[] | null };

  const usuarios = await cargarUsuariosEquipo();
  if (enviaLider) {
    const liderId = resolverUsuario(body.lider_nombre, usuarios, localId);
    if (liderId) payload.lider_id = liderId;
  }
  if (!enviaAuxiliares) return { auxiliares: null };

  const { ids, noEncontrados } = resolverAuxiliares(body.auxiliares_nombres, usuarios, localId);
  if (noEncontrados.length > 0) {
    return {
      auxiliares: null,
      error: `No se encontró en el equipo registrado a: ${noEncontrados.join(", ")}. Usa el nombre exacto del colaborador.`,
    };
  }
  return { auxiliares: ids };
}

/** Reemplaza los auxiliares del cierre por la lista dada. */
async function guardarAuxiliares(cierreId: string, usuarioIds: string[]) {
  const { error: delErr } = await supabaseAdmin.from("cierre_auxiliares").delete().eq("cierre_id", cierreId);
  if (delErr) throw delErr;
  if (usuarioIds.length === 0) return;
  const { error } = await supabaseAdmin
    .from("cierre_auxiliares")
    .insert(usuarioIds.map((usuario_id) => ({ cierre_id: cierreId, usuario_id })));
  if (error) throw error;
}

async function leerCierre(id: string) {
  const { data, error } = await supabaseAdmin.from("cierres_caja").select(CIERRE_SELECT).eq("id", id).single();
  if (error) throw error;
  return aplanarAuxiliares(data);
}

dbRouter.get("/cierres", async (req, res) => {
  const localId = scopedLocalId(req);
  let query = supabaseAdmin
    .from("cierres_caja")
    .select(CIERRE_SELECT)
    // Las filas SYSTEM_* antiguas están Anuladas, así que este filtro también las excluye.
    // (Un filtro "pos_file_name not in (...)" ocultaba los pendientes: NULL NOT IN (...) no es verdadero.)
    .neq("estado", "Anulado")
    .order("fecha", { ascending: false });
  if (localId) query = query.eq("local_id", localId);
  const { data, error } = await query;
  if (error) return fail(res, "GET /cierres", error);
  res.json({ success: true, data: (data || []).map(aplanarAuxiliares) });
});

dbRouter.post("/cierres", async (req, res) => {
  const user = req.user!;
  const payload: Record<string, unknown> = pickColumns(req.body, DECLARED_COLUMNS);

  if (user.isGerencia) {
    Object.assign(payload, pickColumns(req.body, AUDIT_COLUMNS));
  }
  // Quien reporta es el usuario autenticado (salvo que Gerencia registre a nombre de otro).
  if (!isValidUUID(payload.colaborador_id)) payload.colaborador_id = user.sub;
  if (!isValidUUID(payload.local_id)) payload.local_id = user.localId;
  if (!user.isGerencia || !payload.estado) payload.estado = ESTADO_PENDIENTE;

  if (!payload.fecha) return res.status(400).json({ success: false, error: "La fecha del cierre es obligatoria." });
  if (!payload.local_id) return res.status(400).json({ success: false, error: "El usuario no tiene un local asignado." });

  // Evitar cierres duplicados para el mismo local y fecha.
  const { data: dup } = await supabaseAdmin
    .from("cierres_caja")
    .select("id")
    .eq("local_id", payload.local_id as string)
    .eq("fecha", payload.fecha as string)
    .neq("estado", "Anulado")
    .limit(1);
  if (dup && dup.length > 0) {
    return res.status(409).json({ success: false, error: "Ya existe un cierre registrado para esta fecha en este local." });
  }

  let equipo;
  try {
    equipo = await resolverEquipo(req.body, payload.local_id as string, payload);
  } catch (err) {
    return fail(res, "POST /cierres", err);
  }
  if (equipo.error) return res.status(400).json({ success: false, error: equipo.error });

  const { data, error } = await supabaseAdmin.from("cierres_caja").insert(payload).select("id").single();
  // 23505: otro envío simultáneo ganó la carrera (índice único local + fecha).
  if (error?.code === "23505") {
    return res.status(409).json({ success: false, error: "Ya existe un cierre registrado para esta fecha en este local." });
  }
  if (error) return fail(res, "POST /cierres", error);
  try {
    if (equipo.auxiliares) await guardarAuxiliares(data.id, equipo.auxiliares);
    res.json({ success: true, data: await leerCierre(data.id) });
  } catch (err) {
    fail(res, "POST /cierres (auxiliares)", err);
  }
});

dbRouter.put("/cierres/:id", async (req, res) => {
  const user = req.user!;
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ success: false, error: "ID inválido." });

  const { data: existing, error: getErr } = await supabaseAdmin
    .from("cierres_caja")
    .select("id, estado, local_id, colaborador_id")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return fail(res, "PUT /cierres/:id", getErr);
  if (!existing) return res.status(404).json({ success: false, error: "Cierre no encontrado." });

  let updates: Record<string, unknown>;
  if (user.isGerencia) {
    updates = { ...pickColumns(req.body, DECLARED_COLUMNS), ...pickColumns(req.body, AUDIT_COLUMNS) };
    if (updates.estado !== undefined && !ESTADOS_VALIDOS.has(String(updates.estado))) {
      return res.status(400).json({ success: false, error: "Estado de cierre inválido." });
    }
    if (updates.estado === "Anulado") {
      updates.anulado_por = user.sub;
      updates.anulado_at = new Date().toISOString();
    }
    if (updates.estado === "Cuadrado") {
      updates.auditado_por = user.sub;
      updates.auditado_at = updates.auditado_at || new Date().toISOString();
    }
  } else {
    // El equipo de tienda solo puede corregir su arqueo mientras siga pendiente.
    if (existing.local_id !== user.localId) {
      return res.status(403).json({ success: false, error: "No puedes modificar cierres de otro local." });
    }
    if (existing.estado !== ESTADO_PENDIENTE) {
      return res.status(409).json({ success: false, error: "Este cierre ya fue auditado y no se puede modificar." });
    }
    updates = pickColumns(req.body, DECLARED_COLUMNS);
  }

  let equipo;
  try {
    equipo = await resolverEquipo(req.body, existing.local_id, updates);
  } catch (err) {
    return fail(res, "PUT /cierres/:id", err);
  }
  if (equipo.error) return res.status(400).json({ success: false, error: equipo.error });

  if (Object.keys(updates).length === 0 && !equipo.auxiliares) {
    return res.status(400).json({ success: false, error: "No hay campos válidos para actualizar." });
  }

  // Actualización condicional: si el estado cambió entre la lectura y la escritura, no se pisa.
  // Sin columnas que cambiar se reescribe el mismo estado para conservar esa verificación.
  const { data: updated, error } = await supabaseAdmin
    .from("cierres_caja")
    .update(Object.keys(updates).length > 0 ? updates : { estado: existing.estado })
    .eq("id", id)
    .eq("estado", existing.estado)
    .select("id")
    .maybeSingle();
  if (error) return fail(res, "PUT /cierres/:id", error);
  if (!updated) {
    return res.status(409).json({ success: false, error: "El cierre fue modificado por otra persona. Recarga e inténtalo de nuevo." });
  }

  let data;
  try {
    if (equipo.auxiliares) await guardarAuxiliares(id, equipo.auxiliares);
    data = await leerCierre(id);
  } catch (err) {
    return fail(res, "PUT /cierres/:id (auxiliares)", err);
  }

  if (user.isGerencia && updates.estado && updates.estado !== existing.estado) {
    await writeAudit(req, {
      action: "CIERRE_ESTADO",
      targetUser: data.colaborador?.nombre,
      description: `Cierre ${data.fecha}: ${existing.estado} → ${updates.estado}`,
    });
  }
  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// Nómina (solo Gerencia)
// ---------------------------------------------------------------------------
dbRouter.get("/turnos-nomina", requireGerencia, async (req, res) => {
  const localId = scopedLocalId(req);
  let query = supabaseAdmin.from("turnos_nomina").select("*, usuarios(nombre, cargo)").order("fecha_fin", { ascending: false });
  if (localId) query = query.eq("local_id", localId);
  const { data, error } = await query;
  if (error) return fail(res, "GET /turnos-nomina", error);
  res.json({ success: true, data: data || [] });
});

dbRouter.post("/turnos-nomina", requireGerencia, async (req, res) => {
  const { usuario_id, local_id, fecha_inicio, fecha_fin, quincena_nombre, liquidacion, ai_analysis } = req.body || {};
  if (!isValidUUID(usuario_id) || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ success: false, error: "usuario_id, fecha_inicio y fecha_fin son obligatorios." });
  }
  const { data, error } = await supabaseAdmin
    .from("turnos_nomina")
    .insert({
      usuario_id,
      local_id: isValidUUID(local_id) ? local_id : req.user!.localId,
      fecha_inicio,
      fecha_fin,
      quincena_nombre: quincena_nombre ?? null,
      liquidacion: liquidacion ?? null,
      ai_analysis: ai_analysis ?? null,
    })
    .select()
    .single();
  if (error) return fail(res, "POST /turnos-nomina", error);
  res.json({ success: true, data });
});

dbRouter.delete("/turnos-nomina/:id", requireGerencia, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ success: false, error: "ID inválido." });
  const { error } = await supabaseAdmin.from("turnos_nomina").delete().eq("id", id);
  if (error) return fail(res, "DELETE /turnos-nomina/:id", error);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Configuraciones (tabla app_config) — antes estas rutas no existían y
// todo se perdía en silencio.
// ---------------------------------------------------------------------------
async function getConfigByPrefix(prefix: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin.from("app_config").select("key, value").like("key", `${prefix}%`);
  if (error) throw error;
  const out: Record<string, unknown> = {};
  for (const row of data || []) out[row.key.slice(prefix.length)] = row.value;
  return out;
}

async function setConfig(req: Request, entries: Record<string, unknown>) {
  const rows = Object.entries(entries).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: req.user!.sub,
  }));
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from("app_config").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

dbRouter.get("/configuracion-nomina", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("app_config").select("value").eq("key", "configuracion_nomina").maybeSingle();
    if (error) throw error;
    res.json({ success: true, data: data?.value ?? { smmlv_base: 1750905, aux_transporte_base: 249095 } });
  } catch (err) {
    fail(res, "GET /configuracion-nomina", err);
  }
});

dbRouter.post("/configuracion-nomina", requireGerencia, async (req, res) => {
  const smmlv = Number(req.body?.smmlv_base);
  const aux = Number(req.body?.aux_transporte_base);
  if (!(smmlv > 0) || !(aux > 0)) return res.status(400).json({ success: false, error: "Valores de SMMLV y auxilio inválidos." });
  try {
    await setConfig(req, { configuracion_nomina: { smmlv_base: smmlv, aux_transporte_base: aux } });
    await writeAudit(req, { action: "CONFIG_NOMINA", description: `SMMLV ${smmlv} · Aux. transporte ${aux}` });
    res.json({ success: true });
  } catch (err) {
    fail(res, "POST /configuracion-nomina", err);
  }
});

dbRouter.get("/nomina-config", requireGerencia, async (_req, res) => {
  try {
    res.json({ success: true, data: await getConfigByPrefix("nomina_config:") });
  } catch (err) {
    fail(res, "GET /nomina-config", err);
  }
});

dbRouter.post("/nomina-config", requireGerencia, async (req, res) => {
  const { usuarioId, config } = req.body || {};
  if (!usuarioId || typeof config !== "object") return res.status(400).json({ success: false, error: "Datos incompletos." });
  try {
    await setConfig(req, { [`nomina_config:${usuarioId}`]: config });
    res.json({ success: true });
  } catch (err) {
    fail(res, "POST /nomina-config", err);
  }
});

dbRouter.get("/hr-config", requireGerencia, async (_req, res) => {
  try {
    res.json({ success: true, data: await getConfigByPrefix("hr_config:") });
  } catch (err) {
    fail(res, "GET /hr-config", err);
  }
});

dbRouter.post("/hr-config", requireGerencia, async (req, res) => {
  const map = req.body;
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return res.status(400).json({ success: false, error: "Formato inválido." });
  }
  try {
    const entries: Record<string, unknown> = {};
    for (const [nombre, cfg] of Object.entries(map)) entries[`hr_config:${nombre}`] = cfg;
    await setConfig(req, entries);
    res.json({ success: true });
  } catch (err) {
    fail(res, "POST /hr-config", err);
  }
});

dbRouter.get("/cargo-puntos", async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("cargo_puntos").select("*");
  if (error) return fail(res, "GET /cargo-puntos", error);
  res.json({ success: true, data: data || [] });
});
