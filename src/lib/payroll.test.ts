import { describe, it, expect } from "vitest";
import { divisorHorasMes, horasSemanalesLegales, minutosNocturnos, duracionTurnoMin, fechasDelPeriodo } from "./payroll";
import { getColombianHolidays } from "../utils/colombiaHolidays";

const hm = (h: number, m = 0) => h * 60 + m;

describe("jornada legal (Ley 2101 de 2021)", () => {
  it.each([
    ["2024-07-14", 47, 235],
    ["2024-07-15", 46, 230],
    ["2025-07-15", 44, 220],
    ["2026-07-14", 44, 220],
    ["2026-07-15", 42, 210],
    ["2027-01-15", 42, 210],
  ])("%s → %i h/semana, divisor %i", (fecha, horas, divisor) => {
    expect(horasSemanalesLegales(fecha)).toBe(horas);
    expect(divisorHorasMes(fecha)).toBe(divisor);
  });
});

describe("minutosNocturnos (19:00–06:00)", () => {
  it("turno de 12:00 a 19:30 → 30 min nocturnos", () => {
    expect(minutosNocturnos(hm(12), hm(19, 30))).toBe(30);
  });
  it("turno diurno de 07:00 a 15:00 → 0", () => {
    expect(minutosNocturnos(hm(7), hm(15))).toBe(0);
  });
  it("entrada de madrugada 05:00 a 13:00 → 60", () => {
    expect(minutosNocturnos(hm(5), hm(13))).toBe(60);
  });
  it("turno que cruza medianoche 18:00 a 02:00 → 7 h", () => {
    expect(minutosNocturnos(hm(18), hm(2))).toBe(7 * 60);
    expect(duracionTurnoMin(hm(18), hm(2))).toBe(8 * 60);
  });
});

describe("fechasDelPeriodo", () => {
  it("segunda quincena de febrero (año no bisiesto)", () => {
    const f = fechasDelPeriodo("2027-02-16", "2027-02-28");
    expect(f.length).toBe(13);
    expect(f[0]).toBe("2027-02-16");
    expect(f.at(-1)).toBe("2027-02-28");
  });
  it("período vacío si el fin es anterior al inicio", () => {
    expect(fechasDelPeriodo("2026-07-15", "2026-07-01")).toEqual([]);
  });
});

describe("festivos de Colombia (Ley Emiliani)", () => {
  it("2026: los 18 festivos oficiales", () => {
    expect([...getColombianHolidays(2026)].sort()).toEqual([
      "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
      "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07",
      "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    ]);
  });

  it("2027 (Pascua 28 de marzo): Semana Santa y festivos móviles", () => {
    const h = getColombianHolidays(2027);
    for (const f of ["2027-03-25", "2027-03-26", "2027-05-10", "2027-05-31", "2027-06-07"]) {
      expect(h.has(f)).toBe(true);
    }
  });
});
