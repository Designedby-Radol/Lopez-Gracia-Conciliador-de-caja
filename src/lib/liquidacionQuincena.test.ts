import { describe, it, expect } from "vitest";
import { liquidarQuincena } from "./liquidacionQuincena";

const base = { salarioBaseMensual: 2_100_000, tipoContrato: "Indefinido" as const, auxilioTransporteAplica: false };
const params = (fechaFin: string) => ({ smmlv: 1_750_905, auxTransporteMensual: 249_095, fechaFin });

describe("liquidarQuincena", () => {
  it("recargo dominical 80% en jun-2026 y 90% desde jul-2026", () => {
    // Hora ordinaria: 2.100.000 / 220 (44 h) en junio y / 210 (42 h) desde el 15-jul-2026
    const junio = liquidarQuincena(base, { recargosDominicales: 10 }, params("2026-06-30"));
    expect(junio.valRecargosDominicales).toBeCloseTo(10 * (2_100_000 / 220) * 0.8, 6);
    const julio = liquidarQuincena(base, { recargosDominicales: 10 }, params("2026-07-31"));
    expect(julio.valRecargosDominicales).toBeCloseTo(10 * 10_000 * 0.9, 6);
  });

  it("extras diurnas ×1,25 y nocturnas ×1,75", () => {
    const r = liquidarQuincena(base, { horasExtraDiurnas: 2, horasExtraNocturnas: 1 }, params("2026-07-31"));
    expect(r.valHED).toBeCloseTo(2 * 10_000 * 1.25, 6);
    expect(r.valHEN).toBeCloseTo(10_000 * 1.75, 6);
  });

  it("indefinido: 15 días, 4% salud y 4% pensión sobre el IBC", () => {
    const r = liquidarQuincena(base, {}, params("2026-07-31"));
    expect(r.salarioQuincenal).toBe(1_050_000);
    expect(r.deduccionSalud).toBeCloseTo(42_000, 6);
    expect(r.netoAPagar).toBeCloseTo(1_050_000 - 84_000, 6);
  });
});
