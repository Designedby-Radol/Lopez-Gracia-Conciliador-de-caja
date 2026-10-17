import { Router, type Request } from "express";
import { supabaseAdmin, isValidUUID } from "../supabase";
import { requireAuth } from "../auth";
import { writeAudit } from "../audit";

/** Inventarios, checklists y catálogo de insumos. */
export const operacionRouter = Router();
operacionRouter.use(requireAuth);

const TIPOS = new Set(["inventario", "checklist"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function scopedLocalId(req: Request): string | null {
  const requested = (req.query.local_id || req.body?.local_id) as string | undefined;
  if (req.user!.isGerencia && isValidUUID(requested)) return requested;
  return req.user!.localId;
}

const puedeEditarCatalogo = (req: Request) =>
  req.user!.isGerencia || (req.user!.cargo || "").toLowerCase().includes("lider");

operacionRouter.get("/registros", async (req, res) => {
  const tipo = String(req.query.tipo || "");
  if (!TIPOS.has(tipo)) return res.status(400).json({ success: false, error: "Tipo inválido." });
  const localId = scopedLocalId(req);
  if (!localId) return res.json({ success: true, data: [] });

  const { data, error } = await supabaseAdmin
    .from("registros_operativos")
    .select("id, fecha, data, created_at, usuario:usuarios(nombre)")
    .eq("tipo", tipo)
    .eq("local_id", localId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data: data || [] });
});

/** Crea uno o varios registros (varios = importación desde localStorage). */
operacionRouter.post("/registros", async (req, res) => {
  const tipo = String(req.body?.tipo || "");
  const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [req.body];
  if (!TIPOS.has(tipo)) return res.status(400).json({ success: false, error: "Tipo inválido." });
  if (items.length === 0 || items.length > 500) return res.status(400).json({ success: false, error: "Cantidad de registros inválida." });

  const localId = scopedLocalId(req);
  if (!localId) return res.status(400).json({ success: false, error: "El usuario no tiene un local asignado." });

  const rows = [];
  for (const it of items) {
    if (!ISO_DATE.test(String(it?.fecha || "")) || typeof it?.data !== "object" || it.data === null) {
      return res.status(400).json({ success: false, error: "Cada registro necesita fecha (YYYY-MM-DD) y data." });
    }
    rows.push({
      tipo,
      local_id: localId,
      usuario_id: req.user!.sub,
      fecha: it.fecha,
      data: it.data,
      legacy_id: it.legacy_id ? String(it.legacy_id) : null,
    });
  }

  // ignoreDuplicates: reimportar desde otro navegador no duplica registros
  const { data, error } = await supabaseAdmin
    .from("registros_operativos")
    .upsert(rows, { onConflict: "tipo,legacy_id", ignoreDuplicates: true })
    .select("id, fecha, data, created_at");
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data: data || [] });
});

operacionRouter.delete("/registros/:id", async (req, res) => {
  if (!req.user!.isGerencia) return res.status(403).json({ success: false, error: "Solo Gerencia puede eliminar registros." });
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ success: false, error: "ID inválido." });
  const { error } = await supabaseAdmin.from("registros_operativos").delete().eq("id", id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  await writeAudit(req, { action: "REGISTRO_ELIMINADO", description: `Registro operativo ${id}` });
  res.json({ success: true });
});

operacionRouter.get("/inventario-catalogo", async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("app_config").select("value").eq("key", "inventario_catalogo").maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data: data?.value ?? null });
});

operacionRouter.put("/inventario-catalogo", async (req, res) => {
  if (!puedeEditarCatalogo(req)) return res.status(403).json({ success: false, error: "Solo Gerencia o líderes pueden editar el catálogo." });
  const catalogo = req.body?.catalogo;
  if (!Array.isArray(catalogo)) return res.status(400).json({ success: false, error: "Formato inválido." });
  const { error } = await supabaseAdmin.from("app_config").upsert(
    { key: "inventario_catalogo", value: catalogo, updated_at: new Date().toISOString(), updated_by: req.user!.sub },
    { onConflict: "key" }
  );
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});
