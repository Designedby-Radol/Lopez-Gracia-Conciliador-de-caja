import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Key, 
  Lock, 
  Unlock, 
  UserCheck, 
  UserX, 
  UserPlus, 
  Search, 
  Filter, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  AlertTriangle, 
  HelpCircle, 
  FileSpreadsheet, 
  CheckCircle2, 
  Sliders, 
  ShieldCheck, 
  ShieldAlert, 
  History, 
  Sparkles,
  Edit2,
  Trash2,
  Copy,
  Info,
  Cloud,
  Database,
  Download
} from "lucide-react";
import { UserRole } from "../types";
import { 
  securityStore, 
  SYSTEM_ROLE_PERMISSIONS, 
  RolePermissionsConfig, 
  SecurityAuditEntry,
  normalizeSystemRole,
  CanonicalSystemRole
} from "../utils/securityStore";

interface SecurityAndRolesProps {
  teamMembers: any[];
  currentUsername: string;
  localName: string;
  onUpdateMember: (memberId: string, updates: any) => Promise<void>;
  onDeleteMember: (memberName: string) => Promise<void>;
  onAddMember: (memberData: {
    nombre: string;
    cedula: string;
    password: string;
    role: UserRole;
    activo: boolean;
  }) => Promise<void>;
  onReload: () => Promise<void>;
}

export default function SecurityAndRoles({
  teamMembers,
  currentUsername,
  localName,
  onUpdateMember,
  onDeleteMember,
  onAddMember,
  onReload
}: SecurityAndRolesProps) {
  // Navigation tabs
  const [activeSubTab, setActiveSubTab] = useState<"accounts" | "matrix" | "audit">("accounts");

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Passwords visibility toggle per user ID
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Password edit modal
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<{ id: string; nombre: string; cedula: string } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  // New user modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserCedula, setNewUserCedula] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("tienda");
  const [newUserRole, setNewUserRole] = useState<UserRole>("Asistente de Servicio");
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);

  // Delete confirmation modal
  const [userToDelete, setUserToDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Loading indicator for background operations
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(true);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEntry[]>(() => securityStore.getAuditLogs());
  const [auditFilterAction, setAuditFilterAction] = useState<string>("all");
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>("");

  // Helper to determine if a member is suspended in Supabase
  const isMemberSuspended = (member: any) => {
    const status = securityStore.getUserStatus(member.cedula || member.nombre);
    return status === "suspended" || member.activo === false;
  };

  // Sincronización en tiempo real con Supabase Cloud
  const syncWithSupabase = async () => {
    setIsSyncing(true);
    try {
      await securityStore.fetchSecurityConfigFromSupabase();
      const liveLogs = await securityStore.fetchAuditLogsFromSupabase();
      setAuditLogs(liveLogs);
      setLastSyncTime(new Date());
      setSupabaseConnected(true);
    } catch (err) {
      console.error("Error al sincronizar seguridad con Supabase:", err);
      setSupabaseConnected(false);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncWithSupabase();
  }, []);

  // Filtered members
  const filteredMembers = teamMembers.filter((member) => {
    const nameMatch = (member.nombre || "").toLowerCase().includes(searchQuery.toLowerCase());
    const cedulaMatch = (member.cedula || "").toLowerCase().includes(searchQuery.toLowerCase());
    const memberCanonicalRole = normalizeSystemRole(member.cargo || member.role);
    const roleMatch = roleFilter === "all" || memberCanonicalRole === roleFilter || member.role === roleFilter || member.cargo === roleFilter;
    const suspended = isMemberSuspended(member);
    const statusMatch = 
      statusFilter === "all" ||
      (statusFilter === "active" && !suspended) ||
      (statusFilter === "inactive" && suspended);

    return (nameMatch || cedulaMatch) && roleMatch && statusMatch;
  });

  // Filtered audit logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesAction = auditFilterAction === "all" || log.action === auditFilterAction;
    const query = auditSearchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (log.targetUser || "").toLowerCase().includes(query) ||
      (log.executedBy || "").toLowerCase().includes(query) ||
      (log.description || "").toLowerCase().includes(query) ||
      (log.action || "").toLowerCase().includes(query);
    return matchesAction && matchesSearch;
  });

  const handleExportAuditCsv = () => {
    const headers = ["ID", "Fecha_Hora", "Evento", "Usuario_Afectado", "Ejecutado_Por", "Estado", "Detalle"];
    const rows = filteredAuditLogs.map(l => [
      l.id,
      new Date(l.timestamp).toISOString(),
      l.action,
      `"${(l.targetUser || "").replace(/"/g, '""')}"`,
      `"${(l.executedBy || "").replace(/"/g, '""')}"`,
      l.status || "SUCCESS",
      `"${(l.description || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `auditoria_seguridad_${(localName || "tienda").toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const togglePasswordVisibility = (identifier: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [identifier]: !prev[identifier]
    }));
  };

  const handleOpenPasswordModal = (member: any) => {
    const currentPass = securityStore.getPasswordForUser(member.cedula || member.nombre);
    setSelectedUserForPassword({ id: member.id, nombre: member.nombre, cedula: member.cedula || "" });
    setNewPasswordInput(currentPass);
    setPasswordChangeSuccess(false);
  };

  const handleSaveNewPassword = async () => {
    if (!selectedUserForPassword) return;
    const cleanPass = newPasswordInput.trim();
    if (!cleanPass) {
      alert("Por favor ingresa una contraseña o PIN válido.");
      return;
    }

    setIsProcessing(true);
    try {
      const identifier = selectedUserForPassword.cedula || selectedUserForPassword.nombre;
      await securityStore.setPasswordForUser(identifier, cleanPass, currentUsername);
      await syncWithSupabase();
      setPasswordChangeSuccess(true);
      setTimeout(() => {
        setSelectedUserForPassword(null);
        setPasswordChangeSuccess(false);
      }, 1200);
    } catch (err: any) {
      alert("Error al actualizar la contraseña en Supabase: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateRandomPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setNewPasswordInput(randomPin);
  };

  const handleToggleUserStatus = async (member: any) => {
    const currentlySuspended = isMemberSuspended(member);
    const newStatusStr = currentlySuspended ? "active" : "suspended";
    setIsProcessing(true);
    try {
      const identifier = member.cedula || member.nombre;
      await securityStore.setUserStatus(identifier, newStatusStr, currentUsername, member.nombre);
      await onUpdateMember(member.id, { activo: newStatusStr === "active" });
      await syncWithSupabase();
      await onReload();
    } catch (err: any) {
      alert("Error al cambiar estado del usuario en Supabase: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChangeUserRole = async (member: any, newRole: string) => {
    setIsProcessing(true);
    try {
      await securityStore.updateUserRole(member.id, newRole, newRole, currentUsername, member.nombre);
      await onUpdateMember(member.id, { role: newRole, cargo: newRole });
      await syncWithSupabase();
      await onReload();
    } catch (err: any) {
      alert("Error al cambiar rol del usuario en Supabase: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (userToDelete.nombre.toLowerCase() === currentUsername.toLowerCase()) {
      alert("No puedes eliminar la cuenta con la que has iniciado sesión actualmente.");
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteMember(userToDelete.nombre);
      await securityStore.addAuditLog({
        action: "USER_STATUS_CHANGED",
        targetUser: userToDelete.nombre,
        executedBy: currentUsername,
        description: `Cuenta eliminada de la base de datos de Supabase Cloud.`
      });
      await syncWithSupabase();
      setUserToDelete(null);
      await onReload();
    } catch (err: any) {
      alert("Error al eliminar la cuenta en Supabase: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newUserName.trim();
    const cleanCedula = newUserCedula.trim();

    if (!cleanName) {
      alert("Por favor ingresa el nombre del usuario.");
      return;
    }
    if (!cleanCedula) {
      alert("Por favor ingresa el número de documento / cédula para el inicio de sesión.");
      return;
    }

    if (teamMembers.some((m) => (m.nombre || "").toLowerCase() === cleanName.toLowerCase())) {
      alert("Ya existe un usuario con este nombre.");
      return;
    }

    setIsSubmittingNewUser(true);
    try {
      await onAddMember({
        nombre: cleanName,
        cedula: cleanCedula,
        password: newUserPassword.trim() || "tienda",
        role: newUserRole,
        activo: true
      });

      // Guardar clave y estado en Supabase Cloud
      await securityStore.setPasswordForUser(cleanCedula, newUserPassword.trim() || "tienda", currentUsername);
      await securityStore.setUserStatus(cleanCedula, "active", currentUsername, cleanName);
      await securityStore.addAuditLog({
        action: "USER_CREATED",
        targetUser: cleanName,
        executedBy: currentUsername,
        description: `Nueva cuenta creada con rol "${newUserRole}" y persistida en Supabase Cloud.`
      });

      await syncWithSupabase();

      // Resetear y cerrar
      setNewUserName("");
      setNewUserCedula("");
      setNewUserPassword("tienda");
      setNewUserRole("Asistente de Servicio");
      setIsAddUserModalOpen(false);
      await onReload();
    } catch (err: any) {
      alert("Error al registrar la cuenta en Supabase: " + err.message);
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  // KPI calculations
  const totalAccounts = teamMembers.length;
  const suspendedAccounts = teamMembers.filter((m) => isMemberSuspended(m)).length;
  const activeAccounts = totalAccounts - suspendedAccounts;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border-2 border-brand-ink p-6 shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-brand-ink/10 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="p-2 bg-[#1E3E30] text-white rounded-lg">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-xl font-black text-brand-ink uppercase tracking-tight">
                Seguridad, Accesos & Roles
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                Sede {localName}
              </span>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Cloud className="w-3 h-3 text-emerald-700" />
                <span>Supabase Cloud Activo</span>
              </div>
            </div>
            <p className="text-xs text-zinc-600 font-medium">
              Gestión centralizada de credenciales de acceso, contraseñas de punto de venta, roles de sistema y matriz de segregación de funciones sincronizados en tiempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                await syncWithSupabase();
                await onReload();
              }}
              disabled={isSyncing}
              className="flex items-center space-x-2 px-3 py-2 border-2 border-brand-ink bg-zinc-50 hover:bg-zinc-100 text-brand-ink text-xs font-bold transition-all shadow-[2px_2px_0px_0px_#1C1917] cursor-pointer disabled:opacity-50"
              title="Sincronizar usuarios, contraseñas y auditoría con Supabase Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-600" : ""}`} />
              <span>{isSyncing ? "Sincronizando..." : "Sincronizar Supabase"}</span>
            </button>

            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-[#1E3E30] text-white hover:bg-[#162e24] text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0px_0px_#1C1917] cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-300" />
              <span>+ Nueva Cuenta de Acceso</span>
            </button>
          </div>
        </div>

        {/* Security KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-zinc-50 border border-brand-ink/15 p-3 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Total Cuentas</span>
              <span className="text-lg font-black text-brand-ink">{totalAccounts}</span>
            </div>
            <Key className="w-5 h-5 text-zinc-400" />
          </div>

          <div className="bg-emerald-50/50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Activas & Autorizadas</span>
              <span className="text-lg font-black text-emerald-900">{activeAccounts}</span>
            </div>
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="bg-amber-50/50 border border-amber-200 p-3 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Suspendidas / Inactivas</span>
              <span className="text-lg font-black text-amber-900">{suspendedAccounts}</span>
            </div>
            <UserX className="w-5 h-5 text-amber-600" />
          </div>

          <div className="bg-[#1E3E30]/5 border border-[#1E3E30]/20 p-3 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3E30] block">Tu Sesión Activa</span>
              <span className="text-xs font-black text-[#1E3E30] truncate block max-w-[120px]">{currentUsername}</span>
            </div>
            <Shield className="w-5 h-5 text-[#1E3E30]" />
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex border-b-2 border-brand-ink pt-2 gap-2">
          <button
            onClick={() => setActiveSubTab("accounts")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-t-2 border-x-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === "accounts"
                ? "bg-white border-brand-ink text-brand-ink translate-y-[2px] shadow-none"
                : "bg-zinc-100 border-transparent text-zinc-500 hover:text-brand-ink"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Cuentas & Credenciales ({teamMembers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("matrix")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-t-2 border-x-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === "matrix"
                ? "bg-white border-brand-ink text-brand-ink translate-y-[2px] shadow-none"
                : "bg-zinc-100 border-transparent text-zinc-500 hover:text-brand-ink"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Matriz de Permisos por Rol</span>
          </button>

          <button
            onClick={() => setActiveSubTab("audit")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-t-2 border-x-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === "audit"
                ? "bg-white border-brand-ink text-brand-ink translate-y-[2px] shadow-none"
                : "bg-zinc-100 border-transparent text-zinc-500 hover:text-brand-ink"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Auditoría de Seguridad ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Subtab 1: Cuentas y Credenciales */}
      {activeSubTab === "accounts" && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-white border-2 border-brand-ink p-4 shadow-[3px_3px_0px_0px_#1C1917] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o cédula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-brand-ink pl-9 pr-3 py-1.5 text-xs font-bold text-brand-ink outline-none focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center space-x-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] font-black uppercase text-zinc-500">Rol:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-zinc-50 border border-brand-ink px-2 py-1 text-xs font-bold text-brand-ink outline-none cursor-pointer"
                >
                  <option value="all">Todos los roles</option>
                  <option value="Gerencia">Gerencia</option>
                  <option value="Líder operador">Líder operador</option>
                  <option value="Asistente de Servicio">Asistente de Servicio</option>
                  <option value="Líder de pastelería">Líder de pastelería</option>
                  <option value="Auxiliar de pastelería">Auxiliar de pastelería</option>
                </select>
              </div>

              <div className="flex items-center space-x-1 text-xs">
                <span className="text-[10px] font-black uppercase text-zinc-500">Estado:</span>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-zinc-50 border border-brand-ink px-2 py-1 text-xs font-bold text-brand-ink outline-none cursor-pointer"
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Suspendidos</option>
                </select>
              </div>
            </div>
          </div>

          {/* Accounts List Table */}
          <div className="bg-white border-2 border-brand-ink shadow-[4px_4px_0px_0px_#1C1917] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1E3E30] text-white border-b-2 border-brand-ink text-[10px] font-black uppercase tracking-wider">
                    <th className="py-3 px-4">Usuario / Colaborador</th>
                    <th className="py-3 px-3">Cédula (Login ID)</th>
                    <th className="py-3 px-3">Rol de Sistema</th>
                    <th className="py-3 px-3">Credencial / Contraseña</th>
                    <th className="py-3 px-3 text-center">Estado Acceso</th>
                    <th className="py-3 px-4 text-right">Acciones de Seguridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-ink/10 text-xs">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 font-bold">
                        No se encontraron cuentas que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const userRole = normalizeSystemRole(member.cargo || member.role);
                      const roleConfig = SYSTEM_ROLE_PERMISSIONS[userRole] || SYSTEM_ROLE_PERMISSIONS["Asistente de Servicio"];
                      const userPass = securityStore.getPasswordForUser(member.cedula || member.nombre);
                      const isPassVisible = !!visiblePasswords[member.id];
                      const isSuspended = isMemberSuspended(member);

                      return (
                        <tr 
                          key={member.id || member.nombre}
                          className={`hover:bg-zinc-50/80 transition-colors ${
                            isSuspended ? "bg-zinc-100/50 opacity-75" : ""
                          }`}
                        >
                          {/* Usuario */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-[#1E3E30] text-white font-black text-xs flex items-center justify-center border border-brand-ink shadow-xs">
                                {member.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-black text-brand-ink block text-xs">
                                  {member.nombre}
                                </span>
                                <span className="text-[10px] font-semibold text-zinc-500">
                                  {member.local || localName}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Cédula */}
                          <td className="py-3 px-3 font-mono font-bold text-zinc-700">
                            {member.cedula ? (
                              <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                                {member.cedula}
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">No asignada</span>
                            )}
                          </td>

                          {/* Rol Selector */}
                          <td className="py-3 px-3">
                            <select
                              value={userRole}
                              onChange={(e) => handleChangeUserRole(member, e.target.value)}
                              className="bg-white border-2 border-brand-ink px-2 py-1 text-xs font-black text-brand-ink outline-none cursor-pointer hover:bg-zinc-50"
                            >
                              <option value="Gerencia">Gerencia (Administrador)</option>
                              <option value="Líder operador">Líder operador</option>
                              <option value="Asistente de Servicio">Asistente de Servicio</option>
                              <option value="Líder de pastelería">Líder de pastelería</option>
                              <option value="Auxiliar de pastelería">Auxiliar de pastelería</option>
                            </select>
                            <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded mt-1 border ${roleConfig.badgeColor}`}>
                              {roleConfig.title}
                            </span>
                          </td>

                          {/* Contraseña / Credencial */}
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <div className="bg-zinc-50 border border-brand-ink/20 px-2.5 py-1 rounded font-mono font-bold text-xs tracking-wider text-brand-ink flex items-center space-x-1.5 min-w-[90px]">
                                <Lock className="w-3 h-3 text-zinc-400" />
                                <span>{isPassVisible ? userPass : "••••••••"}</span>
                              </div>
                              <button
                                onClick={() => togglePasswordVisibility(member.id)}
                                className="p-1 text-zinc-400 hover:text-brand-ink transition-colors cursor-pointer"
                                title={isPassVisible ? "Ocultar" : "Mostrar"}
                              >
                                {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>

                          {/* Estado Switch */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleToggleUserStatus(member)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer inline-flex items-center space-x-1 ${
                                !isSuspended
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                                  : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                              }`}
                              title={!isSuspended ? "Clic para suspender acceso" : "Clic para activar acceso"}
                            >
                              {!isSuspended ? (
                                <>
                                  <UserCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Activo</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3 h-3 text-red-600" />
                                  <span>Suspendido</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleOpenPasswordModal(member)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors shadow-xs"
                                title="Cambiar o resetear contraseña de acceso"
                              >
                                <Key className="w-3 h-3 text-amber-700" />
                                <span>Resetear Clave</span>
                              </button>

                              <button
                                onClick={() => setUserToDelete({ id: member.id, nombre: member.nombre })}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="Eliminar cuenta de acceso"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Matriz de Permisos por Rol */}
      {activeSubTab === "matrix" && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-brand-ink p-6 shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
            <div className="border-b border-brand-ink/10 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-brand-ink flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-brand-ink" />
                <span>Matriz de Segregación de Funciones & Permisos por Rol</span>
              </h2>
              <p className="text-xs text-zinc-600 font-medium mt-1">
                Alineado a las políticas de control interno de López & Gracia: la gerencia audita y liquida nómina; los líderes operan la tienda; los asistentes registran caja y ejecutan checklists.
              </p>
            </div>

            {/* Matrix Table */}
            <div className="border-2 border-brand-ink overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#1E3E30] text-white border-b-2 border-brand-ink text-[10px] font-black uppercase tracking-wider">
                    <th className="py-3 px-4 w-1/3">Módulo y Acción del Sistema</th>
                    <th className="py-3 px-2 text-center bg-[#162e24]">Gerencia</th>
                    <th className="py-3 px-2 text-center">Líder Operador</th>
                    <th className="py-3 px-2 text-center">Asistente Servicio</th>
                    <th className="py-3 px-2 text-center">Líder Pastelería</th>
                    <th className="py-3 px-2 text-center">Aux. Pastelería</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-ink/10 font-medium">
                  {/* Category: Cierres y Auditoría */}
                  <tr className="bg-zinc-100 font-black text-[10px] uppercase tracking-wider text-zinc-600">
                    <td colSpan={6} className="py-2 px-4">
                      Módulo 1: Cierres de Caja & Auditoría Financiera
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-bold block text-brand-ink">Auditar y Cuadrar Cierres de Caja</span>
                      <span className="text-[10px] text-zinc-500">Conciliación con POS y asignación de descuadres</span>
                    </td>
                    <td className="text-center py-2 px-2 bg-emerald-50/50"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-bold block text-brand-ink">Registrar Arqueo Físico de Caja</span>
                      <span className="text-[10px] text-zinc-500">Conteo de efectivo, datáfono, transferencias y propinas</span>
                    </td>
                    <td className="text-center py-2 px-2 bg-emerald-50/50"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                  </tr>

                  {/* Category: Nómina y Salarios */}
                  <tr className="bg-zinc-100 font-black text-[10px] uppercase tracking-wider text-zinc-600">
                    <td colSpan={6} className="py-2 px-4">
                      Módulo 2: Nómina, Salarios & Propinas (Confidencial)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-bold block text-brand-ink">Ver Salarios & Liquidar Nómina Quincenal</span>
                      <span className="text-[10px] text-zinc-500">Cálculo de turnos, horas extra, recargos y tirillas PDF</span>
                    </td>
                    <td className="text-center py-2 px-2 bg-emerald-50/50"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-bold block text-brand-ink">Liquidación y Parámetros de Propinas</span>
                      <span className="text-[10px] text-zinc-500">Reparto por puntos y políticas de elegibilidad</span>
                    </td>
                    <td className="text-center py-2 px-2 bg-emerald-50/50"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                  </tr>

                  {/* Category: Operación y Checklists */}
                  <tr className="bg-zinc-100 font-black text-[10px] uppercase tracking-wider text-zinc-600">
                    <td colSpan={6} className="py-2 px-4">
                      Módulo 3: Operación de Tienda & Checklists
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-bold block text-brand-ink">Completar Checklist de Apertura / Cierre</span>
                      <span className="text-[10px] text-zinc-500">Supervisión diaria de limpieza, temperatura y caja</span>
                    </td>
                    <td className="text-center py-2 px-2 bg-emerald-50/50"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-bold block text-brand-ink">Inventario de Mercancía & Producción</span>
                      <span className="text-[10px] text-zinc-500">Conteo físico de existencias y registro de mermas</span>
                    </td>
                    <td className="text-center py-2 px-2 bg-emerald-50/50"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                  </tr>

                  {/* Category: Seguridad y Accesos */}
                  <tr className="bg-zinc-100 font-black text-[10px] uppercase tracking-wider text-zinc-600">
                    <td colSpan={6} className="py-2 px-4">
                      Módulo 4: Seguridad, Cuentas & Permisos
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-bold block text-brand-ink">Administrar Cuentas, Contraseñas y Roles</span>
                      <span className="text-[10px] text-zinc-500">Crear usuarios, resetear contraseñas y revocar accesos</span>
                    </td>
                    <td className="text-center py-2 px-2 bg-emerald-50/50"><Check className="w-4 h-4 text-emerald-700 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                    <td className="text-center py-2 px-2"><X className="w-4 h-4 text-zinc-300 mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start space-x-3 text-xs">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-amber-900">
                <span className="font-black uppercase tracking-wider block">Principio de Mínimo Privilegio (PoLP):</span>
                <p className="leading-relaxed">
                  Para proteger la integridad financiera y la privacidad salarial (Ley 1581 de 2012), los colaboradores operativos y líderes solo acceden a las funciones operativas de su turno. Toda modificación salarial, auditoría de descuadres y administración de contraseñas está reservada exclusivamente para Gerencia.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 3: Políticas de Seguridad & Auditoría */}
      {activeSubTab === "audit" && (
        <div className="space-y-6">
          {/* Security Policies Info */}
          <div className="bg-white border-2 border-brand-ink p-6 shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
            <div className="border-b border-brand-ink/10 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-brand-ink flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Políticas de Seguridad Activas en el Punto de Venta</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-zinc-50 border border-brand-ink/15 p-4 rounded-lg space-y-2">
                <span className="font-black uppercase tracking-wider text-brand-ink block">1. Cifrado & Conexión Segura</span>
                <p className="text-zinc-600 leading-relaxed text-[11px]">
                  Las credenciales y tokens se transmiten a través de túneles TLS seguros hacia Supabase Postgres, implementando políticas de Row Level Security (RLS).
                </p>
              </div>

              <div className="bg-zinc-50 border border-brand-ink/15 p-4 rounded-lg space-y-2">
                <span className="font-black uppercase tracking-wider text-brand-ink block">2. Protección de Nómina (Habeas Data)</span>
                <p className="text-zinc-600 leading-relaxed text-[11px]">
                  Los salarios base, bonificaciones y deducciones están aislados de la vista pública del personal de tienda, cumpliendo la Ley 1581 de Protección de Datos Personales.
                </p>
              </div>

              <div className="bg-zinc-50 border border-brand-ink/15 p-4 rounded-lg space-y-2">
                <span className="font-black uppercase tracking-wider text-brand-ink block">3. Trazabilidad de Auditoría</span>
                <p className="text-zinc-600 leading-relaxed text-[11px]">
                  Cada cambio de contraseña, modificación de rol o ajuste de permisos queda sellado en el registro histórico con el autor y la estampa de tiempo correspondiente.
                </p>
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white border-2 border-brand-ink p-6 shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-brand-ink/10 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-brand-ink flex items-center space-x-2">
                  <History className="w-4 h-4 text-brand-ink" />
                  <span>Registro Histórico de Auditoría de Seguridad</span>
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                  Registrado y respaldado en Supabase Cloud. {filteredAuditLogs.length} eventos visibles de {auditLogs.length} totales.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportAuditCsv}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-brand-ink text-brand-ink text-xs font-bold rounded flex items-center space-x-1.5 cursor-pointer transition-colors shadow-xs"
                  title="Descargar registro de auditoría en formato CSV"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Exportar CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => syncWithSupabase()}
                  disabled={isSyncing}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded flex items-center space-x-1.5 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                  title="Recargar eventos recientes desde Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>Actualizar Logs</span>
                </button>
              </div>
            </div>

            {/* Audit Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50 p-3 rounded-lg border border-brand-ink/10">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar en logs (usuario, autor, detalle)..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="w-full bg-white border border-brand-ink/30 pl-9 pr-3 py-1.5 text-xs font-bold text-brand-ink outline-none focus:border-brand-ink rounded"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] font-black uppercase text-zinc-500">Tipo Evento:</span>
                <select
                  value={auditFilterAction}
                  onChange={(e) => setAuditFilterAction(e.target.value)}
                  className="bg-white border border-brand-ink/30 px-2 py-1 text-xs font-bold text-brand-ink outline-none cursor-pointer rounded"
                >
                  <option value="all">Todos los eventos</option>
                  <option value="PASSWORD_CHANGED">Cambios de Contraseña</option>
                  <option value="ROLE_UPDATED">Cambios de Rol</option>
                  <option value="USER_STATUS_CHANGED">Estados de Cuenta</option>
                  <option value="USER_CREATED">Usuarios Creados</option>
                  <option value="LOGIN_SUCCESS">Inicios de Sesión Exitosos</option>
                  <option value="LOGIN_FAILED">Intentos de Acceso Fallidos</option>
                </select>
              </div>
            </div>

            <div className="border-2 border-brand-ink overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#1E3E30] text-white border-b-2 border-brand-ink text-[10px] font-black uppercase tracking-wider">
                    <th className="py-2.5 px-3">Fecha / Hora</th>
                    <th className="py-2.5 px-3">Evento</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Usuario Afectado</th>
                    <th className="py-2.5 px-3">Ejecutado Por</th>
                    <th className="py-2.5 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-ink/10">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 font-bold">
                        No se encontraron registros de auditoría para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => {
                      const isError = log.status === "FAILURE" || log.action === "LOGIN_FAILED";
                      const isWarning = log.action === "PASSWORD_CHANGED" || log.action === "USER_STATUS_CHANGED";

                      return (
                        <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-600 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString("es-CO")}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-300">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                              isError
                                ? "bg-red-100 text-red-800 border-red-300"
                                : isWarning
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300"
                            }`}>
                              {log.status || (isError ? "FAILURE" : "SUCCESS")}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-brand-ink whitespace-nowrap">
                            {log.targetUser}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-zinc-700 whitespace-nowrap">
                            {log.executedBy}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 text-[11px] leading-snug">
                            {log.description}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cambiar Contraseña / Resetear PIN */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 md:left-64 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-6 md:p-8 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-2 border-brand-ink w-full max-w-md shadow-[6px_6px_0px_0px_#1C1917] p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-brand-ink/10 pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-brand-ink">
                  Resetear Contraseña de Acceso
                </h3>
              </div>
              <button
                onClick={() => setSelectedUserForPassword(null)}
                className="text-zinc-400 hover:text-brand-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-zinc-50 p-3 rounded-lg border border-brand-ink/10 space-y-1 text-xs">
              <span className="text-zinc-500 font-bold block text-[10px] uppercase">Usuario:</span>
              <span className="font-black text-brand-ink block text-sm">{selectedUserForPassword.nombre}</span>
              <span className="font-mono text-zinc-600 text-xs">C.C. {selectedUserForPassword.cedula || "No asignada"}</span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-brand-ink block">
                Nueva Contraseña / PIN de Inicio de Sesión:
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full bg-white border-2 border-brand-ink px-3 py-2 text-sm font-mono font-bold text-brand-ink outline-none pr-10"
                  placeholder="Ej. tienda o 123456"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-brand-ink cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleGenerateRandomPin}
                  className="text-[11px] font-bold text-blue-700 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generar PIN aleatorio (6 dígitos)</span>
                </button>
                <span className="text-[10px] font-mono text-zinc-400">Min. 4 caracteres</span>
              </div>
            </div>

            {passwordChangeSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-lg flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>¡Contraseña actualizada con éxito en el sistema!</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-brand-ink/10">
              <button
                type="button"
                onClick={() => setSelectedUserForPassword(null)}
                className="px-4 py-2 border-2 border-brand-ink bg-zinc-100 hover:bg-zinc-200 text-brand-ink text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNewPassword}
                disabled={isProcessing}
                className="px-5 py-2 bg-[#1E3E30] hover:bg-[#162e24] text-white text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-[2px_2px_0px_0px_#1C1917]"
              >
                {isProcessing ? "Guardando..." : "Guardar Contraseña"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nueva Cuenta de Acceso */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 md:left-64 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-6 md:p-8 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-2 border-brand-ink w-full max-w-lg shadow-[6px_6px_0px_0px_#1C1917] p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-brand-ink/10 pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm font-black uppercase tracking-wider text-brand-ink">
                  Registrar Nueva Cuenta de Acceso
                </h3>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-zinc-400 hover:text-brand-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-ink block">
                  Nombre Completo del Colaborador
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sofía Ramírez"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-white border-2 border-brand-ink px-3 py-2 text-xs font-bold text-brand-ink outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-brand-ink block">
                    Cédula (Login ID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 1020730746"
                    value={newUserCedula}
                    onChange={(e) => setNewUserCedula(e.target.value)}
                    className="w-full bg-white border-2 border-brand-ink px-3 py-2 text-xs font-mono font-bold text-brand-ink outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-brand-ink block">
                    Contraseña Inicial
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. tienda"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-white border-2 border-brand-ink px-3 py-2 text-xs font-mono font-bold text-brand-ink outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-ink block">
                  Rol de Sistema & Nivel de Permisos
                </label>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  className="w-full bg-white border-2 border-brand-ink px-3 py-2 text-xs font-bold text-brand-ink outline-none cursor-pointer"
                >
                  <option value="Gerencia">Gerencia (Administrador - Acceso Total)</option>
                  <option value="Líder operador">Líder operador (Caja, Checklists, Inventario)</option>
                  <option value="Asistente de Servicio">Asistente de Servicio (Arqueo Caja, Checklists)</option>
                  <option value="Líder de pastelería">Líder de pastelería (Cocina & Checklists)</option>
                  <option value="Auxiliar de pastelería">Auxiliar de pastelería (Producción)</option>
                </select>
              </div>

              <div className="bg-zinc-50 border border-brand-ink/10 p-3 rounded text-[11px] text-zinc-600 space-y-1">
                <span className="font-bold text-brand-ink uppercase text-[10px] block">Detalles de la Creación:</span>
                <p>
                  Esta cuenta quedará inmediatamente habilitada para iniciar sesión con su número de cédula y la contraseña configurada. Además, creará su ficha laboral sincronizada en el módulo de Perfiles & Nómina.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-brand-ink/10">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 border-2 border-brand-ink bg-zinc-100 hover:bg-zinc-200 text-brand-ink text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewUser}
                  className="px-5 py-2 bg-[#1E3E30] hover:bg-[#162e24] text-white text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-[2px_2px_0px_0px_#1C1917]"
                >
                  {isSubmittingNewUser ? "Creando Cuenta..." : "Registrar Cuenta de Acceso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Eliminación */}
      {userToDelete && (
        <div className="fixed inset-0 md:left-64 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-6 md:p-8 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-2 border-brand-ink w-full max-w-sm shadow-[6px_6px_0px_0px_#1C1917] p-6 space-y-4 my-auto">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black uppercase tracking-wider text-brand-ink">
                ¿Eliminar Cuenta de Acceso?
              </h3>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              ¿Estás seguro de que deseas eliminar la cuenta de acceso de <strong className="text-brand-ink">{userToDelete.nombre}</strong>? Esta persona ya no podrá iniciar sesión en el sistema.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-brand-ink/10">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 border-2 border-brand-ink bg-zinc-100 hover:bg-zinc-200 text-brand-ink text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-[2px_2px_0px_0px_#1C1917]"
              >
                {isDeleting ? "Eliminando..." : "Eliminar Cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
