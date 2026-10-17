/**
 * Formatos y utilidades compartidas por las vistas de inventario de IntuiPOS
 * (Existencias, Movimientos, Costo de ventas y Cuadre).
 */
import { createElement, useEffect, useRef, useState, type DependencyList } from "react";
import { inventarioPosAdapter } from "../../db/inventarioPosAdapter";
import { loadXLSX } from "../../lib/lazyLibs";
import {
  MAX_DIAS_RANGO,
  diasEntre,
  esFechaIso,
  normalizarNombre,
  type BodegaPOS,
  type CategoriaMovimiento,
  type EstadoExistencia,
} from "../../lib/inventarioPos";

// ---------------------------------------------------------------------------
// Números y fechas
// ---------------------------------------------------------------------------

const fmtMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtMonedaDecimales = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtCantidad = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const fmtPorcentaje = new Intl.NumberFormat("es-CO", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

const vacio = (n: number | null | undefined): n is null | undefined => n === null || n === undefined || !Number.isFinite(n);
/** Redondea y convierte −0 en 0 (evita "-$ 0" y "-0"). */
const sinCeroNegativo = (n: number, decimales: number) => {
  const f = 10 ** decimales;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r;
};

/** "$ 1.234.567" sin decimales. null → "—". */
export function formatoMoneda(n: number | null | undefined): string {
  if (vacio(n)) return "—";
  return fmtMoneda.format(sinCeroNegativo(n, 0));
}

/** Costo por unidad: con decimales cuando es pequeño (p. ej. $ 4,57 por gramo). */
export function formatoCostoUnitario(n: number | null | undefined): string {
  if (vacio(n)) return "—";
  return Math.abs(n) < 100 ? fmtMonedaDecimales.format(sinCeroNegativo(n, 2)) : formatoMoneda(n);
}

/** Cantidad con hasta 2 decimales y unidad opcional: "28.248 gr". */
export function formatoCantidad(n: number | null | undefined, unidad?: string): string {
  if (vacio(n)) return "—";
  const texto = fmtCantidad.format(sinCeroNegativo(n, 2));
  return unidad ? `${texto} ${unidad}` : texto;
}

/** Igual que formatoCantidad pero con "+" en los positivos. */
export function formatoCantidadConSigno(n: number | null | undefined, unidad?: string): string {
  if (vacio(n)) return "—";
  const texto = formatoCantidad(n, unidad);
  return sinCeroNegativo(n, 2) > 0 ? `+${texto}` : texto;
}

/** Razón → "35,2 %". null → "—". */
export function formatoPorcentaje(razon: number | null | undefined): string {
  if (vacio(razon)) return "—";
  return fmtPorcentaje.format(razon);
}

/** "2026-10-09" → "09/10/2026". */
export function formatoFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "2026-10-09T19:39:48.47" (hora local del POS) → "09/10/2026 19:39". */
export function formatoFechaHora(ts: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(ts ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : ts;
}

/** Mensaje legible de un error (ApiError trae el texto del servidor). */
export function mensajeError(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Error desconocido al consultar IntuiPOS";
}

/** Valida un rango de fechas antes de consultar. "" = válido. */
export function validarRango(desde: string, hasta: string, hoy: string): string {
  if (!esFechaIso(desde) || !esFechaIso(hasta)) return "Selecciona fechas válidas.";
  if (desde > hasta) return "La fecha inicial no puede ser posterior a la final.";
  if (hasta > hoy) return "La fecha final no puede ser futura.";
  if (diasEntre(desde, hasta) > MAX_DIAS_RANGO) return `El rango máximo es de ${MAX_DIAS_RANGO} días.`;
  return "";
}

// ---------------------------------------------------------------------------
// Estilos compartidos (mismo lenguaje visual de InventoryClosure)
// ---------------------------------------------------------------------------

export const CLASE_TARJETA = "bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]";
export const CLASE_ETIQUETA = "text-xs font-bold text-slate-700 block mb-1.5";
export const CLASE_INPUT =
  "w-full min-w-0 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none transition-all disabled:opacity-60";
export const CLASE_BOTON_SECUNDARIO =
  "px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
export const CLASE_BOTON_PRIMARIO =
  "px-3.5 py-2 bg-[#1E3E30] hover:bg-[#163025] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/** Primera columna fija al desplazar una tabla en horizontal (móvil). La fila lleva `group`. */
export const CLASE_TH_FIJA = "sticky left-0 z-10 bg-slate-50";
export const CLASE_TD_FIJA = "sticky left-0 z-[1] bg-white group-hover:bg-slate-50 shadow-[inset_-1px_0_0_#f1f5f9]";

export type TonoChip ="rojo" | "naranja" | "ambar" | "azul" | "verde" | "gris";

const CLASE_TONO: Record<TonoChip, string> = {
  rojo: "bg-red-50 text-red-700 border-red-200",
  naranja: "bg-orange-50 text-orange-700 border-orange-200",
  ambar: "bg-amber-50 text-amber-800 border-amber-200",
  azul: "bg-sky-50 text-sky-700 border-sky-200",
  verde: "bg-emerald-50 text-emerald-700 border-emerald-200",
  gris: "bg-slate-100 text-slate-600 border-slate-200",
};

export function claseChip(tono: TonoChip): string {
  return `inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-md border whitespace-nowrap ${CLASE_TONO[tono]}`;
}

export const ESTADO_EXISTENCIA: Record<EstadoExistencia, { etiqueta: string; tono: TonoChip }> = {
  negativo: { etiqueta: "Negativo", tono: "rojo" },
  agotado: { etiqueta: "Agotado", tono: "naranja" },
  bajo_minimo: { etiqueta: "Bajo mínimo", tono: "ambar" },
  sobre_maximo: { etiqueta: "Sobre máximo", tono: "azul" },
  ok: { etiqueta: "OK", tono: "verde" },
};

export function ChipEstado({ estado }: { estado: EstadoExistencia }) {
  const e = ESTADO_EXISTENCIA[estado] ?? ESTADO_EXISTENCIA.ok;
  return createElement("span", { className: claseChip(e.tono) }, e.etiqueta);
}

export const TONO_CATEGORIA: Record<CategoriaMovimiento, TonoChip> = {
  apertura: "gris",
  compra: "verde",
  traslado_entrada: "verde",
  produccion_entrada: "verde",
  nota_credito: "verde",
  traslado_salida: "naranja",
  produccion_salida: "naranja",
  venta: "naranja",
  consumo_interno: "naranja",
  cortesia: "naranja",
  evento: "naranja",
  gasto: "naranja",
  baja: "rojo",
  ajuste: "azul",
  requisicion: "gris",
};

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------

/**
 * Ejecuta `consulta` cada vez que cambian `deps` (con espera opcional para no consultar
 * mientras el usuario cambia fechas) e ignora respuestas viejas. `consulta = null` no consulta.
 */
export function useConsultaPOS<T>(consulta: (() => Promise<T>) | null, deps: DependencyList, esperaMs = 0) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const consultaRef = useRef(consulta);
  consultaRef.current = consulta;

  useEffect(() => {
    const fn = consultaRef.current;
    if (!fn) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError("");
    const t = setTimeout(async () => {
      try {
        const r = await fn();
        if (!cancelado) setDatos(r);
      } catch (e) {
        if (!cancelado) {
          setDatos(null);
          setError(mensajeError(e));
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }, esperaMs);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [...deps, version]);

  return { datos, cargando, error, recargar: () => setVersion((v) => v + 1) };
}

export type BodegaListadaPOS = BodegaPOS & { puntoDeVentaNombre: string };

/** Bodegas para el selector: la del local primero. Si falla, el selector queda en "bodega del local". */
export function useBodegasPOS(localName: string) {
  const [estado, setEstado] = useState<{ bodegaLocal: BodegaPOS | null; opciones: BodegaListadaPOS[]; error: string }>({
    bodegaLocal: null,
    opciones: [],
    error: "",
  });

  useEffect(() => {
    let cancelado = false;
    setEstado({ bodegaLocal: null, opciones: [], error: "" });
    inventarioPosAdapter
      .getBodegas(localName)
      .then((r) => {
        if (cancelado || !r.configurado) return;
        const local = r.bodegaLocal;
        const resto = r.bodegas.filter((b) => b.id !== local.id).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        const propia = r.bodegas.find((b) => b.id === local.id) ?? { ...local, puntoDeVentaNombre: "" };
        setEstado({ bodegaLocal: local, opciones: [propia, ...resto], error: "" });
      })
      .catch((e) => {
        if (!cancelado) setEstado({ bodegaLocal: null, opciones: [], error: mensajeError(e) });
      });
    return () => {
      cancelado = true;
    };
  }, [localName]);

  return estado;
}

// ---------------------------------------------------------------------------
// Exportar a Excel
// ---------------------------------------------------------------------------

export type FilaExcel = Record<string, string | number | null>;

/** "Existencias", "BODEGA CHAPINERO", "2026-10-09" → "existencias_bodega_chapinero_2026-10-09.xlsx" */
export function nombreArchivoExcel(...partes: string[]): string {
  const base = partes
    .map((p) => normalizarArchivo(p))
    .filter(Boolean)
    .join("_");
  return `${base || "inventario"}.xlsx`;
}

function normalizarArchivo(s: string): string {
  return normalizarNombre(s)
    .replace(/[^a-z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Descarga un .xlsx con una hoja por entrada (SheetJS se carga solo al exportar). */
export async function exportarExcel(nombreArchivo: string, hojas: { nombre: string; filas: FilaExcel[] }[]): Promise<void> {
  const XLSX = await loadXLSX();
  const libro = XLSX.utils.book_new();
  const usados = new Set<string>();
  for (const h of hojas) {
    let nombre = h.nombre.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Hoja";
    while (usados.has(nombre)) nombre = `${nombre.slice(0, 28)} ${usados.size + 1}`;
    usados.add(nombre);
    const hoja = XLSX.utils.json_to_sheet(h.filas);
    const columnas = h.filas.length ? Object.keys(h.filas[0]) : [];
    hoja["!cols"] = columnas.map((c) => ({
      wch: Math.min(50, h.filas.reduce((max, f) => Math.max(max, String(f[c] ?? "").length), c.length) + 2),
    }));
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
  }
  XLSX.writeFile(libro, nombreArchivo);
}
