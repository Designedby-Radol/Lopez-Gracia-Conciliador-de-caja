import React, { useState } from "react";
import { ChevronDown, Download, FileText, Loader2, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";
import type { DesprendibleDetalle, DesprendibleResumen } from "./types";
import { Panel, EmptyState, ErrorState, SkeletonPanel, Skeleton, useApiResource, formatCOP, formatFecha } from "./ui";
import { descargarDesprendiblePdf } from "./desprendiblePdf";

export default function MisDesprendibles() {
  const { data, error, loading, reload } = useApiResource<DesprendibleResumen[]>("/api/me/desprendibles");
  const [abierto, setAbierto] = useState<string | null>(null);
  // El detalle se pide al abrir y no se guarda fuera de este componente.
  const [detalles, setDetalles] = useState<Record<string, DesprendibleDetalle>>({});
  const [cargando, setCargando] = useState<string | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  const abrir = async (id: string) => {
    if (abierto === id) {
      setAbierto(null);
      return;
    }
    setAbierto(id);
    setErrorDetalle(null);
    if (detalles[id]) return;
    setCargando(id);
    try {
      const r = await api<{ data: DesprendibleDetalle }>(`/api/me/desprendibles/${encodeURIComponent(id)}`);
      setDetalles((prev) => ({ ...prev, [id]: r.data }));
    } catch (err: any) {
      setErrorDetalle(err?.message || "No se pudo abrir el desprendible.");
    } finally {
      setCargando(null);
    }
  };

  const descargar = async (d: DesprendibleDetalle) => {
    setDescargando(true);
    try {
      await descargarDesprendiblePdf(d);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="space-y-5 w-full max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">Mis desprendibles</h1>
        <p className="mt-1 text-sm text-slate-500 font-medium flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-700" /> Solo tú puedes ver tus desprendibles.
        </p>
      </div>

      {loading && !data ? (
        <SkeletonPanel lines={4} />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <Panel>
          <EmptyState icon={<FileText className="w-8 h-8" />} title="Aún no tienes desprendibles publicados">
            Gerencia los publica después de liquidar cada quincena. Te llegará un aviso cuando esté disponible.
          </EmptyState>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {data.map((d) => {
            const isOpen = abierto === d.id;
            const det = detalles[d.id];
            return (
              <li key={d.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => abrir(d.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer hover:bg-slate-50/70 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1E3E30]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{d.quincena_nombre || "Quincena"}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {formatFecha(d.fecha_inicio, { day: "numeric", month: "short" })} al {formatFecha(d.fecha_fin, { day: "numeric", month: "short", year: "numeric" })}
                      {d.version > 1 && " · corregido"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-extrabold font-numeric text-slate-900">{formatCOP(d.neto)}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    {cargando === d.id ? (
                      <div className="space-y-2" aria-busy="true">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    ) : errorDetalle && !det ? (
                      <ErrorState message={errorDetalle} onRetry={() => { setAbierto(null); abrir(d.id); }} />
                    ) : det ? (
                      <>
                        <p className="text-xs text-slate-500 font-medium">
                          {det.datos.cargo || "—"} · Contrato {det.datos.tipoContrato || "—"}
                          {det.datos.diasAsistidos !== null && ` · ${det.datos.diasAsistidos} días asistidos`}
                        </p>
                        <table className="mt-3 w-full text-xs lg:text-sm">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-200">
                              <th scope="col" className="text-left font-semibold py-2">Concepto</th>
                              <th scope="col" className="text-right font-semibold py-2 pl-3">Devengado</th>
                              <th scope="col" className="text-right font-semibold py-2 pl-3">Deducción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {det.datos.conceptos.map((c) => (
                              <tr key={c.concepto}>
                                <td className="py-2 font-medium text-slate-700">{c.concepto}</td>
                                <td className="py-2 pl-3 text-right font-numeric font-bold text-slate-900 whitespace-nowrap">{c.devengado > 0 ? formatCOP(c.devengado) : ""}</td>
                                <td className="py-2 pl-3 text-right font-numeric font-bold text-rose-700 whitespace-nowrap">{c.deduccion > 0 ? formatCOP(c.deduccion) : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200">
                              <td className="pt-2 font-bold text-slate-700">Totales</td>
                              <td className="pt-2 text-right font-numeric font-bold text-slate-900">{formatCOP(det.devengado)}</td>
                              <td className="pt-2 text-right font-numeric font-bold text-rose-700">{formatCOP(det.deducciones)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#E8F3EE] px-4 py-3">
                          <div>
                            <p className="text-xs font-semibold text-[#1E3E30]">Neto a pagar</p>
                            <p className="text-xl font-extrabold font-numeric text-[#1E3E30]">{formatCOP(det.neto)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => descargar(det)}
                            disabled={descargando}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E3E30] text-white text-xs font-bold hover:bg-[#163025] disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3E30]"
                          >
                            {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Descargar PDF
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
