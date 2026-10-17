import { describe, it, expect } from "vitest";
import { asignarMarcaciones } from "./marcaciones";
import { matchEmployeeName, parsePosPdfPages, findEmployeeHeaderPositionsInText } from "../utils/colombianPayroll";

const equipo = [
  { nombre: "Ana Pérez", cedula: "1020304050" },
  { nombre: "Luis Gómez", cedula: "79888777" },
  { nombre: "Marta Ruiz" },
];

describe("matchEmployeeName", () => {
  it("acepta cédula exacta o nombre + apellido", () => {
    expect(matchEmployeeName("1020304050", equipo)?.nombre).toBe("Ana Pérez");
    expect(matchEmployeeName("GOMEZ LUIS", equipo)?.nombre).toBe("Luis Gómez");
    expect(matchEmployeeName("Marta Ruiz Torres", equipo)?.nombre).toBe("Marta Ruiz");
  });

  it("rechaza un solo nombre", () => {
    expect(matchEmployeeName("Ana", equipo)).toBeNull();
    expect(matchEmployeeName("Gómez", equipo)).toBeNull();
  });

  it("no confunde una cédula contenida dentro de otro número", () => {
    expect(matchEmployeeName("9102030405099", equipo)).toBeNull();
  });

  it("no asigna si el nombre es ambiguo entre dos colaboradores", () => {
    const conHomonimos = [{ nombre: "Ana Pérez Gómez" }, { nombre: "Ana Pérez Ruiz" }];
    expect(matchEmployeeName("Ana Pérez", conHomonimos)).toBeNull();
  });
});

describe("asignarMarcaciones", () => {
  it("un reporte con un solo colaborador no se asigna a todo el equipo", () => {
    const r = asignarMarcaciones({ "Luis Gómez": { "2026-10-01": "log" } }, equipo);
    expect(Object.keys(r.porEmpleado)).toEqual(["Luis Gómez"]);
    expect(r.sinMarcaciones).toEqual(["Ana Pérez", "Marta Ruiz"]);
    expect(r.noAsignados).toEqual([]);
  });

  it("reporta los nombres del reporte que no se pudieron asociar", () => {
    const r = asignarMarcaciones({ Ana: { x: 1 }, "PEREZ ANA": { y: 2 } }, equipo);
    expect(r.porEmpleado["Ana Pérez"]).toEqual({ y: 2 });
    expect(r.noAsignados).toEqual(["Ana"]);
  });
});

describe("parsePosPdfPages", () => {
  const marca = "01/10/2026 07:00 AM 01/10/2026 03:00 PM 8:00 NO NO";

  it("sin encabezado identificado no carga las marcas al primer colaborador", () => {
    expect(parsePosPdfPages([`REPORTE ${marca}`], equipo)).toEqual({});
  });

  it("las marcas antes del primer encabezado no se asignan a nadie", () => {
    const texto = `${marca} ${"x".repeat(200)} Luis Gómez 02/10/2026 07:00 AM 02/10/2026 03:00 PM 8:00 NO NO`;
    const r = parsePosPdfPages([texto], equipo);
    expect(Object.keys(r)).toEqual(["Luis Gómez"]);
    expect(Object.keys(r["Luis Gómez"])).toEqual(["2026-10-02"]);
  });

  it("un colaborador registrado con un solo nombre no se detecta por coincidencias sueltas", () => {
    expect(findEmployeeHeaderPositionsInText("Ana María López", { nombre: "Ana" })).toEqual([]);
    expect(findEmployeeHeaderPositionsInText("Ana Lopez ... Gomez", { nombre: "Ana Gómez" })).toEqual([]);
  });
});
