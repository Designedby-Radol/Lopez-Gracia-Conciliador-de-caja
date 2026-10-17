import { describe, it, expect } from "vitest";
import {
  calcularDiferencias,
  faltanteCobrable,
  repartirDescuadre,
  cargoParticipaEnDescuadre,
  resolverPosCanales,
  canalesSinValidar,
  type ConciliacionInput,
} from "./discrepancy";

const base: ConciliacionInput = {
  efectivoDeclarado: 500_000,
  datafonoDeclarado: 300_000,
  efectivoPOS: 500_000,
  datafonoPOS: 300_000,
  justoPOS: 100_000,
  rappiPOS: 80_000,
  transferenciasPOS: 50_000,
  justoReal: 100_000,
  rappiReal: 80_000,
  transferenciasReal: 50_000,
};

const equipo = [
  { nombre: "Ana Pérez", cargo: "Lider Operador" },
  { nombre: "Juana Díaz", cargo: "Asistente de servicio" },
  { nombre: "Luis Gómez", cargo: "Asistente de servicio" },
  { nombre: "Marta Ruiz", cargo: "Auxiliar Pasteleria" },
  { nombre: "Pedro Sánchez", cargo: "Lider de pasteleria" },
  { nombre: "Gerente Uno", cargo: "Gerencia" },
];

describe("calcularDiferencias", () => {
  it("caja cuadrada → todo en cero", () => {
    expect(calcularDiferencias(base)).toEqual({ efectivo: 0, tarjetas: 0, justo: 0, rappi: 0, transferencias: 0, total: 0 });
  });

  it("faltante de efectivo es negativo (declarado − POS)", () => {
    const d = calcularDiferencias({ ...base, efectivoDeclarado: 450_000 });
    expect(d.efectivo).toBe(-50_000);
    expect(faltanteCobrable(d)).toBe(50_000);
  });

  it("un sobrante en un canal compensa un faltante en otro con base 'total'", () => {
    const d = calcularDiferencias({ ...base, efectivoDeclarado: 450_000, rappiReal: 130_000 });
    expect(d.total).toBe(0);
    expect(faltanteCobrable(d, "total")).toBe(0);
    expect(faltanteCobrable(d, "efectivo")).toBe(50_000);
  });
});

describe("cargoParticipaEnDescuadre", () => {
  it.each([
    ["Asistente de servicio", true],
    ["Lider Operador", true],
    ["Auxiliar Pasteleria", false],
    ["Auxiliar de pastelería", false],
    ["Asistente de pasteleria", false],
    ["Lider de pasteleria", false],
    ["Líder de pastelería", false],
    ["Gerencia", false],
    ["administrador", false],
  ])("%s → %s", (cargo, esperado) => {
    expect(cargoParticipaEnDescuadre(cargo)).toBe(esperado);
  });
});

describe("repartirDescuadre", () => {
  it("60% líder y 40% dividido entre auxiliares elegibles", () => {
    const r = repartirDescuadre(100_000, "Ana Pérez", ["Juana Díaz", "Luis Gómez"], equipo);
    expect(r.lider).toBe(60_000);
    expect(r.porAuxiliar).toBe(20_000);
    expect(r.lider + r.porAuxiliar * r.auxiliaresElegibles.length).toBe(100_000);
  });

  it("excluye pastelería y gerencia aunque el nombre no tenga tildes", () => {
    const r = repartirDescuadre(100_000, "Ana Pérez", ["Juana Diaz", "marta ruiz", "Pedro Sanchez", "Gerente Uno"], equipo);
    expect(r.auxiliaresElegibles).toEqual(["Juana Diaz"]);
    expect(r.porAuxiliar).toBe(40_000);
    expect(r.excluidos.map((e) => e.nombre)).toEqual(["marta ruiz", "Pedro Sanchez", "Gerente Uno"]);
  });

  it("no cuenta dos veces un nombre repetido ni al líder como auxiliar", () => {
    const r = repartirDescuadre(90_000, "Ana Pérez", ["Juana Díaz", "juana diaz", "Ana Perez"], equipo);
    expect(r.auxiliaresElegibles).toEqual(["Juana Díaz"]);
    expect(r.lider).toBe(54_000);
    expect(r.porAuxiliar).toBe(36_000);
  });

  it("sin auxiliares elegibles el líder asume el 100%", () => {
    const r = repartirDescuadre(75_000, "Ana Pérez", ["Marta Ruiz"], equipo);
    expect(r.lider).toBe(75_000);
    expect(r.porAuxiliar).toBe(0);
  });

  it("los pesos del redondeo los asume el líder y la suma cuadra exacto", () => {
    const r = repartirDescuadre(100_001, "Ana Pérez", ["Juana Díaz", "Luis Gómez", "Temporal"], equipo);
    expect(r.lider + r.porAuxiliar * 3).toBe(100_001);
    expect(r.porAuxiliar).toBe(13_333);
  });

  it("sin faltante no cobra nada", () => {
    const r = repartirDescuadre(0, "Ana Pérez", ["Juana Díaz"], equipo);
    expect(r.lider).toBe(0);
    expect(r.porAuxiliar).toBe(0);
  });
});

describe("resolverPosCanales", () => {
  const cierre = { justoCierre: 90_000, rappiCierre: 70_000, transferenciasCierre: 40_000, justoPOS: 0, rappiPOS: 75_000, transferenciasPOS: null };

  it("usa el reporte POS cargado si existe", () => {
    expect(resolverPosCanales({ efectivoPOS: 1, tarjetasPOS: 0, justoPOS: 10, rappiPOS: 20, transferenciasPOS: 30 }, cierre))
      .toEqual({ justoPOS: 10, rappiPOS: 20, transferenciasPOS: 30 });
  });

  it("sin reporte: POS guardado > 0, o lo declarado (los 0 guardados no cuentan como dato)", () => {
    expect(resolverPosCanales(null, cierre)).toEqual({ justoPOS: 90_000, rappiPOS: 75_000, transferenciasPOS: 40_000 });
  });
});

describe("canalesSinValidar", () => {
  it("detecta Justo/Rappi con venta POS pero sin valor real ingresado", () => {
    expect(canalesSinValidar({ ...base, justoReal: 0, rappiReal: 0 })).toEqual(["Justo", "Rappi"]);
    expect(canalesSinValidar(base)).toEqual([]);
  });
});
