import { api } from "../lib/api";

export interface ModulePermission {
  id: string;
  name: string;
  description: string;
  category: "Cierres & Caja" | "Nómina & Salarios" | "Operación & Checklist" | "Inventarios" | "Seguridad & Accesos";
}

export interface RolePermissionsConfig {
  role: string;
  title: string;
  badgeColor: string;
  description: string;
  permissions: {
    canAuditCierres: boolean;
    canViewAllCierres: boolean;
    canApproveDiscrepancies: boolean;
    canAccessNomina: boolean;
    canLiquidateSalaries: boolean;
    canEditSalariesConfig: boolean;
    canManagePropinas: boolean;
    canManageSecurityUsers: boolean;
    canChangePasswords: boolean;
    canEditInventory: boolean;
    canCompleteChecklist: boolean;
    canViewFinancialMetrics: boolean;
  };
}

export type CanonicalSystemRole =
  | "Gerencia"
  | "Líder operador"
  | "Asistente de Servicio"
  | "Líder de pastelería"
  | "Auxiliar de pastelería";

export function normalizeSystemRole(rawRoleOrCargo?: string): CanonicalSystemRole {
  if (!rawRoleOrCargo) return "Asistente de Servicio";
  const s = rawRoleOrCargo.trim().toLowerCase();
  if (s.includes("geren") || s.includes("admin")) return "Gerencia";
  if (s.includes("lider") || s.includes("líder")) {
    if (s.includes("pastel") || s.includes("cocin")) return "Líder de pastelería";
    return "Líder operador";
  }
  if (s.includes("pastel") || s.includes("cocin")) return "Auxiliar de pastelería";
  return "Asistente de Servicio";
}

const GERENCIA_CONFIG: RolePermissionsConfig = {
  role: "Gerencia",
  title: "Gerente / Administrador General",
  badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  description: "Acceso total y sin restricciones a todos los módulos financieros, nómina confidencial, auditorías y gestión de cuentas.",
  permissions: {
    canAuditCierres: true,
    canViewAllCierres: true,
    canApproveDiscrepancies: true,
    canAccessNomina: true,
    canLiquidateSalaries: true,
    canEditSalariesConfig: true,
    canManagePropinas: true,
    canManageSecurityUsers: true,
    canChangePasswords: true,
    canEditInventory: true,
    canCompleteChecklist: true,
    canViewFinancialMetrics: true,
  }
};

const LIDER_OPERADOR_CONFIG: RolePermissionsConfig = {
  role: "Líder operador",
  title: "Líder de Operación de Tienda",
  badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  description: "Supervisión diaria del punto de venta, arqueo y registro de cierres, control de checklist, e inventario operativo.",
  permissions: {
    canAuditCierres: false, // Solo registra, la gerencia audita
    canViewAllCierres: true,
    canApproveDiscrepancies: false,
    canAccessNomina: false, // Confidencialidad salarial
    canLiquidateSalaries: false,
    canEditSalariesConfig: false,
    canManagePropinas: false,
    canManageSecurityUsers: false,
    canChangePasswords: false,
    canEditInventory: true,
    canCompleteChecklist: true,
    canViewFinancialMetrics: false,
  }
};

const ASISTENTE_SERVICIO_CONFIG: RolePermissionsConfig = {
  role: "Asistente de Servicio",
  title: "Asistente de Servicio & Ventas",
  badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  description: "Atención al cliente, conteo físico del efectivo de caja, ejecución de checklists de apertura y cierre.",
  permissions: {
    canAuditCierres: false,
    canViewAllCierres: false,
    canApproveDiscrepancies: false,
    canAccessNomina: false,
    canLiquidateSalaries: false,
    canEditSalariesConfig: false,
    canManagePropinas: false,
    canManageSecurityUsers: false,
    canChangePasswords: false,
    canEditInventory: false,
    canCompleteChecklist: true,
    canViewFinancialMetrics: false,
  }
};

const LIDER_PASTELERIA_CONFIG: RolePermissionsConfig = {
  role: "Líder de pastelería",
  title: "Líder de Producción & Pastelería",
  badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  description: "Control del área de cocina y pastelería, checklists de calidad, rotación de insumos y mermas.",
  permissions: {
    canAuditCierres: false,
    canViewAllCierres: false,
    canApproveDiscrepancies: false,
    canAccessNomina: false,
    canLiquidateSalaries: false,
    canEditSalariesConfig: false,
    canManagePropinas: false,
    canManageSecurityUsers: false,
    canChangePasswords: false,
    canEditInventory: true,
    canCompleteChecklist: true,
    canViewFinancialMetrics: false,
  }
};

const AUXILIAR_PASTELERIA_CONFIG: RolePermissionsConfig = {
  role: "Auxiliar de pastelería",
  title: "Auxiliar de Cocina / Pastelería",
  badgeColor: "bg-zinc-100 text-zinc-800 border-zinc-300",
  description: "Apoyo en producción y alistamiento, diligenciamiento de checklist operativo de limpieza y temperatura.",
  permissions: {
    canAuditCierres: false,
    canViewAllCierres: false,
    canApproveDiscrepancies: false,
    canAccessNomina: false,
    canLiquidateSalaries: false,
    canEditSalariesConfig: false,
    canManagePropinas: false,
    canManageSecurityUsers: false,
    canChangePasswords: false,
    canEditInventory: false,
    canCompleteChecklist: true,
    canViewFinancialMetrics: false,
  }
};

export const SYSTEM_ROLE_PERMISSIONS: Record<string, RolePermissionsConfig> = {
  // Roles canónicos con acentos y formato visual
  "Gerencia": GERENCIA_CONFIG,
  "Líder operador": LIDER_OPERADOR_CONFIG,
  "Asistente de Servicio": ASISTENTE_SERVICIO_CONFIG,
  "Líder de pastelería": LIDER_PASTELERIA_CONFIG,
  "Auxiliar de pastelería": AUXILIAR_PASTELERIA_CONFIG,

  // Variaciones directas de la base de datos Supabase para máxima compatibilidad
  "Lider Operador": LIDER_OPERADOR_CONFIG,
  "Lider operador": LIDER_OPERADOR_CONFIG,
  "Lider de punto": LIDER_OPERADOR_CONFIG,
  "Líder de punto": LIDER_OPERADOR_CONFIG,
  "Asistente de servicio": ASISTENTE_SERVICIO_CONFIG,
  "Aux de Venta": ASISTENTE_SERVICIO_CONFIG,
  "colaborador": ASISTENTE_SERVICIO_CONFIG,
  "usuario": ASISTENTE_SERVICIO_CONFIG,
  "Lider Pasteleria": LIDER_PASTELERIA_CONFIG,
  "Lider de pasteleria": LIDER_PASTELERIA_CONFIG,
  "Auxiliar Pasteleria": AUXILIAR_PASTELERIA_CONFIG,
  "Auxiliar de pasteleria": AUXILIAR_PASTELERIA_CONFIG,
  "Asistente de pasteleria": AUXILIAR_PASTELERIA_CONFIG,
  "gerente": GERENCIA_CONFIG,
  "administrador": GERENCIA_CONFIG,
  "admin": GERENCIA_CONFIG,
};

export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  targetUser: string;
  executedBy: string;
  description: string;
  status?: "success" | "warning" | "error";
  ip?: string;
  device?: string;
}

export interface CredentialStatus {
  usuario_id: string;
  debe_cambiar: boolean;
  activo: boolean;
  updated_at: string;
}

/**
 * Operaciones de seguridad. Todas pasan por endpoints de Gerencia en el servidor:
 * las contraseñas se guardan con hash y NUNCA vuelven al navegador.
 */
export const securityStore = {
  async fetchCredentials(): Promise<Record<string, CredentialStatus>> {
    const { data } = await api<{ data: CredentialStatus[] }>("/api/admin/credenciales");
    return Object.fromEntries(data.map((c) => [c.usuario_id, c]));
  },

  /** Asigna una clave temporal; el colaborador deberá cambiarla en su próximo ingreso. */
  async setTemporaryPassword(usuarioId: string, password: string): Promise<void> {
    await api(`/api/admin/usuarios/${encodeURIComponent(usuarioId)}/password`, { method: "POST", json: { password } });
  },

  async setUserActive(usuarioId: string, activo: boolean): Promise<void> {
    await api(`/api/admin/usuarios/${encodeURIComponent(usuarioId)}/estado`, { method: "POST", json: { activo } });
  },

  async fetchAuditLogs(): Promise<SecurityAuditEntry[]> {
    const { data } = await api<{ data: SecurityAuditEntry[] }>("/api/admin/audit");
    return data;
  },

  async addAuditLog(entry: { action: string; targetUser?: string; description?: string; status?: string }): Promise<void> {
    await api("/api/admin/audit", { method: "POST", json: entry });
  },

  /** Genera una clave temporal aleatoria de 8 caracteres (sin caracteres ambiguos). */
  generateTemporaryPassword(): string {
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  },
};
