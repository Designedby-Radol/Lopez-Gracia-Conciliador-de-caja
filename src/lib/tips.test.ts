import { describe, it, expect } from "vitest";
import { repartirPropinas, repartirPropinasEquitativo } from "./tips";

const suma = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe("repartirPropinas", () => {
  it("reparte proporcional a los puntos", () => {
    const r = repartirPropinas(100_000, [
      { name: "Líder", puntos: 2 },
      { name: "Asistente TC", puntos: 1.3 },
      { name: "Asistente MT", puntos: 1 },
    ]);
    expect(suma(r)).toBe(100_000);
    expect(r["Líder"]).toBeGreaterThan(r["Asistente TC"]);
    expect(r["Asistente TC"]).toBeGreaterThan(r["Asistente MT"]);
  });

  it("la suma es exacta aunque la división no lo sea", () => {
    const r = repartirPropinasEquitativo(100_000, ["A", "B", "C"]);
    expect(suma(r)).toBe(100_000);
    expect(Object.values(r).sort()).toEqual([33_333, 33_333, 33_334]);
  });

  it("quien tiene 0 puntos (gerencia, no apto) no recibe nada", () => {
    const r = repartirPropinas(50_000, [{ name: "Gerente", puntos: 0 }, { name: "Asistente", puntos: 1.3 }]);
    expect(r).toEqual({ Gerente: 0, Asistente: 50_000 });
  });

  it("sin participantes con puntos no reparte", () => {
    expect(repartirPropinas(10_000, [{ name: "X", puntos: 0 }])).toEqual({ X: 0 });
    expect(repartirPropinas(10_000, [])).toEqual({});
  });
});
