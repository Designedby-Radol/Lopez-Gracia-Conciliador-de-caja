import { Router, type Request } from "express";
import { supabaseAdmin, isValidUUID } from "../supabase";
import { requireAuth } from "../auth";
import { writeAudit } from "../audit";
import { aplanarAuxiliares } from "../cierreEquipo";
import { addDaysIso, startOfMonthIso, todayBogota } from "../../src/lib/dates";
import { cargoParticipaEnDescuadre } from "../../src/lib/discrepancy";
import {
  resumenPersonal,
  pendientesDelDia,
  panelPunto,
  esLiderOperador,
  esCargoPasteleria,
  type CierreFila,
  type ChecklistFila,
  type InventarioFila,
} from "../../src/lib/metricasEquipo";

/**
 * Datos personales del usuario de la sesión. El usuario sale SIEMPRE de la
 * cookie (req.user.sub), nunca de un parámetro: no hay forma de pedir los
 * datos de otra persona por esta vía.
 */
export const meRouter = Router();
meRouter.use(requireAuth);
// Descuadres y nómina no deben quedar en la caché del navegador ni de un proxy.
meRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, private");
  next();
});

const fail = (res: any, route: string, err: any, status = 500) => {
  console.error(`Error en ${route}:`, err);
  return res.status(status).json({ success: false, error: "Error interno del servidor." });
};

const META_VENTAS_DEFECTO = 10_000_000;
const DIAS_HISTORIAL = 365;

const CIERRE_COLUMNAS =
  "id, fecha, estado, colaborador_id, lider_id, efectivo_cierre, datafono_cierre, justo_cierre, rappi_cierre, " +
  "transferencias_cierre, propinas, dif_efectivo, dif_tarjetas, dif_justo, dif_rappi, dif_transferencias, " +
  "descuadre_lider, descuadre_auxiliar, auxiliares:cierre_auxiliares(usuario_id)";

async function cierresDelLocal(localId: string, desde: string): Promise<CierreFila[]> {
  const { data, error } = await supabaseAdmin
    .from("cierres_caja")
    .select(CIERRE_COLUMNAS)
    .eq("local_id", localId)
    .neq("estado", "Anulado")
    .gte("fecha", desde)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data || []).map(aplanarAuxiliares);
}

async function registrosDelLocal(localId: string, desde: string) {
  const { data, error } = await supabaseAdmin
    .from("registros_operativos")
    .select("tipo, fecha, usuario_id, data")
    .eq("local_id", localId)
    .gte("fecha", desde)
    .order("fecha", { ascending: false })
    .limit(3000);
  if (error) throw error;
  const filas = data || [];
  return {
    checklists: filas.filter((r: any) => r.tipo === "checklist") as ChecklistFila[],
    inventarios: filas.filter((r: any) => r.tipo === "inventario") as InventarioFila[],
  };
}

async function leerConfig<T>(key: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin.from("app_config").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

function inicioPeriodo(periodo: unknown, hoy: string): string {
  if (periodo === "mes") return startOfMonthIso(hoy);
  if (periodo === "90d") return addDaysIso(hoy, -89);
  // Por defecto, la quincena en curso: es como se liquida la nómina.
  return Number(hoy.slice(8, 10)) <= 15 ? startOfMonthIso(hoy) : `${hoy.slice(0, 8)}16`;
}

function perfil(req: Request) {
  const cargo = req.user!.cargo;
  return {
    nombre: req.user!.nombre,
    cargo,
    local: req.user!.local,
    participaDescuadre: cargoParticipaEnDescuadre(cargo),
    esLiderOperador: esLiderOperador(cargo),
    esPasteleria: esCargoPasteleria(cargo),
  };
}

// ---------------------------------------------------------------------------
// Resumen personal: Mi día + Mi desempeño
// ---------------------------------------------------------------------------
meRouter.get("/resumen", async (req, res) => {
  const user = req.user!;
  const hoy = todayBogota();
  if (!user.localId) return res.json({ success: true, data: { perfil: perfil(req), resumen: null, pendientes: null } });

  try {
    const desdeHistorial = addDaysIso(hoy, -DIAS_HISTORIAL);
    const [cierres, registros, catalogo] = await Promise.all([
      cierresDelLocal(user.localId, desdeHistorial),
      registrosDelLocal(user.localId, desdeHistorial),
      leerConfig<unknown[]>("inventario_catalogo"),
    ]);
    const p = perfil(req);
    const resumen = resumenPersonal({
      usuarioId: user.sub,
      participaDescuadre: p.participaDescuadre,
      cierres,
      checklists: registros.checklists,
      inventarios: registros.inventarios,
      catalogoSize: Array.isArray(catalogo) ? catalogo.length : 0,
      hoy,
      desde: inicioPeriodo(req.query.periodo, hoy),
    });
    const pendientes = pendientesDelDia({
      hoy,
      cierresLocal: cierres,
      checklistsLocal: registros.checklists,
      inventariosLocal: registros.inventarios,
    });
    res.json({ success: true, data: { perfil: p, resumen, pendientes } });
  } catch (err) {
    fail(res, "GET /me/resumen", err);
  }
});

// ---------------------------------------------------------------------------
// Panel del punto (solo Líder Operador)
// ---------------------------------------------------------------------------
meRouter.get("/punto", async (req, res) => {
  const user = req.user!;
  if (!esLiderOperador(user.cargo)) {
    return res.status(403).json({ success: false, error: "El panel del punto es solo para el Líder Operador." });
  }
  if (!user.localId) return res.status(400).json({ success: false, error: "El usuario no tiene un local asignado." });

  const hoy = todayBogota();
  try {
    // Mes actual + mes anterior completo (comparativo) + 60 días (promedio por día de la semana).
    const inicioMesAnterior = startOfMonthIso(addDaysIso(startOfMonthIso(hoy), -1));
    const hace60 = addDaysIso(hoy, -60);
    const desdeCierres = inicioMesAnterior < hace60 ? inicioMesAnterior : hace60;
    const [cierres, registros, equipo, meta] = await Promise.all([
      cierresDelLocal(user.localId, desdeCierres),
      registrosDelLocal(user.localId, addDaysIso(hoy, -30)),
      supabaseAdmin.from("usuarios").select("id, nombre, cargo, role").eq("local_id", user.localId).order("nombre"),
      leerConfig<number>("meta_ventas_mensual"),
    ]);
    if (equipo.error) throw equipo.error;
    const miembros = (equipo.data || []).filter(
      (u: any) => u.role !== "administrador" && !String(u.cargo || "").toLowerCase().includes("geren"),
    );
    const panel = panelPunto({
      hoy,
      metaMensual: Number(meta) > 0 ? Number(meta) : META_VENTAS_DEFECTO,
      cierresLocal: cierres,
      checklistsLocal: registros.checklists,
      inventariosLocal: registros.inventarios,
      equipo: miembros.map((u: any) => ({ id: u.id, nombre: u.nombre, cargo: u.cargo })),
    });
    res.json({ success: true, data: panel });
  } catch (err) {
    fail(res, "GET /me/punto", err);
  }
});

// ---------------------------------------------------------------------------
// Desprendibles publicados
// ---------------------------------------------------------------------------
meRouter.get("/desprendibles", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("desprendibles")
    .select("id, fecha_inicio, fecha_fin, quincena_nombre, version, neto, publicado_at")
    .eq("usuario_id", req.user!.sub)
    .eq("estado", "publicado")
    .order("fecha_fin", { ascending: false });
  if (error) return fail(res, "GET /me/desprendibles", error);
  res.json({ success: true, data: data || [] });
});

meRouter.get("/desprendibles/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ success: false, error: "ID inválido." });
  const { data, error } = await supabaseAdmin
    .from("desprendibles")
    .select("id, fecha_inicio, fecha_fin, quincena_nombre, version, datos, devengado, deducciones, neto, publicado_at")
    .eq("id", id)
    .eq("usuario_id", req.user!.sub)
    .eq("estado", "publicado")
    .maybeSingle();
  if (error) return fail(res, "GET /me/desprendibles/:id", error);
  // Mismo 404 si no existe o es de otra persona: no se revela cuál de los dos.
  if (!data) return res.status(404).json({ success: false, error: "Desprendible no encontrado." });
  await writeAudit(req, {
    action: "DESPRENDIBLE_CONSULTADO",
    targetUser: req.user!.nombre,
    description: `${data.quincena_nombre || `${data.fecha_inicio} a ${data.fecha_fin}`} (v${data.version})`,
  });
  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------
meRouter.get("/notificaciones", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("notificaciones")
    .select("id, tipo, titulo, mensaje, ref_tipo, ref_id, leida_at, created_at")
    .eq("usuario_id", req.user!.sub)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return fail(res, "GET /me/notificaciones", error);
  const lista = data || [];
  res.json({ success: true, data: { items: lista, noLeidas: lista.filter((n: any) => !n.leida_at).length } });
});

meRouter.post("/notificaciones/leer", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(isValidUUID).slice(0, 100) : null;
  let query = supabaseAdmin
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("usuario_id", req.user!.sub)
    .is("leida_at", null);
  if (ids) {
    if (ids.length === 0) return res.json({ success: true });
    query = query.in("id", ids);
  }
  const { error } = await query;
  if (error) return fail(res, "POST /me/notificaciones/leer", error);
  res.json({ success: true });
});
