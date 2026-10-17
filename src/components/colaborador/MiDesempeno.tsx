import React, { useState } from "react";
import { Award, ClipboardCheck, Package, Receipt, Trophy } from "lucide-react";
import type { PeriodoResumen, ResumenResponse } from "./types";
import { Panel, StatRow, BarRow, TiraDeTurnos, EmptyState, ErrorState, SkeletonPanel, Segmented, useApiResource, formatCOP, formatFecha } from "./ui";
import { turnosParaTira, ROL_LABEL } from "./turnos";

const CANAL_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjetas: "Datáfono",
  justo: "Justo",
  rappi: "Rappi",
  transferencias: "Transferencias",
};

const SECCION_LABEL: Record<string, string> = { apertura: "Apertura", turno: "Turno", cierre: "Cierre" };

const PERIODOS: { value: PeriodoResumen; label: string }[] = [
  { value: "quincena", label: "Quincena" },
  { value: "mes", label: "Mes" },
  { value: "90d", label: "90 días" },
];

export default function MiDesempeno() {
  const [periodo, setPeriodo] = useState<PeriodoResumen>("quincena");
  const { data, error, loading, reload } = useApiResource<ResumenResponse>(`/api/me/resumen?periodo=${periodo}`);

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">Mi desempeño</h1>
        {data?.resumen && (
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Del {formatFecha(data.resumen.periodo.desde, { day: "numeric", month: "short" })} al{" "}
            {formatFecha(data.resumen.periodo.hasta, { day: "numeric", month: "short" })}
          </p>
        )}
      </div>
      <Segmented label="Período" value={periodo} onChange={setPeriodo} options={PERIODOS} />
    </div>
  );

  if (loading && !data) {
    return (
      <div className="space-y-4">
        {header}
        <SkeletonPanel lines={3} />
        <SkeletonPanel lines={5} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="space-y-4">
        {header}
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }
  if (!data?.resumen) {
    return (
      <div className="space-y-4">
        {header}
        <EmptyState title="Tu usuario no tiene un punto de venta asignado">Pídele a Gerencia que te asigne uno para ver tus métricas.</EmptyState>
      </div>
    );
  }

  const { perfil, resumen } = data;
  const { cierres, descuadres, checklist, inventario, logros } = resumen;
  const haceCaja = !perfil.esPasteleria || cierres.total > 0;

  return (
    <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
      {header}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-start">
        <div className="space-y-5 min-w-0">
      {haceCaja && (
        <Panel title="Cierres de caja">
          <StatRow
            items={[
              { label: "Turnos", value: cierres.total, hint: `${cierres.comoLider} como líder · ${cierres.comoAuxiliar} como auxiliar` },
              {
                label: "Cuadres sin diferencia",
                value: cierres.tasaCuadre === null ? "—" : `${cierres.tasaCuadre}%`,
                hint: `${cierres.limpios} de ${cierres.cuadrados} auditados`,
                tone: cierres.tasaCuadre === null ? "default" : cierres.tasaCuadre >= 90 ? "good" : "warn",
              },
              { label: "Racha actual", value: cierres.rachaActual, hint: "cierres seguidos sin diferencias" },
              { label: "Mejor racha", value: cierres.mejorRacha },
            ]}
          />
          {cierres.recientes.length > 0 && (
            <div className="mt-5">
              <TiraDeTurnos turnos={turnosParaTira(cierres.recientes)} />
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                <Leyenda clase="bg-[#1E3E30] border-[#1E3E30]">Sin diferencias</Leyenda>
                <Leyenda clase="bg-amber-400 border-amber-500">Con descuadre</Leyenda>
                <Leyenda clase="bg-white border-slate-300 border-dashed">Sin auditar</Leyenda>
              </p>
            </div>
          )}
        </Panel>
      )}

      {descuadres && (
        <Panel title="Mis descuadres">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
            <p className={`text-3xl font-extrabold font-numeric tracking-tight ${descuadres.quincenaActual.monto > 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {formatCOP(descuadres.quincenaActual.monto)}
            </p>
            <p className="text-sm text-slate-500 font-medium">asignado en la quincena {descuadres.quincenaActual.etiqueta}</p>
          </div>
          <p className="mt-2 text-xs text-slate-500 max-w-prose">
            Son los montos que Gerencia asignó al auditar cada cierre: el líder del turno responde por el 60% del faltante y los auxiliares reparten el 40%.
          </p>

          {descuadres.porQuincena.length > 0 && (
            <div className="mt-5 space-y-3">
              {(() => {
                const max = Math.max(...descuadres.porQuincena.map((q) => q.monto));
                return descuadres.porQuincena.map((q) => (
                  <BarRow
                    key={q.clave}
                    label={`${q.etiqueta} · ${q.cierres} cierre${q.cierres === 1 ? "" : "s"}`}
                    pct={max > 0 ? Math.round((q.monto / max) * 100) : 0}
                    value={formatCOP(q.monto)}
                    tone="rose"
                  />
                ));
              })()}
            </div>
          )}

          {descuadres.detalle.length === 0 ? (
            <EmptyState icon={<Receipt className="w-8 h-8" />} title="No tienes descuadres asignados">
              Sigue así: cada cierre cuadrado suma a tu racha.
            </EmptyState>
          ) : (
            <div className="mt-5 -mx-5 overflow-x-auto">
              <table className="w-full text-left text-xs lg:text-sm min-w-[520px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th scope="col" className="font-semibold py-2 pl-5 pr-4">Fecha</th>
                    <th scope="col" className="font-semibold py-2 pr-4">Tu papel</th>
                    <th scope="col" className="font-semibold py-2">Diferencias del cierre</th>
                    <th scope="col" className="font-semibold py-2 pr-5 text-right">Te corresponde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {descuadres.detalle.map((d) => {
                    const difs = Object.entries(d.canales as Record<string, number>).filter(([, v]) => v !== 0);
                    return (
                      <tr key={d.cierreId}>
                        <td className="py-2.5 pl-5 pr-4 font-bold text-slate-900 first-letter:uppercase whitespace-nowrap">{formatFecha(d.fecha)}</td>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium whitespace-nowrap">{d.rol === "lider" ? "Líder (60%)" : d.rol === "auxiliar" ? "Auxiliar (40%)" : ROL_LABEL[d.rol]}</td>
                        <td className="py-2.5 text-slate-600 font-medium">
                          {difs.length === 0
                            ? "—"
                            : difs.map(([canal, v]) => (
                                <span key={canal} className="inline-block mr-3 whitespace-nowrap">
                                  {CANAL_LABEL[canal] || canal}{" "}
                                  <span className={`font-numeric font-bold ${v < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                    {v > 0 ? "+" : ""}
                                    {formatCOP(v)}
                                  </span>
                                </span>
                              ))}
                        </td>
                        <td className="py-2.5 pr-5 text-right font-numeric font-extrabold text-rose-700 whitespace-nowrap">{formatCOP(d.monto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

        </div>
        <div className="space-y-5 min-w-0">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
        <Panel title="Checklist operativo">
          {checklist.total === 0 ? (
            <EmptyState icon={<ClipboardCheck className="w-8 h-8" />} title="Sin checklists en este período">
              Los checklists que registres con tu usuario aparecen aquí.
            </EmptyState>
          ) : (
            <>
              <StatRow
                items={[
                  { label: "Registrados", value: checklist.total },
                  {
                    label: "Cumplimiento promedio",
                    value: checklist.promedio === null ? "—" : `${checklist.promedio}%`,
                    tone: checklist.promedio !== null && checklist.promedio >= 90 ? "good" : "warn",
                  },
                ]}
              />
              <div className="mt-5 space-y-3">
                {(["apertura", "turno", "cierre"] as const).map((s) => (
                  <BarRow key={s} label={SECCION_LABEL[s]} pct={checklist.secciones[s]} tone={checklist.peorSeccion === s ? "amber" : "green"} />
                ))}
              </div>
              {checklist.peorSeccion && (
                <p className="mt-3 text-xs text-slate-500 font-medium">
                  Donde más tareas quedan pendientes: <strong className="text-slate-800">{SECCION_LABEL[checklist.peorSeccion]}</strong>.
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel title="Conteos de inventario">
          {inventario.conteos === 0 && !inventario.ultimo ? (
            <EmptyState icon={<Package className="w-8 h-8" />} title="Aún no registras conteos">
              Los conteos que hagas con tu usuario aparecen aquí.
            </EmptyState>
          ) : (
            <>
              <StatRow
                items={[
                  { label: "Conteos en el período", value: inventario.conteos },
                  { label: "Cobertura del catálogo", value: inventario.coberturaPromedio === null ? "—" : `${inventario.coberturaPromedio}%`, hint: "promedio de ítems contados" },
                ]}
              />
              {inventario.ultimo && (
                <p className="mt-4 text-xs text-slate-500 font-medium">
                  Último conteo: <strong className="text-slate-800 first-letter:uppercase">{formatFecha(inventario.ultimo.fecha)}</strong>
                  {inventario.ultimo.cobertura !== null && ` · ${inventario.ultimo.cobertura}% del catálogo`}
                </p>
              )}
            </>
          )}
        </Panel>
      </div>

      <Panel title="Logros" action={<span className="text-xs font-semibold text-slate-500">{logros.filter((l) => l.obtenido).length} de {logros.length}</span>}>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {logros.map((l) => (
            <li
              key={l.id}
              className={`flex items-start gap-3 rounded-xl border p-3 ${l.obtenido ? "border-[#1E3E30]/20 bg-[#E8F3EE]" : "border-slate-200 bg-white"}`}
            >
              <span
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${l.obtenido ? "bg-[#1E3E30] text-white" : "bg-slate-100 text-slate-400"}`}
              >
                {l.obtenido ? <Trophy className="w-4 h-4" /> : <Award className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${l.obtenido ? "text-[#1E3E30]" : "text-slate-800"}`}>{l.titulo}</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{l.descripcion}</p>
                {!l.obtenido && (
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(l.progreso * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de ${l.titulo}`}>
                    <div className="h-full rounded-full bg-[#1E3E30]/60" style={{ width: `${Math.round(l.progreso * 100)}%` }} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
        </div>
      </div>
    </div>
  );
}

function Leyenda({ clase, children }: { clase: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-sm border-2 ${clase}`} aria-hidden="true" />
      {children}
    </span>
  );
}
