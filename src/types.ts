export type UserRole = 
  | "Asistente de servicio"
  | "Lider"
  | "Auxiliar"
  | "Admin"
  | "colaborador" 
  | "gerente" 
  | "Lider de punto" 
  | "Líder operador" 
  | "Líder de pastelería" 
  | "Lider de pasteleria" 
  | "Auxiliar de pastelería" 
  | "Asistente de pasteleria" 
  | "Asistente de Servicio" 
  | "Asistente de servicio tiempo completo (TC)" 
  | "Asistente de servicio medio tiempo (MT)" 
  | "Aux de Venta";

export interface AuthUser {
  id: string;        // uuid de auth.users / public.usuarios
  nombre: string;
  role: "Asistente de servicio" | "Lider" | "Auxiliar" | "Admin" | string;
  localId: string;   // uuid de locales
  localNombre: string;
}

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
  estado: "Pendiente por Cuadrar" | "Cuadrado" | "Con Descuadre" | "Anulado";
  createdAt: string; // ISO string or timestamp
  colaboradorId?: string;
  colaboradorNombre?: string;
  localId?: string;
  localNombre?: string;
  
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
  liderNombre?: string;
  auxiliaresIds?: string[];
  auxiliaresNombres?: string[];
  descuadreLider?: number;
  descuadreAuxiliar?: number;

  // Audit Meta
  auditadoPor?: string;
  auditadoAt?: string;
  anuladoPor?: string;
  anuladoAt?: string;
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
