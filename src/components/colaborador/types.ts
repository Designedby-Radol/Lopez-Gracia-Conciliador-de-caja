import type { ResumenPersonal, PendientesDelDia, PanelPunto } from "../../lib/metricasEquipo";

export type { ResumenPersonal, PendientesDelDia, PanelPunto };

export interface PerfilColaborador {
  nombre: string;
  cargo: string;
  local: string;
  participaDescuadre: boolean;
  esLiderOperador: boolean;
  esPasteleria: boolean;
}

export interface ResumenResponse {
  perfil: PerfilColaborador;
  resumen: ResumenPersonal | null;
  pendientes: PendientesDelDia | null;
}

export type PeriodoResumen = "quincena" | "mes" | "90d";

/** Pestañas del portal del colaborador. */
export type SeccionColaborador = "inicio" | "register" | "inventory" | "checklist" | "desempeno" | "punto" | "desprendibles" | "password";

export interface DesprendibleResumen {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  quincena_nombre: string | null;
  version: number;
  neto: number;
  publicado_at: string;
}

export interface DesprendibleDetalle extends DesprendibleResumen {
  devengado: number;
  deducciones: number;
  datos: {
    nombre: string;
    cargo: string | null;
    tipoContrato: string | null;
    area: string | null;
    diasLaborados: number | null;
    diasAsistidos: number | null;
    conceptos: { concepto: string; devengado: number; deduccion: number }[];
  };
}

export interface Aviso {
  id: string;
  tipo: "cierre_cuadrado" | "descuadre" | "cierre_anulado" | "desprendible";
  titulo: string;
  mensaje: string | null;
  ref_tipo: string | null;
  ref_id: string | null;
  leida_at: string | null;
  created_at: string;
}
