import React, { useState } from "react";
import { Lock, Eye, EyeOff, FileText, Info, HelpCircle, X, CheckCircle2, AlertTriangle } from "lucide-react";
import Logo from "./Logo";
import { api } from "../lib/api";
import type { SessionInfo } from "../App";

interface LoginProps {
  onLoginSuccess: (session: SessionInfo) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Login State
  const [loginCedula, setLoginCedula] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // General State
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotResult, setForgotResult] = useState<{ success: boolean; message: string; isEmailSent?: boolean } | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const identifier = loginCedula.trim();
    if (!identifier || !loginPassword) {
      setError("Ingresa tu correo o cédula y tu contraseña.");
      return;
    }
    setIsLoading(true);
    try {
      const r = await api<{ user: SessionInfo }>("/api/auth/login", {
        method: "POST",
        json: { identifier, password: loginPassword },
      });
      onLoginSuccess(r.user);
    } catch (err: any) {
      setError(err?.message || "No fue posible conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) return;

    setIsSendingForgot(true);
    setForgotResult(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setForgotResult({
          success: true,
          message: json.message,
          isEmailSent: json.resetEmailSent
        });
      } else {
        setForgotResult({
          success: false,
          message: json.error || "No se pudo procesar la solicitud de restablecimiento."
        });
      }
    } catch (err: any) {
      setForgotResult({
        success: false,
        message: err.message || "Error de conexión con el servidor."
      });
    } finally {
      setIsSendingForgot(false);
    }
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
            <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">
              Autenticación segura multi-local
            </p>
          </div>

          <div className="p-8 space-y-6">
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold p-3.5 rounded-xl text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-identifier" className="block text-xs font-black text-[#1C2E24]/70 uppercase tracking-widest mb-2">
                  Correo Electrónico o Cédula (C.C.)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                    <FileText className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Correo o número de cédula"
                    id="login-identifier"
                    autoComplete="username"
                    value={loginCedula}
                    onChange={(e) => setLoginCedula(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Ingresa tu correo registrado o tu número de documento
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="login-password" className="block text-xs font-black text-[#1C2E24]/70 uppercase tracking-widest">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotIdentifier(loginCedula);
                      setForgotResult(null);
                      setShowForgotModal(true);
                    }}
                    className="text-[11px] font-bold text-[#1E3E30] hover:underline cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    id="login-password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 bg-zinc-50/50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] placeholder-zinc-400 text-sm font-semibold outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={showLoginPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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

            <div className="pt-2">
              <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-amber-800">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  El alta de nuevos colaboradores se administra exclusivamente por Gerencia en la pestaña de Equipo del Dashboard.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Recuperación de Contraseña */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-brand-ink rounded-2xl max-w-md w-full p-6 shadow-[8px_8px_0px_0px_#1C1917] space-y-4">
            <div className="flex items-center justify-between border-b border-brand-ink/10 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-brand-ink uppercase tracking-wider">
                    Recuperación de Contraseña
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Servicio de soporte y credenciales de acceso
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                aria-label="Cerrar"
                className="p-1 text-zinc-400 hover:text-brand-ink transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border text-xs ${
                  forgotResult.success
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-red-50 border-red-300 text-red-900"
                }`}>
                  <div className="flex items-start space-x-2.5">
                    {forgotResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold block mb-1">
                        {forgotResult.success ? "Solicitud procesada con éxito" : "Aviso de validación"}
                      </span>
                      <p className="text-[11px] leading-relaxed">
                        {forgotResult.message}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 p-3.5 rounded-xl border border-brand-ink/10 text-[11px] text-zinc-600 space-y-1">
                  <span className="font-bold text-brand-ink block">
                    ¿Cómo restablece la clave el Gerente?
                  </span>
                  <p>
                    1. El Gerente ingresa al Dashboard con su cuenta de Gerencia.
                  </p>
                  <p>
                    2. En la barra lateral, hace clic en <strong>"Seguridad & Roles"</strong>.
                  </p>
                  <p>
                    3. Localiza al colaborador y hace clic en <strong>"Resetear Clave"</strong> para asignarle una nueva contraseña o PIN al instante.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 bg-brand-ink text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                  Entendido, volver al login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Ingresa tu correo electrónico registrado o número de cédula. Te indicaremos cómo restablecer tu clave con Gerencia.
                </p>

                <div>
                  <label className="block text-[11px] font-black text-[#1C2E24]/60 uppercase tracking-widest mb-1.5">
                    Correo o Cédula del Colaborador
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Correo o número de cédula"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] text-xs font-semibold outline-none transition-all"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-1/3 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingForgot}
                    className="w-2/3 py-2.5 bg-[#1E3E30] hover:bg-[#1E3E30]/90 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5"
                  >
                    {isSendingForgot ? (
                      <span>Consultando...</span>
                    ) : (
                      <span>Consultar & Recuperar</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
