import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(rawUrl?: string): string {
  let url = (rawUrl || "").trim();
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/rest\/?$/i, "");
  return url.replace(/\/+$/, "");
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // Sin service_role el servidor no puede operar con RLS activo: mejor fallar al arrancar
  // que funcionar a medias con la clave pública.
  throw new Error(
    "Faltan variables de entorno: SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY son obligatorias."
  );
}

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id?: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id.trim());
}
