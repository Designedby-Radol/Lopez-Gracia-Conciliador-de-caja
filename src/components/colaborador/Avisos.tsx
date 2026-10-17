import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, FileText, Receipt, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import type { Aviso, SeccionColaborador } from "./types";

const INTERVALO_MS = 60_000;

const ICONO: Record<Aviso["tipo"], React.ReactNode> = {
  cierre_cuadrado: <CheckCircle2 className="w-4 h-4 text-emerald-700" />,
  descuadre: <Receipt className="w-4 h-4 text-rose-700" />,
  cierre_anulado: <XCircle className="w-4 h-4 text-slate-500" />,
  desprendible: <FileText className="w-4 h-4 text-[#1E3E30]" />,
};

const DESTINO: Record<Aviso["tipo"], SeccionColaborador> = {
  cierre_cuadrado: "desempeno",
  descuadre: "desempeno",
  cierre_anulado: "register",
  desprendible: "desprendibles",
};

function haceCuanto(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export default function Avisos({ onNavigate }: { onNavigate: (s: SeccionColaborador) => void }) {
  const [items, setItems] = useState<Aviso[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  // Avisos que estaban sin leer al abrir el panel: se resaltan durante esa visita.
  const [resaltados, setResaltados] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ data: { items: Aviso[]; noLeidas: number } }>("/api/me/notificaciones");
      setItems(r.data.items);
      setNoLeidas(r.data.noLeidas);
    } catch {
      /* Un fallo al consultar avisos no debe interrumpir el trabajo. */
    }
  }, []);

  // Consulta al montar, cada minuto mientras la pestaña está visible y al volver a ella.
  useEffect(() => {
    cargar();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") cargar();
    }, INTERVALO_MS);
    const onVisible = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  const toggle = async () => {
    const abrir = !abierto;
    setAbierto(abrir);
    if (abrir) setResaltados(new Set(items.filter((n) => !n.leida_at).map((n) => n.id)));
    if (abrir && noLeidas > 0) {
      setNoLeidas(0);
      try {
        await api("/api/me/notificaciones/leer", { method: "POST", json: {} });
        setItems((prev) => prev.map((n) => (n.leida_at ? n : { ...n, leida_at: new Date().toISOString() })));
      } catch {
        cargar();
      }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={noLeidas > 0 ? `Avisos, ${noLeidas} sin leer` : "Avisos"}
        aria-expanded={abierto}
        aria-haspopup="true"
        className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3E30]"
      >
        <Bell className="w-4 h-4" />
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#FF5C35] text-white text-[11px] font-extrabold flex items-center justify-center font-numeric">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-96 max-h-[70vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-[0_12px_32px_-8px_rgba(28,46,36,0.25)] z-50"
        >
          <p className="px-4 pt-4 pb-2 text-sm font-extrabold text-slate-900">Avisos</p>
          {items.length === 0 ? (
            <p className="px-4 pb-5 text-xs text-slate-500 font-medium">
              Aquí verás cuando Gerencia audite tus cierres o publique tu desprendible.
            </p>
          ) : (
            <ul className="pb-2">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAbierto(false);
                      onNavigate(DESTINO[n.tipo] || "inicio");
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 cursor-pointer ${resaltados.has(n.id) ? "bg-[#E8F3EE]/60" : ""}`}
                  >
                    <span className="mt-0.5 shrink-0">{ICONO[n.tipo]}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900">{n.titulo}</span>
                      {n.mensaje && <span className="block text-xs text-slate-500 font-medium mt-0.5">{n.mensaje}</span>}
                      <span className="block text-[11px] text-slate-400 font-semibold mt-1">{haceCuanto(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
