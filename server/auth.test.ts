import { describe, it, expect, vi } from "vitest";
import { hashPassword, verifyPassword, setSessionCookie, loadSession, requireAuth, requireGerencia, type SessionUser } from "./auth";

const baseUser: SessionUser = {
  sub: "00000000-0000-0000-0000-000000000001",
  nombre: "Prueba",
  cargo: "Asistente de servicio",
  role: "usuario",
  localId: null,
  local: "Chapinero",
  isGerencia: false,
  mustChangePassword: false,
};

function cookieFor(user: SessionUser): string {
  let value = "";
  const res: any = { cookie: (_n: string, v: string) => { value = v; } };
  setSessionCookie(res, user);
  return `lg_session=${encodeURIComponent(value)}`;
}

function run(middleware: any, cookie?: string) {
  const req: any = { headers: cookie ? { cookie } : {} };
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
  const next = vi.fn();
  loadSession(req, res, () => middleware(req, res, next));
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
  it("sin cookie → 401", () => {
    const { res, next } = run(requireAuth);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("cookie manipulada (rol cambiado sin firma válida) → 401", () => {
    const cookie = cookieFor(baseUser);
    const [body, sig] = decodeURIComponent(cookie.split("=")[1]).split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    payload.isGerencia = true;
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
    const { res, next } = run(requireGerencia, `lg_session=${encodeURIComponent(forged)}`);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("colaborador válido pasa requireAuth pero no requireGerencia", () => {
    const cookie = cookieFor(baseUser);
    expect(run(requireAuth, cookie).next).toHaveBeenCalled();
    const g = run(requireGerencia, cookie);
    expect(g.res.statusCode).toBe(403);
    expect(g.next).not.toHaveBeenCalled();
  });

  it("gerencia pasa requireGerencia", () => {
    expect(run(requireGerencia, cookieFor({ ...baseUser, isGerencia: true })).next).toHaveBeenCalled();
  });

  it("con clave temporal pendiente de cambio → 403 en todo", () => {
    const { res, next } = run(requireAuth, cookieFor({ ...baseUser, mustChangePassword: true }));
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
