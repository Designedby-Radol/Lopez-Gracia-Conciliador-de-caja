import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const local = vi.hoisted(() => ({ fila: null as null | { intuipos_store_id: string | null } }));
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: local.fila, error: null }) }) }) }),
  },
}));

import {
  PosError,
  intuiposGet,
  limpiarCachePos,
  listarBodegas,
  obtenerCostoVentas,
  obtenerExistencias,
  obtenerMovimientos,
  resolverPosLocal,
  verificarApertura,
} from "./intuipos";

const TOKEN = "token-de-prueba";
const BODEGA = { id: 2140101, nombre: "BODEGA CENTRO", puntoDeVentaId: 21401 };

const PDVS = [
  { iPuntoDeVentaID: 21401, vName: "LOCAL CENTRO", iCompanyID: 1, iWareHouseIDDefault: 2140101 },
  { iPuntoDeVentaID: 21403, vName: "LOCAL SIN BODEGA", iCompanyID: 1, iWareHouseIDDefault: null },
  { iPuntoDeVentaID: 21490, vName: "ACOPIO", iCompanyID: 1, iWareHouseIDDefault: 2149001 },
];
const BODEGAS = [
  { iWareHouseID: 2140101, vName: " BODEGA CENTRO ", iPuntoDeVentaID: 21401, bIsVirtual: false, tiStatusID: 1 },
  { iWareHouseID: 2149001, vName: "BODEGA ACOPIO", iPuntoDeVentaID: 21490, bIsVirtual: false, tiStatusID: 1 },
  { iWareHouseID: 2149002, vName: "VIRTUAL", iPuntoDeVentaID: 21490, bIsVirtual: true, tiStatusID: 1 },
  { iWareHouseID: 2149003, vName: "INACTIVA", iPuntoDeVentaID: 21490, bIsVirtual: false, tiStatusID: 0 },
];

const encabezado = (id: number, tipo: number, dtDate: string, tiStatusID = 1) => ({
  biTransactionID: id,
  tiTransactionTypeID: tipo,
  dtDate,
  tiStatusID,
  vObservations: null,
  vTerminalID: "CAJA",
  biEmployeeID: 1,
  iWareHouseID: 2140101,
  PuntoDeVentaFrom: null,
  iSupplierID: null,
});

const detalle = (transaccion: number, cantidad: number) => ({
  biTransactionDetailID: transaccion * 10,
  biTransactionID: transaccion,
  tiTransactionTypeID: 27,
  TransactionType: "AJUSTE DE INVENTARIO",
  iItemID: 7,
  ItemName: "Harina",
  GroupName: "Secos",
  SubGroupName: "Harinas",
  MeasureUnit_Inventory: "gr",
  dQuantity: cantidad,
  mItemPrice: 2,
  mTotal: cantidad * 2,
  dtDate: "2026-10-09T19:00:00",
  iPeriodo: 202610,
  SupplierName: null,
  vExternalDocumentID: null,
  vObservations: null,
  vObservationsOnDetail: null,
  WareHouseName: "BODEGA CENTRO",
  tiDetailStatusID: 1,
});

/** fetch falso: responde según la ruta pedida y registra las llamadas. */
function simularFetch(responder: (ruta: string) => unknown) {
  const llamadas: { url: string; headers: Record<string, string> }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    llamadas.push({ url, headers: init?.headers as Record<string, string> });
    const r = responder(url.replace("https://webapi.intuipos.net/api/v1", ""));
    if (r instanceof Response) return r;
    return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fn);
  return llamadas;
}

beforeEach(() => {
  limpiarCachePos();
  vi.stubEnv("INTUIPOS_TOKEN", TOKEN);
  vi.stubEnv("INTUIPOS_STORE_ID", "");
  local.fila = { intuipos_store_id: "21401" };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("intuiposGet", () => {
  it("manda ApiKey y StoreId y comparte la petición simultánea", async () => {
    const llamadas = simularFetch(() => [1, 2]);
    const [a, b] = await Promise.all([intuiposGet("/x", "21401", 60_000), intuiposGet("/x", "21401", 60_000)]);
    expect(a).toEqual([1, 2]);
    expect(b).toBe(a);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].headers).toMatchObject({ ApiKey: TOKEN, StoreId: "21401" });
  });

  it("vuelve a pedir cuando vence el ttl", async () => {
    const llamadas = simularFetch(() => []);
    const ahora = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    await intuiposGet("/x", "21401", 60_000);
    ahora.mockReturnValue(1_030_000);
    await intuiposGet("/x", "21401", 60_000);
    expect(llamadas).toHaveLength(1);
    ahora.mockReturnValue(1_060_001);
    await intuiposGet("/x", "21401", 60_000);
    expect(llamadas).toHaveLength(2);
  });

  it("HTTP de error → PosError con el estado, sin el token, y no queda en caché", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let estado = 500;
    const llamadas = simularFetch(() => (estado === 200 ? [] : new Response("fallo", { status: estado })));
    const error = (await intuiposGet("/x", "21401", 60_000).catch((e: unknown) => e)) as PosError;
    expect(error).toBeInstanceOf(PosError);
    expect(error.status).toBe(500);
    expect(error.message).toBe("IntuiPOS respondió HTTP 500");
    expect(error.message).not.toContain(TOKEN);
    estado = 200;
    await intuiposGet("/x", "21401", 60_000);
    expect(llamadas).toHaveLength(2);
  });

  it("respuesta que no es JSON → PosError 502", async () => {
    simularFetch(() => new Response("<html>", { status: 200 }));
    await expect(intuiposGet("/x", "21401", 60_000)).rejects.toMatchObject({ name: "PosError", status: 502 });
  });

  it("timeout mientras se lee el cuerpo → 'no respondió a tiempo' (504), no 'no es JSON'", async () => {
    simularFetch(() => {
      const r = new Response("[1,", { status: 200 });
      vi.spyOn(r, "json").mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
      return r;
    });
    await expect(intuiposGet("/lento", "21401", 60_000)).rejects.toMatchObject({
      name: "PosError",
      status: 504,
      message: "IntuiPOS no respondió a tiempo.",
    });
  });

  it("sin token no llama a la red", async () => {
    vi.stubEnv("INTUIPOS_TOKEN", "");
    vi.stubEnv("INTUIPOS_API_KEY", "");
    const llamadas = simularFetch(() => []);
    await expect(intuiposGet("/x", "21401", 60_000)).rejects.toBeInstanceOf(PosError);
    expect(llamadas).toHaveLength(0);
  });
});

describe("resolverPosLocal y listarBodegas", () => {
  const configuracion = (ruta: string) =>
    ruta === "/Configuration/GetPuntosDeVenta" ? PDVS : ruta === "/Configuration/GetWarehouses" ? BODEGAS : [];

  it("resuelve la bodega por defecto del punto de venta", async () => {
    simularFetch(configuracion);
    expect(await resolverPosLocal("local")).toEqual({ configurado: true, storeId: "21401", bodega: BODEGA });
  });

  it("explica por qué no está configurado", async () => {
    simularFetch(configuracion);
    local.fila = { intuipos_store_id: null };
    expect(await resolverPosLocal("local")).toEqual({ configurado: false, razon: "El local no tiene intuipos_store_id configurado" });
    local.fila = { intuipos_store_id: "21403" };
    expect(await resolverPosLocal("local")).toMatchObject({ configurado: false, razon: expect.stringContaining("21403") });
    local.fila = { intuipos_store_id: "21401" };
    vi.stubEnv("INTUIPOS_TOKEN", "");
    expect(await resolverPosLocal("local")).toEqual({ configurado: false, razon: "Falta INTUIPOS_TOKEN en variables de entorno" });
  });

  it("usa INTUIPOS_STORE_ID si el local no tiene uno propio", async () => {
    simularFetch(configuracion);
    local.fila = { intuipos_store_id: null };
    vi.stubEnv("INTUIPOS_STORE_ID", "21401");
    expect(await resolverPosLocal("local")).toMatchObject({ configurado: true, storeId: "21401" });
  });

  it("lista solo bodegas activas no virtuales con el nombre del punto de venta", async () => {
    simularFetch(configuracion);
    expect(await listarBodegas("21401")).toEqual([
      { ...BODEGA, puntoDeVentaNombre: "LOCAL CENTRO" },
      { id: 2149001, nombre: "BODEGA ACOPIO", puntoDeVentaId: 21490, puntoDeVentaNombre: "ACOPIO" },
    ]);
  });
});

describe("consultas de inventario", () => {
  it("existencias: arma la ruta con periodo y corte", async () => {
    const llamadas = simularFetch(() => []);
    await obtenerExistencias("21401", BODEGA, { periodo: "202610", corte: "2026-10-10T04:00:00" });
    expect(llamadas[0].url).toBe(
      "https://webapi.intuipos.net/api/v1/Inventory/GetInventoryByItem/2140101/202610/21401?dtFechaDeCorte=2026-10-10T04:00:00",
    );
  });

  it("rechaza ids y fechas que no son válidos antes de llamar a la red", async () => {
    const llamadas = simularFetch(() => []);
    const raro = { ...BODEGA, id: "1/../2" as unknown as number };
    await expect(obtenerExistencias("21401", raro, { periodo: "202610", corte: "2026-10-10T04:00:00" })).rejects.toMatchObject({ status: 400 });
    await expect(obtenerExistencias("21401", BODEGA, { periodo: "202613", corte: "2026-10-10T04:00:00" })).rejects.toBeInstanceOf(PosError);
    await expect(obtenerExistencias("21401", BODEGA, { periodo: "202610", corte: "2026-10-10&x=1" })).rejects.toBeInstanceOf(PosError);
    await expect(obtenerMovimientos("21401", 21401, [27], "2026-10-09", "2026-10-10T04:00:00")).rejects.toBeInstanceOf(PosError);
    await expect(obtenerCostoVentas("21401", BODEGA, "2026-10-01", "2026-13-01")).rejects.toBeInstanceOf(PosError);
    expect(llamadas).toHaveLength(0);
  });

  it("apertura: pendiente si no hay movimiento 26 activo antes del corte", async () => {
    let filas = [encabezado(1, 26, "2026-10-01T04:01:00")];
    const llamadas = simularFetch(() => filas);
    expect(await verificarApertura("21401", 21401, "202610", "2026-10-05T04:00:00")).toBe(false);
    expect(llamadas[0].url).toContain("/GetInventoryTransactionsHeaders/21401/26/2026-10-01T00:00:00/2026-11-01T04:00:00");
    limpiarCachePos();
    filas = [encabezado(1, 26, "2026-10-01T04:01:00", 4)];
    expect(await verificarApertura("21401", 21401, "202610", "2026-10-05T04:00:00")).toBe(true);
    limpiarCachePos();
    filas = [];
    expect(await verificarApertura("21401", 21401, "202610", "2026-10-05T04:00:00")).toBe(true);
  });

  it("movimientos: filtra el rango y une encabezado con detalle", async () => {
    const llamadas = simularFetch((ruta) => {
      if (ruta.startsWith("/Inventory/GetInventoryTransactionsHeaders/")) {
        return [
          encabezado(3, 27, "2026-10-10T04:00:00"), // fuera: el fin es exclusivo
          encabezado(2, 27, "2026-10-09T19:18:20.787"),
          encabezado(1, 27, "2026-10-09T03:59:00"), // fuera: día comercial anterior
        ];
      }
      const id = Number(ruta.split("/")[3]);
      return [detalle(id, -5)];
    });
    const r = await obtenerMovimientos("21401", 21401, [27], "2026-10-09T04:00:00", "2026-10-10T04:00:00");
    expect(r.truncado).toBe(false);
    expect(r.movimientos.map((m) => m.id)).toEqual([2]);
    expect(r.movimientos[0]).toMatchObject({ tipo: "Ajuste", categoria: "ajuste", valorTotal: -10 });
    expect(llamadas.map((l) => l.url.replace("https://webapi.intuipos.net/api/v1", ""))).toEqual([
      "/Inventory/GetInventoryTransactionsHeaders/21401/27/2026-10-09T04:00:00/2026-10-10T04:00:00",
      "/Inventory/GetInventoryTransactionDetails/2/21401",
    ]);
  });

  describe("cola del reporte de costo", () => {
    const fila = { iItemID: 1, ItemName: "Plato", GroupName: "G", SubGroupName: "S", Quantity: 1, mSubTotal: 10, mTotalDiscount: 0, Total: 10, ItemCost: 4, TotalItemCost: 4 };

    /** fetch falso: los reportes de septiembre 10 quedan colgados hasta llamar a `soltar`. */
    function fetchConReporteLento() {
      const urls: string[] = [];
      let soltar: () => void = () => {};
      const colgado = new Promise<void>((ok) => (soltar = ok));
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          urls.push(url);
          if (url.includes("dtFechaInicial=2026-09-10")) await colgado;
          return new Response(JSON.stringify([fila]), { status: 200 });
        }),
      );
      return { urls, soltar: () => soltar() };
    }

    it("un rango ya en caché no espera a otro reporte en curso", async () => {
      const red = fetchConReporteLento();
      await obtenerCostoVentas("21401", BODEGA, "2026-09-01", "2026-09-02");
      const lento = obtenerCostoVentas("21401", BODEGA, "2026-09-10", "2026-09-11");
      try {
        const enCache = await Promise.race([
          obtenerCostoVentas("21401", BODEGA, "2026-09-01", "2026-09-02").then(() => "caché"),
          new Promise((ok) => setTimeout(() => ok("esperó"), 200)),
        ]);
        expect(enCache).toBe("caché");
      } finally {
        red.soltar(); // la cola es global: no dejarla bloqueada para las demás pruebas
        await lento;
      }
      expect(red.urls.filter((u) => u.includes("dtFechaInicial=2026-09-01"))).toHaveLength(1);
    });

    it("descarta el tramo en cola si el cliente se desconectó antes de su turno", async () => {
      const red = fetchConReporteLento();
      const lento = obtenerCostoVentas("21401", BODEGA, "2026-09-10", "2026-09-11");
      const cancelada = new AbortController();
      const abandonado = obtenerCostoVentas("21401", BODEGA, "2026-09-20", "2026-09-21", cancelada.signal).catch((e: unknown) => e);
      cancelada.abort();
      red.soltar();
      await lento;
      expect(await abandonado).toMatchObject({ name: "PosError", status: 499 });
      expect(red.urls.some((u) => u.includes("dtFechaInicial=2026-09-20"))).toBe(false);
    });
  });

  it("costo de ventas: una consulta por mes del rango", async () => {
    const fila = { iItemID: 1, ItemName: "Plato", GroupName: "G", SubGroupName: "S", Quantity: 1, mSubTotal: 10, mTotalDiscount: 0, Total: 10, ItemCost: 4, TotalItemCost: 4 };
    const llamadas = simularFetch(() => [fila]);
    const filas = await obtenerCostoVentas("21401", BODEGA, "2026-09-29", "2026-10-02");
    expect(filas).toHaveLength(2);
    expect(llamadas.map((l) => l.url.replace("https://webapi.intuipos.net/api/v1", ""))).toEqual([
      "/Reports/GetSalesByItemVsItemCost?dtFechaInicial=2026-09-29T04:00:00&dtFechaFinal=2026-10-01T04:00:00&iPuntoDeVentaID=21401&iPeriodo=202609&iPuntoDeVentaIDPrecioTerminal=21401&iWareHouseID=2140101",
      "/Reports/GetSalesByItemVsItemCost?dtFechaInicial=2026-10-01T04:00:00&dtFechaFinal=2026-10-03T04:00:00&iPuntoDeVentaID=21401&iPeriodo=202610&iPuntoDeVentaIDPrecioTerminal=21401&iWareHouseID=2140101",
    ]);
  });
});
