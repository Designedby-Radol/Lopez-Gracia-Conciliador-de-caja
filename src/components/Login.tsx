import React, { useState, useEffect } from "react";
import { Lock, User, Eye, EyeOff, ShieldCheck, UserPlus, LogIn, ChevronRight, FileText } from "lucide-react";
import { UserRole } from "../types";
import Logo from "./Logo";

interface LoginProps {
  onLoginSuccess: (role: UserRole, username: string, local: string) => void;
}

interface RegisteredUser {
  nombre: string;
  cedula?: string;
  password: string;
  role: UserRole;
  local?: string;
}

const DEFAULT_USERS: RegisteredUser[] = [
  { nombre: "Gerente", cedula: "1020730746", password: "admin", role: "gerente", local: "Chapinero" },
  { nombre: "Colaborador Lider", cedula: "1018432109", password: "tienda", role: "Líder operador", local: "Chapinero" },
  { nombre: "Colaborador Auxiliar", cedula: "1032456789", password: "tienda", role: "Asistente de Servicio", local: "Chapinero" }
];

export default function Login({ onLoginSuccess }: LoginProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  
  // Login State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Register State
  const [regUsername, setRegUsername] = useState("");
  const [regCedula, setRegCedula] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<UserRole>("Asistente de servicio");
  const [regLocal, setRegLocal] = useState<string>("Chapinero");
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  // General State
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Initialize registry in localStorage on load
  useEffect(() => {
    const data = localStorage.getItem("lopez_gracia_user_registry");
    if (!data) {
      localStorage.setItem("lopez_gracia_user_registry", JSON.stringify(DEFAULT_USERS));
    }
  }, []);

  const getRegisteredUsers = (): RegisteredUser[] => {
    const data = localStorage.getItem("lopez_gracia_user_registry");
    if (!data) return DEFAULT_USERS;
    try {
      const parsed: RegisteredUser[] = JSON.parse(data);
      // Normalizar roles antiguos si existen
      return parsed.map(u => ({
        ...u,
        role: u.role === "Lider de punto" ? "Líder operador" : u.role
      }));
    } catch (e) {
      return DEFAULT_USERS;
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    setTimeout(() => {
      const inputName = loginUsername.trim();
      const inputPass = loginPassword;

      if (!inputName || !inputPass) {
        setError("Por favor completa todos los campos.");
        setIsLoading(false);
        return;
      }

      // 1. Compatibilidad hacia atrás / Accesos rápidos predeterminados
      if (inputName.toLowerCase() === "colaborador@lopezygracia.com" && inputPass === "tienda") {
        onLoginSuccess("colaborador", "Colaborador Chapinero", "Chapinero");
        return;
      }
      if (inputName.toLowerCase() === "gerente@lopezygracia.com" && inputPass === "admin") {
        onLoginSuccess("gerente", "Gerente de Administración", "Chapinero");
        return;
      }

      // 2. Comprobar contra registro de usuarios (localStorage)
      const users = getRegisteredUsers();
      const matchedUser = users.find(
        u => u.nombre.toLowerCase() === inputName.toLowerCase() && u.password === inputPass
      );

      if (matchedUser) {
        onLoginSuccess(matchedUser.role as UserRole, matchedUser.nombre, matchedUser.local || "Chapinero");
      } else {
        setError("Usuario o contraseña incorrectos. Verifica tus datos o crea un usuario nuevo.");
        setIsLoading(false);
      }
    }, 600);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    setTimeout(() => {
      const usernameInput = regUsername.trim();
      const passwordInput = regPassword;

      if (!usernameInput || !passwordInput) {
        setError("Por favor completa todos los campos para el registro.");
        setIsLoading(false);
        return;
      }

      if (passwordInput.length < 3) {
        setError("La contraseña debe tener al menos 3 caracteres.");
        setIsLoading(false);
        return;
      }

      const users = getRegisteredUsers();
      const exists = users.some(u => u.nombre.toLowerCase() === usernameInput.toLowerCase());

      if (exists) {
        setError("El nombre de usuario ya está registrado. Por favor, intenta con otro.");
        setIsLoading(false);
        return;
      }

      // Guardar el nuevo usuario
      const newUser: RegisteredUser = {
        nombre: usernameInput,
        cedula: regCedula.trim(),
        password: passwordInput,
        role: regRole,
        local: regLocal
      };

      const updatedUsers = [...users, newUser];
      localStorage.setItem("lopez_gracia_user_registry", JSON.stringify(updatedUsers));

      setSuccessMessage(`¡Usuario "${usernameInput}" (C.C. ${regCedula || 'N/A'}) registrado con éxito como ${regRole} en el local "${regLocal}"! Ahora puedes iniciar sesión.`);
      
      // Limpiar campos y cambiar de pestaña
      setLoginUsername(usernameInput);
      setLoginPassword("");
      setRegUsername("");
      setRegCedula("");
      setRegPassword("");
      setActiveTab("login");
      setIsLoading(false);
    }, 500);
  };

  const handleQuickLogin = (role: UserRole) => {
    setIsLoading(true);
    setTimeout(() => {
      if (role === "colaborador") {
        onLoginSuccess("colaborador", "Colaborador Demo (Acceso Rápido)", "Chapinero");
      } else if (role === "gerente") {
        onLoginSuccess("gerente", "Gerente Demo (Acceso Rápido)", "Chapinero");
      } else if (role === "Líder operador" || role === "Lider de punto" || role === "Lider operador") {
        onLoginSuccess("Líder operador", "Líder Operador (Acceso Rápido)", "Chapinero");
      } else {
        onLoginSuccess("Asistente de Servicio", "Asistente de Servicio (Acceso Rápido)", "Chapinero");
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#F5F2EB] flex flex-col items-center justify-center p-4 selection:bg-brand-accent/10 relative">
      {/* Soft technical grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 my-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center select-none">
          <div className="py-2 px-4 transition-transform hover:scale-[1.02] duration-200">
            <Logo size="xl" className="text-[#1C2E24]" />
          </div>
          <p className="text-[11px] text-[#1C2E24]/60 font-black tracking-[0.28em] uppercase mt-3">
            Arroz con leche & Cremosos
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white border border-[#1C2E24]/10 rounded-3xl shadow-xl overflow-hidden">
          {/* Custom Navigation Tab Headers */}
          <div className="flex border-b border-zinc-100 bg-zinc-50/50 p-2 gap-1.5">
            <button
              onClick={() => {
                setActiveTab("login");
                setError("");
                setSuccessMessage("");
              }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl transition-all duration-150 cursor-pointer ${
                activeTab === "login"
                  ? "bg-white text-[#1C2E24] shadow-sm"
                  : "text-[#1C2E24]/50 hover:bg-white/50"
              }`}
            >
              <LogIn className="w-4 h-4 text-[#1C2E24]/70" />
              <span>Ingresar</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("register");
                setError("");
                setSuccessMessage("");
              }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl transition-all duration-150 cursor-pointer ${
                activeTab === "register"
                  ? "bg-white text-[#1C2E24] shadow-sm"
                  : "text-[#1C2E24]/50 hover:bg-white/50"
              }`}
            >
              <UserPlus className="w-4 h-4 text-[#1C2E24]/70" />
              <span>Registrar</span>
            </button>
          </div>

          <div className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold p-3.5 rounded-xl text-center uppercase tracking-wider">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold p-3.5 rounded-xl text-center uppercase tracking-wider">
                {successMessage}
              </div>
            )}

            {activeTab === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-2">
                    Usuario o Correo
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <User className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Tu nombre registrado o demo"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Lock className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-[#1C2E24] transition-colors"
                    >
                      {showLoginPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-[#1E3E30] hover:bg-[#1E3E30]/90 text-white font-black tracking-widest text-xs uppercase rounded-2xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#1E3E30]/10 hover:shadow-lg transition-all hover:-translate-y-0.5 duration-200"
                >
                  {isLoading ? "Iniciando sesión..." : "Ingresar al Sistema"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-1.5">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <User className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Pérez"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-1.5">
                    Número de Cédula (C.C.)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <FileText className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Ej. 1020730746"
                      value={regCedula}
                      onChange={(e) => setRegCedula(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all font-numeric"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-2">
                    Rol en Punto de Venta
                  </label>
                  <div className="relative">
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as UserRole)}
                      className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] text-sm font-semibold outline-none cursor-pointer appearance-none transition-all"
                    >
                      <option value="Líder operador">Líder operador</option>
                      <option value="Asistente de Servicio">Asistente de Servicio</option>
                      <option value="Líder de pastelería">Líder de pastelería</option>
                      <option value="Auxiliar de pastelería">Auxiliar de pastelería</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#1C2E24]/60">
                      <ChevronRight className="w-4 h-4 transform rotate-90" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-2">
                    Local / Punto de Venta
                  </label>
                  <div className="relative">
                    <select
                      value={regLocal}
                      onChange={(e) => setRegLocal(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] text-sm font-semibold outline-none cursor-pointer appearance-none transition-all"
                    >
                      <option value="Chapinero">Chapinero</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#1C2E24]/60">
                      <ChevronRight className="w-4 h-4 transform rotate-90" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Lock className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      placeholder="Elige una contraseña"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-[#1C2E24] transition-colors"
                    >
                      {showRegPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-[#FF5C35] hover:bg-[#E54B24] text-white font-black tracking-widest text-xs uppercase rounded-2xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#FF5C35]/10 hover:shadow-lg transition-all hover:-translate-y-0.5 duration-200"
                >
                  {isLoading ? "Creando usuario..." : "Registrar y Crear Usuario"}
                </button>
              </form>
            )}

            {/* Quick Demo Access (Visible only in non-production) */}
            {!(import.meta as any).env?.PROD && (
              <div className="space-y-4 pt-2">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-100" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black">
                    <span className="bg-white px-3 text-[#1C2E24]/40 tracking-widest">
                      Acceso Demo Rápido
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("Líder operador")}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/50 rounded-2xl group transition-all text-center cursor-pointer duration-150"
                  >
                    <User className="w-5 h-5 text-[#1C2E24]/70 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] font-black text-[#1C2E24] uppercase tracking-wide">Líder</span>
                    <span className="text-[8px] font-bold text-[#1C2E24]/50 uppercase mt-0.5">Operador</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin("Asistente de Servicio")}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/50 rounded-2xl group transition-all text-center cursor-pointer duration-150"
                  >
                    <User className="w-5 h-5 text-[#1C2E24]/70 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] font-black text-[#1C2E24] uppercase tracking-wide">Asistente</span>
                    <span className="text-[8px] font-bold text-[#1C2E24]/50 uppercase mt-0.5">Servicio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin("gerente")}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/50 rounded-2xl group transition-all text-center cursor-pointer duration-150"
                  >
                    <ShieldCheck className="w-5 h-5 text-[#1C2E24]/70 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] font-black text-[#1C2E24] uppercase tracking-wide">Gerente</span>
                    <span className="text-[8px] font-bold text-[#1C2E24]/50 uppercase mt-0.5">Admin</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Credentials hints (Non-prod) */}
        {!(import.meta as any).env?.PROD && (
          <div className="text-center text-[10px] text-[#1C2E24]/50 space-y-1 font-bold">
            <p className="uppercase tracking-wider">
              Líder Operador: <span className="text-[#1C2E24] font-numeric bg-white border border-zinc-200/60 px-1.5 py-0.5 rounded">Colaborador Lider</span> / <span className="text-[#1C2E24] font-numeric bg-white border border-zinc-200/60 px-1.5 py-0.5 rounded">tienda</span>
            </p>
            <p className="uppercase tracking-wider">
              Asistente: <span className="text-[#1C2E24] font-numeric bg-white border border-zinc-200/60 px-1.5 py-0.5 rounded">Colaborador Auxiliar</span> / <span className="text-[#1C2E24] font-numeric bg-white border border-zinc-200/60 px-1.5 py-0.5 rounded">tienda</span>
            </p>
            <p className="uppercase tracking-wider">
              Gerente: <span className="text-[#1C2E24] font-numeric bg-white border border-zinc-200/60 px-1.5 py-0.5 rounded">Gerente</span> / <span className="text-[#1C2E24] font-numeric bg-white border border-zinc-200/60 px-1.5 py-0.5 rounded">admin</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
