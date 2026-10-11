import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashPassword, verifyPassword, setSessionCookie, loadSession, requireAuth, requireGerencia,
  setSessionStateLookup, invalidateSessionCache, type SessionUser, type SessionState,
} from "./auth";

const baseUser: SessionUser = {
  sub: "00000000-0000-0000-0000-000000000001",
  nombre: "Prueba",
  cargo: "Asistente de servicio",
  role: "usuario",
  localId: null,
  local: "Chapinero",
  isGerencia: false,
  mustChangePassword: false,
  sessionVersion: 3,
};

// Estado de credenciales simulado (lo que devolvería la BD).
let dbState: Map<string, SessionState>;
const lookup = vi.fn(async (id: string) => dbState.get(id) ?? null);

beforeEach(() => {
  dbState = new Map([[baseUser.sub, { version: 3, activo: true }]]);
  lookup.mockClear();
  setSessionStateLookup(lookup);
});

function cookieFor(user: SessionUser): string {
  let value = "";
  const res: any = { cookie: (_n: string, v: string) => { value = v; } };
  setSessionCookie(res, user);
  return `lg_session=${encodeURIComponent(value)}`;
}

async function run(middleware: any, cookie?: string) {
  const req: any = { headers: cookie ? { cookie } : {} };
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
  const next = vi.fn();
  await loadSession(req, res, () => middleware(req, res, next));
  return { req, res, next };
}

describe("hash de contraseñas", () => {
  it("verifica la clave correcta y rechaza las incorrectas", () => {
    const h = hashPassword("clave-segura");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("clave-segura", h)).toBe(true);
    expect(verifyPassword("otra", h)).toBe(false);
    expect(verifyPassword("clave-segura", null)).toBe(false);
  });

  it("usa sal aleatoria (mismo texto, hashes distintos)", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });
});

describe("sesión y permisos", () => {
  it("sin cookie → 401", async () => {
    const { res, next } = await run(requireAuth);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("cookie manipulada (rol cambiado sin firma válida) → 401", async () => {
    const cookie = cookieFor(baseUser);
    const [body, sig] = decodeURIComponent(cookie.split("=")[1]).split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    payload.isGerencia = true;
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
    const { res, next } = await run(requireGerencia, `lg_session=${encodeURIComponent(forged)}`);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("colaborador válido pasa requireAuth pero no requireGerencia", async () => {
    const cookie = cookieFor(baseUser);
    expect((await run(requireAuth, cookie)).next).toHaveBeenCalled();
    const g = await run(requireGerencia, cookie);
    expect(g.res.statusCode).toBe(403);
    expect(g.next).not.toHaveBeenCalled();
  });

  it("gerencia pasa requireGerencia", async () => {
    expect((await run(requireGerencia, cookieFor({ ...baseUser, isGerencia: true }))).next).toHaveBeenCalled();
  });

  it("con clave temporal pendiente de cambio → 403 en todo", async () => {
    const { res, next } = await run(requireAuth, cookieFor({ ...baseUser, mustChangePassword: true }));
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("revocación de sesiones (session_version)", () => {
  it("versión de la cookie distinta a la de BD (rol cambiado, clave cambiada…) → 401", async () => {
    dbState.set(baseUser.sub, { version: 4, activo: true });
    const { req, res, next } = await run(requireAuth, cookieFor(baseUser));
    expect(req.user).toBeUndefined();
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("cuenta suspendida → 401 aunque la cookie siga firmada y sin vencer", async () => {
    dbState.set(baseUser.sub, { version: 3, activo: false });
    const { res, next } = await run(requireAuth, cookieFor(baseUser));
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("usuario sin credenciales (eliminado) → 401", async () => {
    dbState.clear();
    expect((await run(requireAuth, cookieFor(baseUser))).res.statusCode).toBe(401);
  });

  it("si la BD falla, la sesión no se acepta (falla cerrado)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    setSessionStateLookup(async () => { throw new Error("BD caída"); });
    expect((await run(requireAuth, cookieFor(baseUser))).res.statusCode).toBe(401);
    spy.mockRestore();
  });

  it("sin lookup configurado, ninguna sesión es válida", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    setSessionStateLookup(null);
    expect((await run(requireAuth, cookieFor(baseUser))).res.statusCode).toBe(401);
    spy.mockRestore();
  });

  it("cookie antigua sin sessionVersion → 401", async () => {
    const { sessionVersion: _v, ...legacy } = baseUser;
    expect((await run(requireAuth, cookieFor(legacy as SessionUser))).res.statusCode).toBe(401);
  });

  it("usa caché corta y la invalidación la refresca de inmediato", async () => {
    const cookie = cookieFor(baseUser);
    expect((await run(requireAuth, cookie)).next).toHaveBeenCalled();
    expect((await run(requireAuth, cookie)).next).toHaveBeenCalled();
    expect(lookup).toHaveBeenCalledTimes(1);

    // Gerencia suspende la cuenta en este proceso: bumpSessionVersion invalida la caché.
    dbState.set(baseUser.sub, { version: 4, activo: false });
    expect((await run(requireAuth, cookie)).next).toHaveBeenCalled(); // aún cacheado
    invalidateSessionCache(baseUser.sub);
    expect((await run(requireAuth, cookie)).res.statusCode).toBe(401);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("la caché vence sola (otros procesos ven la revocación en ≤15 s)", async () => {
    vi.useFakeTimers();
    try {
      const cookie = cookieFor(baseUser);
      expect((await run(requireAuth, cookie)).next).toHaveBeenCalled();
      dbState.set(baseUser.sub, { version: 4, activo: true });
      vi.advanceTimersByTime(16_000);
      expect((await run(requireAuth, cookie)).res.statusCode).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tras el cambio de clave la cookie nueva (versión nueva) sigue valiendo", async () => {
    dbState.set(baseUser.sub, { version: 4, activo: true });
    expect((await run(requireAuth, cookieFor({ ...baseUser, sessionVersion: 4 }))).next).toHaveBeenCalled();
  });
});
