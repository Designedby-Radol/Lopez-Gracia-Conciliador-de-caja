import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Obtener las credenciales de Supabase desde las variables de entorno o import.meta.env
const metaEnv = (import.meta as any).env || {};
const procEnv = (typeof process !== "undefined" && process.env) ? process.env : {};

const supabaseUrl = (metaEnv.VITE_SUPABASE_URL as string) || (procEnv.VITE_SUPABASE_URL as string) || "";
const supabaseAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY as string) || (procEnv.VITE_SUPABASE_ANON_KEY as string) || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseAnonKey.includes("YOUR_")
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (isSupabaseConfigured) {
  console.log("⚡ Supabase inicializado correctamente.");
} else {
  console.log("ℹ️ Supabase no está configurado aún. Operando en Modo Local (LocalStorage) de alta fidelidad.");
}
