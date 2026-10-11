import { describe, it, expect } from "vitest";
import {
  divisorHorasMes, horasSemanalesLegales, minutosNocturnos, duracionTurnoMin, fechasDelPeriodo,
  factorDominical, etiquetaRecargoDominical, salidaContinuaMin, minutosNocturnosIntervalo,
  clasificarTiempoDia, totalizarTiempoPeriodo,
} from "./payroll";
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

describe("factorDominical (Ley 2466 de 2025)", () => {
  it.each([
    ["2025-06-30", 0.75],
    ["2025-07-01", 0.8],
    ["2026-06-30", 0.8],
    ["2026-07-01", 0.9],
    ["2027-06-30", 0.9],
    ["2027-07-01", 1.0],
  ])("%s → %d", (fecha, factor) => {
    expect(factorDominical(fecha)).toBe(factor);
  });
  it("etiqueta legible", () => {
    expect(etiquetaRecargoDominical("2026-06-16")).toBe("+80%");
    expect(etiquetaRecargoDominical("2027-07-15")).toBe("+100%");
  });
});

describe("línea de tiempo continua", () => {
  it("salida después de medianoche suma 1440", () => {
    expect(salidaContinuaMin(hm(18), hm(1))).toBe(1440 + hm(1));
    expect(salidaContinuaMin(hm(7), hm(15))).toBe(hm(15));
  });
  it("nocturnos de un intervalo que empieza pasada la medianoche", () => {
    expect(minutosNocturnosIntervalo(1440 + hm(5), 1440 + hm(7))).toBe(60);
    expect(minutosNocturnosIntervalo(hm(20), hm(20))).toBe(0);
  });
});

describe("clasificarTiempoDia", () => {
  it("12:00–19:30, sale 20:00: 30 min extra nocturna y 30 min de recargo ordinario", () => {
    const t = clasificarTiempoDia({ inicioEfectivoMin: hm(12), salidaProgramadaMin: hm(19, 30), salidaRealMin: hm(20), faltantesMin: 0 });
    expect(t).toEqual({ extraDiurnaMin: 0, extraNocturnaMin: 30, faltantesMin: 0, recargoNocturnoMin: 30 });
  });
  it("07:00–15:00, sale 20:00: 4 h extra diurna y 1 h extra nocturna", () => {
    const t = clasificarTiempoDia({ inicioEfectivoMin: hm(7), salidaProgramadaMin: hm(15), salidaRealMin: hm(20), faltantesMin: 0 });
    expect(t.extraDiurnaMin).toBe(240);
    expect(t.extraNocturnaMin).toBe(60);
    expect(t.recargoNocturnoMin).toBe(0);
  });
  it("tardanza de 20 min repuesta el mismo día: solo el excedente es extra", () => {
    const t = clasificarTiempoDia({ inicioEfectivoMin: hm(7, 20), salidaProgramadaMin: hm(15), salidaRealMin: hm(15, 30), faltantesMin: 20 });
    expect(t).toEqual({ extraDiurnaMin: 10, extraNocturnaMin: 0, faltantesMin: 0, recargoNocturnoMin: 0 });
  });
  it("los minutos que reponen tardanza se toman primero y son jornada ordinaria", () => {
    // Entra 12:30 (30 tarde), sale 20:00: 19:30–20:00 repone la tardanza → sin extra, 60 min de recargo ordinario
    const t = clasificarTiempoDia({ inicioEfectivoMin: hm(12, 30), salidaProgramadaMin: hm(19, 30), salidaRealMin: hm(20), faltantesMin: 30 });
    expect(t).toEqual({ extraDiurnaMin: 0, extraNocturnaMin: 0, faltantesMin: 0, recargoNocturnoMin: 60 });
  });
  it("salida anticipada sin reposición queda como faltante", () => {
    const t = clasificarTiempoDia({ inicioEfectivoMin: hm(7), salidaProgramadaMin: hm(15), salidaRealMin: hm(14), faltantesMin: 60 });
    expect(t.faltantesMin).toBe(60);
    expect(t.extraDiurnaMin + t.extraNocturnaMin).toBe(0);
  });
  it("turno que cruza medianoche 18:00–02:00 con salida 03:00", () => {
    const t = clasificarTiempoDia({ inicioEfectivoMin: hm(18), salidaProgramadaMin: 1440 + hm(2), salidaRealMin: 1440 + hm(3), faltantesMin: 0 });
    expect(t.extraNocturnaMin).toBe(60);
    expect(t.recargoNocturnoMin).toBe(7 * 60);
  });
});

describe("totalizarTiempoPeriodo", () => {
  it("no netea tardanzas de un día contra extras de otro", () => {
    const r = totalizarTiempoPeriodo(
      [
        { extraDiurnaMin: 60, extraNocturnaMin: 0, faltantesMin: 0 },
        { extraDiurnaMin: 0, extraNocturnaMin: 30, faltantesMin: 0 },
        { extraDiurnaMin: 0, extraNocturnaMin: 0, faltantesMin: 45 },
      ],
      10000
    );
    expect(r.horasExtraDiurnas).toBe(1);
    expect(r.horasExtraNocturnas).toBe(0.5);
    expect(r.deduccionTiempoFaltante).toBe(7500);
  });
});
