import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parsePosExcelFile, evaluateAttendanceDay, fusionarMarcacionDia, generatePayrollTirillaJson } from "./colombianPayroll";

function buildPosWorkbook(rows: (string | number)[][]): ArrayBuffer {
  // El reporte del POS trae 14 filas de encabezado antes de los datos.
  const header = Array.from({ length: 14 }, (_, i) => [`Encabezado ${i + 1}`]);
  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

const fila = (cedula: string, nombres: string, apellidos: string, entrada: string, salida: string) => {
  const r: string[] = Array(15).fill("");
  r[0] = cedula; r[3] = nombres; r[7] = apellidos; r[13] = entrada; r[14] = salida;
  return r;
};

describe("parsePosExcelFile (SheetJS)", () => {
  it("lee marcaciones de entrada/salida por colaborador", async () => {
    const buffer = buildPosWorkbook([
      fila("123456", "Ana", "Pérez", "2026-08-03 11:58:00", "2026-08-03 19:35:00"),
    ]);
    const result = await parsePosExcelFile(buffer, [{ nombre: "Ana Pérez", cedula: "123456" }]);
    const dia = result["Ana Pérez"]?.["2026-08-03"];
    expect(dia).toBeDefined();
    expect(dia.timeEntry).toBe("11:58");
    expect(dia.timeExit).toBe("19:35");
  });

  it("archivo vacío no rompe", async () => {
    expect(await parsePosExcelFile(buildPosWorkbook([]), [])).toEqual({});
  });
});

describe("evaluateAttendanceDay", () => {
  it("turno 12:00–19:30 con salida 19:45: 15 min extra nocturna y 30 min de recargo ordinario", () => {
    const r = evaluateAttendanceDay("2026-08-04", "Martes", "12:00", "19:45", "12:00", "19:30", 30);
    expect(r.tiempoAdicionalSalidaMinutos).toBe(15);
    expect(r.extraNocturnaMinutos).toBe(15);
    expect(r.extraDiurnaMinutos).toBe(0);
    expect(r.recargoNocturnoMinutos).toBe(30);
    expect(r.horasTrabajadasEfectivas).toBe(7.3);
  });

  it("llegada anticipada no cuenta y la tardanza sí", () => {
    const temprano = evaluateAttendanceDay("2026-08-04", "Martes", "06:40", "15:00", "07:00", "15:00", 60);
    expect(temprano.llegadaAntesIgnoradaMinutos).toBe(20);
    expect(temprano.recargoNocturnoMinutos).toBe(0);
    const tarde = evaluateAttendanceDay("2026-08-04", "Martes", "07:10", "15:00", "07:00", "15:00", 60);
    expect(tarde.tardanzaEntradaMinutos).toBe(10);
  });

  it("domingo se marca como dominical con el recargo vigente", () => {
    const r = evaluateAttendanceDay("2026-08-02", "Domingo", "12:00", "19:30", "12:00", "19:30", 30);
    expect(r.isDomingoOFestivo).toBe(true);
    expect(r.observacion).toContain("+90%");
    expect(evaluateAttendanceDay("2026-06-28", "Domingo", "12:00", "19:30", "12:00", "19:30", 30).observacion).toContain("+80%");
  });

  it("salida pasada la medianoche en turno diurno no se toma como salida anticipada", () => {
    const r = evaluateAttendanceDay("2026-08-04", "Martes", "12:00", "00:30", "12:00", "19:30", 30);
    expect(r.salidaTempranaMinutos).toBe(0);
    expect(r.tiempoAdicionalSalidaMinutos).toBe(300);
    expect(r.extraNocturnaMinutos).toBe(300);
    expect(r.horasTrabajadasEfectivas).toBe(12);
  });

  it("turno programado 18:00–02:00 que sale 01:30: 30 min de salida anticipada", () => {
    const r = evaluateAttendanceDay("2026-08-04", "Martes", "17:50", "01:30", "18:00", "02:00", 0);
    expect(r.llegadaAntesIgnoradaMinutos).toBe(10);
    expect(r.salidaTempranaMinutos).toBe(30);
    expect(r.faltantesNoCompensadosMinutos).toBe(30);
    expect(r.horasTrabajadasEfectivas).toBe(7.5);
  });

  it("turno programado 23:00–07:00 con entrada 00:10: tardanza de 70 min", () => {
    const r = evaluateAttendanceDay("2026-08-04", "Martes", "00:10", "07:00", "23:00", "07:00", 0);
    expect(r.tardanzaEntradaMinutos).toBe(70);
    expect(r.llegadaAntesIgnoradaMinutos).toBe(0);
    expect(r.salidaTempranaMinutos).toBe(0);
  });
});

describe("turnos que cruzan medianoche en marcaciones y tirilla", () => {
  const log = (timeEntry: string, timeExit: string) => ({ dateIso: "2026-08-04", timeEntry, timeExit, isDominical: false, isFestivo: false, durationStr: "" });

  it("al fusionar, una salida 01:00 gana sobre una de 23:00", () => {
    const r = fusionarMarcacionDia(log("18:00", "23:00"), log("18:05", "01:00"));
    expect(r.timeEntry).toBe("18:00");
    expect(r.timeExit).toBe("01:00");
  });

  it("la tirilla suma las horas de un turno 18:00–02:00", () => {
    const j = generatePayrollTirillaJson({ nombre: "Ana" }, {}, {}, {}, [{ fecha: "2026-08-04", horaIngreso: "18:00", horaSalida: "02:00" }]);
    expect(j.resumen_asistencia.horas_totales_pos).toBe("8:00");
  });
});
