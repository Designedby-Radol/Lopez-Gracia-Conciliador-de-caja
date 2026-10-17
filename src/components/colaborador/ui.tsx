import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { api } from "../../lib/api";

const copFormatter = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const formatCOP = (n: number | null | undefined) => copFormatter.format(Math.round(Number(n) || 0));

/** "2026-10-07" → "mar 7 oct" (sin el desfase de zona horaria de new Date("YYYY-MM-DD")). */
export function formatFecha(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("es-CO", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Pide un recurso de /api con estados de carga, error y recarga. */
export function useApiResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ data: T }>(path);
      if (id === seq.current) setData(r.data);
    } catch (err: any) {
      if (id === seq.current) setError(err?.message || "No se pudo cargar la información.");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}

export function Panel({ title, action, children, className = "" }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200/80 ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 lg:px-6 lg:pt-5">
          {title && <h2 className="text-sm lg:text-base font-extrabold text-slate-900 tracking-tight">{title}</h2>}
          {action}
        </header>
      )}
      <div className="px-5 pb-5 lg:px-6 lg:pb-6">{children}</div>
    </section>
  );
}

/** Fila de cifras separadas por divisores (no tarjetas sueltas). */
export function StatRow({ items }: { items: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "default" | "good" | "warn" | "bad" }[] }) {
  const toneClass = { default: "text-slate-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-700" } as const;
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:divide-x divide-slate-200/80 gap-y-4">
      {items.map((it) => (
        <div key={it.label} className="sm:px-4 first:sm:pl-0 last:sm:pr-0 min-w-0">
          <dt className="text-xs lg:text-sm font-semibold text-slate-500">{it.label}</dt>
          <dd className={`mt-1 text-xl lg:text-2xl font-extrabold font-numeric tracking-tight ${toneClass[it.tone || "default"]}`}>{it.value}</dd>
          {it.hint && <dd className="mt-0.5 text-xs lg:text-[13px] text-slate-500 font-medium">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Barra horizontal con etiqueta y valor; `pct` 0–100. (`key` declarado: el proyecto no instala @types/react.) */
export function BarRow({ label, pct, value, tone = "green" }: { key?: string | number; label: string; pct: number | null; value?: React.ReactNode; tone?: "green" | "amber" | "rose" | "slate" }) {
  const color = { green: "bg-[#1E3E30]", amber: "bg-amber-500", rose: "bg-rose-500", slate: "bg-slate-400" }[tone];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs lg:text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-bold font-numeric text-slate-900">{value ?? (pct === null ? "Sin datos" : `${pct}%`)}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-[width] duration-500 ease-out`} style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} />
      </div>
    </div>
  );
}

export type EstadoTurno = "limpio" | "descuadre" | "pendiente";

/**
 * Tira de turnos: cada cuadro es un cierre en el que participó la persona,
 * en orden cronológico. Verde = cuadrado sin diferencias, ámbar = con descuadre
 * o diferencia, contorno = pendiente de auditoría.
 */
export function TiraDeTurnos({ turnos, max = 20 }: { turnos: { id: string; fecha: string; estado: EstadoTurno; titulo: string }[]; max?: number }) {
  const visibles = turnos.slice(-max);
  if (visibles.length === 0) return null;
  const clase: Record<EstadoTurno, string> = {
    limpio: "bg-[#1E3E30] border-[#1E3E30]",
    descuadre: "bg-amber-400 border-amber-500",
    pendiente: "bg-white border-slate-300 border-dashed",
  };
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Turnos recientes, del más antiguo al más reciente">
      {visibles.map((t) => (
        <li key={t.id} title={t.titulo} className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 ${clase[t.estado]}`}>
          <span className="sr-only">{t.titulo}</span>
        </li>
      ))}
    </ol>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="py-8 px-4 flex flex-col items-center text-center">
      {icon && <div className="text-slate-300 mb-2">{icon}</div>}
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {children && <div className="mt-1 text-xs text-slate-500 max-w-sm">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 text-xs font-semibold">{message}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 hover:text-rose-950 cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { key?: string | number; className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} aria-hidden="true" />;
}

export function SkeletonPanel({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

/** Selector segmentado accesible (radiogroup). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex bg-slate-100 p-1 rounded-xl gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3E30] ${
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
