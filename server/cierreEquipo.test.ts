import { describe, it, expect } from "vitest";
import { resolverUsuario, resolverAuxiliares, aplanarAuxiliares, type UsuarioEquipo } from "./cierreEquipo";

const CHAPINERO = "11111111-1111-1111-1111-111111111111";
const USAQUEN = "22222222-2222-2222-2222-222222222222";

const usuarios: UsuarioEquipo[] = [
  { id: "aaaaaaaa-0000-0000-0000-000000000001", nombre: "Juana Díaz", cedula: "1010", local_id: CHAPINERO },
  { id: "aaaaaaaa-0000-0000-0000-000000000002", nombre: "Pedro Gómez", email: "pedro@lg.co", local_id: CHAPINERO },
  { id: "aaaaaaaa-0000-0000-0000-000000000003", nombre: "Pedro Gómez", local_id: USAQUEN },
  { id: "aaaaaaaa-0000-0000-0000-000000000004", nombre: "Luisa Rey", local_id: USAQUEN },
  { id: "aaaaaaaa-0000-0000-0000-000000000005", nombre: "Ana Mora", local_id: USAQUEN },
  { id: "aaaaaaaa-0000-0000-0000-000000000006", nombre: "Ana Mora", local_id: null },
];

describe("resolverUsuario", () => {
  it("resuelve nombre sin tildes ni mayúsculas, correo, cédula y UUID", () => {
    expect(resolverUsuario("  juana   diaz ", usuarios, CHAPINERO)).toBe(usuarios[0].id);
    expect(resolverUsuario("PEDRO@lg.co", usuarios, CHAPINERO)).toBe(usuarios[1].id);
    expect(resolverUsuario("1010", usuarios, CHAPINERO)).toBe(usuarios[0].id);
    expect(resolverUsuario(usuarios[3].id.toUpperCase(), usuarios, CHAPINERO)).toBe(usuarios[3].id);
  });

  it("prefiere al homónimo del local del cierre", () => {
    expect(resolverUsuario("Pedro Gómez", usuarios, CHAPINERO)).toBe(usuarios[1].id);
    expect(resolverUsuario("Pedro Gómez", usuarios, USAQUEN)).toBe(usuarios[2].id);
  });

  it("acepta personal de otra sede solo si es único en la empresa", () => {
    expect(resolverUsuario("Luisa Rey", usuarios, CHAPINERO)).toBe(usuarios[3].id);
    expect(resolverUsuario("Ana Mora", usuarios, CHAPINERO)).toBeNull();
  });

  it("nunca aproxima: nombre parcial o UUID inexistente no resuelven", () => {
    expect(resolverUsuario("Juana", usuarios, CHAPINERO)).toBeNull();
    expect(resolverUsuario("bbbbbbbb-0000-0000-0000-000000000000", usuarios, CHAPINERO)).toBeNull();
    expect(resolverUsuario("", usuarios, CHAPINERO)).toBeNull();
  });
});

describe("resolverAuxiliares", () => {
  it("devuelve ids sin repetir y lista los no encontrados", () => {
    const r = resolverAuxiliares(["Juana Díaz", "juana diaz", "1010", "Desconocido", "  ", 7], usuarios, CHAPINERO);
    expect(r.ids).toEqual([usuarios[0].id]);
    expect(r.noEncontrados).toEqual(["Desconocido"]);
  });

  it("lista vacía o inválida no produce auxiliares", () => {
    expect(resolverAuxiliares([], usuarios, CHAPINERO)).toEqual({ ids: [], noEncontrados: [] });
    expect(resolverAuxiliares(undefined, usuarios, CHAPINERO)).toEqual({ ids: [], noEncontrados: [] });
  });
});

describe("aplanarAuxiliares", () => {
  it("convierte el embed de PostgREST en {id, nombre} ordenado por nombre", () => {
    const row = {
      id: "c1",
      descuadre_auxiliar: 20000,
      auxiliares: [
        { usuario_id: "u2", usuario: { nombre: "Pedro Gómez" } },
        { usuario_id: "u1", usuario: { nombre: "Ana Mora" } },
      ],
    };
    const out = aplanarAuxiliares(row);
    expect(out.auxiliares).toEqual([{ id: "u1", nombre: "Ana Mora" }, { id: "u2", nombre: "Pedro Gómez" }]);
    expect(out.descuadre_auxiliar).toBe(20000);
  });

  it("sin auxiliares devuelve lista vacía", () => {
    expect(aplanarAuxiliares({ id: "c1", auxiliares: [] }).auxiliares).toEqual([]);
    expect(aplanarAuxiliares({ id: "c1" }).auxiliares).toEqual([]);
  });
});
