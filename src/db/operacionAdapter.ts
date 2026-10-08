import { api } from "../lib/api";
import { resolveLocalId } from "./dbAdapter";

export type TipoRegistro = "inventario" | "checklist";

interface RegistroRow {
  id: string;
  fecha: string;
  data: any;
  created_at: string;
  usuario?: { nombre: string } | null;
}

/** Claves de localStorage donde vivían los registros antes de pasar a Supabase. */
const LEGACY_KEYS: Record<TipoRegistro, string[]> = {
  inventario: ["lopez_gracia_inventory_closures"],
  checklist: ["lopez_gracia_checklists_history", "lopez_gracia_checklists"],
};

const migratedFlag = (tipo: TipoRegistro) => `lg_migrado_${tipo}_v1`;

function fromRow<T>(row: RegistroRow): T {
  return {
    ...row.data,
    id: row.id,
    fecha: row.fecha,
    createdAt: row.data?.createdAt || row.created_at,
    usuarioNombre: row.data?.usuarioNombre || row.usuario?.nombre || "",
  } as T;
}

async function localQuery(localName?: string): Promise<string> {
  if (!localName) return "";
  try {
    return `&local_id=${encodeURIComponent(await resolveLocalId(localName))}`;
  } catch {
    return "";
  }
}

/**
 * Sube una sola vez los registros que este navegador tenía en localStorage.
 * El servidor ignora duplicados (legacy_id), así que es seguro si otro equipo ya los subió.
 */
async function importarLegado(tipo: TipoRegistro, localName?: string): Promise<void> {
  try {
    if (localStorage.getItem(migratedFlag(tipo))) return;
    const vistos = new Set<string>();
    const items: any[] = [];
    for (const key of LEGACY_KEYS[tipo]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      for (const rec of JSON.parse(raw) as any[]) {
        if (!rec?.id || !rec?.fecha || vistos.has(rec.id)) continue;
        vistos.add(rec.id);
        items.push({ fecha: rec.fecha, data: rec, legacy_id: rec.id });
      }
    }
    if (items.length > 0) {
      const local_id = localName ? await resolveLocalId(localName).catch(() => undefined) : undefined;
      await api("/api/db/registros", { method: "POST", json: { tipo, items, local_id } });
    }
    localStorage.setItem(migratedFlag(tipo), new Date().toISOString());
  } catch (err) {
    // Se reintenta en la próxima carga; los datos locales no se borran.
    console.warn(`No se pudieron importar los registros locales de ${tipo}:`, err);
  }
}

export const operacionAdapter = {
  async getRegistros<T>(tipo: TipoRegistro, localName?: string): Promise<T[]> {
    await importarLegado(tipo, localName);
    const { data } = await api<{ data: RegistroRow[] }>(`/api/db/registros?tipo=${tipo}${await localQuery(localName)}`);
    return data.map((r) => fromRow<T>(r));
  },

  async saveRegistro<T extends { fecha: string }>(tipo: TipoRegistro, record: T, localName?: string): Promise<T> {
    const local_id = localName ? await resolveLocalId(localName).catch(() => undefined) : undefined;
    const { data } = await api<{ data: RegistroRow[] }>("/api/db/registros", {
      method: "POST",
      json: { tipo, local_id, items: [{ fecha: record.fecha, data: record }] },
    });
    return fromRow<T>(data[0]);
  },

  async getCatalogoInventario<T>(): Promise<T[] | null> {
    const { data } = await api<{ data: T[] | null }>("/api/db/inventario-catalogo");
    return data;
  },

  async saveCatalogoInventario<T>(catalogo: T[]): Promise<void> {
    await api("/api/db/inventario-catalogo", { method: "PUT", json: { catalogo } });
  },
};
