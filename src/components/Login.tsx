import React, { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, UserCheck, FileText, Info } from "lucide-react";
import { UserRole, Cargo } from "../types";
import { supabase } from "../db/supabaseConfig";
import Logo from "./Logo";

interface LoginProps {
  onLoginSuccess: (role: UserRole, username: string, local: string) => void;
}

function getFriendlyName(emailOrName: string): string {
  if (!emailOrName) return "Colaborador";
  const lower = emailOrName.toLowerCase();
  if (lower.includes("raulsantiago")) return "Raúl Santiago Ramírez";
  if (lower.includes("floralba")) return "Flor Alba Puyo";
  if (lower.includes("sofiaramirez")) return "Sofía Ramírez";
  if (lower.includes("1020730746")) return "Colaborador (1020730746)";
  if (emailOrName.includes("@")) {
    return emailOrName.split("@")[0];
  }
  return emailOrName;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Login State
  const [loginCedula, setLoginCedula] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // General State
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const executeSupabaseLogin = async (identifierInput: string, passwordInput?: string) => {
    setError("");
    setIsLoading(true);

    try {
      const clean = identifierInput.trim();
      if (!clean) {
        setError("Por favor ingresa tu correo o número de cédula.");
        setIsLoading(false);
        return;
      }

      // Enviar solicitud de autenticación al servidor
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: clean, password: passwordInput || "" }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) {
          const user = json.user;
          const friendly = getFriendlyName(user.nombre);
          const roleToPass = user.cargo || (user.role === "administrador" ? "Gerencia" : "Asistente de servicio");
          onLoginSuccess(roleToPass as UserRole, friendly, user.local || "Chapinero");
          setIsLoading(false);
          return;
        }
      }

      // Si el servidor reportó error específico
      const resErr = await res.json().catch(() => ({}));
      setError(resErr.error || "Usuario o credenciales no encontradas en el sistema. Verifica tu correo o documento.");
    } catch (err: any) {
      console.error("Excepción en autenticación:", err);
      setError(err?.message || "Ocurrió un error inesperado al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSupabaseLogin(loginCedula, loginPassword);
  };

  const handleQuickLogin = (emailOrCedula: string) => {
    setLoginCedula(emailOrCedula);
    setLoginPassword("••••••••");
    executeSupabaseLogin(emailOrCedula);
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
          {/* Header */}
          <div className="border-b border-zinc-100 bg-zinc-50/50 p-4 text-center">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#1C2E24]">
              Acceso al Sistema Operativo
            </h2>
            <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
              Autenticación segura multi-local (Supabase Auth)
            </p>
          </div>

          <div className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3.5 rounded-xl text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-2">
                  Correo Electrónico o Cédula (C.C.)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                    <FileText className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ej. raulsantiagoramirez1@gmail.com o 1020730746"
                    value={loginCedula}
                    onChange={(e) => setLoginCedula(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Ingresa tu correo registrado en Supabase o tu número de documento
                </p>
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
                {isLoading ? "Validando credenciales..." : "Ingresar al Sistema"}
              </button>
            </form>

            {/* Accesos rápidos de desarrollo / cuentas registradas en Supabase */}
            <div className="space-y-3 pt-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-100" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-black">
                  <span className="bg-white px-3 text-[#1C2E24]/40 tracking-widest">
                    Cuentas Registradas en Supabase
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("raulsantiagoramirez1@gmail.com")}
                  className="flex flex-col items-start p-2.5 bg-zinc-50 hover:bg-zinc-100 hover:border-[#1E3E30]/40 border border-zinc-200/60 rounded-xl transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1E3E30] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-[#1C2E24] uppercase">Raúl Santiago (Gerente)</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 truncate w-full">raulsantiagoramirez1@gmail.com</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("floralbapuyo@gmail.com")}
                  className="flex flex-col items-start p-2.5 bg-zinc-50 hover:bg-zinc-100 hover:border-[#1E3E30]/40 border border-zinc-200/60 rounded-xl transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-[#1E3E30] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-[#1C2E24] uppercase">Flor Alba (Líder)</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 truncate w-full">floralbapuyo@gmail.com</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("sofiaramirez0305@gmail.com")}
                  className="flex flex-col items-start p-2.5 bg-zinc-50 hover:bg-zinc-100 hover:border-[#1E3E30]/40 border border-zinc-200/60 rounded-xl transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-[#1E3E30] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-[#1C2E24] uppercase">Sofía Ramírez</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 truncate w-full">sofiaramirez0305@gmail.com</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("1020730746")}
                  className="flex flex-col items-start p-2.5 bg-zinc-50 hover:bg-zinc-100 hover:border-[#1E3E30]/40 border border-zinc-200/60 rounded-xl transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-[#1E3E30] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-[#1C2E24] uppercase">Colaborador C.C.</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 font-mono">1020730746</span>
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-2.5 flex items-start gap-2 text-[10px] text-amber-800">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  El alta de nuevos colaboradores se administra exclusivamente por Gerencia en la pestaña de Equipo del Dashboard.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
