import React, { useState } from "react";
import { Lock, User, Eye, EyeOff, UserPlus, LogIn, Mail } from "lucide-react";
import { UserRole } from "../types";
import Logo from "./Logo";
import { supabase, isSupabaseConfigured } from "../db/supabaseConfig";

interface LoginProps {
  onLoginSuccess: (role: UserRole, username: string, local: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  
  // Login State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Register State
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  // General State
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const emailInput = loginUsername.trim();
      const passwordInput = loginPassword;

      if (!emailInput || !passwordInput) {
        setError("Por favor ingresa tu correo y contraseña.");
        setIsLoading(false);
        return;
      }

      if (isSupabaseConfigured && supabase) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: emailInput,
          password: passwordInput,
        });

        if (authError || !data.session) {
          setError("Correo o contraseña incorrectos.");
          setIsLoading(false);
          return;
        }

        const { data: perfil, error: perfilError } = await supabase
          .from("usuarios")
          .select("id, nombre, role, local_id, locales(nombre)")
          .eq("id", data.session.user.id)
          .single();

        if (perfilError || !perfil) {
          console.warn("Perfil no encontrado aún, usando datos de auth metadata.", perfilError);
          const rawName = data.session.user.user_metadata?.nombre || data.session.user.email || "Usuario";
          onLoginSuccess("Asistente de servicio", rawName, "Chapinero");
        } else {
          const localNombre = (perfil.locales as any)?.nombre || "Chapinero";
          onLoginSuccess(perfil.role as UserRole, perfil.nombre, localNombre);
        }
      } else {
        // Fallback para entorno demo si Supabase aún no está enlazado
        if (emailInput.toLowerCase().includes("gerente") || emailInput.toLowerCase().includes("admin")) {
          onLoginSuccess("Admin" as UserRole, "Gerente de Administración", "Chapinero");
        } else if (emailInput.toLowerCase().includes("lider")) {
          onLoginSuccess("Lider" as UserRole, "Colaborador Líder", "Chapinero");
        } else {
          onLoginSuccess("Asistente de servicio" as UserRole, emailInput.split("@")[0] || "Colaborador Chapinero", "Chapinero");
        }
      }
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    // TODO: confirmar con el cliente si el self-registro debe deshabilitarse o ser gestionado solo por un Admin.
    try {
      const emailInput = regEmail.trim();
      const passwordInput = regPassword;
      const nameInput = regUsername.trim();

      if (!emailInput || !passwordInput || !nameInput) {
        setError("Por favor completa nombre, correo y contraseña.");
        setIsLoading(false);
        return;
      }

      if (passwordInput.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        setIsLoading(false);
        return;
      }

      if (isSupabaseConfigured && supabase) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: emailInput,
          password: passwordInput,
          options: {
            data: {
              nombre: nameInput,
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setIsLoading(false);
          return;
        }

        setSuccessMessage(`¡Usuario "${nameInput}" registrado con éxito! Por favor ingresa con tus credenciales.`);
        setLoginUsername(emailInput);
        setLoginPassword("");
        setActiveTab("login");
      } else {
        setSuccessMessage(`¡Usuario "${nameInput}" creado en modo local! Ahora puedes ingresar.`);
        setLoginUsername(emailInput);
        setLoginPassword(passwordInput);
        setActiveTab("login");
      }
    } catch (err: any) {
      setError(err.message || "Error al registrar el usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EB] flex flex-col items-center justify-center p-4 selection:bg-brand-accent/10 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 my-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <div className="bg-white border border-[#1C2E24]/10 p-5 rounded-[2rem] shadow-md transition-all hover:scale-[1.02] duration-200">
            <Logo size="lg" className="text-[#1C2E24]" />
          </div>
          <p className="text-[10px] text-[#1C2E24]/50 font-black tracking-[0.25em] uppercase mt-4">
            Arroz con leche & Cremosos
          </p>
          <div className="h-[1.5px] w-16 bg-[#1E3E30]/20 mx-auto mt-3.5" />
          <h2 className="text-xs font-black text-[#1C2E24]/70 uppercase tracking-widest mt-3.5">
            Módulo Conciliador de Caja
          </h2>
        </div>

        {/* Card Container */}
        <div className="bg-white border border-[#1C2E24]/10 rounded-3xl shadow-xl overflow-hidden">
          {/* Navigation Tab Headers */}
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
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Mail className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="ejemplo@lopezygracia.local"
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
                  {isLoading ? "Autenticando..." : "Ingresar"}
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
                      placeholder="Ej. María López"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-1.5">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Mail className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="ejemplo@lopezygracia.local"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-2">
                    Contraseña (mínimo 6 caracteres)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Lock className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
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
                  {isLoading ? "Registrando..." : "Crear Usuario en Supabase"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
