export type Cargo =
  | "Asistente de servicio"
  | "Lider Operador"
  | "Lider Pasteleria"
  | "Auxiliar Pasteleria"
  | "Gerencia"
  | "admin";

export type AccessRole = "administrador" | "usuario";

export interface AuthUser {
  id: string;
  nombre: string;
  cedula?: string;
  cargo: Cargo;
  role: AccessRole;
  localId: string;
  localNombre: string;
}

// Compatibilidad hacia atrás con el tipo legado
export type UserRole =
  | Cargo
  | "colaborador"
  | "gerente"
  | "Líder operador"
  | "Lider operador"
  | "Líder de pastelería"
  | "Lider de pasteleria"
  | "Auxiliar de pastelería"
  | "Asistente de pasteleria"
  | "Asistente de Servicio"
  | "Asistente de servicio tiempo completo (TC)"
  | "Asistente de servicio medio tiempo (MT)"
  | "Aux de Venta"
  | "Lider de punto";

export function normalizeCargo(cargoOrRole?: string): Cargo {
  if (!cargoOrRole) return "Asistente de servicio";
  const lower = cargoOrRole.trim().toLowerCase();
  if (lower.includes("geren")) return "Gerencia";
  if (lower === "admin") return "admin";
  if (lower.includes("lider") || lower.includes("líder")) {
    if (lower.includes("pasteler")) return "Lider Pasteleria";
    return "Lider Operador";
  }
  if (lower.includes("pasteler")) {
    return "Auxiliar Pasteleria";
  }
  return "Asistente de servicio";
}

export function getAccessRole(cargo: Cargo): AccessRole {
  return cargo === "Gerencia" || cargo === "admin" ? "administrador" : "usuario";
}

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  cargo?: Cargo;
  name: string;
}

export interface CierreCaja {
  id: string;
  fecha: string; // YYYY-MM-DD
  localId?: string;
  local_id?: string;
  colaboradorId?: string;
  colaborador_id?: string;
  colaboradorNombre?: string;

  efectivoCierre: number;
  datafonoCierre: number;
  justoCierre: number;
  rappiCierre: number;
  transferenciasCierre: number;
  propinas: number;
  novedades?: string;

  estado: "Pendiente por Cuadrar" | "Cuadrado" | "Anulado";
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;

  // POS Values (filled during auditing)
  efectivoPOS?: number;
  tarjetasPOS?: number;
  justoPOS?: number;
  rappiPOS?: number;
  transferenciasPOS?: number;
  posFileName?: string;

  // Differences
  difEfectivo?: number;
  difTarjetas?: number;
  difJusto?: number;
  difRappi?: number;
  difTransferencias?: number;

  // Política de Descuadres (60% Líder / 40% Auxiliares)
  liderId?: string;
  lider_id?: string;
  liderNombre?: string;
  auxiliaresNombres?: string[];
  descuadreLider?: number;
  descuadre_lider?: number;
  descuadreAuxiliar?: number;
  descuadre_auxiliar?: number;

  // Audit Meta
  auditadoPor?: string;
  auditado_por?: string;
  auditadoAt?: string;
  auditado_at?: string;

  // Integración Justo
  justoPedidosPOS?: number;
  justo_pedidos_pos?: number;
  justoSobranteEfectivoDespacho?: number;
  justo_sobrante_efectivo_despacho?: number;
}

export interface POSReportTemplate {
  name: string;
  description: string;
  efectivoPOS: number;
  tarjetasPOS: number;
  justoPOS: number;
  rappiPOS: number;
  transferenciasPOS: number;
  fileName: string;
  anulacionesNote?: string;
}
