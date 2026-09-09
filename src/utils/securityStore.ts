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

export const SYSTEM_ROLE_PERMISSIONS: Record<string, RolePermissionsConfig> = {
  "Gerencia": {
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
  },
  "Líder operador": {
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
  },
  "Asistente de Servicio": {
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
  },
  "Líder de pastelería": {
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
  },
  "Auxiliar de pastelería": {
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
  }
};

export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  action: "PASSWORD_CHANGED" | "ROLE_UPDATED" | "USER_CREATED" | "USER_STATUS_CHANGED" | "SECURITY_POLICY_UPDATED" | "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGIN_BLOCKED_SUSPENDED";
  targetUser: string;
  executedBy: string;
  description: string;
  status?: "success" | "warning" | "error";
  ip?: string;
  device?: string;
}

const PASSWORDS_STORAGE_KEY = "lopez_gracia_user_passwords_v1";
const STATUSES_STORAGE_KEY = "lopez_gracia_user_statuses_v1";
const AUDIT_STORAGE_KEY = "lopez_gracia_security_audit_v1";

export const securityStore = {
  // Obtener la contraseña registrada o por defecto (síncrono)
  getPasswordForUser(identifier: string): string {
    try {
      const clean = identifier.trim().toLowerCase();
      const stored = localStorage.getItem(PASSWORDS_STORAGE_KEY);
      if (stored) {
        const map = JSON.parse(stored);
        if (map[clean]) return map[clean];
      }
    } catch (e) {
      console.error("Error reading password from storage:", e);
    }
    // Claves por defecto conocidas
    if (identifier.toLowerCase().includes("admin") || identifier.toLowerCase().includes("raulsantiago")) {
      return "admin123";
    }
    return "tienda";
  },

  // Obtener estado de acceso de la cuenta (activo o suspendido)
  getUserStatus(identifier: string): "active" | "suspended" {
    try {
      const clean = identifier.trim().toLowerCase();
      const stored = localStorage.getItem(STATUSES_STORAGE_KEY);
      if (stored) {
        const map = JSON.parse(stored);
        if (map[clean]) return map[clean];
      }
    } catch (e) {
      console.error("Error reading status from storage:", e);
    }
    return "active";
  },

  // Obtener logs de auditoría de seguridad en caché (síncrono)
  getAuditLogs(): SecurityAuditEntry[] {
    try {
      const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading audit logs:", e);
    }
    return [];
  },

  // Cargar configuración de seguridad (passwords y estados) desde Supabase
  async fetchSecurityConfigFromSupabase(): Promise<{ passwords: Record<string, string>; statuses: Record<string, "active" | "suspended"> }> {
    try {
      const res = await fetch("/api/db/security-config");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const { passwords = {}, statuses = {} } = json.data;
          
          // Actualizar caché local
          const currentPassStored = localStorage.getItem(PASSWORDS_STORAGE_KEY);
          const currentPassMap = currentPassStored ? JSON.parse(currentPassStored) : {};
          localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify({ ...currentPassMap, ...passwords }));

          const currentStatStored = localStorage.getItem(STATUSES_STORAGE_KEY);
          const currentStatMap = currentStatStored ? JSON.parse(currentStatStored) : {};
          localStorage.setItem(STATUSES_STORAGE_KEY, JSON.stringify({ ...currentStatMap, ...statuses }));

          return { passwords, statuses };
        }
      }
    } catch (err) {
      console.warn("No se pudo cargar la configuración de seguridad de Supabase:", err);
    }
    return { passwords: {}, statuses: {} };
  },

  // Guardar nueva contraseña o PIN sincronizando con Supabase
  async setPasswordForUser(identifier: string, newPass: string, executedBy: string = "Gerencia"): Promise<void> {
    const clean = identifier.trim().toLowerCase();
    
    // Actualizar caché local
    try {
      const stored = localStorage.getItem(PASSWORDS_STORAGE_KEY);
      const map = stored ? JSON.parse(stored) : {};
      map[clean] = newPass;
      localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error("Error saving password to local storage:", e);
    }

    // Persistir en Supabase Cloud
    try {
      await fetch("/api/db/security-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passwords: { [clean]: newPass }
        })
      });
    } catch (err) {
      console.warn("Error enviando contraseña a Supabase:", err);
    }

    // Registrar en auditoría de Supabase
    await this.addAuditLog({
      action: "PASSWORD_CHANGED",
      targetUser: identifier,
      executedBy,
      description: `Clave o PIN de acceso actualizado y sincronizado en Supabase Cloud.`
    });
  },

  // Actualizar estado de cuenta (Activar / Suspender) sincronizando con Supabase
  async setUserStatus(identifier: string, status: "active" | "suspended", executedBy: string = "Gerencia", memberName?: string): Promise<void> {
    const clean = identifier.trim().toLowerCase();

    // Actualizar caché local
    try {
      const stored = localStorage.getItem(STATUSES_STORAGE_KEY);
      const map = stored ? JSON.parse(stored) : {};
      map[clean] = status;
      if (memberName) map[memberName.trim().toLowerCase()] = status;
      localStorage.setItem(STATUSES_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error("Error saving status to local storage:", e);
    }

    // Persistir en Supabase Cloud
    try {
      const statusesPayload: Record<string, string> = { [clean]: status };
      if (memberName) statusesPayload[memberName.trim().toLowerCase()] = status;

      await fetch("/api/db/security-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statuses: statusesPayload
        })
      });
    } catch (err) {
      console.warn("Error enviando estado de cuenta a Supabase:", err);
    }

    // Registrar evento en auditoría de Supabase
    await this.addAuditLog({
      action: "USER_STATUS_CHANGED",
      targetUser: memberName || identifier,
      executedBy,
      description: `Estado de cuenta modificado a ${status === "active" ? "ACTIVO" : "SUSPENDIDO"} en Supabase Cloud.`
    });
  },

  // Actualizar rol y cargo de usuario directamente en Supabase
  async updateUserRole(userId: string, role: string, cargo: string, executedBy: string = "Gerencia", memberName: string): Promise<void> {
    try {
      const res = await fetch(`/api/db/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, cargo })
      });
      if (!res.ok) {
        throw new Error("No se pudo actualizar el rol en Supabase");
      }
    } catch (err) {
      console.error("Error actualizando rol en Supabase:", err);
      throw err;
    }

    // Registrar auditoría en Supabase
    await this.addAuditLog({
      action: "ROLE_UPDATED",
      targetUser: memberName,
      executedBy,
      description: `Rol de sistema actualizado a "${role}" (Cargo: ${cargo}) en la base de datos de Supabase.`
    });
  },

  // Cargar logs de auditoría en vivo desde Supabase
  async fetchAuditLogsFromSupabase(): Promise<SecurityAuditEntry[]> {
    try {
      const res = await fetch("/api/db/security-audit");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(json.data));
          return json.data;
        }
      }
    } catch (err) {
      console.warn("No se pudieron cargar logs de Supabase, usando caché:", err);
    }
    return this.getAuditLogs();
  },

  // Registrar un evento de seguridad en Supabase y caché local
  async addAuditLog(entry: Omit<SecurityAuditEntry, "id" | "timestamp">): Promise<void> {
    const newEntry: SecurityAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      status: entry.status || "success",
      ...entry
    };

    // Actualizar caché local
    try {
      const current = this.getAuditLogs();
      const updated = [newEntry, ...current].slice(0, 100);
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving audit log locally:", e);
    }

    // Persistir en Supabase
    try {
      await fetch("/api/db/security-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      });
    } catch (e) {
      console.error("Error saving audit log to Supabase:", e);
    }
  }
};
