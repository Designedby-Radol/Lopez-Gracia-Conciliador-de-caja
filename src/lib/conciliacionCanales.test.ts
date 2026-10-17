import { describe, it, expect } from "vitest";
import { agruparPagosIntuipos } from "./intuiposCanales";
import { canalesSinValidar, calcularDiferencias, valoresConciliacionIniciales } from "./discrepancy";

const fila = (PaymentType: string, tiPaymentTypeID: number, dCredit: number, dDebit = 0, extra: Record<string, unknown> = {}) => ({
  PaymentType,
  tiPaymentTypeID,
  dCredit,
  dDebit,
  PaymentDetailStatus: "Activo",
  TransactionType: "FACTURA",
  DocumentType: "",
  ...extra,
});

describe("agruparPagosIntuipos", () => {
  it("separa tarjetas (TCREDITO/TDEBITO) de transferencias", () => {
    const r = agruparPagosIntuipos([
      fila("EFECTIVO CAJA", 1, 200_000),
      fila("TCREDITO", 2, 150_000, 10_000),
      fila("TDEBITO", 3, 90_000),
      fila("TRANSFERENCIA", 13, 40_000),
      fila("NEQUI", 83, 25_000),
    ]);
    expect(r.tarjetasPOS).toBe(230_000);
    expect(r.totalTcredito).toBe(140_000);
    expect(r.totalTdebito).toBe(90_000);
    expect(r.transferenciasPOS).toBe(65_000);
    expect(r.efectivoPOS).toBe(200_000);
  });

  it("clasifica CxC Justo/Rappi e ignora movimientos de caja e inactivos", () => {
    const r = agruparPagosIntuipos([
      fila("CUENTAS X COBRAR", 9, 70_000, 0, { DocumentType: "CxC JUSTO" }),
      fila("CUENTAS X COBRAR", 9, 30_000, 0, { DocumentType: "CxC RAPPI" }),
      fila("EFECTIVO CAJA", 1, 500_000, 0, { TransactionType: "BASE-INICIO CAJA" }),
      fila("TCREDITO", 2, 99_000, 0, { PaymentDetailStatus: "Anulado" }),
    ]);
    expect(r).toMatchObject({ justoPOS: 70_000, rappiPOS: 30_000, efectivoPOS: 0, tarjetasPOS: 0 });
  });
});

describe("valoresConciliacionIniciales", () => {
  const pendiente = {
    estado: "Pendiente",
    efectivoCierre: 300_000,
    datafonoCierre: 250_000,
    justoCierre: 80_000,
    rappiCierre: 40_000,
    transferenciasCierre: 60_000,
  };

  it("un cierre pendiente con POS por API no queda auto-validado", () => {
    const v = valoresConciliacionIniciales(pendiente, { efectivoPOS: 290_000, justoApi: null });
    expect(v).toEqual({ efectivo: 290_000, datafono: 0, justo: 0, rappi: 0, transferencias: 0, transferenciasCoincide: false });
  });

  it("toma el total de la API de Justo como valor real (fuente independiente)", () => {
    expect(valoresConciliacionIniciales(pendiente, { efectivoPOS: 1, justoApi: 79_500 }).justo).toBe(79_500);
  });

  it("sin POS no pre-llena el efectivo con lo declarado", () => {
    expect(valoresConciliacionIniciales(pendiente).efectivo).toBe(0);
  });

  it("un cierre ya aprobado muestra lo guardado", () => {
    const v = valoresConciliacionIniciales({
      estado: "Cuadrado",
      efectivoPOS: 300_000,
      tarjetasPOS: 250_000,
      justoCierre: 80_000,
      rappiCierre: 40_000,
      transferenciasCierre: 60_000,
      transferenciasPOS: 60_000,
    });
    expect(v).toEqual({ efectivo: 300_000, datafono: 250_000, justo: 80_000, rappi: 40_000, transferencias: 60_000, transferenciasCoincide: true });
  });

  it("con los valores iniciales, el datáfono y las transferencias quedan pendientes de validar", () => {
    const pos = agruparPagosIntuipos([fila("EFECTIVO CAJA", 1, 300_000), fila("TCREDITO", 2, 250_000), fila("PSE", 13, 60_000)]);
    const v = valoresConciliacionIniciales(pendiente, { efectivoPOS: pos.efectivoPOS });
    const input = {
      efectivoDeclarado: pendiente.efectivoCierre,
      datafonoDeclarado: pendiente.datafonoCierre,
      efectivoPOS: v.efectivo,
      datafonoPOS: v.datafono,
      justoPOS: 0,
      rappiPOS: 0,
      transferenciasPOS: pos.transferenciasPOS,
      justoReal: v.justo,
      rappiReal: v.rappi,
      transferenciasReal: v.transferencias,
    };
    expect(canalesSinValidar(input)).toEqual(["Datáfono", "Transferencias"]);
    // Antes el datáfono "real" se llenaba con lo declarado y la diferencia daba 0.
    expect(calcularDiferencias(input).transferencias).toBe(-60_000);
  });
});

describe("canalesSinValidar (efectivo y datáfono)", () => {
  it("avisa si hay valor declarado pero no hay POS / vouchers confirmados", () => {
    const base = { justoPOS: 0, rappiPOS: 0, transferenciasPOS: 0, justoReal: 0, rappiReal: 0, transferenciasReal: 0 };
    expect(canalesSinValidar({ ...base, efectivoDeclarado: 100, efectivoPOS: 0, datafonoDeclarado: 50, datafonoPOS: 0 })).toEqual(["Efectivo", "Datáfono"]);
    expect(canalesSinValidar({ ...base, efectivoDeclarado: 100, efectivoPOS: 100, datafonoDeclarado: 0, datafonoPOS: 0 })).toEqual([]);
  });
});
