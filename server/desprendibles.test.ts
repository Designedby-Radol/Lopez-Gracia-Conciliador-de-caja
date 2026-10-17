import { describe, it, expect, vi } from "vitest";

vi.mock("./supabase", () => ({ supabaseAdmin: {} }));

const { construirDesprendible } = await import("./desprendibles");
const { avisosPorCierre } = await import("./notificaciones");

describe("construirDesprendible", () => {
  const liquidacion = {
    tipoContrato: "Indefinido",
    area: "Servicio",
    diasLaboradosTotales: 15,
    diasAsistidosEfectivos: 13,
    salarioQuincenal: 875452.5,
    auxTransporte: 107941,
    valHED: 0,
    valHEN: 20000,
    valRecargosDominicales: 0,
    valRecargoNocturnoMinutos: 0,
    totalIngresosSalariales: 895452.5,
    totalIngresosNoSalariales: 0,
    deduccionSalud: 35818,
    deduccionPension: 35818,
    totalDeduccionesOtros: 0,
    devengadoTotal: 1003393.5,
    totalDeducciones: 71636,
    netoAPagar: 931757.5,
    attendanceRecords: [{ observacion: "llegó tarde por X" }],
    informacionParticular: "nota privada de gerencia",
  };

  it("solo incluye conceptos con valor y los totales guardados", () => {
    const d = construirDesprendible(liquidacion, { nombre: "Ana", cargo: "Asistente de servicio" });
    expect(d.neto).toBe(931758);
    expect(d.datos.conceptos.map((c) => c.concepto)).toEqual([
      "Salario básico quincenal (15 días)",
      "Auxilio de transporte (13 días)",
      "Horas extra nocturnas",
      "Aporte salud (4%)",
      "Aporte pensión (4%)",
    ]);
  });

  it("no deja pasar marcaciones ni notas internas", () => {
    const json = JSON.stringify(construirDesprendible(liquidacion, { nombre: "Ana" }));
    expect(json).not.toContain("llegó tarde");
    expect(json).not.toContain("nota privada");
  });

  it("rechaza liquidaciones sin totales", () => {
    expect(() => construirDesprendible({ salarioQuincenal: 1 }, { nombre: "Ana" })).toThrow(/totales/);
  });
});

describe("avisosPorCierre", () => {
  const cierre = {
    id: "c1",
    fecha: "2026-10-10",
    estado: "Cuadrado",
    colaborador_id: "reg",
    lider_id: "lid",
    auxiliares: [{ id: "aux" }, { id: "reg" }],
    descuadre_lider: 6000,
    descuadre_auxiliar: 0,
  };

  it("avisa del descuadre a quien tiene monto y del cuadre al resto, sin duplicar personas", () => {
    const avisos = avisosPorCierre(cierre, "Cuadrado");
    expect(avisos.map((a) => [a.usuario_id, a.tipo])).toEqual([
      ["reg", "cierre_cuadrado"],
      ["lid", "descuadre"],
      ["aux", "cierre_cuadrado"],
    ]);
    expect(avisos[1].titulo).toContain("6.000");
  });

  it("al anular solo avisa a quien registró", () => {
    expect(avisosPorCierre(cierre, "Anulado").map((a) => a.usuario_id)).toEqual(["reg"]);
  });
});
