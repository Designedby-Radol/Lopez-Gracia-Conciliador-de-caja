export type UserRole = 
  | "colaborador" 
  | "gerente" 
  | "Líder operador" 
  | "Lider operador" 
  | "Líder de pastelería" 
  | "Lider de pasteleria" 
  | "Auxiliar de pastelería" 
  | "Asistente de pasteleria" 
  | "Asistente de Servicio" 
  | "Asistente de servicio" 
  | "Asistente de servicio tiempo completo (TC)" 
  | "Asistente de servicio medio tiempo (MT)" 
  | "Aux de Venta"
  | "Lider de punto"; // Retrocompatibilidad

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface CierreCaja {
  id: string;
  fecha: string; // YYYY-MM-DD
  efectivoCierre: number;
  datafonoCierre: number;
  justoCierre: number;
  rappiCierre: number;
  transferenciasCierre: number;
  propinas: number;
  novedades: string;
  estado: "Pendiente por Cuadrar" | "Cuadrado";
  createdAt: string; // ISO string or timestamp
  colaboradorNombre?: string; // Nombre del colaborador que realiza el cierre
  
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
  liderNombre?: string;
  auxiliaresNombres?: string[];
  descuadreLider?: number;
  descuadreAuxiliar?: number;

  // Audit Meta
  auditadoPor?: string;
  auditadoAt?: string;
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
