import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parsePosExcelFile, evaluateAttendanceDay } from "./colombianPayroll";

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
  it("turno 12:00–19:30 con salida 19:45: 15 min adicionales y 45 min nocturnos", () => {
    const r = evaluateAttendanceDay("2026-08-04", "Martes", "12:00", "19:45", "12:00", "19:30", 30);
    expect(r.tiempoAdicionalSalidaMinutos).toBe(15);
    expect(r.recargoNocturnoMinutos).toBe(45);
    expect(r.horasTrabajadasEfectivas).toBe(7.3);
  });

  it("llegada anticipada no cuenta y la tardanza sí", () => {
    const temprano = evaluateAttendanceDay("2026-08-04", "Martes", "06:40", "15:00", "07:00", "15:00", 60);
    expect(temprano.llegadaAntesIgnoradaMinutos).toBe(20);
    expect(temprano.recargoNocturnoMinutos).toBe(0);
    const tarde = evaluateAttendanceDay("2026-08-04", "Martes", "07:10", "15:00", "07:00", "15:00", 60);
    expect(tarde.tardanzaEntradaMinutos).toBe(10);
  });

  it("domingo se marca como dominical", () => {
    expect(evaluateAttendanceDay("2026-08-02", "Domingo", "12:00", "19:30", "12:00", "19:30", 30).isDomingoOFestivo).toBe(true);
  });
});
