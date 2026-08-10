import { useState, useEffect } from "react";
import Login from "./components/Login";
import CollaboratorInflow from "./components/CollaboratorInflow";
import ManagerDashboard from "./components/ManagerDashboard";
import { UserRole } from "./types";
import { supabase, isSupabaseConfigured } from "./db/supabaseConfig";

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState<string>("");
  const [local, setLocal] = useState<string>("Chapinero");

  const fetchProfile = async (userId: string, defaultName: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("nombre, role, locales(nombre)")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setRole(data.role as UserRole);
        setUsername(data.nombre);
        setLocal((data.locales as any)?.nombre || "Chapinero");
      } else {
        setRole("Asistente de servicio" as UserRole);
        setUsername(defaultName);
        setLocal("Chapinero");
      }
    } catch (err) {
      console.warn("Error consultando perfil de Supabase:", err);
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const rawName = session.user.user_metadata?.nombre || session.user.email || "Usuario";
          fetchProfile(session.user.id, rawName);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          const rawName = session.user.user_metadata?.nombre || session.user.email || "Usuario";
          fetchProfile(session.user.id, rawName);
        } else {
          setRole(null);
          setUsername("");
          setLocal("Chapinero");
        }
      });

      return () => subscription.unsubscribe();
    } else {
      const savedRole = localStorage.getItem("lopez_gracia_role") as UserRole | null;
      const savedName = localStorage.getItem("lopez_gracia_username");
      const savedLocal = localStorage.getItem("lopez_gracia_local") || "Chapinero";
      
      if (savedRole && savedName) {
        setRole(savedRole);
        setUsername(savedName);
        setLocal(savedLocal);
      }
    }
  }, []);

  const handleLoginSuccess = (userRole: UserRole, userName: string, userLocal: string) => {
    setRole(userRole);
    setUsername(userName);
    setLocal(userLocal);
    localStorage.setItem("lopez_gracia_role", userRole);
    localStorage.setItem("lopez_gracia_username", userName);
    localStorage.setItem("lopez_gracia_local", userLocal);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setRole(null);
    setUsername("");
    setLocal("Chapinero");
    localStorage.removeItem("lopez_gracia_role");
    localStorage.removeItem("lopez_gracia_username");
    localStorage.removeItem("lopez_gracia_local");
  };

  const isManager = role === "gerente" || role === "Admin";

  return (
    <div className="font-sans min-h-screen bg-brand-bg text-brand-ink">
      {role === null && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      
      {role !== null && !isManager && (
        <CollaboratorInflow onLogout={handleLogout} username={username} role={role} local={local} />
      )}
      
      {role !== null && isManager && (
        <ManagerDashboard onLogout={handleLogout} username={username} local={local} />
      )}
    </div>
  );
}
