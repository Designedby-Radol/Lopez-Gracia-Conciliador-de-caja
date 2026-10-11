/**
 * Cliente de SOLO LECTURA de la API de IntuiPOS para el módulo de inventario.
 * Solo GET: nunca llamar a InsertInventoryTransaction, UpdateTransactionStatus ni
 * InsertSupplier (escriben en el POS real).
 *
 * Cabeceras: ApiKey (INTUIPOS_TOKEN) y StoreId = intuipos_store_id del local. El punto
 * de venta y la bodega consultados van en la ruta (pueden ser de otro local).
 */
import { supabaseAdmin } from "./supabase";
import { BOGOTA_TZ, daysInMonth, toBogotaIsoDate, todayBogota } from "../src/lib/dates";
import {
  TIPO_APERTURA,
  corteFinDia,
  corteInicioDia,
  esFechaIso,
  mapConcurrente,
  mapMovimiento,
  obtenerEncabezadosCompletos,
  partirRangoPorMes,
  type BodegaPOS,
  type ConsultaExistencias,
  type MovimientoPOS,
  type PosBodegaRow,
  type PosCostoVentaRow,
  type PosDetalleRow,
  type PosEncabezadoRow,
  type PosExistenciaRow,
  type PosPuntoDeVentaRow,
} from "../src/lib/inventarioPos";

const BASE = "https://webapi.intuipos.net/api/v1";
const TIMEOUT_MS = 25_000;
const MAX_CACHE = 1000;
const TTL_CORTO = 60_000;
const TTL_LARGO = 10 * 60_000;
const TTL_CONFIG = 60 * 60_000;
const DIA_MS = 86_400_000;
const CONCURRENCIA_DETALLES = 6;

export class PosError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "PosError";
    this.status = status;
  }
}

export type PosLocal =
  | { configurado: false; razon: string }
  | { configurado: true; storeId: string; bodega: BodegaPOS };

export type BodegaListadaPOS = BodegaPOS & { puntoDeVentaNombre: string };

const tokenPos = () => process.env.INTUIPOS_TOKEN || process.env.INTUIPOS_API_KEY || "";
const texto = (s: unknown) => String(s ?? "").trim();
/** "2026-10-09T19:39:48.47" → "2026-10-09T19:39:48" (comparable como texto). */
const aTimestamp = (s: unknown) => texto(s).replace(" ", "T").slice(0, 19);

// ---------------------------------------------------------------------------
// Validación de lo que va en la ruta (evita inyectar segmentos o parámetros)
// ---------------------------------------------------------------------------

const ENTERO_POSITIVO = /^[1-9]\d{0,11}$/;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const PERIODO = /^\d{4}(0[1-9]|1[0-2])$/;

function idValido(v: unknown, campo: string): string {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!ENTERO_POSITIVO.test(s)) throw new PosError(`Parámetro inválido para IntuiPOS: ${campo}.`, 400);
  return s;
}

function timestampValido(v: unknown, campo: string): string {
  const m = typeof v === "string" ? TIMESTAMP.exec(v) : null;
  if (!m || !esFechaIso(m[1])) throw new PosError(`Parámetro inválido para IntuiPOS: ${campo}.`, 400);
  return v as string;
}

function fechaValida(v: unknown, campo: string): string {
  if (!esFechaIso(v)) throw new PosError(`Parámetro inválido para IntuiPOS: ${campo}.`, 400);
  return v;
}

function periodoValido(v: unknown): string {
  if (typeof v !== "string" || !PERIODO.test(v)) throw new PosError("Parámetro inválido para IntuiPOS: periodo.", 400);
  return v;
}

const formatoHora = new Intl.DateTimeFormat("en-GB", {
  timeZone: BOGOTA_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Hora local de Bogotá "YYYY-MM-DDTHH:mm:ss", desplazada `ms` (negativo = pasado). */
function ahoraLocal(ms = 0): string {
  const d = new Date(Date.now() + ms);
  return `${toBogotaIsoDate(d)}T${formatoHora.format(d)}`;
}

// ---------------------------------------------------------------------------
// GET con caché en memoria
// ---------------------------------------------------------------------------

interface EntradaCache {
  expira: number;
  promesa: Promise<unknown>;
}
const cache = new Map<string, EntradaCache>();

/** Solo para pruebas. */
export function limpiarCachePos() {
  cache.clear();
}

async function pedir(ruta: string, storeId: string): Promise<unknown> {
  const apiKey = tokenPos();
  if (!apiKey) throw new PosError("Falta INTUIPOS_TOKEN en variables de entorno", 500);
  let resp: Response;
  try {
    resp = await fetch(BASE + ruta, {
      headers: { ApiKey: apiKey, StoreId: storeId },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const tiempo = (e as { name?: string })?.name === "TimeoutError";
    throw new PosError(tiempo ? "IntuiPOS no respondió a tiempo." : "No se pudo conectar con IntuiPOS.", 504);
  }
  if (!resp.ok) {
    void resp.body?.cancel().catch(() => {});
    console.warn(`[IntuiPOS] HTTP ${resp.status} en ${ruta.split("?")[0]}`);
    throw new PosError(`IntuiPOS respondió HTTP ${resp.status}`, resp.status);
  }
  try {
    return await resp.json();
  } catch (e) {
    // El mismo timeout también corta la lectura del cuerpo: es lentitud, no un formato raro.
    const nombre = (e as { name?: string })?.name;
    if (nombre === "TimeoutError" || nombre === "AbortError") throw new PosError("IntuiPOS no respondió a tiempo.", 504);
    throw new PosError("IntuiPOS devolvió una respuesta que no es JSON.", 502);
  }
}

/**
 * GET a IntuiPOS. Guarda la promesa (dos peticiones simultáneas comparten una sola
 * llamada), la descarta si falla y conserva como máximo MAX_CACHE entradas.
 */
export function intuiposGet<T>(ruta: string, storeId: string, ttlMs: number): Promise<T> {
  const tienda = idValido(storeId, "StoreId");
  const clave = `${tienda}|${ruta}`;
  const ahora = Date.now();
  const previa = cache.get(clave);
  if (previa && previa.expira > ahora) return previa.promesa as Promise<T>;
  cache.delete(clave);

  const entrada: EntradaCache = { expira: ahora + ttlMs, promesa: pedir(ruta, tienda) };
  cache.set(clave, entrada);
  entrada.promesa.catch(() => {
    if (cache.get(clave) === entrada) cache.delete(clave);
  });
  if (cache.size > MAX_CACHE) {
    const masVieja = cache.keys().next().value;
    if (masVieja !== undefined) cache.delete(masVieja);
  }
  return entrada.promesa as Promise<T>;
}

/** true si la ruta tiene una entrada vigente en caché (ya resuelta o en curso). */
function enCache(ruta: string, storeId: string): boolean {
  const previa = cache.get(`${storeId.trim()}|${ruta}`);
  return previa !== undefined && previa.expira > Date.now();
}

/** GET que debe devolver una lista. Devuelve una copia: el arreglo en caché no se modifica. */
async function lista<T>(ruta: string, storeId: string, ttlMs: number): Promise<T[]> {
  const json = await intuiposGet<unknown>(ruta, storeId, ttlMs);
  if (json === null) return [];
  if (!Array.isArray(json)) {
    cache.delete(`${storeId.trim()}|${ruta}`);
    throw new PosError("Respuesta inesperada de IntuiPOS.", 502);
  }
  return [...json] as T[];
}

const puntosDeVenta = (storeId: string) =>
  lista<PosPuntoDeVentaRow>("/Configuration/GetPuntosDeVenta", storeId, TTL_CONFIG);
const bodegasPos = (storeId: string) => lista<PosBodegaRow>("/Configuration/GetWarehouses", storeId, TTL_CONFIG);

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Punto de venta y bodega de IntuiPOS de un local de Supabase. */
export async function resolverPosLocal(localId: string): Promise<PosLocal> {
  const { data, error } = await supabaseAdmin.from("locales").select("intuipos_store_id").eq("id", localId).maybeSingle();
  if (error) throw new Error(`No se pudo leer el local: ${error.message}`);
  if (!data) return { configurado: false, razon: "El local no existe" };

  const storeId = texto(data.intuipos_store_id || process.env.INTUIPOS_STORE_ID);
  if (!storeId) return { configurado: false, razon: "El local no tiene intuipos_store_id configurado" };
  if (!tokenPos()) return { configurado: false, razon: "Falta INTUIPOS_TOKEN en variables de entorno" };
  if (!ENTERO_POSITIVO.test(storeId)) return { configurado: false, razon: "El intuipos_store_id del local no es válido" };

  const pdv = (await puntosDeVenta(storeId)).find((p) => String(p.iPuntoDeVentaID) === storeId);
  if (!pdv || !pdv.iWareHouseIDDefault) {
    return { configurado: false, razon: `El punto de venta ${storeId} no existe en IntuiPOS o no tiene bodega asignada` };
  }
  const bodegaId = pdv.iWareHouseIDDefault;
  const fila = (await bodegasPos(storeId)).find((b) => b.iWareHouseID === bodegaId);
  return {
    configurado: true,
    storeId,
    bodega: { id: bodegaId, nombre: texto(fila?.vName) || `Bodega ${bodegaId}`, puntoDeVentaId: pdv.iPuntoDeVentaID },
  };
}

/** Bodegas activas y no virtuales de la empresa, con el nombre de su punto de venta. */
export async function listarBodegas(storeId: string): Promise<BodegaListadaPOS[]> {
  const [pdvs, bodegas] = await Promise.all([puntosDeVenta(storeId), bodegasPos(storeId)]);
  const nombrePdv = new Map(pdvs.map((p) => [p.iPuntoDeVentaID, texto(p.vName)]));
  return bodegas
    .filter((b) => b.tiStatusID === 1 && !b.bIsVirtual)
    .map((b) => ({
      id: b.iWareHouseID,
      nombre: texto(b.vName),
      puntoDeVentaId: b.iPuntoDeVentaID,
      puntoDeVentaNombre: nombrePdv.get(b.iPuntoDeVentaID) ?? "",
    }))
    .sort((a, b) => a.puntoDeVentaId - b.puntoDeVentaId || a.id - b.id);
}

/** Existencias, costo y catálogo de una bodega al corte indicado. */
export async function obtenerExistencias(storeId: string, bodega: BodegaPOS, consulta: ConsultaExistencias): Promise<PosExistenciaRow[]> {
  const ruta =
    `/Inventory/GetInventoryByItem/${idValido(bodega.id, "bodega")}/${periodoValido(consulta.periodo)}` +
    `/${idValido(bodega.puntoDeVentaId, "punto de venta")}?dtFechaDeCorte=${timestampValido(consulta.corte, "corte")}`;
  // Un corte de hoy en adelante todavía cambia con cada venta.
  const ttl = consulta.corte >= corteInicioDia(todayBogota()) ? TTL_CORTO : TTL_LARGO;
  return lista<PosExistenciaRow>(ruta, storeId, ttl);
}

/**
 * true si el periodo aún no tiene la apertura (26) antes del corte: el cierre mensual
 * no se ha corrido en IntuiPOS y las existencias solo suman los movimientos del mes.
 */
export async function verificarApertura(storeId: string, pdv: number, periodo: string, corte: string): Promise<boolean> {
  const p = periodoValido(periodo);
  const limite = timestampValido(corte, "corte");
  const mes = `${p.slice(0, 4)}-${p.slice(4)}`;
  const ultimo = `${mes}-${String(daysInMonth(Number(p.slice(0, 4)), Number(p.slice(4)))).padStart(2, "0")}`;
  const ruta =
    `/Inventory/GetInventoryTransactionsHeaders/${idValido(pdv, "punto de venta")}/${TIPO_APERTURA}` +
    `/${mes}-01T00:00:00/${corteFinDia(ultimo)}`;
  const rows = await lista<PosEncabezadoRow>(ruta, storeId, TTL_LARGO);
  return !rows.some((r) => r.tiStatusID === 1 && aTimestamp(r.dtDate) < limite);
}

/**
 * Movimientos con detalle en [desde, hasta) (timestamps locales). Parte el rango si
 * IntuiPOS corta en 500 encabezados; `truncado` avisa si aun así pudo faltar alguno.
 */
export async function obtenerMovimientos(
  storeId: string,
  pdv: number,
  tipos: number[],
  desde: string,
  hasta: string,
): Promise<{ movimientos: MovimientoPOS[]; truncado: boolean }> {
  const punto = idValido(pdv, "punto de venta");
  const listaTipos = tipos.map((t) => idValido(t, "tipo de movimiento")).join(",");
  timestampValido(desde, "desde");
  timestampValido(hasta, "hasta");
  if (!listaTipos || desde >= hasta) return { movimientos: [], truncado: false };

  const ttl = hasta > ahoraLocal(-DIA_MS) ? TTL_CORTO : TTL_LARGO;
  const { rows, truncado } = await obtenerEncabezadosCompletos(
    (a, b) =>
      lista<PosEncabezadoRow>(
        `/Inventory/GetInventoryTransactionsHeaders/${punto}/${listaTipos}/${timestampValido(a, "desde")}/${timestampValido(b, "hasta")}`,
        storeId,
        ttl,
      ),
    desde,
    hasta,
  );
  const enRango = rows.filter((h) => {
    const t = aTimestamp(h.dtDate);
    return t >= desde && t < hasta;
  });
  const movimientos = await mapConcurrente(enRango, CONCURRENCIA_DETALLES, async (h) => {
    const ruta = `/Inventory/GetInventoryTransactionDetails/${idValido(h.biTransactionID, "transacción")}/${punto}`;
    return mapMovimiento(h, await lista<PosDetalleRow>(ruta, storeId, TTL_LARGO));
  });
  return { movimientos, truncado };
}

/**
 * IntuiPOS mezcla dos ejecuciones simultáneas de GetSalesByItemVsItemCost (aun de rangos
 * o periodos distintos): el costo sale duplicado. Comprobado oct-2026: en secuencia el costo es
 * estable; en paralelo, x2. Por eso este reporte se pide de a uno en todo el proceso.
 */
let colaReporteCosto: Promise<unknown> = Promise.resolve();

/** Pone `fn` en la cola del reporte. Si `signal` se aborta mientras espera turno, no se ejecuta. */
function enColaReporteCosto<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const turno = colaReporteCosto.then(() => {
    if (signal?.aborted) throw new PosError("Consulta cancelada: el cliente cerró la conexión.", 499);
    return fn();
  });
  colaReporteCosto = turno.catch(() => undefined);
  return turno;
}

/**
 * Reporte de ventas vs. costo por producto, una consulta por mes del rango (fechas YYYY-MM-DD).
 * Lo que ya está en caché (o en curso) no espera turno: no vuelve a ejecutar el reporte.
 * `signal`: la ruta lo aborta si el cliente se desconecta, para descartar los tramos aún en cola.
 */
export async function obtenerCostoVentas(
  storeId: string,
  bodega: BodegaPOS,
  desde: string,
  hasta: string,
  signal?: AbortSignal,
): Promise<PosCostoVentaRow[]> {
  const bod = idValido(bodega.id, "bodega");
  const pdv = idValido(bodega.puntoDeVentaId, "punto de venta");
  const tramos = partirRangoPorMes(fechaValida(desde, "desde"), fechaValida(hasta, "hasta"));
  const reciente = ahoraLocal(-DIA_MS);
  const filas: PosCostoVentaRow[] = [];
  for (const t of tramos) {
    const final = corteFinDia(t.hasta);
    const qs =
      `dtFechaInicial=${corteInicioDia(t.desde)}&dtFechaFinal=${final}&iPuntoDeVentaID=${pdv}` +
      `&iPeriodo=${periodoValido(t.periodo)}&iPuntoDeVentaIDPrecioTerminal=${pdv}&iWareHouseID=${bod}`;
    const ruta = `/Reports/GetSalesByItemVsItemCost?${qs}`;
    const pedirTramo = () => lista<PosCostoVentaRow>(ruta, storeId, final > reciente ? TTL_CORTO : TTL_LARGO);
    filas.push(...(await (enCache(ruta, storeId) ? pedirTramo() : enColaReporteCosto(pedirTramo, signal))));
  }
  return filas;
}
