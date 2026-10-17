import { Router, type Request, type Response } from "express";
import { isValidUUID } from "../supabase";
import { requireAuth, requireGerencia } from "../auth";
import { addDaysIso, startOfMonthIso, todayBogota } from "../../src/lib/dates";
import {
  MAX_DIAS_RANGO,
  TIPOS_DETALLADOS,
  TIPO_AJUSTE,
  agruparCostoVentas,
  calcularKardex,
  calcularTeoricoCuadre,
  consultaCierreDia,
  consultaInicioDia,
  corteFinDia,
  corteInicioDia,
  costoConsumoVentas,
  diasEntre,
  esFechaIso,
  mapCatalogoItem,
  mapExistencia,
  resumirExistencias,
  totalesConCosto,
  type BodegaPOS,
  type CategoriaMovimiento,
} from "../../src/lib/inventarioPos";
import {
  PosError,
  listarBodegas,
  obtenerCostoVentas,
  obtenerExistencias,
  obtenerMovimientos,
  resolverPosLocal,
  verificarApertura,
} from "../intuipos";

/** Inventario leído de IntuiPOS (solo lectura). */
export const inventarioPosRouter = Router();
inventarioPosRouter.use(requireAuth);

class ErrorValidacion extends Error {}

const ADVERTENCIA_TRUNCADO =
  "IntuiPOS devolvió el máximo de movimientos en un tramo de un minuto; algunos movimientos pueden faltar.";

const ADVERTENCIA_COSTO_REPORTE =
  "El costo total se toma del reporte de IntuiPOS (solo productos con venta): no incluye empaques ni artículos entregados sin precio.";

const advertenciaApertura = (periodo: string) =>
  `IntuiPOS aún no tiene la apertura del periodo ${periodo} (cierre mensual de inventario pendiente); las existencias teóricas no son confiables.`;

const round2 = (n: number) => Math.round(n * 100) / 100;

const porGrupoYNombre = <T extends { grupo: string; nombre: string }>(a: T, b: T) =>
  a.grupo.localeCompare(b.grupo, "es") || a.nombre.localeCompare(b.nombre, "es");

/** Gerencia puede consultar otro local con local_id; los demás, solo el suyo. */
function scopedLocalId(req: Request): string {
  const pedido = req.query.local_id;
  if (req.user!.isGerencia && pedido !== undefined && pedido !== "") {
    if (!isValidUUID(pedido)) throw new ErrorValidacion("local_id inválido.");
    return pedido.trim();
  }
  if (!req.user!.localId) throw new ErrorValidacion("El usuario no tiene un local asignado.");
  return req.user!.localId;
}

function fechaParam(v: unknown, nombre: string, defecto: string): string {
  if (v === undefined || v === "") return defecto;
  if (!esFechaIso(v)) throw new ErrorValidacion(`${nombre} debe ser una fecha válida (YYYY-MM-DD).`);
  return v;
}

/** Fecha de un solo día: por defecto hoy (Bogotá) y nunca futura. */
function fechaDiaParam(req: Request): string {
  const hoy = todayBogota();
  const fecha = fechaParam(req.query.fecha, "fecha", hoy);
  if (fecha > hoy) throw new ErrorValidacion("La fecha no puede ser futura.");
  return fecha;
}

function rangoParam(req: Request, desdePorDefecto: (hasta: string) => string): { desde: string; hasta: string } {
  const hoy = todayBogota();
  const hasta = fechaParam(req.query.hasta, "hasta", hoy);
  const desde = fechaParam(req.query.desde, "desde", desdePorDefecto(hasta));
  if (desde > hasta) throw new ErrorValidacion("La fecha inicial no puede ser posterior a la final.");
  if (hasta > hoy) throw new ErrorValidacion("La fecha final no puede ser futura.");
  if (diasEntre(desde, hasta) > MAX_DIAS_RANGO) throw new ErrorValidacion(`El rango máximo es de ${MAX_DIAS_RANGO} días.`);
  return { desde, hasta };
}

function bodegaIdParam(req: Request): number | null {
  const v = req.query.bodega_id;
  if (v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^[1-9]\d{0,11}$/.test(v)) throw new ErrorValidacion("bodega_id inválido.");
  return Number(v);
}

interface ContextoPos {
  storeId: string;
  bodegaLocal: BodegaPOS;
  bodega: BodegaPOS;
}

/**
 * Local → punto de venta y bodega de IntuiPOS. Si no está configurado responde
 * `configurado: false` y devuelve null. `bodegaId` (solo rutas de Gerencia) debe ser
 * una bodega activa de la empresa.
 */
async function contexto(req: Request, res: Response, bodegaId: number | null = null): Promise<ContextoPos | null> {
  const pos = await resolverPosLocal(scopedLocalId(req));
  if (pos.configurado === false) {
    res.json({ success: true, configurado: false, razon: pos.razon });
    return null;
  }
  let bodega = pos.bodega;
  if (bodegaId !== null && bodegaId !== pos.bodega.id) {
    const encontrada = (await listarBodegas(pos.storeId)).find((b) => b.id === bodegaId);
    if (!encontrada) throw new ErrorValidacion("La bodega no existe o no está activa en IntuiPOS.");
    bodega = { id: encontrada.id, nombre: encontrada.nombre, puntoDeVentaId: encontrada.puntoDeVentaId };
  }
  return { storeId: pos.storeId, bodegaLocal: pos.bodega, bodega };
}

function manejar(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (res.headersSent) return;
      if (e instanceof ErrorValidacion) return void res.status(400).json({ success: false, error: e.message });
      if (e instanceof PosError) return void res.status(502).json({ success: false, error: e.message });
      console.error(`Error en /api/inventario-pos${req.path}:`, e);
      res.status(500).json({ success: false, error: "Error interno al consultar el inventario de IntuiPOS." });
    }
  };
}

/** Catálogo de insumos de la bodega del local (sin cantidades ni costos). */
inventarioPosRouter.get(
  "/catalogo",
  manejar(async (req, res) => {
    const ctx = await contexto(req, res);
    if (!ctx) return;
    const rows = await obtenerExistencias(ctx.storeId, ctx.bodega, consultaCierreDia(todayBogota()));
    res.json({ success: true, configurado: true, bodega: ctx.bodega, items: rows.map(mapCatalogoItem).sort(porGrupoYNombre) });
  }),
);

inventarioPosRouter.get(
  "/bodegas",
  requireGerencia,
  manejar(async (req, res) => {
    const ctx = await contexto(req, res);
    if (!ctx) return;
    res.json({ success: true, configurado: true, bodegaLocal: ctx.bodegaLocal, bodegas: await listarBodegas(ctx.storeId) });
  }),
);

/** Existencias teóricas y valorizadas al cierre del día comercial. */
inventarioPosRouter.get(
  "/existencias",
  requireGerencia,
  manejar(async (req, res) => {
    const fecha = fechaDiaParam(req);
    const ctx = await contexto(req, res, bodegaIdParam(req));
    if (!ctx) return;
    const consulta = consultaCierreDia(fecha);
    const [rows, aperturaPendiente] = await Promise.all([
      obtenerExistencias(ctx.storeId, ctx.bodega, consulta),
      verificarApertura(ctx.storeId, ctx.bodega.puntoDeVentaId, consulta.periodo, consulta.corte),
    ]);
    const items = rows.map(mapExistencia).sort(porGrupoYNombre);
    res.json({
      success: true,
      configurado: true,
      bodega: ctx.bodega,
      fecha,
      periodo: consulta.periodo,
      corte: consulta.corte,
      aperturaPendiente,
      advertencias: aperturaPendiente ? [advertenciaApertura(consulta.periodo)] : [],
      items,
      resumen: resumirExistencias(items),
    });
  }),
);

/**
 * Existencias inicial y final, movimientos detallados y kardex de los días comerciales
 * [desde, hasta]. Si falta la apertura de algún periodo, el kardex va sin ventas calculadas.
 */
async function kardexDelRango(ctx: ContextoPos, desde: string, hasta: string) {
  const pdv = ctx.bodega.puntoDeVentaId;
  const ini = consultaInicioDia(desde);
  const fin = consultaCierreDia(hasta);
  const [{ movimientos, truncado }, inicial, final, pendienteIni, pendienteFin] = await Promise.all([
    obtenerMovimientos(ctx.storeId, pdv, TIPOS_DETALLADOS, corteInicioDia(desde), corteFinDia(hasta)),
    obtenerExistencias(ctx.storeId, ctx.bodega, ini),
    obtenerExistencias(ctx.storeId, ctx.bodega, fin),
    verificarApertura(ctx.storeId, pdv, ini.periodo, ini.corte),
    verificarApertura(ctx.storeId, pdv, fin.periodo, fin.corte),
  ]);
  const periodosPendientes = [...new Set([pendienteIni ? ini.periodo : "", pendienteFin ? fin.periodo : ""].filter(Boolean))];
  let kardex = calcularKardex(inicial.map(mapExistencia), final.map(mapExistencia), movimientos);
  if (periodosPendientes.length > 0) kardex = kardex.map((k) => ({ ...k, ventasCalculadas: null }));
  return { movimientos, truncado, kardex, periodosPendientes };
}

/** Movimientos detallados y kardex del rango (las ventas se calculan por diferencia). */
inventarioPosRouter.get(
  "/movimientos",
  requireGerencia,
  manejar(async (req, res) => {
    const { desde, hasta } = rangoParam(req, (h) => addDaysIso(h, -6));
    const ctx = await contexto(req, res, bodegaIdParam(req));
    if (!ctx) return;
    const { movimientos, truncado, kardex, periodosPendientes } = await kardexDelRango(ctx, desde, hasta);

    const advertencias = periodosPendientes.map(advertenciaApertura);
    if (periodosPendientes.length > 0) {
      advertencias.push("Las ventas calculadas del kardex se omiten hasta que IntuiPOS registre la apertura del periodo.");
    }
    if (truncado) advertencias.push(ADVERTENCIA_TRUNCADO);

    const totalesPorCategoria: Partial<Record<CategoriaMovimiento, { movimientos: number; valor: number }>> = {};
    for (const m of movimientos) {
      if (m.anulado) continue;
      const t = (totalesPorCategoria[m.categoria] ??= { movimientos: 0, valor: 0 });
      t.movimientos += 1;
      t.valor = round2(t.valor + m.valorTotal);
    }

    res.json({ success: true, configurado: true, bodega: ctx.bodega, desde, hasta, movimientos, kardex, totalesPorCategoria, advertencias });
  }),
);

/** Teórico para cuadrar el conteo físico de un día (siempre la bodega del local). */
inventarioPosRouter.get(
  "/cuadre",
  requireGerencia,
  manejar(async (req, res) => {
    const fecha = fechaDiaParam(req);
    const ctx = await contexto(req, res);
    if (!ctx) return;
    const pdv = ctx.bodega.puntoDeVentaId;
    const consulta = consultaCierreDia(fecha);
    const [rows, ajustes, aperturaPendiente] = await Promise.all([
      obtenerExistencias(ctx.storeId, ctx.bodega, consulta),
      obtenerMovimientos(ctx.storeId, pdv, [TIPO_AJUSTE], corteInicioDia(fecha), corteFinDia(fecha)),
      verificarApertura(ctx.storeId, pdv, consulta.periodo, consulta.corte),
    ]);
    const advertencias = aperturaPendiente ? [advertenciaApertura(consulta.periodo)] : [];
    if (ajustes.truncado) advertencias.push(ADVERTENCIA_TRUNCADO);
    res.json({
      success: true,
      configurado: true,
      bodega: ctx.bodega,
      fecha,
      corte: consulta.corte,
      aperturaPendiente,
      advertencias,
      items: calcularTeoricoCuadre(rows.map(mapExistencia).sort(porGrupoYNombre), ajustes.movimientos),
    });
  }),
);

/**
 * Costo de ventas por producto (reporte de IntuiPOS, un tramo por mes). El costo total
 * sale del consumo de inventario por ventas (kardex): el reporte repite el costo de los
 * componentes de combos en filas con venta $0 y no distingue los empaques regalados.
 * Si el kardex no es confiable, se usa el costo del reporte de los productos con venta.
 */
inventarioPosRouter.get(
  "/costo-ventas",
  requireGerencia,
  manejar(async (req, res) => {
    const { desde, hasta } = rangoParam(req, startOfMonthIso);
    const ctx = await contexto(req, res, bodegaIdParam(req));
    if (!ctx) return;
    // Si el cliente se va, los tramos que aún esperan en la cola del reporte se descartan.
    const cancelada = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) cancelada.abort();
    });
    const filas = await obtenerCostoVentas(ctx.storeId, ctx.bodega, desde, hasta, cancelada.signal);
    if (cancelada.signal.aborted) return;
    const { items, totales } = agruparCostoVentas(filas);

    // En secuencia (no junto al reporte): IntuiPOS ya mostró que mezcla consultas simultáneas del reporte.
    const advertencias: string[] = [];
    let costoInventario: number | null = null;
    try {
      const k = await kardexDelRango(ctx, desde, hasta);
      advertencias.push(...k.periodosPendientes.map(advertenciaApertura));
      if (k.truncado) advertencias.push(ADVERTENCIA_TRUNCADO);
      else costoInventario = costoConsumoVentas(k.kardex);
    } catch (e) {
      if (!(e instanceof PosError)) throw e;
      advertencias.push(`No se pudo calcular el consumo de inventario: ${e.message}`);
    }
    if (costoInventario === null) advertencias.push(ADVERTENCIA_COSTO_REPORTE);

    res.json({
      success: true,
      configurado: true,
      bodega: ctx.bodega,
      desde,
      hasta,
      items,
      totales: costoInventario === null ? totales : totalesConCosto(totales, costoInventario),
      fuenteCosto: costoInventario === null ? "reporte" : "inventario",
      costoReporte: totales.costoTotal,
      advertencias,
    });
  }),
);
