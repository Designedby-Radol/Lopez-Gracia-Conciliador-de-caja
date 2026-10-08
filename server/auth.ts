import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Hash de contraseñas (scrypt nativo de Node, sin dependencias externas)
// ---------------------------------------------------------------------------
const SCRYPT_KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(plain, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export const MIN_PASSWORD_LENGTH = 6;

// ---------------------------------------------------------------------------
// Sesión firmada (HMAC-SHA256) en cookie httpOnly
// ---------------------------------------------------------------------------
export interface SessionUser {
  sub: string;          // usuarios.id
  nombre: string;
  cargo: string;
  role: string;
  localId: string | null;
  local: string;
  isGerencia: boolean;
  mustChangePassword: boolean;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

const COOKIE_NAME = "lg_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const IS_PROD = process.env.NODE_ENV === "production";

const SESSION_SECRET = (() => {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (IS_PROD) {
    throw new Error("SESSION_SECRET es obligatoria en producción (mínimo 32 caracteres).");
  }
  console.warn("[WARN] SESSION_SECRET no definida: usando una aleatoria (las sesiones se pierden al reiniciar).");
  return crypto.randomBytes(32).toString("hex");
})();

function sign(data: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

function encodeSession(user: SessionUser): string {
  const payload: SessionPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    const { exp: _exp, ...user } = payload;
    return user;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function setSessionCookie(res: Response, user: SessionUser) {
  res.cookie(COOKIE_NAME, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function isGerenciaUser(u: { role?: string | null; cargo?: string | null }): boolean {
  const role = (u.role || "").toLowerCase();
  const cargo = (u.cargo || "").toLowerCase();
  return role === "administrador" || cargo.includes("geren");
}

/** Carga la sesión (si existe) en req.user. No bloquea. */
export function loadSession(req: Request, _res: Response, next: NextFunction) {
  req.user = decodeSession(readCookie(req, COOKIE_NAME)) || undefined;
  next();
}

/** Exige sesión válida y que el usuario ya haya cambiado su clave temporal. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Sesión no válida o expirada. Vuelve a iniciar sesión." });
  }
  if (req.user.mustChangePassword) {
    return res.status(403).json({ success: false, error: "Debes cambiar tu contraseña antes de continuar.", mustChangePassword: true });
  }
  next();
}

export function requireGerencia(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user?.isGerencia) {
      return res.status(403).json({ success: false, error: "Acción permitida solo para Gerencia." });
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// Límite de intentos de login (en memoria, por IP + identificador)
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

export function loginRateLimitKey(req: Request, identifier: string) {
  return `${req.ip}|${identifier.toLowerCase()}`;
}

export function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function registerFailedAttempt(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
