import { supabaseAdmin } from "./supabase";
import { rolEnCierre, montoDescuadre, type CierreFila } from "../src/lib/metricasEquipo";

export interface Aviso {
  usuario_id: string;
  tipo: "cierre_cuadrado" | "descuadre" | "cierre_anulado" | "desprendible";
  titulo: string;
  mensaje?: string | null;
  ref_tipo?: "cierre" | "desprendible";
  ref_id?: string | null;
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "2026-10-07" → "mié, 7 oct" */
function fechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? FECHA.format(new Date(Date.UTC(y, m - 1, d))).replace(/\./g, "") : iso;
}

/** Avisos para el equipo de un cierre cuyo estado cambió a Cuadrado o Anulado. */
export function avisosPorCierre(cierre: CierreFila, estadoNuevo: string): Aviso[] {
  const personas = new Set<string>();
  if (cierre.colaborador_id) personas.add(cierre.colaborador_id);
  if (cierre.lider_id) personas.add(cierre.lider_id);
  for (const a of cierre.auxiliares || []) if (a.id) personas.add(a.id);

  const avisos: Aviso[] = [];
  for (const usuarioId of personas) {
    if (estadoNuevo === "Anulado") {
      if (usuarioId !== cierre.colaborador_id) continue;
      avisos.push({
        usuario_id: usuarioId,
        tipo: "cierre_anulado",
        titulo: `Tu cierre del ${fechaCorta(cierre.fecha)} fue anulado`,
        mensaje: "Gerencia lo anuló. Si hace falta, registra el cierre de nuevo.",
        ref_tipo: "cierre",
        ref_id: cierre.id,
      });
      continue;
    }
    if (estadoNuevo !== "Cuadrado") continue;
    const monto = montoDescuadre({ ...cierre, estado: "Cuadrado" }, rolEnCierre(cierre, usuarioId));
    avisos.push(
      monto > 0
        ? {
            usuario_id: usuarioId,
            tipo: "descuadre",
            titulo: `Se te asignó un descuadre de ${COP.format(monto)}`,
            mensaje: `Cierre del ${fechaCorta(cierre.fecha)}. El detalle por canal está en Mi desempeño.`,
            ref_tipo: "cierre",
            ref_id: cierre.id,
          }
        : {
            usuario_id: usuarioId,
            tipo: "cierre_cuadrado",
            titulo: `El cierre del ${fechaCorta(cierre.fecha)} quedó cuadrado`,
            mensaje: null,
            ref_tipo: "cierre",
            ref_id: cierre.id,
          },
    );
  }
  return avisos;
}

/** Guarda avisos. Nunca lanza: un aviso fallido no debe deshacer la operación. */
export async function notificar(avisos: Aviso[]): Promise<void> {
  if (avisos.length === 0) return;
  try {
    const { error } = await supabaseAdmin.from("notificaciones").insert(avisos);
    if (error) console.error("[notificaciones] No se pudieron guardar:", error.message);
  } catch (err) {
    console.error("[notificaciones] Error inesperado:", err);
  }
}
