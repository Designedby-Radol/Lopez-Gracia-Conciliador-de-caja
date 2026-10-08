/**
 * Equipo de un cierre (líder y auxiliares): resolución de nombres a usuario_id
 * y forma en que se devuelve al cliente. Funciones puras para poder probarlas
 * sin base de datos. El reparto 60/40 NO se calcula aquí (src/lib/discrepancy.ts).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UsuarioEquipo {
  id: string;
  nombre: string | null;
  email?: string | null;
  cedula?: string | number | null;
  local_id?: string | null;
}

export function normalizarNombre(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

function coincide(u: UsuarioEquipo, entrada: string): boolean {
  if (UUID_RE.test(entrada)) return u.id.toLowerCase() === entrada.toLowerCase();
  const target = normalizarNombre(entrada);
  return (
    normalizarNombre(u.nombre || "") === target ||
    (!!u.email && normalizarNombre(u.email) === target) ||
    (u.cedula !== null && u.cedula !== undefined && String(u.cedula).trim() === entrada)
  );
}

/**
 * Resuelve un nombre, correo, cédula o UUID a un usuario_id con coincidencia EXACTA.
 * Primero busca en el local del cierre; si no hay coincidencia, en toda la empresa
 * (personal que cubre turnos en otra sede). Si la coincidencia es ambigua, no resuelve:
 * atribuir un cobro a otra persona es grave.
 */
export function resolverUsuario(entrada: string, usuarios: UsuarioEquipo[], localId?: string | null): string | null {
  const clean = String(entrada ?? "").trim();
  if (!clean) return null;
  const candidatos = usuarios.filter((u) => coincide(u, clean));
  const delLocal = localId ? candidatos.filter((u) => u.local_id === localId) : [];
  if (delLocal.length === 1) return delLocal[0].id;
  if (delLocal.length === 0 && candidatos.length === 1) return candidatos[0].id;
  return null;
}

/** Resuelve la lista de auxiliares; los repetidos se guardan una sola vez. */
export function resolverAuxiliares(
  entradas: unknown,
  usuarios: UsuarioEquipo[],
  localId?: string | null,
): { ids: string[]; noEncontrados: string[] } {
  const ids: string[] = [];
  const noEncontrados: string[] = [];
  const lista = Array.isArray(entradas) ? entradas : [];
  for (const entrada of lista) {
    if (typeof entrada !== "string" || !entrada.trim()) continue;
    const id = resolverUsuario(entrada, usuarios, localId);
    if (!id) noEncontrados.push(entrada.trim());
    else if (!ids.includes(id)) ids.push(id);
  }
  return { ids, noEncontrados };
}

/** Aplana el embed de PostgREST (`auxiliares:cierre_auxiliares(usuario_id, usuario:usuarios(nombre))`). */
export function aplanarAuxiliares(row: any): any {
  if (!row || typeof row !== "object") return row;
  const embebidos: any[] = Array.isArray(row.auxiliares) ? row.auxiliares : [];
  const auxiliares = embebidos
    .map((a) => ({ id: a?.usuario_id ?? null, nombre: a?.usuario?.nombre ?? null }))
    .filter((a) => a.id)
    .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
  return { ...row, auxiliares };
}
