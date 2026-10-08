import { describe, it, expect, vi, beforeEach } from "vitest";

const apiMock = vi.fn();
vi.mock("../lib/api", () => ({ api: (...args: any[]) => apiMock(...args) }));

import { dbAdapter, fromDbRow, toDbRow, equipoPayload } from "./dbAdapter";
import { repartirDescuadre } from "../lib/discrepancy";

const LOCAL = "11111111-1111-1111-1111-111111111111";
const LIDER = "aaaaaaaa-0000-0000-0000-000000000001";

const equipo = [
  { nombre: "Laura Líder", cargo: "Lider Operador" },
  { nombre: "Juana Díaz", cargo: "Asistente de servicio" },
  { nombre: "Pedro Gómez", cargo: "Asistente de servicio" },
  { nombre: "Sofía Torta", cargo: "Auxiliar Pasteleria" },
];

beforeEach(() => {
  apiMock.mockReset();
});

describe("equipoPayload / toDbRow", () => {
  it("envía los nombres de auxiliares y el líder para que el servidor los resuelva", () => {
    expect(equipoPayload({ liderNombre: " Laura Líder ", auxiliaresNombres: ["Juana Díaz", " ", "Pedro Gómez"] })).toEqual({
      lider_nombre: "Laura Líder",
      auxiliares_nombres: ["Juana Díaz", "Pedro Gómez"],
    });
  });

  it("un lider_id válido tiene prioridad sobre el nombre", () => {
    expect(equipoPayload({ liderId: LIDER, liderNombre: "Laura Líder" })).toEqual({ lider_id: LIDER });
  });

  it("sin auxiliaresNombres no toca cierre_auxiliares; lista vacía sí (los borra)", () => {
    expect(equipoPayload({})).toEqual({});
    expect(equipoPayload({ auxiliaresNombres: [] })).toEqual({ auxiliares_nombres: [] });
  });

  it("toDbRow incluye el equipo junto a los montos del 60/40 sin alterarlos", () => {
    const row = toDbRow(
      { fecha: "2026-09-10", liderNombre: "Laura Líder", auxiliaresNombres: ["Juana Díaz"], descuadreLider: 60000, descuadreAuxiliar: 40000 },
      LOCAL,
    );
    expect(row.lider_nombre).toBe("Laura Líder");
    expect(row.auxiliares_nombres).toEqual(["Juana Díaz"]);
    expect(row.descuadre_lider).toBe(60000);
    expect(row.descuadre_auxiliar).toBe(40000);
  });
});

describe("fromDbRow", () => {
  it("mapea líder (desde lider_id) y auxiliares (desde cierre_auxiliares)", () => {
    const c = fromDbRow({
      id: "c1", fecha: "2026-09-10", local_id: LOCAL, estado: "Cuadrado",
      lider_id: LIDER, lider: { nombre: "Laura Líder" },
      auxiliares: [{ id: "u1", nombre: "Juana Díaz" }, { id: "u2", nombre: "Pedro Gómez" }],
      descuadre_lider: "60000", descuadre_auxiliar: "20000",
    });
    expect(c.liderId).toBe(LIDER);
    expect(c.liderNombre).toBe("Laura Líder");
    expect(c.auxiliaresNombres).toEqual(["Juana Díaz", "Pedro Gómez"]);
    expect(c.descuadreLider).toBe(60000);
    expect(c.descuadreAuxiliar).toBe(20000);
  });

  it("sin líder ni auxiliares devuelve undefined / lista vacía", () => {
    const c = fromDbRow({ id: "c1", fecha: "2026-09-10", estado: "Pendiente por Cuadrar", auxiliares: [] });
    expect(c.liderNombre).toBeUndefined();
    expect(c.auxiliaresNombres).toEqual([]);
  });
});

describe("persistencia del equipo y regla 60/40", () => {
  it("el reparto recalculado tras recargar es idéntico al aprobado", () => {
    const aprobado = repartirDescuadre(100_001, "Laura Líder", ["Juana Díaz", "Sofía Torta", "Pedro Gómez"], equipo);
    // Lo que Gerencia guarda: solo los auxiliares elegibles (Sofía es de pastelería).
    expect(aprobado.auxiliaresElegibles).toEqual(["Juana Díaz", "Pedro Gómez"]);

    // Lo que devuelve el servidor tras recargar (nombres canónicos desde usuarios).
    const recargado = fromDbRow({
      id: "c1", fecha: "2026-09-10", estado: "Cuadrado",
      lider: { nombre: "Laura Líder" },
      auxiliares: aprobado.auxiliaresElegibles.map((nombre, i) => ({ id: `u${i}`, nombre })),
      descuadre_lider: aprobado.lider, descuadre_auxiliar: aprobado.porAuxiliar,
    });
    const otraVez = repartirDescuadre(100_001, recargado.liderNombre!, recargado.auxiliaresNombres!, equipo);
    expect(otraVez.lider).toBe(aprobado.lider);
    expect(otraVez.porAuxiliar).toBe(aprobado.porAuxiliar);
    expect(otraVez.auxiliaresElegibles).toEqual(aprobado.auxiliaresElegibles);
    expect(recargado.descuadreLider).toBe(aprobado.lider);
    expect(recargado.descuadreAuxiliar).toBe(aprobado.porAuxiliar);
    expect(recargado.descuadreLider! + recargado.descuadreAuxiliar! * recargado.auxiliaresNombres!.length).toBe(100_001);
  });

  it("al aprobar, updateCierre envía auxiliares y montos tal cual", async () => {
    apiMock.mockResolvedValue({ success: true });
    await dbAdapter.updateCierre("c1", {
      estado: "Cuadrado",
      liderNombre: "Laura Líder",
      auxiliaresNombres: ["Juana Díaz", "Pedro Gómez"],
      descuadreLider: 60001,
      descuadreAuxiliar: 20000,
    });
    expect(apiMock).toHaveBeenCalledTimes(1);
    const [path, init] = apiMock.mock.calls[0];
    expect(path).toBe("/api/db/cierres/c1");
    expect(init.method).toBe("PUT");
    expect(init.json).toEqual({
      estado: "Cuadrado",
      lider_nombre: "Laura Líder",
      auxiliares_nombres: ["Juana Díaz", "Pedro Gómez"],
      descuadre_lider: 60001,
      descuadre_auxiliar: 20000,
    });
  });

  it("al declarar, saveCierre envía los auxiliares y devuelve los guardados", async () => {
    apiMock.mockImplementation(async (path: string, init?: any) => {
      if (path === "/api/db/cierres") {
        return {
          data: {
            id: "c9", fecha: init.json.fecha, estado: "Pendiente por Cuadrar",
            lider: { nombre: "Laura Líder" }, auxiliares: [{ id: "u1", nombre: "Juana Díaz" }],
          },
        };
      }
      throw new Error(`ruta inesperada ${path}`);
    });
    const c = await dbAdapter.saveCierre(
      {
        fecha: "2026-09-10", efectivoCierre: 0, datafonoCierre: 0, propinas: 0, estado: "Pendiente por Cuadrar",
        liderNombre: "Laura Líder", auxiliaresNombres: ["Juana Díaz"],
      } as any,
      LOCAL,
    );
    const [, init] = apiMock.mock.calls[0];
    expect(init.json.auxiliares_nombres).toEqual(["Juana Díaz"]);
    expect(init.json.lider_nombre).toBe("Laura Líder");
    expect(c.auxiliaresNombres).toEqual(["Juana Díaz"]);
    expect(c.liderNombre).toBe("Laura Líder");
  });
});
