/**
 * Inventario desde IntuiPOS: tipos, catálogo de movimientos y cálculos puros
 * (sin red ni DOM) compartidos por server/routes/inventarioPos.ts y la interfaz.
 *
 * Reglas de la API comprobadas contra el POS real (oct-2026):
 * - El día comercial va de 04:00 a 04:00 (hora Bogotá, sin zona en los textos).
 * - GetInventoryByItem(bodega, periodo YYYYMM, pdv, dtFechaDeCorte) suma los
 *   movimientos del periodo con fecha < corte. El periodo debe ser el mes del día
 *   comercial: el cierre mensual se registra como AJUSTE (27) el día 1 a las 03:59
 *   (periodo anterior) y la apertura (26) el día 1 a las 04:01 (periodo nuevo).
 * - GetInventoryTransactionsHeaders devuelve como máximo 500 filas.
 */
import { addDaysIso, daysInMonth, toBogotaIsoDate } from "./dates";

// ---------------------------------------------------------------------------
// Filas crudas de IntuiPOS (solo los campos que se usan)
// ---------------------------------------------------------------------------

/** GET /Inventory/GetInventoryByItem/{bodega}/{periodo}/{pdv}?dtFechaDeCorte= */
export interface PosExistenciaRow {
  iItemID: number;
  ItemName: string;
  GroupName: string;
  SubGroupName: string;
  tiItemRoleID: number; // 1 = Ingrediente, 0 = Item de venta
  MeasureUnit_Inventory: string;
  dMinQty: number;
  dMaxQty: number;
  dQuantity: number;
  mItemCost: number; // costo promedio unitario
  mTotal: number;
}

/** GET /Inventory/GetInventoryTransactionsHeaders/{pdv}/{tipos}/{desde}/{hasta} */
export interface PosEncabezadoRow {
  biTransactionID: number;
  tiTransactionTypeID: number;
  dtDate: string; // "2026-10-09T19:39:48.47" hora local
  tiStatusID: number; // 1 = activo; otro valor = anulado/cancelado
  vObservations: string | null;
  vTerminalID: string | null;
  biEmployeeID: number | null;
  iWareHouseID: number;
  PuntoDeVentaFrom: string | null; // origen de un traslado
  iSupplierID: number | null;
}

/** GET /Inventory/GetInventoryTransactionDetails/{transaccion}/{pdv} */
export interface PosDetalleRow {
  biTransactionDetailID: number;
  biTransactionID: number;
  tiTransactionTypeID: number;
  TransactionType: string;
  iItemID: number;
  ItemName: string;
  GroupName: string;
  SubGroupName: string;
  MeasureUnit_Inventory: string;
  dQuantity: number; // con signo: egresos negativos
  mItemPrice: number; // costo unitario del movimiento
  mTotal: number; // valor con signo
  dtDate: string;
  iPeriodo: number;
  SupplierName: string | null;
  vExternalDocumentID: string | null;
  vObservations: string | null;
  vObservationsOnDetail: string | null;
  WareHouseName: string | null;
  tiDetailStatusID: number;
}

/** GET /Reports/GetSalesByItemVsItemCost */
export interface PosCostoVentaRow {
  iItemID: number;
  ItemName: string;
  GroupName: string;
  SubGroupName: string;
  Quantity: number;
  mSubTotal: number; // venta neta sin impuestos (0 en componentes de combos)
  mTotalDiscount: number;
  Total: number;
  ItemCost: number;
  TotalItemCost: number;
}

/** GET /Configuration/GetPuntosDeVenta */
export interface PosPuntoDeVentaRow {
  iPuntoDeVentaID: number;
  vName: string;
  iCompanyID: number;
  iWareHouseIDDefault: number | null;
}

/** GET /Configuration/GetWarehouses */
export interface PosBodegaRow {
  iWareHouseID: number;
  vName: string;
  iPuntoDeVentaID: number;
  bIsVirtual: boolean;
  tiStatusID: number;
}

// ---------------------------------------------------------------------------
// Tipos de movimiento de inventario
// ---------------------------------------------------------------------------

export type CategoriaMovimiento =
  | "apertura"
  | "compra"
  | "traslado_entrada"
  | "traslado_salida"
  | "produccion_entrada"
  | "produccion_salida"
  | "venta"
  | "nota_credito"
  | "baja"
  | "consumo_interno"
  | "cortesia"
  | "evento"
  | "gasto"
  | "ajuste"
  | "requisicion";

export interface TipoMovimientoPOS {
  id: number;
  /** Nombre exacto que devuelve IntuiPOS (TransactionType). */
  nombre: string;
  /** Texto corto para la interfaz. */
  etiqueta: string;
  categoria: CategoriaMovimiento;
  /** false = documento informativo (no cambia existencias). */
  afectaExistencia: boolean;
}

/** Únicos tipos con detalle de inventario encontrados en el histórico del POS (2025–2026). */
export const TIPOS_MOVIMIENTO_POS: Record<number, TipoMovimientoPOS> = {
  9: { id: 9, nombre: "EGRESO x EVENTO", etiqueta: "Evento", categoria: "evento", afectaExistencia: true },
  12: { id: 12, nombre: "EGRESO x CONSUMO CORTESIA", etiqueta: "Cortesía", categoria: "cortesia", afectaExistencia: true },
  13: { id: 13, nombre: "EGRESO x CONSUMO INTERNO", etiqueta: "Consumo interno", categoria: "consumo_interno", afectaExistencia: true },
  18: { id: 18, nombre: "EGRESO x GASTO", etiqueta: "Gasto", categoria: "gasto", afectaExistencia: true },
  19: { id: 19, nombre: "INGRESO x NOTA CRÉDITO EN VENTA", etiqueta: "Nota crédito", categoria: "nota_credito", afectaExistencia: true },
  20: { id: 20, nombre: "INGRESO x COMPRA", etiqueta: "Compra", categoria: "compra", afectaExistencia: true },
  21: { id: 21, nombre: "EGRESO x VENTA", etiqueta: "Venta", categoria: "venta", afectaExistencia: true },
  22: { id: 22, nombre: "EGRESO x BAJA", etiqueta: "Baja / merma", categoria: "baja", afectaExistencia: true },
  24: { id: 24, nombre: "EGRESO x PRODUCCION", etiqueta: "Consumo en producción", categoria: "produccion_salida", afectaExistencia: true },
  25: { id: 25, nombre: "INGRESO x PRODUCCION", etiqueta: "Producción", categoria: "produccion_entrada", afectaExistencia: true },
  26: { id: 26, nombre: "CIERRE DE INVENTARIO", etiqueta: "Apertura de periodo", categoria: "apertura", afectaExistencia: true },
  27: { id: 27, nombre: "AJUSTE DE INVENTARIO", etiqueta: "Ajuste", categoria: "ajuste", afectaExistencia: true },
  28: { id: 28, nombre: "EGRESO x TRASLADO", etiqueta: "Traslado enviado", categoria: "traslado_salida", afectaExistencia: true },
  29: { id: 29, nombre: "INGRESO x TRASLADO", etiqueta: "Traslado recibido", categoria: "traslado_entrada", afectaExistencia: true },
  51: { id: 51, nombre: "REQUISICION X TRASLADO", etiqueta: "Requisición", categoria: "requisicion", afectaExistencia: false },
};

/**
 * Tipos cuyo detalle se descarga para el listado de movimientos.
 * Se excluyen 21 (un egreso por cada venta: cientos al día; se calcula por diferencia)
 * y 26 (apertura de periodo: ya está incluida en las existencias inicial/final).
 */
export const TIPOS_DETALLADOS: number[] = [9, 12, 13, 18, 19, 20, 22, 24, 25, 27, 28, 29, 51];

export const TIPO_AJUSTE = 27;
export const TIPO_APERTURA = 26;
export const LIMITE_ENCABEZADOS_POS = 500;
export const MAX_DIAS_RANGO = 31;

/** Etiquetas de categoría para la interfaz. */
export const ETIQUETA_CATEGORIA: Record<CategoriaMovimiento, string> = {
  apertura: "Apertura de periodo",
  compra: "Compras",
  traslado_entrada: "Traslados recibidos",
  traslado_salida: "Traslados enviados",
  produccion_entrada: "Producción",
  produccion_salida: "Consumo en producción",
  venta: "Ventas",
  nota_credito: "Notas crédito",
  baja: "Bajas / mermas",
  consumo_interno: "Consumo interno",
  cortesia: "Cortesías",
  evento: "Eventos",
  gasto: "Gastos",
  ajuste: "Ajustes",
  requisicion: "Requisiciones",
};

// ---------------------------------------------------------------------------
// Modelo de dominio (lo que devuelve server/routes/inventarioPos.ts)
// ---------------------------------------------------------------------------

export interface BodegaPOS {
  id: number; // iWareHouseID
  nombre: string;
  puntoDeVentaId: number;
}

export interface CatalogoItemPOS {
  posItemId: number;
  nombre: string;
  grupo: string;
  subgrupo: string;
  unidad: string; // unidad de inventario (gr, Und, un, ml, kg, porción)
  esIngrediente: boolean;
  minimo: number;
  maximo: number;
}

export type EstadoExistencia = "negativo" | "agotado" | "bajo_minimo" | "sobre_maximo" | "ok";

export interface ExistenciaPOS extends CatalogoItemPOS {
  cantidad: number;
  costoUnitario: number;
  valor: number; // cantidad × costo (negativo si la existencia es negativa)
  estado: EstadoExistencia;
}

export interface ResumenExistencias {
  items: number;
  valorTotal: number; // suma de valores positivos
  negativos: number;
  agotados: number;
  bajoMinimo: number;
}

export interface LineaMovimientoPOS {
  posItemId: number;
  nombre: string;
  grupo: string;
  unidad: string;
  cantidad: number; // con signo
  costoUnitario: number;
  valor: number; // con signo
  observacion: string;
}

export interface MovimientoPOS {
  id: number;
  tipoId: number;
  tipo: string; // etiqueta
  categoria: CategoriaMovimiento;
  afectaExistencia: boolean;
  fecha: string; // dtDate del encabezado, hora local
  anulado: boolean;
  observaciones: string;
  terminal: string;
  origen: string; // punto de venta de origen (traslados)
  proveedor: string;
  documentoExterno: string;
  lineas: LineaMovimientoPOS[];
  valorTotal: number; // suma de valores de las líneas (con signo)
}

export interface KardexItemPOS {
  posItemId: number;
  nombre: string;
  grupo: string;
  unidad: string;
  inicial: number | null;
  final: number | null;
  /** Suma de cantidades por categoría (sin "venta", que se calcula). */
  porCategoria: Partial<Record<CategoriaMovimiento, number>>;
  entradas: number; // categorías con cantidad positiva, excepto ajuste
  salidas: number; // categorías con cantidad negativa, excepto ajuste (valor negativo)
  ajustes: number; // neto de ajustes
  /** final − inicial − movimientos detallados. null si falta inicial/final o el periodo no tiene apertura. */
  ventasCalculadas: number | null;
  costoUnitario: number;
  valorFinal: number | null;
}

export interface CuadreTeoricoPOS {
  posItemId: number;
  nombre: string;
  unidad: string;
  /** Existencia al cierre del día sin los ajustes de ese día (lo que "debería haber"). */
  teoricoAntesAjuste: number;
  /** Ajustes registrados en IntuiPOS ese día (conteo hecho en el POS). */
  ajustePOS: number;
  /** Existencia al cierre del día después de ajustes. */
  finalPOS: number;
  costoUnitario: number;
}

export interface ConteoParaCuadre {
  insumoId: string;
  posItemId?: number | null;
  nombre: string;
  unidad: string;
  rawExpression: string;
  total: number;
}

export interface CuadreLinea {
  insumoId: string;
  posItemId: number | null;
  nombre: string;
  unidad: string;
  /** null = el insumo no se contó (expresión vacía). */
  contado: number | null;
  teorico: number | null;
  diferencia: number | null; // contado − teórico
  valorDiferencia: number | null; // diferencia × costo unitario
  ajustePOS: number | null;
  costoUnitario: number | null;
  /** Unidad en que se contó cuando no es la del POS (registros del catálogo manual). */
  unidadContada?: string;
  /** true = la unidad contada no se puede convertir a la del POS: diferencia y valor quedan en null. */
  unidadIncompatible?: boolean;
}

export interface CostoVentaPOS {
  posItemId: number;
  nombre: string;
  grupo: string;
  subgrupo: string;
  cantidad: number;
  ventaNeta: number;
  costoUnitario: number;
  costoTotal: number;
  /** (venta − costo) / venta; null si la venta es 0 (p. ej. componentes de combo). */
  margen: number | null;
}

export interface TotalesCostoVentas {
  cantidad: number;
  ventaNeta: number;
  costoTotal: number;
  margen: number | null;
}

/** Rango de consulta a IntuiPOS: periodo YYYYMM + corte "YYYY-MM-DDTHH:mm:ss" local. */
export interface ConsultaExistencias {
  periodo: string;
  corte: string;
}

export interface TramoMensual {
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  periodo: string; // YYYYMM
}

export interface ResumenCuadre {
  contados: number;
  conDiferencia: number;
  noContados: number;
  valorFaltante: number; // negativo
  valorSobrante: number;
  valorNeto: number;
}

// ---------------------------------------------------------------------------
// Redondeo
// ---------------------------------------------------------------------------

/** Redondeo simétrico (−2.5 → −3) que corrige el error binario (1.005 → 1.01) y normaliza −0 a 0. */
function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  const r = (Math.sign(n) * Math.round(Math.abs(n) * f * (1 + Number.EPSILON))) / f;
  return r === 0 || !Number.isFinite(r) ? 0 : r;
}

const round2 = (n: number) => redondear(n, 2);
/** IntuiPOS maneja cantidades con 5 decimales; esto solo quita el ruido de sumar flotantes. */
const redondearCantidad = (n: number) => redondear(n, 5);
const num = (n: unknown) => Number(n) || 0;
const texto = (s: unknown) => String(s ?? "").trim();

// ---------------------------------------------------------------------------
// Fechas y periodos (textos sin zona: no dependen del huso horario del equipo)
// ---------------------------------------------------------------------------

const HORA_CORTE = "04:00:00";

/** "YYYY-MM-DD", "YYYY-MM-DDTHH:mm" o "YYYY-MM-DDTHH:mm:ss(.fff)" → "YYYY-MM-DDTHH:mm:ss". */
function normalizarTimestamp(s: string): string {
  const t = String(s ?? "").trim().replace(" ", "T");
  if (t.length === 10) return `${t}T00:00:00`;
  if (t.length === 16) return `${t}:00`;
  return t.slice(0, 19);
}

/** Milisegundos de un timestamp local tratado como UTC (solo para restar y promediar). */
function aMilisegundos(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(normalizarTimestamp(s));
  if (!m) return NaN;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, se);
}

/** "2026-10-09" → "202610". */
export function periodoDe(fecha: string): string {
  return `${fecha.slice(0, 4)}${fecha.slice(5, 7)}`;
}

/** Inicio del día comercial: "2026-10-09" → "2026-10-09T04:00:00". */
export function corteInicioDia(fecha: string): string {
  return `${fecha}T${HORA_CORTE}`;
}

/** Fin (exclusivo) del día comercial: "2026-10-09" → "2026-10-10T04:00:00". */
export function corteFinDia(fecha: string): string {
  return `${addDaysIso(fecha, 1)}T${HORA_CORTE}`;
}

/** Existencias al cierre del día comercial: periodo del día y corte a las 04:00 del día siguiente. */
export function consultaCierreDia(fecha: string): ConsultaExistencias {
  return { periodo: periodoDe(fecha), corte: corteFinDia(fecha) };
}

/**
 * Existencias al inicio del día comercial = cierre del día anterior. El 1º del mes
 * consulta el periodo anterior (el periodo nuevo antes de su apertura da todo en cero).
 */
export function consultaInicioDia(fecha: string): ConsultaExistencias {
  return consultaCierreDia(addDaysIso(fecha, -1));
}

/** Días del rango, inclusivo: (d, d) → 1. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aMilisegundos(hasta) - aMilisegundos(desde)) / 86_400_000) + 1;
}

/** Parte un rango de fechas en tramos de un solo mes (para consultas que exigen iPeriodo). */
export function partirRangoPorMes(desde: string, hasta: string): TramoMensual[] {
  const tramos: TramoMensual[] = [];
  let actual = desde;
  while (actual <= hasta) {
    const dias = daysInMonth(Number(actual.slice(0, 4)), Number(actual.slice(5, 7)));
    const finMes = `${actual.slice(0, 8)}${String(dias).padStart(2, "0")}`;
    const fin = finMes < hasta ? finMes : hasta;
    tramos.push({ desde: actual, hasta: fin, periodo: periodoDe(actual) });
    actual = addDaysIso(fin, 1);
  }
  return tramos;
}

/** Punto medio entre dos timestamps locales, redondeado al segundo ("YYYY-MM-DDTHH:mm:ss"). */
export function puntoMedioLocal(a: string, b: string): string {
  const ma = aMilisegundos(a);
  const mb = aMilisegundos(b);
  if (!Number.isFinite(ma) || !Number.isFinite(mb)) throw new Error(`Timestamp inválido: ${a} / ${b}`);
  return new Date(Math.round((ma + mb) / 2000) * 1000).toISOString().slice(0, 19);
}

/** true si es una fecha "YYYY-MM-DD" que existe en el calendario. */
export function esFechaIso(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Día comercial en curso (Bogotá no tiene horario de verano): entre 00:00 y 04:00 sigue siendo el de ayer. */
export function diaComercialActual(ahora: Date = new Date()): string {
  return toBogotaIsoDate(new Date(ahora.getTime() - 4 * 3_600_000));
}

// ---------------------------------------------------------------------------
// Mapeos de filas IntuiPOS → modelo de dominio
// ---------------------------------------------------------------------------

export function mapCatalogoItem(row: PosExistenciaRow): CatalogoItemPOS {
  return {
    posItemId: row.iItemID,
    nombre: texto(row.ItemName),
    grupo: texto(row.GroupName),
    subgrupo: texto(row.SubGroupName),
    unidad: texto(row.MeasureUnit_Inventory),
    esIngrediente: row.tiItemRoleID === 1,
    minimo: num(row.dMinQty),
    maximo: num(row.dMaxQty),
  };
}

/** Mínimo/máximo en 0 = no configurado en IntuiPOS. */
export function estadoExistencia(cantidad: number, minimo: number, maximo: number): EstadoExistencia {
  if (cantidad < 0) return "negativo";
  if (cantidad === 0) return "agotado";
  if (minimo > 0 && cantidad < minimo) return "bajo_minimo";
  if (maximo > 0 && cantidad > maximo) return "sobre_maximo";
  return "ok";
}

export function mapExistencia(row: PosExistenciaRow): ExistenciaPOS {
  const item = mapCatalogoItem(row);
  const cantidad = num(row.dQuantity);
  const costoUnitario = num(row.mItemCost);
  return {
    ...item,
    cantidad,
    costoUnitario,
    valor: round2(cantidad * costoUnitario),
    estado: estadoExistencia(cantidad, item.minimo, item.maximo),
  };
}

/** El valor total suma solo existencias positivas (las negativas no restan valor al inventario). */
export function resumirExistencias(items: ExistenciaPOS[]): ResumenExistencias {
  return {
    items: items.length,
    valorTotal: round2(items.reduce((acc, i) => acc + (i.valor > 0 ? i.valor : 0), 0)),
    negativos: items.filter((i) => i.estado === "negativo").length,
    agotados: items.filter((i) => i.estado === "agotado").length,
    bajoMinimo: items.filter((i) => i.estado === "bajo_minimo").length,
  };
}

/**
 * Une encabezado y detalle. Un tipo desconocido se trata como ajuste que sí afecta existencias.
 * El valor de cada línea es cantidad × costo (como existencias, kardex y cuadre): el mTotal de
 * IntuiPOS le suma un impuesto (mTotalTax1) en ajustes, traslados y producción.
 */
export function mapMovimiento(h: PosEncabezadoRow, detalles: PosDetalleRow[]): MovimientoPOS {
  const def = TIPOS_MOVIMIENTO_POS[h.tiTransactionTypeID];
  const lineas: LineaMovimientoPOS[] = detalles.map((d) => {
    const cantidad = num(d.dQuantity);
    const costoUnitario = num(d.mItemPrice);
    return {
      posItemId: d.iItemID,
      nombre: texto(d.ItemName),
      grupo: texto(d.GroupName),
      unidad: texto(d.MeasureUnit_Inventory),
      cantidad,
      costoUnitario,
      valor: round2(cantidad * costoUnitario),
      observacion: texto(d.vObservationsOnDetail),
    };
  });
  // Los traslados traen "0" como documento externo: no es un dato real.
  const documento = detalles.map((d) => texto(d.vExternalDocumentID)).find((v) => v !== "" && v !== "0");
  return {
    id: h.biTransactionID,
    tipoId: h.tiTransactionTypeID,
    tipo: def?.etiqueta ?? (texto(detalles[0]?.TransactionType) || `Tipo ${h.tiTransactionTypeID}`),
    categoria: def?.categoria ?? "ajuste",
    afectaExistencia: def?.afectaExistencia ?? true,
    fecha: h.dtDate,
    anulado: h.tiStatusID !== 1,
    observaciones: texto(h.vObservations),
    terminal: texto(h.vTerminalID),
    origen: texto(h.PuntoDeVentaFrom),
    proveedor: detalles.map((d) => texto(d.SupplierName)).find((v) => v !== "") ?? "",
    documentoExterno: documento ?? "",
    lineas,
    valorTotal: round2(lineas.reduce((acc, l) => acc + l.valor, 0)),
  };
}

// ---------------------------------------------------------------------------
// Kardex, cuadre y costo de ventas
// ---------------------------------------------------------------------------

const cuentaEnKardex = (m: MovimientoPOS) => m.afectaExistencia && !m.anulado && m.categoria !== "requisicion";

/**
 * Kardex por insumo entre dos existencias. Las ventas no se descargan (cientos de
 * documentos al día): se calculan por diferencia = final − inicial − movimientos.
 */
export function calcularKardex(
  inicial: ExistenciaPOS[] | null,
  final: ExistenciaPOS[] | null,
  movimientos: MovimientoPOS[],
): KardexItemPOS[] {
  interface Acumulado {
    posItemId: number;
    nombre: string;
    grupo: string;
    unidad: string;
    inicial: ExistenciaPOS | null;
    final: ExistenciaPOS | null;
    porCategoria: Partial<Record<CategoriaMovimiento, number>>;
    ultimoCosto: number;
    fechaUltimoCosto: string;
  }
  const porId = new Map<number, Acumulado>();
  const obtener = (id: number, base: { nombre: string; grupo: string; unidad: string }) => {
    let a = porId.get(id);
    if (!a) {
      a = { posItemId: id, nombre: base.nombre, grupo: base.grupo, unidad: base.unidad, inicial: null, final: null, porCategoria: {}, ultimoCosto: 0, fechaUltimoCosto: "" };
      porId.set(id, a);
    }
    return a;
  };

  // Nombre, grupo y unidad: los de final, si no los de inicial, si no los de las líneas.
  for (const e of final ?? []) obtener(e.posItemId, e).final = e;
  for (const e of inicial ?? []) obtener(e.posItemId, e).inicial = e;
  for (const m of movimientos) {
    if (!cuentaEnKardex(m)) continue;
    const fecha = normalizarTimestamp(m.fecha);
    for (const l of m.lineas) {
      const a = obtener(l.posItemId, l);
      a.porCategoria[m.categoria] = (a.porCategoria[m.categoria] ?? 0) + l.cantidad;
      if (l.costoUnitario > 0 && fecha >= a.fechaUltimoCosto) {
        a.ultimoCosto = l.costoUnitario;
        a.fechaUltimoCosto = fecha;
      }
    }
  }

  const hayAmbas = inicial !== null && final !== null;
  return [...porId.values()]
    .map((a): KardexItemPOS => {
      const porCategoria: Partial<Record<CategoriaMovimiento, number>> = {};
      let entradas = 0;
      let salidas = 0;
      for (const [cat, valor] of Object.entries(a.porCategoria) as [CategoriaMovimiento, number][]) {
        const total = redondearCantidad(valor);
        porCategoria[cat] = total;
        if (cat === "ajuste") continue;
        if (total > 0) entradas += total;
        else if (total < 0) salidas += total;
      }
      entradas = redondearCantidad(entradas);
      salidas = redondearCantidad(salidas);
      const ajustes = porCategoria.ajuste ?? 0;
      const ini = a.inicial ? a.inicial.cantidad : null;
      const fin = a.final ? a.final.cantidad : null;
      const costoUnitario = a.final ? a.final.costoUnitario : a.inicial ? a.inicial.costoUnitario : a.ultimoCosto;
      return {
        posItemId: a.posItemId,
        nombre: a.nombre,
        grupo: a.grupo,
        unidad: a.unidad,
        inicial: ini,
        final: fin,
        porCategoria,
        entradas,
        salidas,
        ajustes,
        ventasCalculadas: hayAmbas && ini !== null && fin !== null ? redondear(fin - ini - (entradas + salidas + ajustes), 3) : null,
        costoUnitario,
        valorFinal: fin !== null ? round2(fin * costoUnitario) : null,
      };
    })
    .sort((x, y) => x.grupo.localeCompare(y.grupo, "es") || x.nombre.localeCompare(y.nombre, "es") || x.posItemId - y.posItemId);
}

/**
 * Teórico para cuadrar un conteo físico del día: existencia al cierre sin los ajustes
 * de ese día (el POS registra a diario su propio conteo como AJUSTE).
 */
export function calcularTeoricoCuadre(final: ExistenciaPOS[], ajustesDelDia: MovimientoPOS[]): CuadreTeoricoPOS[] {
  const ajustePorItem = new Map<number, number>();
  for (const m of ajustesDelDia) {
    if (m.categoria !== "ajuste" || m.anulado) continue;
    for (const l of m.lineas) ajustePorItem.set(l.posItemId, (ajustePorItem.get(l.posItemId) ?? 0) + l.cantidad);
  }
  return final.map((e) => {
    const ajustePOS = redondearCantidad(ajustePorItem.get(e.posItemId) ?? 0);
    return {
      posItemId: e.posItemId,
      nombre: e.nombre,
      unidad: e.unidad,
      teoricoAntesAjuste: redondearCantidad(e.cantidad - ajustePOS),
      ajustePOS,
      finalPOS: e.cantidad,
      costoUnitario: e.costoUnitario,
    };
  });
}

/** Minúsculas, sin tildes, espacios colapsados: "  Azúcar   Morena " → "azucar morena". */
export function normalizarNombre(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const UNIDADES: Record<string, string> = {
  g: "gr", gr: "gr", grs: "gr", gramo: "gr", gramos: "gr",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
  ml: "ml", mililitro: "ml", mililitros: "ml",
  l: "l", lt: "l", lts: "l", litro: "l", litros: "l",
  u: "un", un: "un", und: "un", ud: "un", uds: "un", unidad: "un", unidades: "un",
};

/** Unidad canónica para comparar: "g"/"gramos" → "gr", "L"/"lts" → "l", "Und"/"uds" → "un". */
export function normalizarUnidad(u: string): string {
  const s = normalizarNombre(u).replace(/\.$/, "");
  return UNIDADES[s] ?? s;
}

const FACTORES_UNIDAD: Record<string, number> = { "kg>gr": 1000, "gr>kg": 0.001, "l>ml": 1000, "ml>l": 0.001 };

/** Factor para pasar una cantidad de `desde` a `hacia` (1 si es la misma o falta alguna); null si no hay conversión. */
export function factorUnidad(desde: string, hacia: string): number | null {
  const a = normalizarUnidad(desde);
  const b = normalizarUnidad(hacia);
  if (!a || !b || a === b) return 1;
  return FACTORES_UNIDAD[`${a}>${b}`] ?? null;
}

/** "1.000", "12.500" o "1.500,5": punto de miles de es-CO (como se muestran los totales y botones). */
const CON_PUNTO_DE_MILES = /^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/;

/**
 * Suma una expresión de conteo como "340 + 250,5 + 1.000" (2 decimales). La coma es decimal
 * y el punto seguido de grupos de 3 cifras es de miles (es-CO), salvo en kg y L, donde
 * "1.500" se lee 1,5 (así lo muestran las básculas); con coma ("1.500,5") siempre es de miles.
 */
export function calcularExpresionConteo(raw: string, unidad = ""): number {
  const puntoDecimal = ["kg", "l"].includes(normalizarUnidad(unidad));
  let suma = 0;
  for (const parte of String(raw ?? "").split("+")) {
    let t = parte.replace(/[^0-9.,]/g, "");
    if (!t) continue;
    if (CON_PUNTO_DE_MILES.test(t) && (t.includes(",") || !puntoDecimal)) t = t.replace(/\./g, "");
    const n = parseFloat(t.replace(/,/g, "."));
    if (!isNaN(n)) suma += n;
  }
  return Math.round(suma * 100) / 100;
}

/**
 * Cruza el conteo físico con el teórico del POS (por id de IntuiPOS y, si no hay,
 * por nombre). Al final agrega los insumos del POS que nadie contó.
 * Un conteo en otra unidad (registros del catálogo manual) se convierte a la del POS
 * (kg↔gr, L↔ml); si no hay conversión, la línea no se compara (diferencia null).
 */
export function cruzarConteo(conteo: ConteoParaCuadre[], teoricos: CuadreTeoricoPOS[]): CuadreLinea[] {
  const porId = new Map<number, CuadreTeoricoPOS>();
  const porNombre = new Map<string, CuadreTeoricoPOS>();
  for (const t of teoricos) {
    if (!porId.has(t.posItemId)) porId.set(t.posItemId, t);
    const clave = normalizarNombre(t.nombre);
    if (!porNombre.has(clave)) porNombre.set(clave, t);
  }
  const usados = new Set<CuadreTeoricoPOS>();

  const lineas: CuadreLinea[] = conteo.map((c) => {
    const t = (c.posItemId != null ? porId.get(c.posItemId) : undefined) ?? porNombre.get(normalizarNombre(c.nombre));
    if (t) usados.add(t);
    const factor = t ? factorUnidad(c.unidad, t.unidad) : 1;
    const convertido = t !== undefined && factor !== null && factor !== 1;
    const bruto = String(c.rawExpression ?? "").trim() === "" ? null : num(c.total);
    const contado = bruto !== null && convertido ? redondearCantidad(bruto * factor) : bruto;
    const teorico = t ? t.teoricoAntesAjuste : null;
    const costoUnitario = t ? t.costoUnitario : null;
    const diferencia = factor !== null && contado !== null && teorico !== null ? redondearCantidad(contado - teorico) : null;
    const linea: CuadreLinea = {
      insumoId: c.insumoId,
      posItemId: t?.posItemId ?? c.posItemId ?? null,
      nombre: c.nombre,
      unidad: convertido ? t.unidad : c.unidad || t?.unidad || "",
      contado,
      teorico,
      diferencia,
      valorDiferencia: diferencia !== null && costoUnitario !== null ? round2(diferencia * costoUnitario) : null,
      ajustePOS: t ? t.ajustePOS : null,
      costoUnitario,
    };
    if (factor !== 1) linea.unidadContada = c.unidad;
    if (factor === null) linea.unidadIncompatible = true;
    return linea;
  });

  for (const t of teoricos) {
    if (usados.has(t)) continue;
    lineas.push({
      insumoId: `pos-${t.posItemId}`,
      posItemId: t.posItemId,
      nombre: t.nombre,
      unidad: t.unidad,
      contado: null,
      teorico: t.teoricoAntesAjuste,
      diferencia: null,
      valorDiferencia: null,
      ajustePOS: t.ajustePOS,
      costoUnitario: t.costoUnitario,
    });
  }
  return lineas;
}

export function resumirCuadre(lineas: CuadreLinea[]): ResumenCuadre {
  let faltante = 0;
  let sobrante = 0;
  for (const l of lineas) {
    const v = l.valorDiferencia ?? 0;
    if (v < 0) faltante += v;
    else sobrante += v;
  }
  return {
    contados: lineas.filter((l) => l.contado !== null).length,
    conDiferencia: lineas.filter((l) => l.diferencia !== null && Math.abs(l.diferencia) > 0.0005).length,
    noContados: lineas.filter((l) => l.contado === null).length,
    valorFaltante: round2(faltante),
    valorSobrante: round2(sobrante),
    valorNeto: round2(faltante + sobrante),
  };
}

/** (venta − costo) / venta; null si no hubo venta. */
export function margenBruto(venta: number, costo: number): number | null {
  return venta > 0 ? (venta - costo) / venta : null;
}

/**
 * Agrupa por producto las filas del reporte de costo de ventas (una consulta por mes).
 * IntuiPOS repite los componentes de combos y subrecetas en filas con venta $0 cuyo
 * costo ya está dentro del costo del producto vendido (p. ej. "Arroz con leche grande"
 * y su receta "Alta Gracia Libra" traen el mismo costo). Por eso los totales suman solo
 * los productos con venta; las filas con venta $0 quedan como detalle informativo.
 */
export function agruparCostoVentas(rows: PosCostoVentaRow[]): { items: CostoVentaPOS[]; totales: TotalesCostoVentas } {
  const porId = new Map<number, { row: PosCostoVentaRow; cantidad: number; venta: number; costo: number }>();
  for (const r of rows) {
    const a = porId.get(r.iItemID) ?? { row: r, cantidad: 0, venta: 0, costo: 0 };
    a.cantidad += num(r.Quantity);
    a.venta += num(r.mSubTotal);
    a.costo += num(r.TotalItemCost);
    porId.set(r.iItemID, a);
  }

  const items: CostoVentaPOS[] = [...porId.values()]
    .map((a) => {
      const cantidad = redondearCantidad(a.cantidad);
      const ventaNeta = round2(a.venta);
      const costoTotal = round2(a.costo);
      return {
        posItemId: a.row.iItemID,
        nombre: texto(a.row.ItemName),
        grupo: texto(a.row.GroupName),
        subgrupo: texto(a.row.SubGroupName),
        cantidad,
        ventaNeta,
        costoUnitario: cantidad !== 0 ? round2(costoTotal / cantidad) : 0,
        costoTotal,
        margen: margenBruto(ventaNeta, costoTotal),
      };
    })
    .sort((x, y) => y.costoTotal - x.costoTotal || x.nombre.localeCompare(y.nombre, "es"));

  // Totales sobre las sumas sin redondear (redondear por ítem y luego sumar desvía centavos).
  const vendidos = [...porId.values()].filter((a) => round2(a.venta) !== 0);
  const ventaNeta = round2(vendidos.reduce((acc, a) => acc + a.venta, 0));
  const costoTotal = round2(vendidos.reduce((acc, a) => acc + a.costo, 0));
  return {
    items,
    totales: {
      cantidad: redondearCantidad(vendidos.reduce((acc, a) => acc + a.cantidad, 0)),
      ventaNeta,
      costoTotal,
      margen: margenBruto(ventaNeta, costoTotal),
    },
  };
}

/**
 * Costo de ventas desde el inventario: Σ(−ventas calculadas del kardex × costo unitario).
 * Es el consumo real por ventas de la bodega: incluye una sola vez los componentes de
 * combos y también lo que se entrega sin precio (bolsas, tapas). null si ningún insumo
 * tiene ventas calculadas (falta la existencia inicial/final o la apertura del periodo).
 */
export function costoConsumoVentas(kardex: KardexItemPOS[]): number | null {
  let costo = 0;
  let hay = false;
  for (const k of kardex) {
    if (k.ventasCalculadas === null) continue;
    hay = true;
    costo -= k.ventasCalculadas * k.costoUnitario;
  }
  return hay ? round2(costo) : null;
}

/** Totales del reporte con otro costo total (p. ej. el consumo de inventario) y su margen. */
export function totalesConCosto(totales: TotalesCostoVentas, costoTotal: number): TotalesCostoVentas {
  const costo = round2(costoTotal);
  return { ...totales, costoTotal: costo, margen: margenBruto(totales.ventaNeta, costo) };
}

/** Conserva las filas de los días comerciales [desde 04:00, hasta+1 04:00). */
export function filtrarPorDiaComercial<T extends { dtDate: string }>(rows: T[], desde: string, hasta: string): T[] {
  const inicio = corteInicioDia(desde);
  const fin = corteFinDia(hasta);
  return rows.filter((r) => {
    const t = normalizarTimestamp(r.dtDate);
    return t >= inicio && t < fin;
  });
}

// ---------------------------------------------------------------------------
// Utilidades async (sin red: reciben la función que consulta)
// ---------------------------------------------------------------------------

/**
 * Trae TODOS los encabezados de un rango aunque IntuiPOS corte la respuesta en 500
 * filas: si un tramo llega lleno, lo parte en dos y vuelve a consultar. `truncado`
 * avisa si un tramo mínimo siguió lleno (posible pérdida de filas).
 */
export async function obtenerEncabezadosCompletos(
  fetcher: (desde: string, hasta: string) => Promise<PosEncabezadoRow[]>,
  desde: string,
  hasta: string,
  opts: { limite?: number; minSegundos?: number } = {},
): Promise<{ rows: PosEncabezadoRow[]; truncado: boolean }> {
  const limite = opts.limite ?? LIMITE_ENCABEZADOS_POS;
  const minSegundos = opts.minSegundos ?? 60;
  const porId = new Map<number, PosEncabezadoRow>();
  let truncado = false;

  const recorrer = async (a: string, b: string): Promise<void> => {
    const rows = await fetcher(a, b);
    if (rows.length >= limite) {
      const segundos = (aMilisegundos(b) - aMilisegundos(a)) / 1000;
      const medio = segundos > minSegundos ? puntoMedioLocal(a, b) : null;
      const msMedio = medio ? aMilisegundos(medio) : NaN;
      // El medio debe quedar estrictamente dentro del rango; si no, se recursaría sin fin.
      if (medio && msMedio > aMilisegundos(a) && msMedio < aMilisegundos(b)) {
        await recorrer(a, medio);
        await recorrer(medio, b);
        return;
      }
      truncado = true;
    }
    for (const r of rows) porId.set(r.biTransactionID, r);
  };

  await recorrer(desde, hasta);
  const rows = [...porId.values()].sort((x, y) => {
    const fx = normalizarTimestamp(x.dtDate);
    const fy = normalizarTimestamp(y.dtDate);
    if (fx !== fy) return fx < fy ? 1 : -1;
    // Mismo segundo: comparar el texto completo (fracciones) y luego el id.
    if (x.dtDate !== y.dtDate) return x.dtDate < y.dtDate ? 1 : -1;
    return y.biTransactionID - x.biTransactionID;
  });
  return { rows, truncado };
}

/** Como Promise.all(items.map(fn)) pero con máximo `limite` tareas a la vez. Conserva el orden. */
export async function mapConcurrente<T, R>(items: T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;
  let detener = false;
  const trabajador = async () => {
    while (!detener && siguiente < items.length) {
      const i = siguiente++;
      try {
        resultados[i] = await fn(items[i], i);
      } catch (e) {
        detener = true;
        throw e;
      }
    }
  };
  const n = Math.min(Math.max(1, Math.floor(limite) || 1), items.length);
  await Promise.all(Array.from({ length: n }, () => trabajador()));
  return resultados;
}
