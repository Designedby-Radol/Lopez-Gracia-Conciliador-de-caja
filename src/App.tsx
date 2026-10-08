import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import Login from "./components/Login";
import { UserRole } from "./types";
import { api, SESSION_EXPIRED_EVENT } from "./lib/api";

// Cada rol descarga solo su pantalla (el dashboard de Gerencia es el más pesado).
const CollaboratorInflow = lazy(() => import("./components/CollaboratorInflow"));
const ManagerDashboard = lazy(() => import("./components/ManagerDashboard"));
const ForcePasswordChange = lazy(() => import("./components/ForcePasswordChange"));

export interface SessionInfo {
  id: string;
  nombre: string;
  cargo: string;
  role: string;
  local: string;
  localId: string | null;
  isGerencia: boolean;
  mustChangePassword: boolean;
}

export default function App() {
  // undefined = verificando sesión con el servidor; null = sin sesión.
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    api<{ user: SessionInfo }>("/api/auth/me")
      .then((r) => setSession(r.user))
      .catch(() => setSession(null));

    // Limpieza de la sesión insegura anterior (rol guardado en localStorage).
    ["lopez_gracia_role", "lopez_gracia_username", "lopez_gracia_local", "lopez_gracia_user_passwords_v1", "lopez_gracia_user_statuses_v1"]
      .forEach((k) => localStorage.removeItem(k));

    const onExpired = () => setSession(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setSession(null);
    }
  }, []);

  if (session === undefined) {
    return <div className="min-h-screen bg-brand-bg" aria-busy="true" />;
  }

  return (
    <div className="font-sans min-h-screen bg-brand-bg text-brand-ink">
      {session === null && <Login onLoginSuccess={setSession} />}

      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm font-bold text-zinc-500" aria-busy="true">Cargando…</div>}>
      {session?.mustChangePassword && (
        <ForcePasswordChange user={session} onChanged={setSession} onLogout={handleLogout} />
      )}

      {session && !session.mustChangePassword && !session.isGerencia && (
        <CollaboratorInflow onLogout={handleLogout} username={session.nombre} role={session.cargo as UserRole} local={session.local} />
      )}

      {session && !session.mustChangePassword && session.isGerencia && (
        <ManagerDashboard onLogout={handleLogout} username={session.nombre} local={session.local} />
      )}
      </Suspense>
    </div>
  );
}
