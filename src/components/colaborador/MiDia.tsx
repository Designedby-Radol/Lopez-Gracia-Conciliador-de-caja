import React from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock, Package, PlusCircle, AlertTriangle, CalendarClock } from "lucide-react";
import { todayBogota } from "../../lib/dates";
import type { ResumenResponse, SeccionColaborador } from "./types";
import { Panel, StatRow, TiraDeTurnos, EmptyState, ErrorState, SkeletonPanel, useApiResource, formatCOP, formatFecha } from "./ui";
import { turnosParaTira, estadoTurno, ROL_LABEL } from "./turnos";

interface Props {
  onNavigate: (s: SeccionColaborador) => void;
}

type Tarea = {
  id: string;
  hecho: boolean;
  urgente?: boolean;
  icon: React.ReactNode;
  titulo: string;
  detalle?: string;
  accion?: { label: string; to: SeccionColaborador };
};

export default function MiDia({ onNavigate }: Props) {
  const { data, error, loading, reload } = useApiResource<ResumenResponse>("/api/me/resumen?periodo=quincena");
  const hoy = todayBogota();

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonPanel lines={4} />
        <SkeletonPanel lines={3} />
      </div>
    );
  }
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { perfil, resumen, pendientes } = data;
  const primerNombre = perfil.nombre.split(" ")[0] || perfil.nombre;
  const haceCaja = !perfil.esPasteleria;

  const tareas: Tarea[] = [];
  if (pendientes) {
    if (haceCaja) {
      tareas.push(
        pendientes.cierreHoy
          ? {
              id: "cierre",
              hecho: true,
              icon: <PlusCircle className="w-4 h-4" />,
              titulo: "Cierre de caja de hoy registrado",
              detalle: pendientes.cierreHoy.estado === "Cuadrado" ? "Ya fue auditado y quedó cuadrado." : "Queda pendiente de auditoría por Gerencia.",
            }
          : {
              id: "cierre",
              hecho: false,
              icon: <PlusCircle className="w-4 h-4" />,
              titulo: "Falta el cierre de caja de hoy",
              detalle: "Regístralo al terminar el turno.",
              accion: { label: "Registrar", to: "register" },
            },
      );
      if (pendientes.cierreAyerFalta) {
        tareas.push({
          id: "cierre-ayer",
          hecho: false,
          urgente: true,
          icon: <AlertTriangle className="w-4 h-4" />,
          titulo: "No hay cierre registrado de ayer",
          detalle: "Si hubo turno, registra el cierre con la fecha de ayer.",
          accion: { label: "Registrar", to: "register" },
        });
      }
    }
    const turnos = pendientes.checklistTurnosHoy;
    tareas.push({
      id: "checklist",
      hecho: turnos.length > 0,
      icon: <ClipboardCheck className="w-4 h-4" />,
      titulo: turnos.length > 0 ? "Checklist registrado hoy" : "Aún no hay checklist hoy",
      detalle: turnos.length > 0 ? `Turnos: ${turnos.join(", ")}.` : "Apertura, turno y cierre del local.",
      accion: { label: turnos.length > 0 ? "Ver" : "Abrir", to: "checklist" },
    });
    tareas.push({
      id: "inventario",
      hecho: pendientes.inventarioHoy,
      icon: <Package className="w-4 h-4" />,
      titulo: pendientes.inventarioHoy ? "Inventario contado hoy" : "Falta el conteo de inventario de hoy",
      accion: pendientes.inventarioHoy ? undefined : { label: "Contar", to: "inventory" },
    });
  }
  const faltan = tareas.filter((t) => !t.hecho).length;
  const recientes = resumen?.cierres.recientes || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">Hola, {primerNombre}</h1>
        <p className="mt-1 text-sm text-slate-500 font-medium first-letter:uppercase">
          {formatFecha(hoy, { weekday: "long", day: "numeric", month: "long" })} · Punto {perfil.local}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
      <Panel
        title={faltan === 0 ? "Todo al día" : `Pendiente hoy · ${faltan}`}
        action={
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <CalendarClock className="w-3.5 h-3.5" /> Todo el local
          </span>
        }
      >
        <ul className="divide-y divide-slate-100">
          {tareas.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
              <span
                className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                  t.hecho ? "bg-emerald-50 text-emerald-700" : t.urgente ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {t.hecho ? <CheckCircle2 className="w-4 h-4" /> : t.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${t.hecho ? "text-slate-500" : "text-slate-900"}`}>{t.titulo}</p>
                {t.detalle && <p className="text-xs text-slate-500 font-medium mt-0.5">{t.detalle}</p>}
              </div>
              {t.accion && (
                <button
                  type="button"
                  onClick={() => onNavigate(t.accion!.to)}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3E30] ${
                    t.hecho ? "text-slate-600 hover:bg-slate-100" : "bg-[#1E3E30] text-white hover:bg-[#163025]"
                  }`}
                >
                  {t.accion.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {resumen && (
        <Panel
          title="Tu quincena"
          action={
            <button
              type="button"
              onClick={() => onNavigate("desempeno")}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#1E3E30] hover:underline underline-offset-4 cursor-pointer"
            >
              Ver mi desempeño <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          <StatRow
            items={
              haceCaja
                ? [
                    { label: "Turnos", value: resumen.cierres.total, hint: `${resumen.cierres.pendientes} sin auditar` },
                    {
                      label: "Cuadres sin diferencia",
                      value: resumen.cierres.tasaCuadre === null ? "—" : `${resumen.cierres.tasaCuadre}%`,
                      tone: resumen.cierres.tasaCuadre === null ? "default" : resumen.cierres.tasaCuadre >= 90 ? "good" : "warn",
                    },
                    { label: "Racha actual", value: resumen.cierres.rachaActual, hint: `Mejor: ${resumen.cierres.mejorRacha}` },
                    ...(resumen.descuadres
                      ? [
                          {
                            label: "Descuadres",
                            value: formatCOP(resumen.descuadres.quincenaActual.monto),
                            tone: (resumen.descuadres.quincenaActual.monto > 0 ? "bad" : "good") as "bad" | "good",
                          },
                        ]
                      : []),
                  ]
                : [
                    { label: "Checklists", value: resumen.checklist.total },
                    { label: "Cumplimiento", value: resumen.checklist.promedio === null ? "—" : `${resumen.checklist.promedio}%` },
                    { label: "Conteos de inventario", value: resumen.inventario.conteos },
                  ]
            }
          />
          {haceCaja && recientes.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-500 mb-2">Tus últimos turnos</p>
              <TiraDeTurnos turnos={turnosParaTira(recientes)} />
            </div>
          )}
        </Panel>
      )}
      </div>

      {haceCaja && (
        <Panel title="Últimos cierres donde participaste">
          {recientes.length === 0 ? (
            <EmptyState icon={<Clock className="w-8 h-8" />} title="Todavía no apareces en ningún cierre">
              Cuando registres un cierre o te incluyan como líder o auxiliar del turno, aparecerá aquí.
            </EmptyState>
          ) : (
            <ul className="grid lg:grid-cols-2 lg:gap-x-10">
              {recientes.slice(0, 4).map((c) => {
                const estado = estadoTurno(c);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 first-letter:uppercase">{formatFecha(c.fecha)}</p>
                      <p className="text-xs text-slate-500 font-medium">{ROL_LABEL[c.rol]}</p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${
                        estado === "pendiente"
                          ? "bg-slate-100 text-slate-600"
                          : estado === "limpio"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {estado === "pendiente" ? "Pendiente" : c.monto > 0 ? `Descuadre ${formatCOP(c.monto)}` : estado === "limpio" ? "Cuadrado" : "Con diferencias"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
