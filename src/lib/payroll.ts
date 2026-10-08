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
