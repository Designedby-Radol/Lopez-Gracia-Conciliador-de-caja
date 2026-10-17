/**
 * Asignación de las marcaciones del reporte POS a cada colaborador de la nómina.
 *
 * Nunca se "adivina": un bloque de marcaciones se asigna a un colaborador solo si
 * la clave del reporte es su nombre exacto o si `matchEmployeeName` lo identifica
 * sin ambigüedad (cédula o ≥ 2 palabras del nombre). En particular, si el reporte
 * trae un solo colaborador, NO se le asigna a todos los demás.
 */
import { matchEmployeeName } from "../utils/colombianPayroll";

export interface ResultadoMarcaciones<T> {
  /** Marcaciones por nombre del colaborador (tal como está en teamMembers). */
  porEmpleado: Record<string, T>;
  /** Colaboradores para los que no se encontró ninguna marcación en el reporte. */
  sinMarcaciones: string[];
  /** Nombres del reporte que no se pudieron asociar a ningún colaborador. */
  noAsignados: string[];
}

export function asignarMarcaciones<T>(
  posParsedMap: Record<string, T>,
  teamMembers: { nombre: string; cedula?: string | number | null }[],
): ResultadoMarcaciones<T> {
  const porEmpleado: Record<string, T> = {};
  const noAsignados: string[] = [];
  const nombres = new Set(teamMembers.map((m) => m.nombre));

  for (const [clave, logs] of Object.entries(posParsedMap)) {
    const nombre = nombres.has(clave) ? clave : matchEmployeeName(clave, teamMembers)?.nombre;
    if (!nombre) {
      noAsignados.push(clave);
      continue;
    }
    // La clave exacta tiene prioridad sobre una coincidencia aproximada.
    if (porEmpleado[nombre] === undefined || clave === nombre) porEmpleado[nombre] = logs;
  }

  const sinMarcaciones = teamMembers
    .map((m) => m.nombre)
    .filter((nombre) => porEmpleado[nombre] === undefined);

  return { porEmpleado, sinMarcaciones, noAsignados };
}
