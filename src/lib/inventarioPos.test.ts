import { describe, it, expect } from "vitest";
import {
  periodoDe,
  corteInicioDia,
  corteFinDia,
  consultaCierreDia,
  consultaInicioDia,
  diasEntre,
  partirRangoPorMes,
  puntoMedioLocal,
  esFechaIso,
  mapCatalogoItem,
  estadoExistencia,
  mapExistencia,
  resumirExistencias,
  mapMovimiento,
  calcularKardex,
  calcularTeoricoCuadre,
  normalizarNombre,
  cruzarConteo,
  resumirCuadre,
  agruparCostoVentas,
  costoConsumoVentas,
  totalesConCosto,
  margenBruto,
  filtrarPorDiaComercial,
  obtenerEncabezadosCompletos,
  mapConcurrente,
  diaComercialActual,
  calcularExpresionConteo,
  normalizarUnidad,
  factorUnidad,
  type PosExistenciaRow,
  type PosEncabezadoRow,
  type PosDetalleRow,
  type PosCostoVentaRow,
  type ExistenciaPOS,
  type MovimientoPOS,
  type CategoriaMovimiento,
  type CuadreTeoricoPOS,
  type ConteoParaCuadre,
} from "./inventarioPos";

// ---------------------------------------------------------------------------
// Datos sintéticos
// ---------------------------------------------------------------------------

const filaExistencia = (extra: Partial<PosExistenciaRow> = {}): PosExistenciaRow => ({
  iItemID: 76,
  ItemName: " Chips de chocolate ",
  GroupName: "Insumos ",
  SubGroupName: "Empaques ",
  tiItemRoleID: 1,
  MeasureUnit_Inventory: "gr ",
  dMinQty: 100,
  dMaxQty: 0,
  dQuantity: 250,
  mItemCost: 37.7835,
  mTotal: 9445.875,
  ...extra,
});

const existencia = (posItemId: number, cantidad: number, extra: Partial<ExistenciaPOS> = {}): ExistenciaPOS => ({
  posItemId,
  nombre: `Insumo ${posItemId}`,
  grupo: "Insumos",
  subgrupo: "",
  unidad: "gr",
  esIngrediente: true,
  minimo: 0,
  maximo: 0,
  cantidad,
  costoUnitario: 10,
  valor: cantidad * 10,
  estado: "ok",
  ...extra,
});

type LineaCorta = [posItemId: number, cantidad: number, costo?: number];

const movimiento = (
  id: number,
  categoria: CategoriaMovimiento,
  lineas: LineaCorta[],
  extra: Partial<MovimientoPOS> = {},
): MovimientoPOS => ({
  id,
  tipoId: 0,
  tipo: categoria,
  categoria,
  afectaExistencia: categoria !== "requisicion",
  fecha: "2026-10-05T10:00:00",
  anulado: false,
  observaciones: "",
  terminal: "",
  origen: "",
  proveedor: "",
  documentoExterno: "",
  lineas: lineas.map(([posItemId, cantidad, costo = 10]) => ({
    posItemId,
    nombre: `Insumo ${posItemId}`,
    grupo: "Insumos",
    unidad: "gr",
    cantidad,
    costoUnitario: costo,
    valor: cantidad * costo,
    observacion: "",
  })),
  valorTotal: 0,
  ...extra,
});

const encabezado = (extra: Partial<PosEncabezadoRow> = {}): PosEncabezadoRow => ({
  biTransactionID: 1001,
  tiTransactionTypeID: 29,
  dtDate: "2026-10-09T15:44:26.253",
  tiStatusID: 1,
  vObservations: "  Reposición semanal ",
  vTerminalID: "CAJA",
  biEmployeeID: 1,
  iWareHouseID: 900101,
  PuntoDeVentaFrom: "BODEGA CENTRAL",
  iSupplierID: null,
  ...extra,
});

const detalle = (extra: Partial<PosDetalleRow> = {}): PosDetalleRow => ({
  biTransactionDetailID: 1,
  biTransactionID: 1001,
  tiTransactionTypeID: 29,
  TransactionType: "INGRESO x TRASLADO",
  iItemID: 44,
  ItemName: "Agua botella",
  GroupName: "Bebidas",
  SubGroupName: "Agua",
  MeasureUnit_Inventory: "un",
  dQuantity: 48,
  mItemPrice: 1000.5,
  mTotal: 48024,
  dtDate: "2026-10-09T15:44:26.253",
  iPeriodo: 202610,
  SupplierName: null,
  vExternalDocumentID: "0",
  vObservations: "",
  vObservationsOnDetail: "",
  WareHouseName: "BODEGA LOCAL",
  tiDetailStatusID: 1,
  ...extra,
});

const filaCosto = (extra: Partial<PosCostoVentaRow> = {}): PosCostoVentaRow => ({
  iItemID: 40,
  ItemName: "Capuccino",
  GroupName: "Bebidas",
  SubGroupName: "Café",
  Quantity: 10,
  mSubTotal: 60_000,
  mTotalDiscount: 0,
  Total: 65_000,
  ItemCost: 1200,
  TotalItemCost: 12_000,
  ...extra,
});

// ---------------------------------------------------------------------------
// Fechas y periodos
// ---------------------------------------------------------------------------

describe("fechas y cortes del día comercial", () => {
  it("periodo y cortes de un día normal", () => {
    expect(periodoDe("2026-10-09")).toBe("202610");
    expect(corteInicioDia("2026-10-09")).toBe("2026-10-09T04:00:00");
    expect(corteFinDia("2026-10-09")).toBe("2026-10-10T04:00:00");
  });

  it("fin de mes y fin de año: el corte cae el 1º siguiente a las 04:00", () => {
    expect(corteFinDia("2026-10-31")).toBe("2026-11-01T04:00:00");
    expect(corteFinDia("2026-12-31")).toBe("2027-01-01T04:00:00");
    expect(corteFinDia("2028-02-28")).toBe("2028-02-29T04:00:00");
  });

  it("cierre del último día del mes: periodo del mes, corte posterior (incluye el ajuste de cierre de las 03:59)", () => {
    expect(consultaCierreDia("2026-10-31")).toEqual({ periodo: "202610", corte: "2026-11-01T04:00:00" });
    expect(consultaCierreDia("2026-10-09")).toEqual({ periodo: "202610", corte: "2026-10-10T04:00:00" });
  });

  it("inicio del 1º de mes consulta el periodo anterior (no el nuevo, que daría ceros)", () => {
    expect(consultaInicioDia("2026-10-01")).toEqual({ periodo: "202609", corte: "2026-10-01T04:00:00" });
    expect(consultaInicioDia("2027-01-01")).toEqual({ periodo: "202612", corte: "2027-01-01T04:00:00" });
  });

  it("inicio de un día cualquiera = cierre del día anterior", () => {
    expect(consultaInicioDia("2026-10-09")).toEqual({ periodo: "202610", corte: "2026-10-09T04:00:00" });
    expect(consultaInicioDia("2026-10-02")).toEqual(consultaCierreDia("2026-10-01"));
  });

  it("diasEntre es inclusivo y cruza meses", () => {
    expect(diasEntre("2026-10-09", "2026-10-09")).toBe(1);
    expect(diasEntre("2026-09-25", "2026-10-05")).toBe(11);
    expect(diasEntre("2028-02-01", "2028-03-01")).toBe(30);
    expect(diasEntre("2026-10-10", "2026-10-09")).toBe(0);
  });

  it("partirRangoPorMes: un mes, varios meses, fin de año y rango invertido", () => {
    expect(partirRangoPorMes("2026-10-01", "2026-10-09")).toEqual([{ desde: "2026-10-01", hasta: "2026-10-09", periodo: "202610" }]);
    expect(partirRangoPorMes("2026-09-15", "2026-11-02")).toEqual([
      { desde: "2026-09-15", hasta: "2026-09-30", periodo: "202609" },
      { desde: "2026-10-01", hasta: "2026-10-31", periodo: "202610" },
      { desde: "2026-11-01", hasta: "2026-11-02", periodo: "202611" },
    ]);
    expect(partirRangoPorMes("2026-12-31", "2027-01-01")).toEqual([
      { desde: "2026-12-31", hasta: "2026-12-31", periodo: "202612" },
      { desde: "2027-01-01", hasta: "2027-01-01", periodo: "202701" },
    ]);
    expect(partirRangoPorMes("2028-02-10", "2028-03-01").map((t) => t.hasta)).toEqual(["2028-02-29", "2028-03-01"]);
    expect(partirRangoPorMes("2026-10-10", "2026-10-09")).toEqual([]);
  });

  it("puntoMedioLocal: mismo formato, cruza meses y redondea al segundo", () => {
    expect(puntoMedioLocal("2026-10-09T04:00:00", "2026-10-10T04:00:00")).toBe("2026-10-09T16:00:00");
    expect(puntoMedioLocal("2026-10-31T04:00:00", "2026-11-02T04:00:00")).toBe("2026-11-01T04:00:00");
    expect(puntoMedioLocal("2026-10-09T10:00:00", "2026-10-09T10:00:03")).toBe("2026-10-09T10:00:02");
    expect(() => puntoMedioLocal("ayer", "2026-10-09T10:00:00")).toThrow();
  });

  it("esFechaIso valida formato y calendario", () => {
    expect(esFechaIso("2026-10-09")).toBe(true);
    expect(esFechaIso("2028-02-29")).toBe(true);
    expect(esFechaIso("2026-02-29")).toBe(false);
    expect(esFechaIso("2026-13-01")).toBe(false);
    expect(esFechaIso("2026-10-9")).toBe(false);
    expect(esFechaIso("2026-10-09T04:00:00")).toBe(false);
    expect(esFechaIso(20261009)).toBe(false);
    expect(esFechaIso(null)).toBe(false);
  });

  it("filtrarPorDiaComercial respeta los cortes de 04:00 (fracciones de segundo incluidas)", () => {
    const filas = [
      { id: 1, dtDate: "2026-10-09T03:59:59.997" },
      { id: 2, dtDate: "2026-10-09T04:00:00" },
      { id: 3, dtDate: "2026-10-10T03:59:59.5" },
      { id: 4, dtDate: "2026-10-10T04:00:00.01" },
      { id: 5, dtDate: "2026-10-10T19:18:20.787" },
      { id: 6, dtDate: "2026-10-11T04:00:00" },
    ];
    expect(filtrarPorDiaComercial(filas, "2026-10-09", "2026-10-09").map((f) => f.id)).toEqual([2, 3]);
    expect(filtrarPorDiaComercial(filas, "2026-10-09", "2026-10-10").map((f) => f.id)).toEqual([2, 3, 4, 5]);
  });

  it("diaComercialActual: entre 00:00 y 04:00 (Bogotá) sigue abierto el día anterior", () => {
    expect(diaComercialActual(new Date("2026-10-10T07:00:00Z"))).toBe("2026-10-09"); // 02:00 Bogotá
    expect(diaComercialActual(new Date("2026-10-10T08:59:59Z"))).toBe("2026-10-09"); // 03:59:59
    expect(diaComercialActual(new Date("2026-10-10T09:00:00Z"))).toBe("2026-10-10"); // 04:00
    expect(diaComercialActual(new Date("2026-10-11T04:30:00Z"))).toBe("2026-10-10"); // 23:30
    expect(diaComercialActual(new Date("2026-11-01T06:00:00Z"))).toBe("2026-10-31"); // 01:00 del 1º
  });

  it("filtrarPorDiaComercial en cambio de mes: el ajuste de cierre de las 03:59 del 1º es del último día", () => {
    const filas = [
      { id: 1, dtDate: "2026-10-01T03:59:00" },
      { id: 2, dtDate: "2026-10-01T04:01:00" },
    ];
    expect(filtrarPorDiaComercial(filas, "2026-09-30", "2026-09-30").map((f) => f.id)).toEqual([1]);
    expect(filtrarPorDiaComercial(filas, "2026-10-01", "2026-10-01").map((f) => f.id)).toEqual([2]);
  });
});

// ---------------------------------------------------------------------------
// Mapeos
// ---------------------------------------------------------------------------

describe("estadoExistencia", () => {
  it.each([
    [-1, 10, 50, "negativo"],
    [0, 10, 50, "agotado"],
    [5, 10, 50, "bajo_minimo"],
    [10, 10, 50, "ok"],
    [60, 10, 50, "sobre_maximo"],
    [3, 0, 0, "ok"],
    [999, 10, 0, "ok"],
  ])("cantidad %s, mín %s, máx %s → %s", (cantidad, minimo, maximo, esperado) => {
    expect(estadoExistencia(cantidad, minimo, maximo)).toBe(esperado);
  });
});

describe("mapeo de existencias", () => {
  it("mapCatalogoItem recorta textos y marca ingredientes", () => {
    expect(mapCatalogoItem(filaExistencia())).toEqual({
      posItemId: 76,
      nombre: "Chips de chocolate",
      grupo: "Insumos",
      subgrupo: "Empaques",
      unidad: "gr",
      esIngrediente: true,
      minimo: 100,
      maximo: 0,
    });
    expect(mapCatalogoItem(filaExistencia({ tiItemRoleID: 0 })).esIngrediente).toBe(false);
  });

  it("mapExistencia valoriza a 2 decimales y calcula el estado", () => {
    const e = mapExistencia(filaExistencia({ dQuantity: 250, mItemCost: 37.7835 }));
    expect(e.cantidad).toBe(250);
    expect(e.costoUnitario).toBe(37.7835);
    expect(e.valor).toBe(9445.88);
    expect(e.estado).toBe("ok");
    expect(mapExistencia(filaExistencia({ dQuantity: 50 })).estado).toBe("bajo_minimo");
    expect(mapExistencia(filaExistencia({ dQuantity: -3, mItemCost: 10 })).valor).toBe(-30);
  });

  it("resumirExistencias suma solo valores positivos y cuenta estados", () => {
    const items = [
      mapExistencia(filaExistencia({ iItemID: 1, dQuantity: 10, mItemCost: 100, dMinQty: 0 })),
      mapExistencia(filaExistencia({ iItemID: 2, dQuantity: -2, mItemCost: 100 })),
      mapExistencia(filaExistencia({ iItemID: 3, dQuantity: 0 })),
      mapExistencia(filaExistencia({ iItemID: 4, dQuantity: 5, mItemCost: 1, dMinQty: 10 })),
    ];
    expect(resumirExistencias(items)).toEqual({ items: 4, valorTotal: 1005, negativos: 1, agotados: 1, bajoMinimo: 1 });
  });
});

describe("mapMovimiento", () => {
  it("traslado recibido: etiqueta, categoría, origen y documento '0' vacío", () => {
    const m = mapMovimiento(encabezado(), [
      detalle(),
      detalle({ biTransactionDetailID: 2, iItemID: 45, ItemName: " Agua con gas ", dQuantity: 24, mItemPrice: 1368.3333, mTotal: 32839.9992 }),
    ]);
    expect(m).toMatchObject({
      id: 1001,
      tipoId: 29,
      tipo: "Traslado recibido",
      categoria: "traslado_entrada",
      afectaExistencia: true,
      fecha: "2026-10-09T15:44:26.253",
      anulado: false,
      observaciones: "Reposición semanal",
      terminal: "CAJA",
      origen: "BODEGA CENTRAL",
      proveedor: "",
      documentoExterno: "",
      valorTotal: 80864,
    });
    expect(m.lineas[1]).toEqual({
      posItemId: 45,
      nombre: "Agua con gas",
      grupo: "Bebidas",
      unidad: "un",
      cantidad: 24,
      costoUnitario: 1368.3333,
      valor: 32840,
      observacion: "",
    });
  });

  it("compra anulada: proveedor y factura del primer detalle que los tenga", () => {
    const m = mapMovimiento(encabezado({ tiTransactionTypeID: 20, tiStatusID: 4, PuntoDeVentaFrom: null, vObservations: null }), [
      detalle({ tiTransactionTypeID: 20, SupplierName: "  ", vExternalDocumentID: null }),
      detalle({ tiTransactionTypeID: 20, SupplierName: " Distribuidora Uno ", vExternalDocumentID: "113604" }),
    ]);
    expect(m.anulado).toBe(true);
    expect(m.tipo).toBe("Compra");
    expect(m.categoria).toBe("compra");
    expect(m.proveedor).toBe("Distribuidora Uno");
    expect(m.documentoExterno).toBe("113604");
    expect(m.origen).toBe("");
    expect(m.observaciones).toBe("");
  });

  it("tipo desconocido: etiqueta del detalle o 'Tipo N', categoría ajuste y afecta existencia", () => {
    const conDetalle = mapMovimiento(encabezado({ tiTransactionTypeID: 77 }), [detalle({ TransactionType: " OTRO MOVIMIENTO " })]);
    expect(conDetalle).toMatchObject({ tipo: "OTRO MOVIMIENTO", categoria: "ajuste", afectaExistencia: true });
    const sinDetalle = mapMovimiento(encabezado({ tiTransactionTypeID: 77 }), []);
    expect(sinDetalle).toMatchObject({ tipo: "Tipo 77", lineas: [], valorTotal: 0 });
  });

  it("el valor de la línea es cantidad × costo, sin el impuesto que IntuiPOS suma en mTotal", () => {
    // Ajuste de cierre real: q −52 × 159,28 = −8.282,56; IntuiPOS manda mTotal −8.938 (con mTotalTax1).
    const m = mapMovimiento(encabezado({ tiTransactionTypeID: 27 }), [
      detalle({ tiTransactionTypeID: 27, dQuantity: -52, mItemPrice: 159.28, mTotal: -8938 }),
      detalle({ tiTransactionTypeID: 27, iItemID: 55, dQuantity: 3, mItemPrice: 100, mTotal: 324 }),
    ]);
    expect(m.lineas.map((l) => l.valor)).toEqual([-8282.56, 300]);
    expect(m.valorTotal).toBe(-7982.56);
  });

  it("requisición no afecta existencias; egresos conservan el signo", () => {
    expect(mapMovimiento(encabezado({ tiTransactionTypeID: 51 }), []).afectaExistencia).toBe(false);
    const baja = mapMovimiento(encabezado({ tiTransactionTypeID: 22 }), [detalle({ dQuantity: -1897, mItemPrice: 8.3009, mTotal: -15746.8073 })]);
    expect(baja.lineas[0].cantidad).toBe(-1897);
    expect(baja.valorTotal).toBe(-15746.81);
  });
});

// ---------------------------------------------------------------------------
// Kardex
// ---------------------------------------------------------------------------

describe("calcularKardex", () => {
  const inicial = [
    existencia(44, 10, { nombre: "Agua botella", grupo: "Bebidas", unidad: "un", costoUnitario: 9000 }),
    existencia(76, 500, { nombre: "Chips de chocolate", costoUnitario: 37 }),
  ];
  const final = [
    existencia(44, 54, { nombre: "Agua botella", grupo: "Bebidas", unidad: "un", costoUnitario: 9314.83603 }),
    existencia(76, 380, { nombre: "Chips de chocolate", costoUnitario: 37.7835 }),
    existencia(200, 15, { nombre: "Arroz nuevo", costoUnitario: 4.5 }),
  ];
  const movimientos = [
    movimiento(1, "traslado_entrada", [[44, 48, 13484.3125], [76, 200]]),
    movimiento(2, "consumo_interno", [[76, -30]]),
    movimiento(3, "ajuste", [[76, -27], [44, 0]]),
    movimiento(4, "ajuste", [[76, 5]]),
    movimiento(5, "requisicion", [[76, 1000]]),
    movimiento(6, "compra", [[76, 999]], { anulado: true }),
    movimiento(7, "compra", [[300, 12, 50]], { fecha: "2026-10-03T10:00:00" }),
    movimiento(8, "compra", [[300, 6, 55]], { fecha: "2026-10-04T10:00:00" }),
    movimiento(9, "baja", [[300, -2, 0]], { fecha: "2026-10-06T10:00:00" }),
  ];
  const kardex = calcularKardex(inicial, final, movimientos);
  const de = (id: number) => kardex.find((k) => k.posItemId === id)!;

  it("ventas calculadas = final − inicial − movimientos detallados", () => {
    // Agua: 10 + 48 (traslado) + ventas = 54 → ventas = −4
    expect(de(44)).toMatchObject({ inicial: 10, final: 54, entradas: 48, salidas: 0, ajustes: 0, ventasCalculadas: -4 });
    // Chips: 500 + 200 − 30 − 22 (ajustes) + ventas = 380 → ventas = −268
    const chips = de(76);
    expect(chips).toMatchObject({ entradas: 200, salidas: -30, ajustes: -22, ventasCalculadas: -268 });
    expect(chips.inicial! + chips.entradas + chips.salidas + chips.ajustes + chips.ventasCalculadas!).toBe(chips.final);
  });

  it("requisiciones y anulados no cuentan", () => {
    expect(de(76).porCategoria).toEqual({ traslado_entrada: 200, consumo_interno: -30, ajuste: -22 });
    expect(de(76).porCategoria.requisicion).toBeUndefined();
    expect(de(76).porCategoria.compra).toBeUndefined();
  });

  it("ítem sin inicial: sin ventas calculadas; ítem solo en movimientos: costo de la última línea con costo", () => {
    expect(de(200)).toMatchObject({ inicial: null, final: 15, ventasCalculadas: null, valorFinal: 67.5 });
    expect(de(300)).toMatchObject({ inicial: null, final: null, entradas: 18, salidas: -2, ventasCalculadas: null, costoUnitario: 55, valorFinal: null });
  });

  it("costo y valor final salen de la existencia final", () => {
    expect(de(44).costoUnitario).toBe(9314.83603);
    expect(de(44).valorFinal).toBe(503_001.15);
  });

  it("ordena por grupo y luego por nombre", () => {
    expect(kardex.map((k) => k.nombre)).toEqual(["Agua botella", "Arroz nuevo", "Chips de chocolate", "Insumo 300"]);
  });

  it("sin existencias inicial o final no hay ventas calculadas", () => {
    const sinInicial = calcularKardex(null, final, movimientos);
    expect(sinInicial.every((k) => k.inicial === null && k.ventasCalculadas === null)).toBe(true);
    expect(sinInicial.find((k) => k.posItemId === 44)!.final).toBe(54);
    const sinFinal = calcularKardex(inicial, null, movimientos);
    expect(sinFinal.every((k) => k.final === null && k.ventasCalculadas === null && k.valorFinal === null)).toBe(true);
    expect(sinFinal.find((k) => k.posItemId === 76)!.costoUnitario).toBe(37);
  });

  it("redondea a 3 decimales y no devuelve −0", () => {
    const [k] = calcularKardex([existencia(1, 1)], [existencia(1, 0.9999)], []);
    expect(Object.is(k.ventasCalculadas, 0)).toBe(true);
    const [k2] = calcularKardex([existencia(1, 0.3)], [existencia(1, 0)], [movimiento(1, "consumo_interno", [[1, -0.1], [1, -0.2]])]);
    expect(k2.salidas).toBe(-0.3);
    expect(Object.is(k2.ventasCalculadas, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cuadre conteo físico vs POS
// ---------------------------------------------------------------------------

describe("calcularTeoricoCuadre", () => {
  it("teórico = existencia al cierre − ajustes del día (solo ajustes no anulados, solo ítems del final)", () => {
    const final = [existencia(1, 100, { costoUnitario: 20 }), existencia(2, 40)];
    const ajustes = [
      movimiento(10, "ajuste", [[1, -7], [99, 5]]),
      movimiento(11, "ajuste", [[1, 2]]),
      movimiento(12, "ajuste", [[1, -50]], { anulado: true }),
      movimiento(13, "consumo_interno", [[1, -3]]),
    ];
    expect(calcularTeoricoCuadre(final, ajustes)).toEqual([
      { posItemId: 1, nombre: "Insumo 1", unidad: "gr", teoricoAntesAjuste: 105, ajustePOS: -5, finalPOS: 100, costoUnitario: 20 },
      { posItemId: 2, nombre: "Insumo 2", unidad: "gr", teoricoAntesAjuste: 40, ajustePOS: 0, finalPOS: 40, costoUnitario: 10 },
    ]);
  });
});

describe("normalizarNombre", () => {
  it("quita tildes, mayúsculas y espacios de más", () => {
    expect(normalizarNombre("  Azúcar   MORENA ")).toBe("azucar morena");
    expect(normalizarNombre("Piña\tcalada")).toBe("pina calada");
  });
});

describe("calcularExpresionConteo", () => {
  it("suma términos con coma decimal y punto de miles es-CO", () => {
    expect(calcularExpresionConteo("340+250+300", "gr")).toBe(890);
    expect(calcularExpresionConteo("2.500", "gr")).toBe(2500);
    expect(calcularExpresionConteo("2,5", "gr")).toBe(2.5);
    expect(calcularExpresionConteo("1.500,5", "gr")).toBe(1500.5);
    expect(calcularExpresionConteo("1.000 + 1000 + 2.500", "ml")).toBe(4500);
    expect(calcularExpresionConteo("12.000", "Und")).toBe(12000);
  });

  it("un punto que no agrupa miles sigue siendo decimal", () => {
    expect(calcularExpresionConteo("2.5", "gr")).toBe(2.5);
    expect(calcularExpresionConteo("0.250", "gr")).toBe(0.25);
    expect(calcularExpresionConteo("1.25 + 0,75", "Und")).toBe(2);
  });

  it("en kg y L el punto es decimal (como en la báscula) salvo que también haya coma", () => {
    expect(calcularExpresionConteo("1.500", "kg")).toBe(1.5);
    expect(calcularExpresionConteo("0.5 + 1.250", "L")).toBe(1.75);
    expect(calcularExpresionConteo("1.500,5", "kg")).toBe(1500.5);
  });

  it("vacío o sin números → 0; ignora letras y espacios", () => {
    expect(calcularExpresionConteo("", "gr")).toBe(0);
    expect(calcularExpresionConteo("  + ", "gr")).toBe(0);
    expect(calcularExpresionConteo("340 gr + 250gr", "gr")).toBe(590);
  });
});

describe("cruzarConteo y resumirCuadre", () => {
  const teoricos: CuadreTeoricoPOS[] = [
    { posItemId: 1, nombre: "Leche entera", unidad: "ml", teoricoAntesAjuste: 1000, ajustePOS: -50, finalPOS: 950, costoUnitario: 4 },
    { posItemId: 2, nombre: "Azucar morena", unidad: "gr", teoricoAntesAjuste: 500, ajustePOS: 0, finalPOS: 500, costoUnitario: 3 },
    { posItemId: 3, nombre: "Envase libra", unidad: "Und", teoricoAntesAjuste: 20, ajustePOS: 0, finalPOS: 20, costoUnitario: 1500 },
    { posItemId: 4, nombre: "Canela", unidad: "gr", teoricoAntesAjuste: 80, ajustePOS: 0, finalPOS: 80, costoUnitario: 10 },
  ];
  const conteo: ConteoParaCuadre[] = [
    { insumoId: "pos-1", posItemId: 1, nombre: "Leche entera", unidad: "ml", rawExpression: "900", total: 900 },
    { insumoId: "manual-azucar", nombre: "  Azúcar  Morena", unidad: "gr", rawExpression: "250+260", total: 510 },
    { insumoId: "pos-3", posItemId: 3, nombre: "Envase libra", unidad: "Und", rawExpression: "  ", total: 0 },
    { insumoId: "manual-vainilla", posItemId: null, nombre: "Esencia de vainilla", unidad: "ml", rawExpression: "30", total: 30 },
  ];
  const lineas = cruzarConteo(conteo, teoricos);

  it("cruza por id de IntuiPOS", () => {
    expect(lineas[0]).toEqual({
      insumoId: "pos-1",
      posItemId: 1,
      nombre: "Leche entera",
      unidad: "ml",
      contado: 900,
      teorico: 1000,
      diferencia: -100,
      valorDiferencia: -400,
      ajustePOS: -50,
      costoUnitario: 4,
    });
  });

  it("cruza por nombre sin tildes cuando no hay id", () => {
    expect(lineas[1]).toMatchObject({ insumoId: "manual-azucar", posItemId: 2, contado: 510, teorico: 500, diferencia: 10, valorDiferencia: 30 });
  });

  it("expresión vacía = no contado; insumo fuera del POS queda sin teórico", () => {
    expect(lineas[2]).toMatchObject({ contado: null, teorico: 20, diferencia: null, valorDiferencia: null });
    expect(lineas[3]).toMatchObject({ posItemId: null, contado: 30, teorico: null, diferencia: null, valorDiferencia: null, costoUnitario: null });
  });

  it("agrega al final los insumos del POS que nadie contó", () => {
    expect(lineas).toHaveLength(5);
    expect(lineas[4]).toEqual({
      insumoId: "pos-4",
      posItemId: 4,
      nombre: "Canela",
      unidad: "gr",
      contado: null,
      teorico: 80,
      diferencia: null,
      valorDiferencia: null,
      ajustePOS: 0,
      costoUnitario: 10,
    });
  });

  it("resumirCuadre separa faltantes y sobrantes", () => {
    expect(resumirCuadre(lineas)).toEqual({
      contados: 3,
      conDiferencia: 2,
      noContados: 2,
      valorFaltante: -400,
      valorSobrante: 30,
      valorNeto: -370,
    });
  });

  it("conteo en L contra IntuiPOS en ml: convierte antes de comparar", () => {
    const [l] = cruzarConteo(
      [{ insumoId: "ins-4", nombre: "Leche Entera", unidad: "L", rawExpression: "5", total: 5 }],
      [{ posItemId: 1, nombre: "Leche entera", unidad: "ml", teoricoAntesAjuste: 5000, ajustePOS: 0, finalPOS: 5000, costoUnitario: 4 }],
    );
    expect(l).toMatchObject({ posItemId: 1, unidad: "ml", unidadContada: "L", contado: 5000, teorico: 5000, diferencia: 0, valorDiferencia: 0 });
    expect(l.unidadIncompatible).toBeUndefined();
    const [kg] = cruzarConteo(
      [{ insumoId: "ins-1", nombre: "Harina", unidad: "kg", rawExpression: "3", total: 3 }],
      [{ posItemId: 2, nombre: "Harina", unidad: "gr", teoricoAntesAjuste: 2800, ajustePOS: 0, finalPOS: 2800, costoUnitario: 2 }],
    );
    expect(kg).toMatchObject({ unidad: "gr", contado: 3000, diferencia: 200, valorDiferencia: 400 });
  });

  it("unidad sin conversión (L contra gr): no se compara ni entra en faltante/neto", () => {
    const lineas = cruzarConteo(
      [
        { insumoId: "ins-8", nombre: "Leche Deslactosada", unidad: "L", rawExpression: "6", total: 6 },
        { insumoId: "pos-9", posItemId: 9, nombre: "Sal", unidad: "gr", rawExpression: "90", total: 90 },
      ],
      [
        { posItemId: 131, nombre: "Leche deslactosada", unidad: "gr", teoricoAntesAjuste: 6210, ajustePOS: 0, finalPOS: 6210, costoUnitario: 4.39 },
        { posItemId: 9, nombre: "Sal", unidad: "gr", teoricoAntesAjuste: 100, ajustePOS: 0, finalPOS: 100, costoUnitario: 1 },
      ],
    );
    expect(lineas[0]).toMatchObject({
      posItemId: 131,
      unidad: "L",
      unidadContada: "L",
      unidadIncompatible: true,
      contado: 6,
      teorico: 6210,
      diferencia: null,
      valorDiferencia: null,
    });
    expect(resumirCuadre(lineas)).toEqual({ contados: 2, conDiferencia: 1, noContados: 0, valorFaltante: -10, valorSobrante: 0, valorNeto: -10 });
  });

  it("normalizarUnidad y factorUnidad", () => {
    expect(["g", "Gr ", "gramos", "GRS"].map(normalizarUnidad)).toEqual(["gr", "gr", "gr", "gr"]);
    expect(["L", "lts", "Litros"].map(normalizarUnidad)).toEqual(["l", "l", "l"]);
    expect(["Und", "un", "uds", "Unidades"].map(normalizarUnidad)).toEqual(["un", "un", "un", "un"]);
    expect(normalizarUnidad("Porción")).toBe("porcion");
    expect(factorUnidad("g", "gr")).toBe(1);
    expect(factorUnidad("uds", "Und")).toBe(1);
    expect(factorUnidad("kg", "gr")).toBe(1000);
    expect(factorUnidad("ml", "L")).toBe(0.001);
    expect(factorUnidad("L", "gr")).toBeNull();
    expect(factorUnidad("paquetes", "Und")).toBeNull();
    expect(factorUnidad("", "gr")).toBe(1);
  });

  it("diferencias mínimas (ruido de flotantes) no cuentan como diferencia", () => {
    const [l] = cruzarConteo(
      [{ insumoId: "x", posItemId: 9, nombre: "Sal", unidad: "gr", rawExpression: "0.1+0.2", total: 0.1 + 0.2 }],
      [{ posItemId: 9, nombre: "Sal", unidad: "gr", teoricoAntesAjuste: 0.3, ajustePOS: 0, finalPOS: 0.3, costoUnitario: 1 }],
    );
    expect(l.diferencia).toBe(0);
    expect(resumirCuadre([l]).conDiferencia).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Costo de ventas
// ---------------------------------------------------------------------------

describe("agruparCostoVentas", () => {
  const filas = [
    // Tramo septiembre
    filaCosto({ iItemID: 40, Quantity: 10, mSubTotal: 60_000, TotalItemCost: 12_000 }),
    filaCosto({ iItemID: 4, ItemName: "Postre mediano ", GroupName: "Postres", SubGroupName: "Arroz con leche", Quantity: 100, mSubTotal: 0, TotalItemCost: 139_461.49 }),
    // Tramo octubre
    filaCosto({ iItemID: 40, Quantity: 5, mSubTotal: 30_000, TotalItemCost: 6_300 }),
    filaCosto({ iItemID: 41, ItemName: "Macchiato", Quantity: 0, mSubTotal: 0, TotalItemCost: 0 }),
  ];
  const { items, totales } = agruparCostoVentas(filas);

  it("suma los tramos por producto y calcula costo unitario y margen", () => {
    const capuccino = items.find((i) => i.posItemId === 40)!;
    expect(capuccino).toMatchObject({ nombre: "Capuccino", cantidad: 15, ventaNeta: 90_000, costoTotal: 18_300, costoUnitario: 1220 });
    expect(capuccino.margen).toBeCloseTo(71_700 / 90_000, 10);
  });

  it("venta 0 (componente de combo) → margen null; cantidad 0 → costo unitario 0", () => {
    expect(items.find((i) => i.posItemId === 4)).toMatchObject({ nombre: "Postre mediano", ventaNeta: 0, margen: null, costoUnitario: 1394.61 });
    expect(items.find((i) => i.posItemId === 41)).toMatchObject({ costoUnitario: 0, margen: null });
  });

  it("ordena por costo total descendente", () => {
    expect(items.map((i) => i.posItemId)).toEqual([4, 40, 41]);
  });

  it("totales: solo productos con venta (las filas con venta $0 no se suman)", () => {
    expect(totales).toMatchObject({ cantidad: 15, ventaNeta: 90_000, costoTotal: 18_300 });
    expect(totales.margen).toBeCloseTo((90_000 - 18_300) / 90_000, 10);
  });

  it("subreceta repetida por IntuiPOS con venta $0 (caso 388/5): su costo no se cuenta dos veces", () => {
    const r = agruparCostoVentas([
      filaCosto({ iItemID: 388, ItemName: "Arroz con leche grande", Quantity: 26, mSubTotal: 470_000, TotalItemCost: 97_322 }),
      filaCosto({ iItemID: 5, ItemName: "Alta Gracia Libra", Quantity: 26, mSubTotal: 0, Total: 0, TotalItemCost: 97_322 }),
    ]);
    // El detalle conserva ambas filas (informativo); el total no las suma dos veces.
    expect(r.items.map((i) => [i.posItemId, i.ventaNeta, i.costoTotal])).toEqual(
      expect.arrayContaining([
        [388, 470_000, 97_322],
        [5, 0, 97_322],
      ]),
    );
    expect(r.totales).toMatchObject({ cantidad: 26, ventaNeta: 470_000, costoTotal: 97_322 });
    expect(r.totales.margen).toBeCloseTo((470_000 - 97_322) / 470_000, 10);
  });

  it("sin filas: totales en cero y margen null", () => {
    expect(agruparCostoVentas([])).toEqual({ items: [], totales: { cantidad: 0, ventaNeta: 0, costoTotal: 0, margen: null } });
  });
});

describe("costo de ventas desde el inventario", () => {
  const kardex = calcularKardex(
    [existencia(1, 1000, { costoUnitario: 4 }), existencia(2, 50, { costoUnitario: 300 }), existencia(3, 10)],
    [existencia(1, 400, { costoUnitario: 4 }), existencia(2, 30, { costoUnitario: 300 }), existencia(3, 12), existencia(4, 5)],
    [movimiento(1, "traslado_entrada", [[1, 200]]), movimiento(2, "ajuste", [[3, 1]])],
  );

  it("costoConsumoVentas = Σ(−ventas calculadas × costo), una vez por insumo (incluye empaques sin precio)", () => {
    // Insumo 1: 1000 + 200 − 400 = 800 vendidos × 4; insumo 2 (bolsa): 20 × 300; insumo 3: +1 sin explicar × 10.
    expect(costoConsumoVentas(kardex)).toBe(800 * 4 + 20 * 300 - 10);
  });

  it("null si ningún insumo tiene ventas calculadas", () => {
    expect(costoConsumoVentas(kardex.map((k) => ({ ...k, ventasCalculadas: null })))).toBeNull();
    expect(costoConsumoVentas([])).toBeNull();
  });

  it("totalesConCosto reemplaza el costo y recalcula el margen", () => {
    const base = { cantidad: 10, ventaNeta: 50_000, costoTotal: 99_999, margen: -1 };
    expect(totalesConCosto(base, 9_190.004)).toEqual({ cantidad: 10, ventaNeta: 50_000, costoTotal: 9_190, margen: (50_000 - 9_190) / 50_000 });
    expect(totalesConCosto({ ...base, ventaNeta: 0 }, 100).margen).toBeNull();
    expect(margenBruto(100, 25)).toBe(0.75);
  });
});

// ---------------------------------------------------------------------------
// Utilidades async
// ---------------------------------------------------------------------------

/** Fake de GetInventoryTransactionsHeaders: rango inclusivo en ambos extremos, desc, truncado a `limite`. */
function fakeEncabezados(todos: PosEncabezadoRow[], limite: number) {
  const llamadas: Array<[string, string]> = [];
  const fetcher = async (desde: string, hasta: string) => {
    llamadas.push([desde, hasta]);
    return todos
      .filter((r) => r.dtDate.slice(0, 19) >= desde && r.dtDate.slice(0, 19) <= hasta)
      .sort((a, b) => (a.dtDate < b.dtDate ? 1 : a.dtDate > b.dtDate ? -1 : 0))
      .slice(0, limite);
  };
  return { fetcher, llamadas };
}

const isoLocal = (ms: number) => new Date(ms).toISOString().slice(0, 19);

describe("obtenerEncabezadosCompletos", () => {
  it("parte el rango cuando la respuesta llega llena, sin duplicar ni perder filas", async () => {
    const base = Date.UTC(2026, 9, 1, 4, 0, 0);
    // 1200 encabezados, uno cada 10 minutos (el punto medio cae justo sobre uno: se pide dos veces)
    const todos = Array.from({ length: 1200 }, (_, i) =>
      encabezado({ biTransactionID: 5000 + i, dtDate: `${isoLocal(base + i * 600_000)}.5` }),
    );
    const { fetcher, llamadas } = fakeEncabezados(todos, 100);
    const r = await obtenerEncabezadosCompletos(fetcher, "2026-10-01T04:00:00", "2026-10-10T04:00:00", { limite: 100 });

    expect(r.truncado).toBe(false);
    expect(r.rows).toHaveLength(1200);
    expect(new Set(r.rows.map((x) => x.biTransactionID)).size).toBe(1200);
    expect(llamadas.length).toBeGreaterThan(12);
    const fechas = r.rows.map((x) => x.dtDate);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });

  it("no parte si la respuesta no llega al límite", async () => {
    const { fetcher, llamadas } = fakeEncabezados([encabezado({ biTransactionID: 1 }), encabezado({ biTransactionID: 2 })], 500);
    const r = await obtenerEncabezadosCompletos(fetcher, "2026-10-09T04:00:00", "2026-10-10T04:00:00");
    expect(llamadas).toHaveLength(1);
    expect(r).toMatchObject({ truncado: false });
    expect(r.rows.map((x) => x.biTransactionID)).toEqual([2, 1]);
  });

  it("marca truncado si un tramo mínimo sigue lleno", async () => {
    const todos = Array.from({ length: 30 }, (_, i) => encabezado({ biTransactionID: i + 1, dtDate: "2026-10-05T10:00:00" }));
    const { fetcher, llamadas } = fakeEncabezados(todos, 10);
    const r = await obtenerEncabezadosCompletos(fetcher, "2026-10-05T04:00:00", "2026-10-06T04:00:00", { limite: 10 });
    expect(r.truncado).toBe(true);
    expect(r.rows).toHaveLength(10);
    expect(llamadas.length).toBeLessThan(100);
  });

  it("no recursa sin fin cuando el medio no queda dentro del rango", async () => {
    const todos = Array.from({ length: 5 }, (_, i) => encabezado({ biTransactionID: i + 1, dtDate: "2026-10-05T10:00:00" }));
    const { fetcher, llamadas } = fakeEncabezados(todos, 2);
    const r = await obtenerEncabezadosCompletos(fetcher, "2026-10-05T10:00:00", "2026-10-05T10:00:01", { limite: 2, minSegundos: 0 });
    expect(r.truncado).toBe(true);
    expect(llamadas).toHaveLength(1);
  });
});

describe("mapConcurrente", () => {
  const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

  it("conserva el orden y no supera el límite de tareas simultáneas", async () => {
    let activas = 0;
    let maximo = 0;
    const items = [30, 5, 20, 1, 15, 8, 2, 12, 4, 9];
    const r = await mapConcurrente(items, 3, async (ms, i) => {
      activas++;
      maximo = Math.max(maximo, activas);
      await esperar(ms);
      activas--;
      return `${i}:${ms}`;
    });
    expect(r).toEqual(items.map((ms, i) => `${i}:${ms}`));
    expect(maximo).toBe(3);
  });

  it("propaga el primer error y deja de lanzar tareas nuevas", async () => {
    const iniciadas: number[] = [];
    await expect(
      mapConcurrente([0, 1, 2, 3, 4], 1, async (n) => {
        iniciadas.push(n);
        if (n === 1) throw new Error("fallo 1");
        return n;
      }),
    ).rejects.toThrow("fallo 1");
    expect(iniciadas).toEqual([0, 1]);
  });

  it("lista vacía → []", async () => {
    expect(await mapConcurrente([], 6, async () => 1)).toEqual([]);
  });
});
