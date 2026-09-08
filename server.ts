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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjbHR4dXRreHZoYWdibHZuc2N5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTc3MDcyNiwiZXhwIjoyMTAxMzQ2NzI2fQ.NkAvzfSSMAhzZg3OBhFUgR6PI9l5DfDZUMjfb-XD594";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
        return res.status(404).json({ success: false, error: "Usuario o documento no encontrado en el sistema." });
      }

      const localNombre = matched.locales?.nombre || "Chapinero";

      res.json({
        success: true,
        user: {
          id: matched.id,
          nombre: matched.nombre,
          cargo: matched.cargo,
          role: matched.role,
          local: localNombre
        }
      });
    } catch (err: any) {
      console.error("Error en POST /api/auth/login:", err);
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
      const { data, error } = await supabaseAdmin.from("usuarios").upsert(req.body, { onConflict: "id" }).select().single();
      if (error) throw error;
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
      const { data, error } = await supabaseAdmin.from("cierres_caja").insert(req.body).select().single();
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
      const { data, error } = await supabaseAdmin.from("cierres_caja").update(req.body).eq("id", id).select().single();
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

  // ---- INTEGRACIÓN POS: JUSTO (4.1) ----
  app.get("/api/pos/justo", async (req, res) => {
    try {
      const justoToken = process.env.JUSTO_API_TOKEN;
      if (!justoToken) {
        return res.status(503).json({
          status: "error",
          message: "Integración con Justo no configurada. Falta JUSTO_API_TOKEN en las variables de entorno."
        });
      }

      const fecha = (req.query.fecha as string) || new Date().toISOString().split("T")[0];
      const storeId = (req.query.store_id as string) || (req.query.local_id as string) || process.env.JUSTO_STORE_ID || "default";

      try {
        const response = await fetch(`https://api.getjusto.com/v1/orders?date=${fecha}&store_id=${storeId}`, {
          headers: {
            Authorization: `Bearer ${justoToken}`,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[Justo API] Respuesta no exitosa (${response.status}):`, errText);
          return res.status(response.status).json({
            status: "error",
            message: `Justo API error (${response.status}): ${errText}`
          });
        }

        const data = await response.json();
        const orders: any[] = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : []);

        let totalPedidosPos = 0;
        let sobranteEfectivoDespacho = 0;

        for (const order of orders) {
          totalPedidosPos += Number(order.total || order.amount || 0);
          if (order.payment_method === "cash" || order.metodo_pago === "efectivo") {
            sobranteEfectivoDespacho += Number(order.cash_surplus || order.delivery_cash || 0);
          }
        }

        return res.json({
          status: "ok",
          data: {
            total_pedidos_pos: totalPedidosPos,
            sobrante_efectivo_despacho: sobranteEfectivoDespacho,
            raw_count: orders.length
          }
        });
      } catch (fetchError: any) {
        console.error("Error al consultar API de Justo:", fetchError);
        return res.status(502).json({
          status: "error",
          message: `Fallo al comunicarse con Justo: ${fetchError?.message || "Error de red"}`
        });
      }
    } catch (error: any) {
      console.error("Error en /api/pos/justo:", error);
      return res.status(500).json({
        status: "error",
        message: error?.message || "Error interno al procesar pedidos de Justo."
      });
    }
  });

  // ---- INTEGRACIÓN POS: INTUIPOS (4.2) ----
  app.get("/api/pos/intuipos", async (req, res) => {
    try {
      const apiKey = process.env.INTUIPOS_API_KEY;
      const storeId = process.env.INTUIPOS_STORE_ID;

      if (!apiKey || !storeId) {
        return res.status(503).json({
          status: "error",
          message: "Integración con IntuiPOS no configurada. Falta INTUIPOS_API_KEY o INTUIPOS_STORE_ID en las variables de entorno."
        });
      }

      const fecha = (req.query.fecha as string) || new Date().toISOString().split("T")[0];

      try {
        const response = await fetch(`https://api.intuipos.com/v1/sales/summary?store_id=${storeId}&date=${fecha}`, {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[IntuiPOS API] Respuesta no exitosa (${response.status}):`, errText);
          return res.status(response.status).json({
            status: "error",
            message: `IntuiPOS API error (${response.status}): ${errText}`
          });
        }

        const data = await response.json();

        return res.json({
          status: "ok",
          data: {
            efectivo: Number(data.efectivo || data.cash || 0),
            datafono: Number(data.datafono || data.tarjetas || data.card || 0),
            justo: Number(data.justo || 0),
            rappi: Number(data.rappi || 0),
            transferencias: Number(data.transferencias || data.transfers || 0)
          }
        });
      } catch (fetchError: any) {
        console.error("Error al consultar API de IntuiPOS:", fetchError);
        return res.status(502).json({
          status: "error",
          message: `Fallo al comunicarse con IntuiPOS: ${fetchError?.message || "Error de red"}`
        });
      }
    } catch (error: any) {
      console.error("Error en /api/pos/intuipos:", error);
      return res.status(500).json({
        status: "error",
        message: error?.message || "Error interno al procesar ventas de IntuiPOS."
      });
    }
  });

  // ---- SINCRONIZACIÓN COMBINADA DE CIERRE (4.3) ----
  app.post("/api/pos/sync-closure", async (req, res) => {
    try {
      const { cierre_id, fecha, local_id } = req.body;

      if (!fecha) {
        return res.status(400).json({
          status: "error",
          message: "Parámetro 'fecha' requerido (formato YYYY-MM-DD)."
        });
      }

      const syncResult: any = {
        cierre_id,
        fecha,
        local_id,
        justo: null,
        intuipos: null,
        errors: []
      };

      // 1. Intentar sincronizar Justo si está configurado
      if (process.env.JUSTO_API_TOKEN) {
        try {
          const storeId = process.env.JUSTO_STORE_ID || local_id || "default";
          const justoRes = await fetch(`https://api.getjusto.com/v1/orders?date=${fecha}&store_id=${storeId}`, {
            headers: {
              Authorization: `Bearer ${process.env.JUSTO_API_TOKEN}`,
              "Content-Type": "application/json"
            }
          });
          if (justoRes.ok) {
            const data = await justoRes.json();
            const orders = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : []);
            let total = 0;
            let surplus = 0;
            orders.forEach((o: any) => {
              total += Number(o.total || o.amount || 0);
              if (o.payment_method === "cash" || o.metodo_pago === "efectivo") {
                surplus += Number(o.cash_surplus || o.delivery_cash || 0);
              }
            });
            syncResult.justo = {
              total_pedidos_pos: total,
              sobrante_efectivo_despacho: surplus,
              raw_count: orders.length
            };
          } else {
            syncResult.errors.push(`Justo status ${justoRes.status}`);
          }
        } catch (e: any) {
          syncResult.errors.push(`Justo error: ${e.message}`);
        }
      } else {
        syncResult.justo = { not_configured: true };
      }

      // 2. Intentar sincronizar IntuiPOS si está configurado
      if (process.env.INTUIPOS_API_KEY && process.env.INTUIPOS_STORE_ID) {
        try {
          const intuiRes = await fetch(`https://api.intuipos.com/v1/sales/summary?store_id=${process.env.INTUIPOS_STORE_ID}&date=${fecha}`, {
            headers: {
              "x-api-key": process.env.INTUIPOS_API_KEY,
              "Content-Type": "application/json"
            }
          });
          if (intuiRes.ok) {
            const data = await intuiRes.json();
            syncResult.intuipos = {
              efectivo: Number(data.efectivo || data.cash || 0),
              datafono: Number(data.datafono || data.tarjetas || data.card || 0),
              justo: Number(data.justo || 0),
              rappi: Number(data.rappi || 0),
              transferencias: Number(data.transferencias || data.transfers || 0)
            };
          } else {
            syncResult.errors.push(`IntuiPOS status ${intuiRes.status}`);
          }
        } catch (e: any) {
          syncResult.errors.push(`IntuiPOS error: ${e.message}`);
        }
      } else {
        syncResult.intuipos = { not_configured: true };
      }

      return res.json({
        status: "ok",
        data: syncResult
      });
    } catch (error: any) {
      console.error("Error en /api/pos/sync-closure:", error);
      return res.status(500).json({
        status: "error",
        message: error?.message || "Error al sincronizar cierre de caja con POS."
      });
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
