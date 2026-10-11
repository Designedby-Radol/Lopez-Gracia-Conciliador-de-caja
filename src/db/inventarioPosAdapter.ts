import { api } from "../lib/api";
import { resolveLocalId } from "./dbAdapter";
import type {
  BodegaPOS,
  CatalogoItemPOS,
  CategoriaMovimiento,
  CostoVentaPOS,
  CuadreTeoricoPOS,
  ExistenciaPOS,
  KardexItemPOS,
  MovimientoPOS,
  ResumenExistencias,
  TotalesCostoVentas,
} from "../lib/inventarioPos";

// Respuestas de /api/inventario-pos/* (sin el campo "success").

export type NoConfigurado = { configurado: false; razon: string };

export type CatalogoPOSResp = NoConfigurado | { configurado: true; bodega: BodegaPOS; items: CatalogoItemPOS[] };

export type BodegasPOSResp =
  | NoConfigurado
  | { configurado: true; bodegaLocal: BodegaPOS; bodegas: (BodegaPOS & { puntoDeVentaNombre: string })[] };

export type ExistenciasPOSResp =
  | NoConfigurado
  | {
      configurado: true;
      bodega: BodegaPOS;
      fecha: string;
      periodo: string;
      corte: string;
      aperturaPendiente: boolean;
      advertencias: string[];
      items: ExistenciaPOS[];
      resumen: ResumenExistencias;
    };

export type MovimientosPOSResp =
  | NoConfigurado
  | {
      configurado: true;
      bodega: BodegaPOS;
      desde: string;
      hasta: string;
      movimientos: MovimientoPOS[];
      kardex: KardexItemPOS[];
      totalesPorCategoria: Partial<Record<CategoriaMovimiento, { movimientos: number; valor: number }>>;
      advertencias: string[];
    };

export type CuadrePOSResp =
  | NoConfigurado
  | {
      configurado: true;
      bodega: BodegaPOS;
      fecha: string;
      corte: string;
      aperturaPendiente: boolean;
      advertencias: string[];
      items: CuadreTeoricoPOS[];
    };

export type CostoVentasPOSResp =
  | NoConfigurado
  | {
      configurado: true;
      bodega: BodegaPOS;
      desde: string;
      hasta: string;
      items: CostoVentaPOS[];
      totales: TotalesCostoVentas;
      /** "inventario" = costo total del consumo por ventas (kardex); "reporte" = suma del reporte, solo productos con venta. */
      fuenteCosto: "inventario" | "reporte";
      /** Costo de receta de los productos con venta según el reporte de IntuiPOS. */
      costoReporte: number;
      advertencias: string[];
    };

type Params = Record<string, string | number | null | undefined>;

/**
 * GET a /api/inventario-pos/<ruta>. Si el local no se puede resolver se propaga el error
 * (a diferencia de operacionAdapter) para no mostrar existencias de otro local.
 */
async function getPos<T extends { configurado: boolean }>(ruta: string, localName: string | undefined, params: Params = {}): Promise<T> {
  const qs = new URLSearchParams();
  if (localName) qs.set("local_id", await resolveLocalId(localName));
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === null || valor === undefined || valor === "") continue;
    qs.set(clave, String(valor));
  }
  const query = qs.toString();
  const { success: _success, ...resto } = await api<{ success: true; configurado: boolean; razon?: string }>(
    `/api/inventario-pos/${ruta}${query ? `?${query}` : ""}`,
  );
  if (!resto.configurado) {
    return { configurado: false, razon: resto.razon || "IntuiPOS no está configurado para este local." } as unknown as T;
  }
  return resto as unknown as T;
}

export const inventarioPosAdapter = {
  getCatalogo(localName?: string): Promise<CatalogoPOSResp> {
    return getPos<CatalogoPOSResp>("catalogo", localName);
  },

  getBodegas(localName?: string): Promise<BodegasPOSResp> {
    return getPos<BodegasPOSResp>("bodegas", localName);
  },

  getExistencias(localName: string, { fecha, bodegaId }: { fecha: string; bodegaId?: number | null }): Promise<ExistenciasPOSResp> {
    return getPos<ExistenciasPOSResp>("existencias", localName, { fecha, bodega_id: bodegaId });
  },

  getMovimientos(
    localName: string,
    { desde, hasta, bodegaId }: { desde: string; hasta: string; bodegaId?: number | null },
  ): Promise<MovimientosPOSResp> {
    return getPos<MovimientosPOSResp>("movimientos", localName, { desde, hasta, bodega_id: bodegaId });
  },

  getCuadre(localName: string, fecha: string): Promise<CuadrePOSResp> {
    return getPos<CuadrePOSResp>("cuadre", localName, { fecha });
  },

  getCostoVentas(
    localName: string,
    { desde, hasta, bodegaId }: { desde: string; hasta: string; bodegaId?: number | null },
  ): Promise<CostoVentasPOSResp> {
    return getPos<CostoVentasPOSResp>("costo-ventas", localName, { desde, hasta, bodega_id: bodegaId });
  },
};
