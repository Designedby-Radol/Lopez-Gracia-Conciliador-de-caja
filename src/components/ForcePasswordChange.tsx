import React, { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import Logo from "./Logo";
import { api } from "../lib/api";
import type { SessionInfo } from "../App";

interface Props {
  user: SessionInfo;
  onChanged: (user: SessionInfo) => void;
  onLogout: () => void;
}

const MIN_LENGTH = 6;

export default function ForcePasswordChange({ user, onChanged, onLogout }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < MIN_LENGTH) return setError(`La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
    if (newPassword !== confirmPassword) return setError("Las contraseñas nuevas no coinciden.");

    setSaving(true);
    try {
      const r = await api<{ user: SessionInfo }>("/api/auth/change-password", {
        method: "POST",
        json: { currentPassword, newPassword },
      });
      onChanged(r.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3.5 py-3 bg-zinc-50 border border-zinc-200 focus:border-[#1E3E30] focus:bg-white rounded-xl text-[#1C2E24] text-sm font-semibold outline-none";

  return (
    <div className="min-h-screen bg-[#F5F2EB] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo size="xl" className="text-[#1C2E24]" />
        </div>
        <form onSubmit={handleSubmit} className="bg-white border border-[#1C2E24]/10 rounded-3xl shadow-xl p-8 space-y-5">
          <div className="flex items-start gap-3">
            <KeyRound className="w-6 h-6 text-[#1E3E30] shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-base font-black text-[#1C2E24]">Hola, {user.nombre}</h1>
              <p className="text-sm text-zinc-600 mt-1">
                Por seguridad debes crear una contraseña nueva antes de continuar. Tu clave actual es temporal.
              </p>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold p-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fpc-current" className="block text-xs font-bold text-zinc-700 mb-1.5">Contraseña actual (temporal)</label>
            <input id="fpc-current" type="password" required autoComplete="current-password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="fpc-new" className="block text-xs font-bold text-zinc-700 mb-1.5">Nueva contraseña</label>
            <input id="fpc-new" type="password" required minLength={MIN_LENGTH} autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="fpc-confirm" className="block text-xs font-bold text-zinc-700 mb-1.5">Confirmar nueva contraseña</label>
            <input id="fpc-confirm" type="password" required minLength={MIN_LENGTH} autoComplete="new-password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3.5 bg-[#1E3E30] hover:bg-[#1E3E30]/90 text-white font-black text-sm rounded-2xl disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar y continuar"}
          </button>
          <button type="button" onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-800">
            <LogOut className="w-4 h-4" aria-hidden="true" /> Salir
          </button>
        </form>
      </div>
    </div>
  );
}
