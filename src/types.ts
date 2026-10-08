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

// ==========================================
// TALENTO HUMANO, NÓMINA & RRHH INTERFACES
// ==========================================

export interface BonusConfig {
  id: string;
  concepto: string;
  monto: number;
  tipologia: "Salarial" | "No Salarial";
}

export interface DailySchedule {
  dia: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo";
  activo: boolean;
  horaEntrada: string; // e.g. "07:00"
  horaSalida: string; // e.g. "15:00"
  minutosAlmuerzo: number; // e.g. 60, 30, 0
  horasCalculadas: number;
}

export interface EmployeeHRProfile {
  telefono?: string;
  email?: string;
  direccion?: string;
  fechaIngreso?: string; // YYYY-MM-DD
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;
  contactoEmergenciaParentesco?: string;
  eps?: string; // Sanitas, Compensar, Sura, etc.
  arl?: string; // Positiva, SURA (Riesgo I/II)
  fondoPensiones?: string; // Porvenir, Protección, Colfondos, Colpensiones
  fondoCesantias?: string;
  tallaUniforme?: string;
  banco?: string;
  tipoCuenta?: "Ahorros" | "Corriente" | "Daviplata" | "Nequi";
  numeroCuenta?: string;
}

export interface DisciplinarySanction {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipo: "Llamado de Atención Verbal" | "Memorando Escrito" | "Suspensión Disciplinaria" | "Acta de Descargos";
  gravedad: "Leve" | "Moderada" | "Grave";
  motivo: string;
  descripcion: string;
  compromiso?: string;
  diasSuspension?: number;
  estado: "Activa" | "Cumplida" | "Anulada";
  firmadoPorEmpleado: boolean;
  registradoPor: string;
  fechaDescargos?: string;
}

export interface EmployeeBonusRecord {
  id: string;
  fecha: string; // YYYY-MM-DD
  concepto: string;
  monto: number;
  tipologia: "Salarial" | "No Salarial";
  tipoPago: "Mensual Recurrente" | "Única Vez" | "Por Quincena (50%)";
  motivo?: string;
  estado: "Aprobado" | "Pendiente" | "Pagado";
}

export interface VacationPeriod {
  id: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  diasHabiles: number;
  periodoCorrespondiente?: string; // e.g. "2024 - 2025"
  tipo: "Vacaciones Disfrutadas" | "Vacaciones Compensadas en Dinero" | "Permiso Remunerado" | "Permiso No Remunerado" | "Incapacidad Médica (EPS)" | "Licencia Legal";
  estado: "Aprobado" | "En Solicitud" | "Tomado" | "Rechazado";
  observaciones?: string;
}

export interface EmployeeSalaryConfig {
  nombre: string;
  cedula?: string;
  role: string;
  area: "Pastelería" | "Ventas";
  salarioBaseMensual: number;
  tipoContrato: "Indefinido" | "Por días" | "Término Fijo" | "Obra o Labor";
  auxilioTransporteAplica: boolean;
  informacionParticular: string;
  bonoFijoQuincenal?: number;
  descuentoFijoQuincenal?: number;
  puntajePropinas?: number;
  bonosConfigurados?: BonusConfig[];
  diaDescansoContractual?: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo";
  horarioSemanal?: DailySchedule[];

  // Extensión RRHH & Talento Humano
  hrProfile?: EmployeeHRProfile;
  sanciones?: DisciplinarySanction[];
  bonificaciones?: EmployeeBonusRecord[];
  vacaciones?: VacationPeriod[];
}

