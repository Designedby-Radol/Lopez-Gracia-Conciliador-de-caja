/**
 * Utilidades de fecha en hora de Colombia (America/Bogota, UTC-5 sin horario de verano).
 *
 * Evitar `new Date().toISOString().split("T")[0]`: devuelve la fecha UTC, que después
 * de las 7:00 p.m. en Bogotá ya es el día siguiente.
 */
export const BOGOTA_TZ = "America/Bogota";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOGOTA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha `YYYY-MM-DD` de un instante, en hora de Bogotá. */
export function toBogotaIsoDate(date: Date = new Date()): string {
  return isoDateFormatter.format(date);
}

/** Fecha de hoy `YYYY-MM-DD` en Bogotá. */
export function todayBogota(): string {
  return toBogotaIsoDate(new Date());
}

/** Suma (o resta) días a una fecha `YYYY-MM-DD` sin depender de la zona horaria del equipo. */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Primer día del mes de una fecha `YYYY-MM-DD`. */
export function startOfMonthIso(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** Interpreta `YYYY-MM-DD` como fecha local (sin el desfase de un día que causa `new Date("YYYY-MM-DD")`). */
export function parseIsoDateLocal(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Días del mes (28–31) para año y mes (1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
