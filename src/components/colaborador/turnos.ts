import type { EstadoTurno } from "./ui";
import type { ResumenPersonal } from "./types";
import { formatCOP, formatFecha } from "./ui";

type Reciente = ResumenPersonal["cierres"]["recientes"][number];

export const ROL_LABEL: Record<Reciente["rol"], string> = {
  lider: "Líder del turno",
  auxiliar: "Auxiliar del turno",
  registro: "Registró el cierre",
};

export function estadoTurno(c: Reciente): EstadoTurno {
  if (c.estado !== "Cuadrado") return "pendiente";
  return c.limpio && c.monto === 0 ? "limpio" : "descuadre";
}

/** Recientes (más nuevo primero) → tira cronológica (más antiguo primero). */
export function turnosParaTira(recientes: Reciente[]) {
  return recientes
    .slice()
    .reverse()
    .map((c) => {
      const estado = estadoTurno(c);
      const detalle =
        estado === "pendiente" ? "pendiente de auditoría" : estado === "limpio" ? "cuadrado sin diferencias" : c.monto > 0 ? `descuadre de ${formatCOP(c.monto)}` : "cuadrado con diferencias";
      return { id: c.id, fecha: c.fecha, estado, titulo: `${formatFecha(c.fecha)} · ${ROL_LABEL[c.rol]} · ${detalle}` };
    });
}
