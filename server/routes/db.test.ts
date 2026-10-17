import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import type { SessionUser } from "../auth";

// ---- Supabase simulado: cada consulta registra sus filtros y devuelve lo que diga `responder`. ----
interface Consulta { table: string; select?: string; filters: [string, string, unknown][]; op: string }
const consultas: Consulta[] = [];
const rpcs: { fn: string; args: any }[] = [];
let responder: (c: Consulta) => { data: any; error: any } = () => ({ data: [], error: null });

function builder(table: string) {
  const c: Consulta = { table, filters: [], op: "select" };
  consultas.push(c);
  const b: any = {
    select(cols?: string) { if (c.op === "select") c.select = cols; return b; },
    update() { c.op = "update"; return b; },
    upsert() { c.op = "upsert"; return b; },
    insert() { c.op = "insert"; return b; },
    delete() { c.op = "delete"; return b; },
    order() { return b; },
    limit() { return b; },
    like(col: string, v: unknown) { c.filters.push(["like", col, v]); return b; },
    eq(col: string, v: unknown) { c.filters.push(["eq", col, v]); return b; },
    neq(col: string, v: unknown) { c.filters.push(["neq", col, v]); return b; },
    in(col: string, v: unknown) { c.filters.push(["in", col, v]); return b; },
    gte(col: string, v: unknown) { c.filters.push(["gte", col, v]); return b; },
    is(col: string, v: unknown) { c.filters.push(["is", col, v]); return b; },
    single() { return Promise.resolve(responder(c)); },
    maybeSingle() { return Promise.resolve(responder(c)); },
    then(ok: any, ko: any) { return Promise.resolve(responder(c)).then(ok, ko); },
  };
  return b;
}

vi.mock("../supabase", () => ({
  supabaseAdmin: {
    from: (t: string) => builder(t),
    rpc: (fn: string, args: any) => { rpcs.push({ fn, args }); return Promise.resolve({ data: { id: "d1", version: 1 }, error: null }); },
  },
  isValidUUID: (id: unknown) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
}));
vi.mock("../audit", () => ({ writeAudit: vi.fn(async () => {}) }));
const bump = vi.fn(async (_id: string) => 1);
vi.mock("../sessions", () => ({ bumpSessionVersion: (id: string) => bump(id) }));

const { dbRouter } = await import("./db");
const { canalesRouter } = await import("./canales");

const LOCAL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const colaborador: SessionUser = {
  sub: USER_ID, nombre: "Ana", cargo: "Auxiliar", role: "usuario", localId: LOCAL_A,
  local: "Chapinero", isGerencia: false, mustChangePassword: false, sessionVersion: 0,
};
const gerencia: SessionUser = { ...colaborador, sub: "22222222-2222-2222-2222-222222222222", role: "administrador", isGerencia: true };

let currentUser: SessionUser = colaborador;
let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = currentUser; next(); });
  app.use("/api/db", dbRouter);
  app.use("/api/canales", canalesRouter);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); vi.unstubAllGlobals(); });

beforeEach(() => {
  consultas.length = 0;
  rpcs.length = 0;
  bump.mockClear();
  responder = () => ({ data: [], error: null });
  currentUser = colaborador;
});

async function call(path: string, init?: RequestInit) {
  const r = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json" } });
  return { status: r.status, body: await r.json() };
}

describe("alcance por local (scopedLocalId)", () => {
  it("colaborador sin local asignado → lista vacía, sin consultar la BD", async () => {
    currentUser = { ...colaborador, localId: null };
    for (const ruta of ["/api/db/usuarios", "/api/db/cierres"]) {
      const { status, body } = await call(ruta);
      expect(status).toBe(200);
      expect(body.data).toEqual([]);
    }
    expect(consultas).toHaveLength(0);
  });

  it("colaborador con local solo consulta su local aunque pida otro", async () => {
    await call(`/api/db/cierres?local_id=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`);
    expect(consultas[0].filters).toContainEqual(["eq", "local_id", LOCAL_A]);
  });

  it("Gerencia sin local_id ve todos los locales", async () => {
    currentUser = { ...gerencia, localId: null };
    await call("/api/db/cierres");
    expect(consultas[0].filters.some(([, col]) => col === "local_id")).toBe(false);
  });
});

describe("GET /usuarios", () => {
  beforeEach(() => {
    responder = (c) => c.table === "usuarios"
      ? { data: [{ id: USER_ID, nombre: "Ana", cargo: "Auxiliar" }], error: null }
      : { data: [{ usuario_id: USER_ID, activo: false }], error: null };
  });

  it("no-Gerencia solo recibe id, nombre y cargo; credenciales filtradas por ids", async () => {
    const { body } = await call("/api/db/usuarios");
    expect(consultas[0].select).toBe("id, nombre, cargo");
    expect(consultas[1]).toMatchObject({ table: "credenciales", filters: [["in", "usuario_id", [USER_ID]]] });
    expect(body.data).toEqual([{ id: USER_ID, nombre: "Ana", cargo: "Auxiliar", activo: false }]);
  });

  it("Gerencia recibe todas las columnas", async () => {
    currentUser = gerencia;
    await call("/api/db/usuarios");
    expect(consultas[0].select).toBe("*, locales(nombre)");
    expect(consultas[1].filters).toEqual([["in", "usuario_id", [USER_ID]]]);
  });
});

describe("revocación al cambiar rol", () => {
  it("PATCH con rol o cargo incrementa session_version del usuario", async () => {
    currentUser = gerencia;
    responder = () => ({ data: { id: USER_ID, nombre: "Ana", role: "usuario", cargo: "Lider" }, error: null });
    expect((await call(`/api/db/usuarios/${USER_ID}`, { method: "PATCH", body: JSON.stringify({ cargo: "Lider" }) })).status).toBe(200);
    expect(bump).toHaveBeenCalledWith(USER_ID);
  });

  it("PATCH solo de nombre no cierra sesiones", async () => {
    currentUser = gerencia;
    responder = () => ({ data: { id: USER_ID, nombre: "Ana B" }, error: null });
    await call(`/api/db/usuarios/${USER_ID}`, { method: "PATCH", body: JSON.stringify({ nombre: "Ana B" }) });
    expect(bump).not.toHaveBeenCalled();
  });

  it("POST (upsert) que cambia el rol de un usuario existente también revoca", async () => {
    currentUser = gerencia;
    responder = (c) => c.op === "select"
      ? { data: { role: "usuario", cargo: "Auxiliar", local_id: LOCAL_A }, error: null }
      : { data: { id: USER_ID, nombre: "Ana", role: "administrador", cargo: "Auxiliar", local_id: LOCAL_A }, error: null };
    await call("/api/db/usuarios", { method: "POST", body: JSON.stringify({ id: USER_ID, nombre: "Ana", role: "administrador" }) });
    expect(bump).toHaveBeenCalledWith(USER_ID);
  });
});

describe("fail(): sin detalles internos al cliente", () => {
  it("devuelve un mensaje genérico y registra el detalle en el log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    responder = () => ({ data: null, error: { message: 'relation "cierres_caja" column "x" does not exist' } });
    const { status, body } = await call("/api/db/cierres");
    expect(status).toBe(500);
    expect(body.error).toBe("Error interno del servidor.");
    expect(JSON.stringify(spy.mock.calls)).toContain("does not exist");
    spy.mockRestore();
  });
});

describe("canales: errores del proveedor → 502", () => {
  beforeEach(() => {
    currentUser = gerencia;
    process.env.JUSTO_API_TOKEN = "t";
    process.env.INTUIPOS_TOKEN = "t";
    responder = () => ({ data: { justo_store_id: "s1", intuipos_store_id: "1" }, error: null });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("Justo responde 401 → 502 (no se confunde con sesión expirada)", async () => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (url: any, init?: any) =>
      String(url).startsWith(base) ? realFetch(url, init) : Promise.resolve(new Response("token inválido", { status: 401 })));
    const { status, body } = await call(`/api/canales/justo/ventas?localId=${LOCAL_A}&fecha=2026-10-01`);
    vi.stubGlobal("fetch", realFetch);
    expect(status).toBe(502);
    expect(body.error).not.toContain("token inválido");
  });

  it("IntuiPOS responde 401 → 502", async () => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (url: any, init?: any) =>
      String(url).startsWith(base) ? realFetch(url, init) : Promise.resolve(new Response("", { status: 401 })));
    const { status } = await call(`/api/canales/intuipos/ventas?localId=${LOCAL_A}&fecha=2026-10-01`);
    vi.stubGlobal("fetch", realFetch);
    expect(status).toBe(502);
  });
});

describe("GET /cierres: alcance por participación", () => {
  const OTRO = "33333333-3333-3333-3333-333333333333";
  const filas = [
    { id: "c1", fecha: "2026-10-01", estado: "Cuadrado", colaborador_id: OTRO, lider_id: OTRO, auxiliares: [{ usuario_id: USER_ID, usuario: { nombre: "Ana" } }] },
    { id: "c2", fecha: "2026-10-02", estado: "Cuadrado", colaborador_id: OTRO, lider_id: OTRO, auxiliares: [] },
    { id: "c3", fecha: "2026-10-03", estado: "Pendiente por Cuadrar", colaborador_id: USER_ID, lider_id: OTRO, auxiliares: [] },
  ];
  beforeEach(() => { responder = () => ({ data: filas, error: null }); });

  it("un asistente solo recibe los cierres en los que figura", async () => {
    const { body } = await call("/api/db/cierres");
    expect(body.data.map((c: any) => c.id)).toEqual(["c1", "c3"]);
  });

  it("un líder recibe todos los cierres de su local", async () => {
    currentUser = { ...colaborador, cargo: "Lider Operador" };
    const { body } = await call("/api/db/cierres");
    expect(body.data).toHaveLength(3);
  });
});

describe("desprendibles", () => {
  const TURNO = "44444444-4444-4444-4444-444444444444";
  const liquidacion = {
    tipoContrato: "Indefinido", diasLaboradosTotales: 15, diasAsistidosEfectivos: 13,
    salarioQuincenal: 875000, auxTransporte: 107000, deduccionSalud: 35000, deduccionPension: 35000,
    totalIngresosSalariales: 875000, devengadoTotal: 982000, totalDeducciones: 70000, netoAPagar: 912000,
    attendanceRecords: [{ fecha: "2026-10-01", observacion: "nota interna" }],
  };

  it("solo Gerencia publica", async () => {
    const { status } = await call("/api/db/desprendibles/publicar", { method: "POST", body: JSON.stringify({ turnoIds: [TURNO] }) });
    expect(status).toBe(403);
  });

  it("arma el contenido en el servidor e ignora datos enviados por el cliente", async () => {
    currentUser = gerencia;
    responder = (c) => c.table === "turnos_nomina"
      ? { data: [{ id: TURNO, usuario_id: USER_ID, local_id: LOCAL_A, fecha_inicio: "2026-10-01", fecha_fin: "2026-10-15", quincena_nombre: "Q1 Oct", liquidacion, usuario: { nombre: "Ana", cargo: "Asistente de servicio" } }], error: null }
      : { data: [], error: null };
    const { status, body } = await call("/api/db/desprendibles/publicar", {
      method: "POST",
      body: JSON.stringify({ turnoIds: [TURNO], neto: 99999999, datos: { conceptos: [] } }),
    });
    expect(status).toBe(200);
    expect(body.data.publicados).toHaveLength(1);
    expect(rpcs[0].fn).toBe("publicar_desprendible");
    expect(rpcs[0].args.p_neto).toBe(912000);
    expect(rpcs[0].args.p_publicado_por).toBe(gerencia.sub);
    expect(JSON.stringify(rpcs[0].args.p_datos)).not.toContain("nota interna");
    expect(consultas.some((c) => c.table === "notificaciones" && c.op === "insert")).toBe(true);
  });
});

describe("PUT /cierres/:id: solo participantes (o líderes)", () => {
  const CIERRE = "66666666-6666-6666-6666-666666666666";
  const OTRO = "33333333-3333-3333-3333-333333333333";
  const ajeno = { id: CIERRE, estado: "Pendiente por Cuadrar", local_id: LOCAL_A, colaborador_id: OTRO, lider_id: OTRO, auxiliares: [] };

  it("un asistente que no figura en el cierre recibe 403 y no se escribe nada", async () => {
    responder = () => ({ data: ajeno, error: null });
    const { status } = await call(`/api/db/cierres/${CIERRE}`, { method: "PUT", body: JSON.stringify({ fecha: "2026-10-16" }) });
    expect(status).toBe(403);
    expect(consultas.some((c) => c.op === "update")).toBe(false);
  });

  it("un auxiliar del cierre sí puede corregirlo mientras está pendiente", async () => {
    responder = () => ({ data: { ...ajeno, auxiliares: [{ usuario_id: USER_ID }] }, error: null });
    const { status } = await call(`/api/db/cierres/${CIERRE}`, { method: "PUT", body: JSON.stringify({ fecha: "2026-10-16" }) });
    expect(status).toBe(200);
  });
});
