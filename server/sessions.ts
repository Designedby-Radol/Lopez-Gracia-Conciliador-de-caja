import { supabaseAdmin } from "./supabase";
import { invalidateSessionCache, type SessionState } from "./auth";

/** Estado de la cuenta para validar cookies (ver loadSession). */
export async function lookupSessionState(usuarioId: string): Promise<SessionState | null> {
  const { data, error } = await supabaseAdmin
    .from("credenciales")
    .select("session_version, activo")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { version: Number(data.session_version), activo: Boolean(data.activo) };
}

/**
 * Incrementa credenciales.session_version (atómico, vía RPC) y devuelve la nueva
 * versión: todas las cookies emitidas antes dejan de valer.
 */
export async function bumpSessionVersion(usuarioId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("bump_session_version", { p_usuario_id: usuarioId });
  invalidateSessionCache(usuarioId);
  if (error) throw error;
  return Number(data);
}
