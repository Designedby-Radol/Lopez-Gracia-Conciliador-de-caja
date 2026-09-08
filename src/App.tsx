import { useState, useEffect } from "react";
import Login from "./components/Login";
import CollaboratorInflow from "./components/CollaboratorInflow";
import ManagerDashboard from "./components/ManagerDashboard";
import { UserRole } from "./types";

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState<string>("");
  const [local, setLocal] = useState<string>("Chapinero");

  // Persistir la sesión en localStorage para que la previsualización no se pierda al reiniciar
  useEffect(() => {
    const savedRole = localStorage.getItem("lopez_gracia_role") as UserRole | null;
    const savedName = localStorage.getItem("lopez_gracia_username");
    const savedLocal = localStorage.getItem("lopez_gracia_local") || "Chapinero";
    
    if (savedRole && savedName) {
      setRole(savedRole);
      setUsername(savedName);
      setLocal(savedLocal);
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

  const handleLogout = () => {
    setRole(null);
    setUsername("");
    setLocal("Chapinero");
    localStorage.removeItem("lopez_gracia_role");
    localStorage.removeItem("lopez_gracia_username");
    localStorage.removeItem("lopez_gracia_local");
  };

  return (
    <div className="font-sans min-h-screen bg-brand-bg text-brand-ink">
      {role === null && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      
      {role !== null && role !== "gerente" && (
        <CollaboratorInflow onLogout={handleLogout} username={username} role={role} local={local} />
      )}
      
      {role === "gerente" && (
        <ManagerDashboard onLogout={handleLogout} username={username} local={local} />
      )}
    </div>
  );
}
