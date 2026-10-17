import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import type { SessionUser } from "../auth";

// ---- Supabase simulado (mismo esquema que db.test.ts) ----
interface Consulta { table: string; select?: string; filters: [string, string, unknown][]; op: string }
const consultas: Consulta[] = [];
let responder: (c: Consulta) => { data: any; error: any } = () => ({ data: [], error: null });

function builder(table: string) {
  const c: Consulta = { table, filters: [], op: "select" };
  consultas.push(c);
  const b: any = {
    select(cols?: string) { if (c.op === "select") c.select = cols; return b; },
    update() { c.op = "update"; return b; },
    insert() { c.op = "insert"; return b; },
    order() { return b; },
    limit() { return b; },
    eq(col: string, v: unknown) { c.filters.push(["eq", col, v]); return b; },
    neq(col: string, v: unknown) { c.filters.push(["neq", col, v]); return b; },
    gte(col: string, v: unknown) { c.filters.push(["gte", col, v]); return b; },
    in(col: string, v: unknown) { c.filters.push(["in", col, v]); return b; },
    is(col: string, v: unknown) { c.filters.push(["is", col, v]); return b; },
    single() { return Promise.resolve(responder(c)); },
    maybeSingle() { return Promise.resolve(responder(c)); },
    then(ok: any, ko: any) { return Promise.resolve(responder(c)).then(ok, ko); },
  };
  return b;
}

vi.mock("../supabase", () => ({
  supabaseAdmin: { from: (t: string) => builder(t) },
  isValidUUID: (id: unknown) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
}));
const audit = vi.fn(async () => {});
vi.mock("../audit", () => ({ writeAudit: (...a: any[]) => audit(...(a as [])) }));

const { meRouter } = await import("./me");

const LOCAL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTRO_ID = "99999999-9999-9999-9999-999999999999";
const DESP_ID = "55555555-5555-5555-5555-555555555555";
const asistente: SessionUser = {
  sub: USER_ID, nombre: "Ana", cargo: "Asistente de servicio", role: "usuario", localId: LOCAL_A,
  local: "Chapinero", isGerencia: false, mustChangePassword: false, sessionVersion: 0,
};

let currentUser: SessionUser = asistente;
let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = currentUser; next(); });
  app.use("/api/me", meRouter);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });

beforeEach(() => {
  consultas.length = 0;
  audit.mockClear();
  responder = () => ({ data: [], error: null });
  currentUser = asistente;
});

async function call(path: string, init?: RequestInit) {
  const r = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json" } });
  return { status: r.status, headers: r.headers, body: await r.json() };
}

describe("/api/me: siempre el usuario de la sesión", () => {
  it("no guarda respuestas en caché", async () => {
    const { headers } = await call("/api/me/notificaciones");
    expect(headers.get("cache-control")).toContain("no-store");
  });

  it("resumen consulta solo el local de la sesión aunque se pida otro usuario o local", async () => {
    const { status, body } = await call(`/api/me/resumen?usuario_id=${OTRO_ID}&local_id=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`);
    expect(status).toBe(200);
    const cierres = consultas.find((c) => c.table === "cierres_caja")!;
    expect(cierres.filters).toContainEqual(["eq", "local_id", LOCAL_A]);
    expect(body.data.perfil).toMatchObject({ nombre: "Ana", participaDescuadre: true, esLiderOperador: false });
  });

  it("pastelería no participa del 60/40: el resumen no trae descuadres", async () => {
    currentUser = { ...asistente, cargo: "Auxiliar Pasteleria" };
    const { body } = await call("/api/me/resumen");
    expect(body.data.perfil.participaDescuadre).toBe(false);
    expect(body.data.resumen.descuadres).toBeNull();
  });

  it("sin local asignado no consulta la BD", async () => {
    currentUser = { ...asistente, localId: null };
    const { body } = await call("/api/me/resumen");
    expect(body.data.resumen).toBeNull();
    expect(consultas).toHaveLength(0);
  });
});

describe("/api/me/punto", () => {
  it("rechaza a quien no es Líder Operador", async () => {
    expect((await call("/api/me/punto")).status).toBe(403);
    currentUser = { ...asistente, cargo: "Lider Pasteleria" };
    expect((await call("/api/me/punto")).status).toBe(403);
  });

  it("el Líder Operador recibe el panel de su local", async () => {
    currentUser = { ...asistente, cargo: "Lider Operador" };
    const { status, body } = await call("/api/me/punto");
    expect(status).toBe(200);
    expect(body.data.ventas.metaMensual).toBe(10_000_000);
    expect(consultas.find((c) => c.table === "usuarios")!.filters).toContainEqual(["eq", "local_id", LOCAL_A]);
  });
});

describe("/api/me/desprendibles", () => {
  it("el detalle filtra por el usuario de la sesión y solo publicados", async () => {
    responder = () => ({ data: { id: DESP_ID, fecha_inicio: "2026-10-01", fecha_fin: "2026-10-15", version: 1, neto: 900000 }, error: null });
    const { status } = await call(`/api/me/desprendibles/${DESP_ID}`);
    expect(status).toBe(200);
    expect(consultas[0].filters).toEqual([
      ["eq", "id", DESP_ID],
      ["eq", "usuario_id", USER_ID],
      ["eq", "estado", "publicado"],
    ]);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it("si es de otra persona responde 404 y no audita lectura", async () => {
    responder = () => ({ data: null, error: null });
    const { status } = await call(`/api/me/desprendibles/${DESP_ID}`);
    expect(status).toBe(404);
    expect(audit).not.toHaveBeenCalled();
  });

  it("la lista no incluye el contenido detallado", async () => {
    await call("/api/me/desprendibles");
    expect(consultas[0].select).not.toContain("datos");
    expect(consultas[0].filters).toContainEqual(["eq", "usuario_id", USER_ID]);
  });
});

describe("/api/me/notificaciones/leer", () => {
  it("solo marca avisos del usuario de la sesión", async () => {
    await call("/api/me/notificaciones/leer", { method: "POST", body: JSON.stringify({ ids: [DESP_ID] }) });
    expect(consultas[0]).toMatchObject({ table: "notificaciones", op: "update" });
    expect(consultas[0].filters).toContainEqual(["eq", "usuario_id", USER_ID]);
    expect(consultas[0].filters).toContainEqual(["in", "id", [DESP_ID]]);
  });
});
