/**
 * Conciliación de cierres y política de descuadres 60/40.
 *
 * Fuente única de verdad: la usan tanto la vista previa que ve Gerencia como el
 * guardado al aprobar, para que lo aprobado sea exactamente lo que se registra.
 *
 * Convención de signos: diferencia > 0 = sobrante, diferencia < 0 = faltante.
 *   - Efectivo y datáfono:        declarado por la tienda − POS
 *   - Justo, Rappi, transferencias: valor real validado en portal/banco − POS
 */

export interface ConciliacionInput {
  /** Declarado por la tienda en el arqueo. */
  efectivoDeclarado: number;
  datafonoDeclarado: number;
  /** Valores del POS confirmados por Gerencia. */
  efectivoPOS: number;
  datafonoPOS: number;
  justoPOS: number;
  rappiPOS: number;
  transferenciasPOS: number;
  /** Valores reales validados en portales / extracto bancario. */
  justoReal: number;
  rappiReal: number;
  transferenciasReal: number;
}

export interface Diferencias {
  efectivo: number;
  tarjetas: number;
  justo: number;
  rappi: number;
  transferencias: number;
  /** Suma neta de todos los canales. */
  total: number;
}

const toPesos = (n: number) => Math.round(Number(n) || 0);

export function calcularDiferencias(i: ConciliacionInput): Diferencias {
  const efectivo = toPesos(i.efectivoDeclarado) - toPesos(i.efectivoPOS);
  const tarjetas = toPesos(i.datafonoDeclarado) - toPesos(i.datafonoPOS);
  const justo = toPesos(i.justoReal) - toPesos(i.justoPOS);
  const rappi = toPesos(i.rappiReal) - toPesos(i.rappiPOS);
  const transferencias = toPesos(i.transferenciasReal) - toPesos(i.transferenciasPOS);
  return { efectivo, tarjetas, justo, rappi, transferencias, total: efectivo + tarjetas + justo + rappi + transferencias };
}

/**
 * Base sobre la que se cobra el faltante al equipo.
 * - "total": suma neta de todos los canales (comportamiento histórico de la app).
 * - "efectivo": solo el faltante de efectivo (lo que describe CONTEXTO_PROYECTO.md §3.1).
 */
export type BaseCobroFaltante = "total" | "efectivo";
export const BASE_COBRO_FALTANTE: BaseCobroFaltante = "total";

/** Monto a cobrar al equipo (siempre ≥ 0). */
export function faltanteCobrable(d: Diferencias, base: BaseCobroFaltante = BASE_COBRO_FALTANTE): number {
  const neto = base === "efectivo" ? d.efectivo : d.total;
  return neto < 0 ? -neto : 0;
}

// ---------------------------------------------------------------------------
// Política 60/40
// ---------------------------------------------------------------------------

export function normalizarTexto(s: string | undefined | null): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * ¿El cargo responde por faltantes de caja como auxiliar?
 * Excluidos: Gerencia/administración y TODO el equipo de pastelería/cocina
 * (líder y auxiliares), que no manipulan la caja registradora.
 */
export function cargoParticipaEnDescuadre(cargo: string | undefined | null): boolean {
  const c = normalizarTexto(cargo);
  if (!c) return true; // sin cargo conocido: se trata como auxiliar de servicio
  if (c.includes("geren") || c.includes("admin")) return false;
  if (c.includes("pastel") || c.includes("cocin")) return false;
  return true;
}

export interface MiembroEquipo {
  nombre: string;
  cargo?: string | null;
  role?: string | null;
}

export interface RepartoDescuadre {
  faltante: number;
  /** Lo que asume el líder (60% + lo que no se pudo repartir). */
  lider: number;
  /** Monto por cada auxiliar elegible (todos pagan lo mismo). */
  porAuxiliar: number;
  auxiliaresElegibles: string[];
  /** Nombres excluidos y por qué (cargo de pastelería, gerencia, duplicado, es el líder). */
  excluidos: { nombre: string; motivo: string }[];
}

/**
 * Reparte un faltante: 60% al líder de punto y 40% en partes iguales entre los
 * auxiliares elegibles. Si no hay auxiliares elegibles, el líder asume el 100%.
 * Los pesos que sobran por redondeo los asume el líder, de modo que la suma
 * de lo cobrado es exactamente el faltante.
 */
export function repartirDescuadre(
  faltante: number,
  liderNombre: string,
  auxiliaresNombres: string[],
  equipo: MiembroEquipo[],
): RepartoDescuadre {
  const total = toPesos(faltante);
  const liderKey = normalizarTexto(liderNombre);
  const porNombre = new Map(equipo.map((m) => [normalizarTexto(m.nombre), m]));

  const vistos = new Set<string>();
  const auxiliaresElegibles: string[] = [];
  const excluidos: RepartoDescuadre["excluidos"] = [];

  for (const nombre of auxiliaresNombres) {
    const key = normalizarTexto(nombre);
    if (!key) continue;
    if (key === liderKey) {
      excluidos.push({ nombre, motivo: "Es el líder del turno" });
      continue;
    }
    if (vistos.has(key)) {
      excluidos.push({ nombre, motivo: "Nombre repetido" });
      continue;
    }
    vistos.add(key);
    const miembro = porNombre.get(key);
    if (miembro && !cargoParticipaEnDescuadre(miembro.cargo || miembro.role)) {
      excluidos.push({ nombre, motivo: `Cargo excluido (${miembro.cargo || miembro.role})` });
      continue;
    }
    auxiliaresElegibles.push(nombre);
  }

  if (total <= 0) {
    return { faltante: 0, lider: 0, porAuxiliar: 0, auxiliaresElegibles, excluidos };
  }

  if (auxiliaresElegibles.length === 0) {
    return { faltante: total, lider: total, porAuxiliar: 0, auxiliaresElegibles, excluidos };
  }

  const parteLider = Math.round(total * 0.6);
  const bolsaAuxiliares = total - parteLider;
  const porAuxiliar = Math.floor(bolsaAuxiliares / auxiliaresElegibles.length);
  const residuo = bolsaAuxiliares - porAuxiliar * auxiliaresElegibles.length;

  return {
    faltante: total,
    lider: parteLider + residuo,
    porAuxiliar,
    auxiliaresElegibles,
    excluidos,
  };
}

// ---------------------------------------------------------------------------
// Resolución de valores POS por canal
// ---------------------------------------------------------------------------

export interface PosData {
  efectivoPOS: number;
  tarjetasPOS: number;
  justoPOS: number;
  rappiPOS: number;
  transferenciasPOS: number;
}

export interface CierreParaPos {
  justoPOS?: number | null;
  rappiPOS?: number | null;
  transferenciasPOS?: number | null;
  justoCierre?: number | null;
  rappiCierre?: number | null;
  transferenciasCierre?: number | null;
}

/**
 * POS de Justo/Rappi/transferencias: el reporte cargado en esta sesión; si no hay,
 * el guardado en el cierre (si es > 0); si tampoco, lo declarado por la tienda
 * (sin evidencia del POS no se genera diferencia contra el POS).
 */
export function resolverPosCanales(posData: PosData | null, cierre: CierreParaPos) {
  const pick = (fromReport: number | undefined, saved: number | null | undefined, declared: number | null | undefined) => {
    if (posData) return toPesos(fromReport ?? 0);
    if (saved != null && Number(saved) > 0) return toPesos(saved);
    return toPesos(declared ?? 0);
  };
  return {
    justoPOS: pick(posData?.justoPOS, cierre.justoPOS, cierre.justoCierre),
    rappiPOS: pick(posData?.rappiPOS, cierre.rappiPOS, cierre.rappiCierre),
    transferenciasPOS: pick(posData?.transferenciasPOS, cierre.transferenciasPOS, cierre.transferenciasCierre),
  };
}

/**
 * Canales que Gerencia todavía no ha validado:
 *  - Justo, Rappi, transferencias: venta en el POS sin valor real ingresado
 *    (aprobar así registra un faltante igual a toda la venta del canal).
 *  - Efectivo y datáfono: la tienda declaró un valor pero no hay valor POS /
 *    vouchers confirmado contra el cual compararlo.
 */
export function canalesSinValidar(
  i: Pick<ConciliacionInput, "justoPOS" | "rappiPOS" | "transferenciasPOS" | "justoReal" | "rappiReal" | "transferenciasReal">
    & Partial<Pick<ConciliacionInput, "efectivoDeclarado" | "efectivoPOS" | "datafonoDeclarado" | "datafonoPOS">>,
): string[] {
  const out: string[] = [];
  if ((i.efectivoDeclarado ?? 0) > 0 && !i.efectivoPOS) out.push("Efectivo");
  if ((i.datafonoDeclarado ?? 0) > 0 && !i.datafonoPOS) out.push("Datáfono");
  if (i.justoPOS > 0 && !i.justoReal) out.push("Justo");
  if (i.rappiPOS > 0 && !i.rappiReal) out.push("Rappi");
  if (i.transferenciasPOS > 0 && !i.transferenciasReal) out.push("Transferencias");
  return out;
}

// ---------------------------------------------------------------------------
// Valores iniciales del formulario de conciliación
// ---------------------------------------------------------------------------

export interface CierreParaConciliar {
  estado?: string | null;
  efectivoPOS?: number | null;
  tarjetasPOS?: number | null;
  transferenciasPOS?: number | null;
  justoCierre?: number | null;
  rappiCierre?: number | null;
  transferenciasCierre?: number | null;
}

export interface ValoresConciliacion {
  efectivo: number;
  datafono: number;
  justo: number;
  rappi: number;
  transferencias: number;
  transferenciasCoincide: boolean;
}

/**
 * Con qué valores arranca la columna "Reales a Conciliar".
 *
 * Un cierre ya aprobado muestra lo que se guardó. Uno pendiente NUNCA se
 * pre-llena con lo declarado por la tienda ni con el propio POS en los
 * canales que se validan contra una fuente externa (vouchers, portal, banco):
 * eso dejaría la diferencia en 0 sin que nadie haya validado nada.
 * Solo se pre-llenan valores que vienen de una fuente independiente:
 * el efectivo del POS y el total de la API de Justo.
 */
export function valoresConciliacionIniciales(
  cierre: CierreParaConciliar,
  fuentes: { efectivoPOS?: number | null; justoApi?: number | null } = {},
): ValoresConciliacion {
  if (cierre.estado === "Cuadrado") {
    const transferencias = toPesos(cierre.transferenciasCierre ?? 0);
    return {
      efectivo: toPesos(cierre.efectivoPOS ?? 0),
      datafono: toPesos(cierre.tarjetasPOS ?? 0),
      justo: toPesos(cierre.justoCierre ?? 0),
      rappi: toPesos(cierre.rappiCierre ?? 0),
      transferencias,
      transferenciasCoincide: transferencias > 0 && transferencias === toPesos(cierre.transferenciasPOS ?? 0),
    };
  }
  const efectivoPOS = fuentes.efectivoPOS ?? cierre.efectivoPOS;
  return {
    efectivo: toPesos(efectivoPOS ?? 0),
    datafono: 0,
    justo: toPesos(fuentes.justoApi ?? 0),
    rappi: 0,
    transferencias: 0,
    transferenciasCoincide: false,
  };
}
