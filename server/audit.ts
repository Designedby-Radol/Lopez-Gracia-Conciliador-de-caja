import type { Request } from "express";
import { supabaseAdmin } from "./supabase";

export interface AuditEntry {
  action: string;
  targetUser?: string;
  executedBy?: string;
  description?: string;
  status?: "success" | "warning" | "error";
}

export function clientIp(req: Request): string | undefined {
  return req.ip || req.headers["x-forwarded-for"]?.toString();
}

/** Registra un evento en audit_log. Nunca lanza: la auditoría no debe tumbar la operación. */
export async function writeAudit(req: Request, entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("audit_log").insert({
      action: entry.action,
      target_user: entry.targetUser ?? null,
      executed_by: entry.executedBy ?? req.user?.nombre ?? "Sistema",
      description: entry.description ?? null,
      status: entry.status ?? "success",
      ip: clientIp(req) ?? null,
    });
    if (error) console.error("[audit] No se pudo registrar:", error.message);
  } catch (err) {
    console.error("[audit] Error inesperado:", err);
  }
}
