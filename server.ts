import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

function normalizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return "https://zcltxutkxvhagblvnscy.supabase.co";
  let url = rawUrl.trim();
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/rest\/?$/i, "");
  url = url.replace(/\/+$/, "");
  return url || "https://zcltxutkxvhagblvnscy.supabase.co";
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL);
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjbHR4dXRreHZoYWdibHZuc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzA3MjYsImV4cCI6MjEwMTM0NjcyNn0.pfqPjpHtRJEvY988Sooaw-pd_LJL0-hxeSSFMjehZRg";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_ANON_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[WARN] SUPABASE_SERVICE_ROLE_KEY no está definida en el entorno. " +
    "Usando clave pública/anon como fallback para iniciar el servidor."
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

function isValidUUID(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

// ---- HELPERS DE SEGURIDAD Y AUDITORÍA EN SUPABASE ----
async function getSecurityConfigFromSupabase(): Promise<{ passwords: Record<string, string>; statuses: Record<string, "active" | "suspended"> }> {
  try {
    const { data } = await supabaseAdmin
      .from("cierres_caja")
      .select("id, novedades")
      .eq("pos_file_name", "SYSTEM_SECURITY_CONFIG")
      .limit(1)
      .maybeSingle();

    if (data?.novedades) {
      const parsed = JSON.parse(data.novedades);
      return {
        passwords: parsed.passwords || {},
        statuses: parsed.statuses || {}
      };
    }
  } catch (err) {
    console.error("Error leyendo configuración de seguridad en Supabase:", err);
  }
  return { passwords: {}, statuses: {} };
}

async function saveSecurityConfigToSupabase(config: { passwords: Record<string, string>; statuses: Record<string, "active" | "suspended"> }) {
  try {
    const { data: user } = await supabaseAdmin.from("usuarios").select("id").limit(1).single();
    const { data: local } = await supabaseAdmin.from("locales").select("id").limit(1).single();
    if (!user?.id || !local?.id) return false;

    const { data: existing } = await supabaseAdmin
      .from("cierres_caja")
      .select("id")
      .eq("pos_file_name", "SYSTEM_SECURITY_CONFIG")
      .limit(1)
      .maybeSingle();

    const payload = {
      colaborador_id: user.id,
      local_id: local.id,
      fecha: "1970-01-02",
      estado: "Anulado",
      pos_file_name: "SYSTEM_SECURITY_CONFIG",
      efectivo_cierre: 0,
      datafono_cierre: 0,
      justo_cierre: 0,
      rappi_cierre: 0,
      transferencias_cierre: 0,
      novedades: JSON.stringify(config)
    };

    if (existing?.id) {
      await supabaseAdmin.from("cierres_caja").update({ novedades: JSON.stringify(config) }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("cierres_caja").insert(payload);
    }
    return true;
  } catch (err) {
    console.error("Error guardando configuración de seguridad en Supabase:", err);
    return false;
  }
}

async function getAuditLogsFromSupabase(): Promise<any[]> {
  try {
    const { data } = await supabaseAdmin
      .from("cierres_caja")
      .select("id, created_at, novedades")
      .eq("pos_file_name", "SYSTEM_AUDIT_LOG")
      .limit(1)
      .maybeSingle();

    if (!data?.novedades) return [];

    const parsed = JSON.parse(data.novedades);
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      return [parsed];
    }
    return [];
  } catch (err) {
    console.error("Error cargando auditoría de Supabase:", err);
    return [];
  }
}

async function logSecurityAuditToSupabase(entry: {
  action: string;
  targetUser: string;
  executedBy: string;
  description: string;
  status?: "success" | "warning" | "error";
  ip?: string;
  device?: string;
}) {
  try {
    const { data: user } = await supabaseAdmin.from("usuarios").select("id").limit(1).single();
    const { data: local } = await supabaseAdmin.from("locales").select("id").limit(1).single();
    if (!user?.id || !local?.id) return;

    const auditPayload = {
      id: "sec-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      ...entry,
      status: entry.status || "success"
    };

    const { data: existing } = await supabaseAdmin
      .from("cierres_caja")
      .select("id, novedades")
      .eq("pos_file_name", "SYSTEM_AUDIT_LOG")
      .limit(1)
      .maybeSingle();

    let existingLogs: any[] = [];
    if (existing?.novedades) {
      try {
        const parsed = JSON.parse(existing.novedades);
        existingLogs = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        existingLogs = [];
      }
    }

    const updatedLogs = [auditPayload, ...existingLogs].slice(0, 500);

    if (existing?.id) {
      await supabaseAdmin
        .from("cierres_caja")
        .update({ novedades: JSON.stringify(updatedLogs) })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("cierres_caja").insert({
        colaborador_id: user.id,
        local_id: local.id,
        fecha: "1970-01-01",
        estado: "Anulado",
        pos_file_name: "SYSTEM_AUDIT_LOG",
        efectivo_cierre: 0,
        datafono_cierre: 0,
        justo_cierre: 0,
        rappi_cierre: 0,
        transferencias_cierre: 0,
        novedades: JSON.stringify(updatedLogs)
      });
    }
  } catch (err) {
    console.error("Error registrando log de auditoría en Supabase:", err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // ---- RUTAS DB SUPABASE ADMIN (IGNORAN RLS DESDE EL SERVIDOR) ----
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier) {
        return res.status(400).json({ success: false, error: "Ingresa tu usuario, correo o cédula" });
      }

      const clean = String(identifier).trim().toLowerCase();
      
      const { data: dbUsers, error: dbErr } = await supabaseAdmin
        .from("usuarios")
        .select("*, locales(nombre)");

      if (dbErr) {
        console.error("Error consultando usuarios en login:", dbErr);
        return res.status(500).json({ success: false, error: dbErr.message });
      }

      const matched = (dbUsers || []).find((u: any) => {
        const nombre = (u.nombre || "").toLowerCase();
        const cedula = String(u.cedula || "").trim();
        const email = (u.email || "").toLowerCase();

        return (
          nombre === clean ||
          email === clean ||
          (clean.length >= 4 && (nombre.includes(clean) || clean.includes(nombre))) ||
          (cedula && cedula === clean)
        );
      });

      if (!matched) {
        await logSecurityAuditToSupabase({
          action: "LOGIN_FAILED",
          targetUser: clean,
          executedBy: "Sistema Auth",
          description: "Intento de inicio de sesión con identificador o cédula inexistente.",
          status: "warning",
          ip: req.ip || req.headers["x-forwarded-for"]?.toString()
        });
        return res.status(404).json({ success: false, error: "Usuario o documento no encontrado en el sistema." });
      }

      // Validar si la cuenta está suspendida en Supabase
      const userKey = (matched.cedula || matched.nombre).trim().toLowerCase();
      const secConfig = await getSecurityConfigFromSupabase();
      const userStatus = secConfig.statuses?.[userKey] || secConfig.statuses?.[matched.nombre.toLowerCase()] || "active";

      if (userStatus === "suspended") {
        await logSecurityAuditToSupabase({
          action: "LOGIN_BLOCKED_SUSPENDED",
          targetUser: matched.nombre,
          executedBy: "Sistema Auth",
          description: "Acceso bloqueado en tiempo real: La cuenta se encuentra suspendida en Supabase.",
          status: "error",
          ip: req.ip || req.headers["x-forwarded-for"]?.toString()
        });
        return res.status(403).json({ 
          success: false, 
          error: "Esta cuenta se encuentra suspendida por la administración. Comunícate con Gerencia." 
        });
      }

      // Validar contraseña / PIN si se proporcionó
      const expectedPassword = 
        secConfig.passwords?.[userKey] || 
        secConfig.passwords?.[matched.nombre.toLowerCase()] ||
        (matched.role === "administrador" || matched.cargo === "Gerencia" ? "admin123" : "tienda");

      if (password !== undefined && password !== null && String(password).trim() !== "") {
        const inputPass = String(password).trim();
        if (inputPass !== expectedPassword) {
          await logSecurityAuditToSupabase({
            action: "LOGIN_FAILED",
            targetUser: matched.nombre,
            executedBy: "Sistema Auth",
            description: "Intento de inicio de sesión con clave o PIN incorrecto.",
            status: "warning",
            ip: req.ip || req.headers["x-forwarded-for"]?.toString()
          });
          return res.status(401).json({ success: false, error: "Contraseña o PIN incorrecto." });
        }
      }

      // Registro de inicio exitoso en auditoría de Supabase
      await logSecurityAuditToSupabase({
        action: "LOGIN_SUCCESS",
        targetUser: matched.nombre,
        executedBy: matched.nombre,
        description: `Inicio de sesión exitoso como ${matched.cargo} (${matched.role}).`,
        status: "success",
        ip: req.ip || req.headers["x-forwarded-for"]?.toString()
      });

      const localNombre = matched.locales?.nombre || "Chapinero";

      res.json({
        success: true,
        user: {
          id: matched.id,
          nombre: matched.nombre,
          cargo: matched.cargo,
          role: matched.role,
          local: localNombre,
          cedula: matched.cedula
        }
      });
    } catch (err: any) {
      console.error("Error en POST /api/auth/login:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // ---- ENDPOINTS DE SEGURIDAD & AUDITORÍA EN SUPABASE ----
  app.get("/api/db/security-config", async (_req, res) => {
    try {
      const config = await getSecurityConfigFromSupabase();
      res.json({ success: true, data: config });
    } catch (err: any) {
      console.error("Error en GET /api/db/security-config:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/db/security-config", async (req, res) => {
    try {
      const { passwords, statuses } = req.body || {};
      const current = await getSecurityConfigFromSupabase();
      const updated = {
        passwords: { ...(current.passwords || {}), ...(passwords || {}) },
        statuses: { ...(current.statuses || {}), ...(statuses || {}) }
      };

      const ok = await saveSecurityConfigToSupabase(updated);
      if (!ok) throw new Error("No se pudo guardar la configuración de seguridad en Supabase");
      res.json({ success: true, data: updated });
    } catch (err: any) {
      console.error("Error en POST /api/db/security-config:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/db/security-audit", async (_req, res) => {
    try {
      const logs = await getAuditLogsFromSupabase();
      res.json({ success: true, data: logs });
    } catch (err: any) {
      console.error("Error en GET /api/db/security-audit:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/db/security-audit", async (req, res) => {
    try {
      const { action, targetUser, executedBy, description, status } = req.body || {};
      if (!action || !targetUser) {
        return res.status(400).json({ success: false, error: "Datos de auditoría incompletos" });
      }

      await logSecurityAuditToSupabase({
        action,
        targetUser,
        executedBy: executedBy || "Gerencia",
        description: description || "Acción de seguridad ejecutada",
        status: status || "success",
        ip: req.ip || req.headers["x-forwarded-for"]?.toString()
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error en POST /api/db/security-audit:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.patch("/api/db/usuarios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { role, cargo, nombre, cedula } = req.body || {};
      const updates: any = { updated_at: new Date().toISOString() };
      if (role !== undefined) updates.role = role;
      if (cargo !== undefined) updates.cargo = cargo;
      if (nombre !== undefined) updates.nombre = nombre;
      if (cedula !== undefined) updates.cedula = cedula;

      const { data, error } = await supabaseAdmin
        .from("usuarios")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Error en PATCH /api/db/usuarios/:id:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.delete("/api/db/usuarios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin.from("usuarios").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error en DELETE /api/db/usuarios/:id:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/db/locales", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from("locales").select("*").order("nombre");
      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (err: any) {
      console.error("Error en /api/db/locales:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/db/usuarios", async (req, res) => {
    try {
      const localId = req.query.local_id as string;
      let query = supabaseAdmin.from("usuarios").select("*, locales(nombre)").order("nombre");
      if (localId) query = query.eq("local_id", localId);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (err: any) {
      console.error("Error en /api/db/usuarios:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/db/usuarios", async (req, res) => {
    try {
      const { id, nombre, cedula, cargo, role, local_id, activo, password } = req.body || {};
      
      const payload: any = {};
      if (id) payload.id = id;
      if (nombre !== undefined) payload.nombre = nombre;
      if (cedula !== undefined) payload.cedula = cedula;
      if (cargo !== undefined) payload.cargo = cargo;
      if (role !== undefined) payload.role = role;
      if (local_id !== undefined) payload.local_id = local_id;

      const { data, error } = await supabaseAdmin
        .from("usuarios")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
        
      if (error) throw error;

      // Si se especificó contraseña o estado activo, sincronizar en la configuración de seguridad en Supabase
      if (nombre && (activo !== undefined || password !== undefined)) {
        const userKey = (cedula || nombre).trim().toLowerCase();
        const secConfig = await getSecurityConfigFromSupabase();
        let changed = false;

        if (password) {
          secConfig.passwords[userKey] = password;
          secConfig.passwords[nombre.toLowerCase()] = password;
          changed = true;
        }

        if (activo !== undefined) {
          const status = activo ? "active" : "suspended";
          secConfig.statuses[userKey] = status;
          secConfig.statuses[nombre.toLowerCase()] = status;
          changed = true;
        }

        if (changed) {
          await saveSecurityConfigToSupabase(secConfig);
        }
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Error en POST /api/db/usuarios:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/db/cierres", async (req, res) => {
    try {
      const localId = req.query.local_id as string;
      let query = supabaseAdmin.from("cierres_caja").select("*").neq("estado", "Anulado").order("fecha", { ascending: false });
      if (localId) query = query.eq("local_id", localId);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (err: any) {
      console.error("Error en /api/db/cierres:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/db/cierres", async (req, res) => {
    try {
      const payload = { ...req.body };

      // Validar y asegurar colaborador_id (evitar not-null constraint error)
      if (!payload.colaborador_id || !isValidUUID(payload.colaborador_id)) {
        const identifier = payload.colaboradorNombre || payload.colaborador_nombre || payload.liderNombre || payload.lider_nombre || payload.colaborador_id;
        let matchedUser = null;
        const { data: users } = await supabaseAdmin.from("usuarios").select("id, nombre, cedula");
        
        if (identifier && users && users.length > 0) {
          const clean = String(identifier).toLowerCase().replace(/[^a-z0-9]/g, "");
          matchedUser = users.find((u: any) => {
            const nom = String(u.nombre || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const ced = String(u.cedula || "").trim();
            return nom.includes(clean) || clean.includes(nom) || (ced && clean.includes(ced));
          });
        }
        
        if (!matchedUser && users && users.length > 0) {
          matchedUser = users[0];
        }

        if (matchedUser?.id) {
          payload.colaborador_id = matchedUser.id;
        }
      }

      // Validar y asegurar local_id
      if (!payload.local_id || !isValidUUID(payload.local_id)) {
        const { data: firstLocal } = await supabaseAdmin.from("locales").select("id").limit(1).single();
        if (firstLocal?.id) {
          payload.local_id = firstLocal.id;
        }
      }

      // Sanitizar campos que no pertenecen a la tabla cierres_caja
      const validColumns = [
        "id", "fecha", "local_id", "colaborador_id", "efectivo_cierre", "datafono_cierre",
        "justo_cierre", "rappi_cierre", "transferencias_cierre", "propinas", "novedades",
        "estado", "efectivo_pos", "tarjetas_pos", "justo_pos", "rappi_pos", "transferencias_pos",
        "pos_file_name", "dif_efectivo", "dif_tarjetas", "dif_justo", "dif_rappi",
        "dif_transferencias", "lider_id", "descuadre_lider", "descuadre_auxiliar",
        "auditado_por", "auditado_at", "anulado_por", "anulado_at", "justo_pedidos_pos",
        "justo_sobrante_efectivo_despacho"
      ];

      const cleanPayload: any = {};
      for (const col of validColumns) {
        if (payload[col] !== undefined) {
          cleanPayload[col] = payload[col];
        }
      }

      const { data, error } = await supabaseAdmin.from("cierres_caja").insert(cleanPayload).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Error en POST /api/db/cierres:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.put("/api/db/cierres/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validColumns = [
        "fecha", "local_id", "colaborador_id", "efectivo_cierre", "datafono_cierre",
        "justo_cierre", "rappi_cierre", "transferencias_cierre", "propinas", "novedades",
        "estado", "efectivo_pos", "tarjetas_pos", "justo_pos", "rappi_pos", "transferencias_pos",
        "pos_file_name", "dif_efectivo", "dif_tarjetas", "dif_justo", "dif_rappi",
        "dif_transferencias", "lider_id", "descuadre_lider", "descuadre_auxiliar",
        "auditado_por", "auditado_at", "anulado_por", "anulado_at", "justo_pedidos_pos",
        "justo_sobrante_efectivo_despacho"
      ];

      const cleanPayload: any = {};
      for (const col of validColumns) {
        if (req.body[col] !== undefined) {
          cleanPayload[col] = req.body[col];
        }
      }

      if (cleanPayload.colaborador_id && !isValidUUID(cleanPayload.colaborador_id)) {
        delete cleanPayload.colaborador_id;
      }
      if (cleanPayload.lider_id && !isValidUUID(cleanPayload.lider_id)) {
        delete cleanPayload.lider_id;
      }
      if (cleanPayload.auditado_por && !isValidUUID(cleanPayload.auditado_por)) {
        delete cleanPayload.auditado_por;
      }

      const { data, error } = await supabaseAdmin.from("cierres_caja").update(cleanPayload).eq("id", id).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Error en PUT /api/db/cierres/:id:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/db/turnos-nomina", async (req, res) => {
    try {
      const localId = req.query.local_id as string;
      let query = supabaseAdmin.from("turnos_nomina").select("*, usuarios(nombre, cargo)").order("fecha_fin", { ascending: false });
      if (localId) query = query.eq("local_id", localId);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (err: any) {
      console.error("Error en /api/db/turnos-nomina:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/db/turnos-nomina", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from("turnos_nomina").insert(req.body).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Error en POST /api/db/turnos-nomina:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.delete("/api/db/turnos-nomina/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin.from("turnos_nomina").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error en DELETE /api/db/turnos-nomina/:id:", err);
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Endpoint para consultas laborales y liquidaciones con IA Gemini (Experto Laboralista Colombiano)
  app.post("/api/gemini/laboral", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { prompt, employeeContext } = req.body;

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          text: "⚠️ **Atención**: No se encontró la clave de API (GEMINI_API_KEY) en las variables de entorno. Por favor verifica los secretos en la configuración."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `Eres un Abogado Experto en Derecho Laboral Colombiano y Especialista en Liquidación de Nómina conforme al Código Sustantivo del Trabajo (CST) de Colombia con sus más recientes reformas vigentes a Julio de 2026.
Tu función es guiar al gerente/empleador de "López & Gracia" en la gestión de salarios y liquidación de quincenas para su equipo de trabajo.

Tipos de Contrato y Reglas de Liquidación en la Empresa:
1. Término Indefinido:
   - Salario Base Mensual ($1.750.905 COP o el parametrizado).
   - Incluye el derecho a 1 día de descanso pago remunerado a la semana.
   - Auxilio de transporte: Se liquida ÚNICAMENTE por los días en que el trabajador asistió a laborar en el sitio ($8.303,17 COP/día asistido).
   - Deducciones de ley: 4% Salud (EPS) + 4% Pensión sobre el ingreso salarial devengado (IBC).
2. Por Días (Fines de semana / Ocasionales):
   - Turno Tiempo Completo: 12:00 PM a 7:30 PM (7.5 hrs de permanencia con 0.5 hrs de almuerzo = 7.0 hrs de trabajo efectivo).
   - Turno Medio Tiempo: 2:00 PM a 7:30 PM (5.5 hrs de trabajo efectivo sin almuerzo).
   - Auxilio de transporte: $8.303,17 COP por cada día efectivamente asistido.
   - EXONERACIÓN DE DEDUCCIONES: A las personas que trabajan "Por días", NO se les realizan deducciones de Salud ni Pensión ($0 EPS / $0 Pensión).

Normativa y parámetros de ley colombiana vigentes (Actualizado a Julio de 2026):
1. Salario Mínimo Legal Vigente (SMMLV 2026): $1.750.905 COP mensuales ($875.452,50 COP quincenal). Total devengado con auxilio de transporte: $2.000.000 COP.
2. Auxilio de Transporte de Ley 2026: $249.095 COP mensuales ($8.303,17 COP por día asistido).
3. Jornada Máxima Legal: 42 horas semanales (en vigor desde el 15 de julio de 2026, Ley 2101 de 2021).
4. Divisor para valor hora ordinaria: 210 horas mensuales (Salario Base Mensual / 210 = $8.337,64 COP/hora).
5. Jornada Nocturna: Comprende desde las 7:00 p.m. hasta las 6:00 a.m. del día siguiente.
6. Salario Base Quincenal = Salario Base Mensual / 2.
7. Deducciones Obligatorias del Trabajador:
   - Salud: 4% sobre el Ingreso Base de Cotización (IBC).
   - Pensión: 4% sobre el Ingreso Base de Cotización (IBC).
   (El auxilio de transporte no suma para la base de salud ni pensión).
8. Tabla Oficial de Factores de Multiplicación y Recargos (Vigentes a Julio de 2026):
   - Hora Extra Diurna (HED): Factor 1.25 (+25% recargo)
   - Recargo Nocturno Ordinario (RN - 7pm a 6am): Factor 1.35 (+35% recargo)
   - Hora Extra Nocturna (HEN): Factor 1.75 (+75% recargo)
   - Dominical / Festivo Diurno Ordinario: Factor 1.90 (+90% recargo, actualizado desde el 1 de julio de 2026)
   - Dominical / Festivo Nocturno Ordinario: Factor 2.25 (+125% recargo = 90% dominical + 35% nocturno)
   - Hora Extra Diurna Dominical / Festiva: Factor 2.15 (+115% recargo = 25% extra diurna + 90% dominical)
   - Hora Extra Nocturna Dominical / Festiva: Factor 2.65 (+165% recargo = 75% extra nocturna + 90% dominical)
9. Bonos no constitutivos de salario (Art. 128 CST): válidos siempre que no desnaturalicen el salario ni superen el tope del 40%.

Instrucciones de respuesta:
- Realiza el desglose detallado de la quincena (Devengados, Deducciones y Neto a Pagar) aplicando los parámetros correspondientes (Salario Base de $1.750.905 COP o el configurado, Auxilio de Transporte de $249.095 COP mensuales / $124.547,50 quincenal si aplica), la jornada de 42 horas (divisor 210) y el inicio de jornada nocturna a las 7:00 p.m.
- Analiza la "Información Particular" del trabajador (observaciones de contrato, horarios, tiempo de almuerzo, novedades de ausencias, acuerdos) y resalta aspectos legales importantes o riesgos jurídicos según el CST.
- Responde de forma estructurada, profesional, clara, con títulos en Markdown y viñetas explicativas.`;

      let userMessage = prompt || "Por favor analiza la liquidación de la quincena para este trabajador.";
      if (employeeContext) {
        userMessage += `\n\n--- DATOS DEL COLABORADOR Y QUINCENA ---
Nombre: ${employeeContext.nombre || "No especificado"}
Cargo: ${employeeContext.cargo || "No especificado"}
Salario Base Mensual: $${Number(employeeContext.salarioBase || 0).toLocaleString('es-CO')} COP
Tipo de Contrato: ${employeeContext.tipoContrato || "Indefinido"}
Auxilio de Transporte Aplica: ${employeeContext.auxilioTransporte ? "SÍ" : "NO"}
Periodo a Liquidar: ${employeeContext.quincenaPeriodo || "Quincena de 15 días"}
Información Particular / Anotaciones Especiales: ${employeeContext.informacionParticular || "Sin anotaciones especiales."}

Novedades de la quincena:
- Horas Extra Diurnas (HED): ${employeeContext.novedadesIngresadas?.horasExtraDiurnas || 0} horas
- Horas Extra Nocturnas (HEN): ${employeeContext.novedadesIngresadas?.horasExtraNocturnas || 0} horas
- Recargos Dominicales/Festivos: ${employeeContext.novedadesIngresadas?.recargosDominicales || 0} horas
- Bonos no salariales / Auxilios: $${Number(employeeContext.novedadesIngresadas?.bonoNoSalarial || 0).toLocaleString('es-CO')} COP
- Deducciones particulares (préstamos, adelantos, consumos): $${Number(employeeContext.novedadesIngresadas?.deduccionesAdicionales || 0).toLocaleString('es-CO')} COP`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: userMessage,
        config: {
          systemInstruction,
          temperature: 0.2
        }
      });

      return res.json({
        success: true,
        text: response.text
      });
    } catch (error: any) {
      console.error("Error en /api/gemini/laboral:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Ocurrió un error al procesar la solicitud con IA."
      });
    }
  });

  // ---- INTEGRACIÓN CANALES: JUSTO V3 (/ecommerce/orders) ----
  // Corte horario oficial: 4:00am a 4:00am Bogotá (09:00 UTC a 09:00 UTC día siguiente)
  app.get("/api/canales/justo/ventas", async (req, res) => {
    try {
      const localId = (req.query.localId || req.query.local_id) as string;
      const fecha = (req.query.fecha as string) || new Date().toISOString().split("T")[0];

      if (!localId || !fecha) {
        return res.status(400).json({ success: false, error: "localId y fecha son requeridos" });
      }

      const { data: local, error: localError } = await supabaseAdmin
        .from("locales")
        .select("justo_store_id")
        .eq("id", localId)
        .single();

      if (localError || !local?.justo_store_id) {
        return res.json({ configurado: false });
      }

      const storeId = local.justo_store_id;
      const justoToken = process.env.JUSTO_API_TOKEN;
      if (!justoToken) {
        return res.json({ configurado: false });
      }

      // Regla de corte 4:00am a 4:00am hora Bogotá = 09:00:00Z a 09:00:00Z (UTC-5 sin DST)
      const dia = new Date(`${fecha}T00:00:00.000Z`);
      const diaSiguiente = new Date(dia);
      diaSiguiente.setUTCDate(dia.getUTCDate() + 1);

      const fromDate = `${dia.toISOString().slice(0, 10)}T09:00:00.000Z`;
      const toDate = `${diaSiguiente.toISOString().slice(0, 10)}T09:00:00.000Z`;

      let totalVentas = 0;
      let cantidadOrdenes = 0;
      let sobranteEfectivoDespacho = 0;
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 25) {
        const url = new URL("https://api.service.getjusto.com/v3/ecommerce/orders");
        url.searchParams.set("storeId", storeId);
        url.searchParams.set("fromDate", fromDate);
        url.searchParams.set("toDate", toDate);
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", "50");

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${justoToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (page === 1) {
            const errText = await response.text();
            console.warn(`[Justo API] Error (${response.status}):`, errText);
            return res.status(response.status).json({ success: false, error: errText });
          }
          break;
        }

        const data = await response.json();
        const orders: any[] = Array.isArray(data.orders)
          ? data.orders
          : (Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []));

        if (orders.length === 0) {
          hasMore = false;
          break;
        }

        for (const order of orders) {
          cantidadOrdenes += 1;
          const orderTotal = Number(
            order.itemsPriceBeforeDiscountsAfterProductDiscount ??
            order.totalVentas ??
            order.total ??
            0
          );
          totalVentas += orderTotal;

          const isCash = order.paymentType === "cash" || order.payment_method === "cash" || order.metodo_pago === "efectivo";
          if (isCash) {
            sobranteEfectivoDespacho += Number(order.deliveryFee ?? order.delivery_cash ?? order.sobranteEfectivoDespacho ?? 0);
          }
        }

        if (data.totalCount && cantidadOrdenes >= data.totalCount) {
          hasMore = false;
        } else if (data.pagination && page >= (data.pagination.totalPages || data.pagination.pages || 1)) {
          hasMore = false;
        } else if (orders.length < 50) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return res.json({
        configurado: true,
        totalVentas,
        cantidadOrdenes,
        sobranteEfectivoDespacho,
      });
    } catch (error: any) {
      console.error("Error en /api/canales/justo/ventas:", error);
      return res.status(500).json({ success: false, error: error?.message || "Error interno de Justo" });
    }
  });

  // ---- INTEGRACIÓN CANALES: INTUIPOS (GetTransactionsByPayment) ----
  // GET /api/canales/intuipos/ventas?localId=<uuid>&fecha=YYYY-MM-DD
  app.get("/api/canales/intuipos/ventas", async (req, res) => {
    try {
      const localId = (req.query.localId || req.query.local_id) as string;
      const fecha = req.query.fecha as string;
      if (!localId || !fecha) {
        return res.status(400).json({ success: false, error: "localId y fecha son requeridos" });
      }

      const { data: local } = await supabaseAdmin
        .from("locales")
        .select("intuipos_store_id")
        .eq("id", localId)
        .single();

      const storeId = local?.intuipos_store_id || process.env.INTUIPOS_STORE_ID || "21401";
      const apiKey = process.env.INTUIPOS_TOKEN || process.env.INTUIPOS_API_KEY;
      if (!apiKey) {
        return res.json({ configurado: false, razon: "Falta INTUIPOS_TOKEN en variables de entorno" });
      }

      const dtFechaInicial = `${fecha}T04:00:00`;
      const diaSiguiente = new Date(`${fecha}T00:00:00.000Z`);
      diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);
      const dtFechaFinal = `${diaSiguiente.toISOString().slice(0, 10)}T04:00:00`;

      const url = new URL(`https://webapi.intuipos.net/api/v1/Reports/GetTransactionsByPayment`);
      url.searchParams.set("iPuntoDeVentaID", String(storeId));
      url.searchParams.set("dtFechaInicial", dtFechaInicial);
      url.searchParams.set("dtFechaFinal", dtFechaFinal);

      const resp = await fetch(url.toString(), {
        headers: {
          ApiKey: apiKey,
          StoreId: String(storeId),
        },
      });

      if (!resp.ok) {
        console.warn(`IntuiPOS API respondió con estado ${resp.status}`);
        return res.status(resp.status).json({ success: false, error: `IntuiPOS error HTTP ${resp.status}` });
      }

      const items: any[] = await resp.json();

      if (!Array.isArray(items)) {
        return res.status(502).json({ success: false, error: "Respuesta inesperada de IntuiPOS" });
      }

      let efectivoPOS = 0;
      let justoPOS = 0;          // CUENTAS x COBRAR con DocumentType "CxC JUSTO"
      let rappiPOS = 0;          // CUENTAS x COBRAR con DocumentType "CxC RAPPI"
      let tcreditoCredit = 0;
      let tdebitoCredit = 0;
      let tcreditoDebit = 0;
      let tdebitoDebit = 0;
      let otherTransferCredit = 0;
      let otherTransferDebit = 0;

      for (const row of items) {
        // Excluir movimientos administrativos de caja (apertura de base y cierre de caja)
        const trxType = (row.TransactionType || "").toString().trim().toUpperCase();
        if (trxType === "BASE-INICIO CAJA" || trxType === "CIERRE DE CAJA") continue;

        // Solo procesar registros activos
        if (row.PaymentDetailStatus !== "Activo") continue;

        const credit = Number(row.dCredit) || 0;
        const debit = Number(row.dDebit) || 0;
        const tipo = Number(row.tiPaymentTypeID);
        const paymentTypeStr = (row.PaymentType || "").toString().trim().toUpperCase();
        const docTypeStr = (row.DocumentType || "").toString().trim().toUpperCase();

        // 1. EFECTIVO CAJA
        if (paymentTypeStr === "EFECTIVO CAJA" || tipo === 1) {
          efectivoPOS += (credit - debit);
        }
        // 2. CUENTAS x COBRAR -> CxC JUSTO
        else if (docTypeStr === "CXC JUSTO" || (paymentTypeStr.includes("CUENTAS") && docTypeStr.includes("JUSTO"))) {
          justoPOS += (credit - debit);
        }
        // 3. CUENTAS x COBRAR -> CxC RAPPI
        else if (docTypeStr === "CXC RAPPI" || (paymentTypeStr.includes("CUENTAS") && docTypeStr.includes("RAPPI"))) {
          rappiPOS += (credit - debit);
        }
        // 4. TRANSFERENCIAS POS: (TCREDITO + TDEBITO) - (dDebit facturas debitadas)
        else if (paymentTypeStr === "TCREDITO" || tipo === 2) {
          tcreditoCredit += credit;
          tcreditoDebit += debit;
        } else if (paymentTypeStr === "TDEBITO" || tipo === 3) {
          tdebitoCredit += credit;
          tdebitoDebit += debit;
        } else if (paymentTypeStr === "TRANSFERENCIA" || paymentTypeStr === "NEQUI" || paymentTypeStr === "PSE" || tipo === 13 || tipo === 83) {
          otherTransferCredit += credit;
          otherTransferDebit += debit;
        }
      }

      // Transferencias POS = (TCREDITO + TDEBITO) - (dDebit de facturas debitadas)
      const transferenciasPOS = Math.round(
        (tcreditoCredit + tdebitoCredit + otherTransferCredit) - (tcreditoDebit + tdebitoDebit + otherTransferDebit)
      );

      // Tarjetas / datáfonos: según especificación, no se toma directamente como resultado
      // de conciliación automática sino mediante confirmación manual (vouchers / datáfono físico).
      const tarjetasPOS = 0;

      return res.json({
        configurado: true,
        efectivoPOS: Math.round(efectivoPOS),
        tarjetasPOS,
        justoPOS: Math.round(justoPOS),
        rappiPOS: Math.round(rappiPOS),
        transferenciasPOS,
        totalTcredito: Math.round(tcreditoCredit - tcreditoDebit),
        totalTdebito: Math.round(tdebitoCredit - tdebitoDebit),
      });
    } catch (error: any) {
      console.error("Error en /api/canales/intuipos/ventas:", error);
      return res.status(500).json({ success: false, error: error?.message || "Error interno" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();