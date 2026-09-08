import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return "https://zcltxutkxvhagblvnscy.supabase.co";
  let url = rawUrl.trim();
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/rest\/?$/i, "");
  url = url.replace(/\/+$/, "");
  return url || "https://zcltxutkxvhagblvnscy.supabase.co";
}

const env = (import.meta as any).env || {};
const rawSupabaseUrl = (env.VITE_SUPABASE_URL as string) || "";
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY as string) || 
  (env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjbHR4dXRreHZoYWdibHZuc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzA3MjYsImV4cCI6MjEwMTM0NjcyNn0.pfqPjpHtRJEvY988Sooaw-pd_LJL0-hxeSSFMjehZRg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
