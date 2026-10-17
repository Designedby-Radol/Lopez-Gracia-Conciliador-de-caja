/**
 * Parámetros de jornada (Colombia) que dependen de la fecha.
 */
import { addDaysIso } from "./dates";

/**
 * Jornada máxima semanal según la reducción gradual de la Ley 2101 de 2021.
 * Cada reducción entra en vigor el 15 de julio.
 */
export function horasSemanalesLegales(fechaIso: string): number {
  if (fechaIso >= "2026-07-15") return 42;
  if (fechaIso >= "2025-07-15") return 44;
  if (fechaIso >= "2024-07-15") return 46;
  if (fechaIso >= "2023-07-15") return 47;
  return 48;
}

/**
 * Divisor mensual para la hora ordinaria (horas semanales × 5):
 * 48 h → 240, 47 h → 235, 46 h → 230, 44 h → 220, 42 h → 210.
 */
export function divisorHorasMes(fechaIso: string): number {
  return horasSemanalesLegales(fechaIso) * 5;
}

/** Inicio de la jornada nocturna (7:00 p. m.) y fin (6:00 a. m.), en minutos del día. */
export const INICIO_NOCTURNO_MIN = 19 * 60;
export const FIN_NOCTURNO_MIN = 6 * 60;

/**
 * Minutos trabajados en franja nocturna (19:00–06:00) para un turno
 * [inicio, fin] en minutos del día. Si fin < inicio, el turno cruza medianoche.
 */
export function minutosNocturnos(inicioMin: number, finMin: number): number {
  const inicio = inicioMin;
  const fin = finMin < inicioMin ? finMin + 1440 : finMin;
  // Franjas nocturnas cubriendo dos días: [00:00–06:00], [19:00–06:00 del día siguiente], [19:00 del día 2…]
  const franjas: [number, number][] = [
    [0, FIN_NOCTURNO_MIN],
    [INICIO_NOCTURNO_MIN, 1440 + FIN_NOCTURNO_MIN],
    [1440 + INICIO_NOCTURNO_MIN, 2880],
  ];
  return franjas.reduce((acc, [a, b]) => acc + Math.max(0, Math.min(fin, b) - Math.max(inicio, a)), 0);
}

/** Duración en minutos de un turno, soportando turnos que cruzan medianoche. */
export function duracionTurnoMin(inicioMin: number, finMin: number): number {
  return finMin >= inicioMin ? finMin - inicioMin : finMin + 1440 - inicioMin;
}

/** Fechas `YYYY-MM-DD` de un período, ambos extremos incluidos. */
export function fechasDelPeriodo(inicioIso: string, finIso: string): string[] {
  if (!inicioIso || !finIso || finIso < inicioIso) return [];
  const out: string[] = [];
  for (let f = inicioIso; f <= finIso && out.length < 62; f = addDaysIso(f, 1)) out.push(f);
  return out;
}

/**
 * Recargo por trabajo dominical o festivo según la gradualidad de la Ley 2466 de 2025
 * (cada aumento entra en vigor el 1 de julio): 75 % → 80 % → 90 % → 100 %.
 * Devuelve el factor que se suma a la hora ordinaria (0,90 = +90 %).
 */
export function factorDominical(fechaIso: string): number {
  if (fechaIso >= "2027-07-01") return 1.0;
  if (fechaIso >= "2026-07-01") return 0.9;
  if (fechaIso >= "2025-07-01") return 0.8;
  return 0.75;
}

/** Recargo dominical como texto, p. ej. "+90%". */
export function etiquetaRecargoDominical(fechaIso: string): string {
  return `+${Math.round(factorDominical(fechaIso) * 100)}%`;
}

/** Factores de hora extra sobre la hora ordinaria (CST art. 168). */
export const FACTOR_HORA_EXTRA_DIURNA = 1.25;
export const FACTOR_HORA_EXTRA_NOCTURNA = 1.75;

/**
 * Lleva una hora de salida a una línea de tiempo continua respecto a la entrada:
 * si sale "antes" de entrar, el turno cruzó medianoche y se suma un día (1440 min).
 */
export function salidaContinuaMin(entradaMin: number, salidaMin: number): number {
  return salidaMin < entradaMin ? salidaMin + 1440 : salidaMin;
}

/** Minutos nocturnos (19:00–06:00) del intervalo [desde, hasta] en línea de tiempo continua. */
export function minutosNocturnosIntervalo(desdeMin: number, hastaMin: number): number {
  const duracion = hastaMin - desdeMin;
  if (duracion <= 0) return 0;
  const inicioDia = ((desdeMin % 1440) + 1440) % 1440;
  return minutosNocturnos(inicioDia, inicioDia + duracion);
}

export interface TiempoDia {
  /** Minutos extra pagaderos a 1,25 (después de compensar faltantes del mismo día). */
  extraDiurnaMin: number;
  /** Minutos extra pagaderos a 1,75 (los que caen entre 19:00 y 06:00). */
  extraNocturnaMin: number;
  /** Tardanza + salida anticipada que no se compensó el mismo día; se descuenta a valor ordinario. */
  faltantesMin: number;
  /** Minutos nocturnos de jornada ordinaria (recargo +35 %); excluye los extra nocturnos. */
  recargoNocturnoMin: number;
}

/**
 * Clasifica el tiempo de un día. Todos los valores en línea de tiempo continua (ver
 * `salidaContinuaMin`). Los minutos que se quedó después de la salida programada primero
 * reponen la tardanza/salida anticipada del mismo día (no superan la jornada, así que no son
 * extra); solo el excedente es hora extra y se separa en diurna y nocturna.
 */
export function clasificarTiempoDia(p: {
  inicioEfectivoMin: number;
  salidaProgramadaMin: number;
  salidaRealMin: number;
  faltantesMin: number;
}): TiempoDia {
  const extraBruto = Math.max(0, p.salidaRealMin - p.salidaProgramadaMin);
  const compensados = Math.min(p.faltantesMin, extraBruto);
  const inicioExtra = p.salidaProgramadaMin + compensados;
  const extraTotal = extraBruto - compensados;
  const extraNocturnaMin = extraTotal > 0 ? minutosNocturnosIntervalo(inicioExtra, p.salidaRealMin) : 0;
  const finOrdinario = Math.min(p.salidaRealMin, inicioExtra);
  return {
    extraDiurnaMin: extraTotal - extraNocturnaMin,
    extraNocturnaMin,
    faltantesMin: p.faltantesMin - compensados,
    recargoNocturnoMin: minutosNocturnosIntervalo(p.inicioEfectivoMin, finOrdinario),
  };
}

/**
 * Totaliza el período sin cruzar tarifas: las extra diurnas y nocturnas se pagan cada una a su
 * factor y los faltantes se descuentan a valor de hora ordinaria (no se netean entre días).
 */
export function totalizarTiempoPeriodo(
  dias: Pick<TiempoDia, "extraDiurnaMin" | "extraNocturnaMin" | "faltantesMin">[],
  valorHoraOrdinaria: number
): { horasExtraDiurnas: number; horasExtraNocturnas: number; deduccionTiempoFaltante: number } {
  const suma = (k: "extraDiurnaMin" | "extraNocturnaMin" | "faltantesMin") => dias.reduce((acc, d) => acc + (d[k] || 0), 0);
  const aHoras = (min: number) => Math.round((min / 60) * 10) / 10;
  return {
    horasExtraDiurnas: aHoras(suma("extraDiurnaMin")),
    horasExtraNocturnas: aHoras(suma("extraNocturnaMin")),
    deduccionTiempoFaltante: Math.round((suma("faltantesMin") / 60) * valorHoraOrdinaria),
  };
}
