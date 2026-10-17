import React from "react";
import { AlertTriangle, Info, Users } from "lucide-react";
import type { PanelPunto as PanelPuntoData } from "./types";
import { Panel, StatRow, BarRow, EmptyState, ErrorState, SkeletonPanel, useApiResource, formatCOP, formatFecha } from "./ui";

export default function PanelPunto({ local }: { local: string }) {
  const { data, error, loading, reload } = useApiResource<PanelPuntoData>("/api/me/punto");

  const header = (
    <div>
      <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">Punto {local}</h1>
      <p className="mt-1 text-sm text-slate-500 font-medium">Ventas declaradas, equipo y alertas del local.</p>
    </div>
  );

  if (loading && !data) {
    return (
      <div className="space-y-4">
        {header}
        <SkeletonPanel lines={4} />
        <SkeletonPanel lines={6} />
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
  if (!data) return null;

  const { ventas, equipo, alertas } = data;
  const variacion =
    ventas.mesAnteriorMismoCorte > 0 ? Math.round(((ventas.mes - ventas.mesAnteriorMismoCorte) / ventas.mesAnteriorMismoCorte) * 100) : null;
  const max14 = Math.max(1, ...ventas.ultimos14.map((d) => d.total || 0));
  const maxDia = Math.max(1, ...ventas.porDiaSemana.map((d) => d.promedio));

  return (
    <div className="space-y-5">
      {header}

      {alertas.length > 0 && (
        <ul className="space-y-2" aria-label="Alertas del punto">
          {alertas.map((a) => (
            <li
              key={a.tipo}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                a.nivel === "alta" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{a.mensaje}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
      <Panel title="Ventas del mes">
        <StatRow
          items={[
            { label: "Esta semana", value: formatCOP(ventas.semana) },
            {
              label: "Mes en curso",
              value: formatCOP(ventas.mes),
              hint:
                variacion === null ? "Sin datos del mes anterior" : `${variacion >= 0 ? "+" : ""}${variacion}% frente al mismo corte del mes anterior`,
            },
            {
              label: "Meta mensual",
              value: ventas.avanceMeta === null ? "—" : `${ventas.avanceMeta}%`,
              hint: formatCOP(ventas.metaMensual),
              tone: ventas.avanceMeta !== null && ventas.avanceMeta >= 100 ? "good" : "default",
            },
          ]}
        />
        <div className="mt-5">
          <BarRow label="Avance hacia la meta" pct={ventas.avanceMeta} value={`${formatCOP(ventas.mes)} de ${formatCOP(ventas.metaMensual)}`} />
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-500 mb-2">Últimos 14 días</p>
          <div className="flex items-end gap-1 h-28" role="list" aria-label="Venta declarada por día, últimos 14 días">
            {ventas.ultimos14.map((d) => (
              <div key={d.fecha} role="listitem" className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0" title={`${formatFecha(d.fecha)}: ${d.total === null ? "sin cierre" : formatCOP(d.total)}`}>
                {d.total === null ? (
                  <div className="w-full max-w-10 h-1 rounded-full bg-rose-200" aria-label={`${d.fecha} sin cierre`} />
                ) : (
                  <div className="w-full max-w-10 rounded-t-md bg-[#1E3E30]/80 hover:bg-[#1E3E30] transition-colors" style={{ height: `${Math.max(4, (d.total / max14) * 100)}%` }} />
                )}
                <span className="text-[10px] font-semibold text-slate-400 font-numeric">{Number(d.fecha.slice(8, 10))}</span>
              </div>
            ))}
          </div>
        </div>

      </Panel>

      <Panel title="Promedio por día de la semana" action={<span className="text-xs font-semibold text-slate-500">Últimos 60 días</span>}>
        <div>
          <div className="space-y-2.5">
            {ventas.porDiaSemana
              .slice(1)
              .concat(ventas.porDiaSemana.slice(0, 1))
              .map((d) => (
                <BarRow key={d.etiqueta} label={d.etiqueta} pct={d.dias > 0 ? Math.round((d.promedio / maxDia) * 100) : null} value={d.dias > 0 ? formatCOP(d.promedio) : "Sin cierres"} />
              ))}
          </div>
        </div>

        <p className="mt-5 flex items-start gap-2 text-xs text-slate-500 font-medium">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Son los valores declarados en cada cierre, incluidos los que aún no audita Gerencia.
        </p>
      </Panel>
      </div>

      <Panel title="Equipo · últimos 30 días">
        {equipo.length === 0 ? (
          <EmptyState icon={<Users className="w-8 h-8" />} title="No hay colaboradores registrados en el local" />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-left text-xs lg:text-sm min-w-[560px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th scope="col" className="font-semibold py-2 pl-5">Colaborador</th>
                  <th scope="col" className="font-semibold py-2 text-right">Turnos</th>
                  <th scope="col" className="font-semibold py-2 text-right">Cuadres sin diferencia</th>
                  <th scope="col" className="font-semibold py-2 text-right">Checklist</th>
                  <th scope="col" className="font-semibold py-2 pr-5 text-right">Conteos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipo.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pl-5">
                      <p className="font-bold text-slate-900">{m.nombre}</p>
                      <p className="text-slate-500 font-medium">{m.cargo || "Sin cargo"}</p>
                    </td>
                    <td className="py-2.5 text-right font-numeric font-bold text-slate-900">{m.turnos}</td>
                    <td className="py-2.5 text-right font-numeric font-bold">
                      {m.tasaCuadre === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={m.tasaCuadre >= 90 ? "text-emerald-700" : "text-amber-700"}>
                          {m.tasaCuadre}% <span className="text-slate-400 font-medium">({m.cuadrados})</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-numeric font-bold text-slate-900">
                      {m.checklistPromedio === null ? <span className="text-slate-400">—</span> : `${m.checklistPromedio}%`}
                    </td>
                    <td className="py-2.5 pr-5 text-right font-numeric font-bold text-slate-900">{m.conteos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
