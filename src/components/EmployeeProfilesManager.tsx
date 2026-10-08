import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Calendar,
  Clock,
  Shield,
  DollarSign,
  Gift,
  AlertTriangle,
  FileText,
  Printer,
  Send,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  Briefcase,
  HeartPulse,
  Building2,
  Phone,
  Mail,
  MapPin,
  Award,
  FileCheck,
  ChevronRight,
  X,
  ExternalLink,
  Sliders
} from "lucide-react";
import { 
  EmployeeSalaryConfig, 
  EmployeeHRProfile, 
  DisciplinarySanction, 
  EmployeeBonusRecord, 
  VacationPeriod,
  DailySchedule 
} from "../types";
import { 
  hrStore, 
  calculateTotalWeeklyHours, 
  calculateEffectiveHours, 
  calculateVacationDaysAccrued,
  getDefaultSchedule 
} from "../utils/hrStore";
import { dbAdapter } from "../db/dbAdapter";
import { ROLE_POINTS_MAP, getRolePoints } from "../data/turnosDefaults";
import { todayBogota } from "../lib/dates";

interface EmployeeProfilesManagerProps {
  teamMembers: any[];
  currentUsername: string;
  localName: string;
  onNavigateTab: (tab: string) => void;
  onRefreshTeamMembers: () => Promise<void>;
}

export const EmployeeProfilesManager: React.FC<EmployeeProfilesManagerProps> = ({
  teamMembers,
  currentUsername,
  localName,
  onNavigateTab,
  onRefreshTeamMembers
}) => {
  const smmlvBase = Number(localStorage.getItem("lopez_gracia_smmlv_base")) || 1750905;
  const auxTranspBase = Number(localStorage.getItem("lopez_gracia_aux_transp_base")) || 249095;

  // Estados principales
  const [hrConfigs, setHrConfigs] = useState<Record<string, EmployeeSalaryConfig>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(true);

  // Control de visibilidad del mensaje de advertencia (Seguridad vs. RRHH)
  const [showWarningBanner, setShowWarningBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem("lg_dismiss_hr_warning_banner") !== "true";
    } catch {
      return true;
    }
  });

  const handleDismissWarningBanner = () => {
    setShowWarningBanner(false);
    try {
      localStorage.setItem("lg_dismiss_hr_warning_banner", "true");
    } catch {
      // ignore
    }
  };

  const handleOpenWarningBanner = () => {
    setShowWarningBanner(true);
    try {
      localStorage.removeItem("lg_dismiss_hr_warning_banner");
    } catch {
      // ignore
    }
  };

  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<"TODOS" | "Ventas" | "Pastelería">("TODOS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "Activos" | "Inactivos">("TODOS");

  // Modal de Ficha Integral del Colaborador
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [activeHrTab, setActiveHrTab] = useState<
    "contract" | "schedule" | "bonuses" | "sanctions" | "vacations" | "reports"
  >("contract");

  // Modal para agregar nuevo empleado
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberCedula, setNewMemberCedula] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Asistente de Servicio");
  const [newMemberArea, setNewMemberArea] = useState<"Ventas" | "Pastelería">("Ventas");
  const [newMemberSalario, setNewMemberSalario] = useState<number>(smmlvBase);
  const [newMemberTipoContrato, setNewMemberTipoContrato] = useState<"Indefinido" | "Por días" | "Término Fijo" | "Obra o Labor">("Indefinido");
  const [newMemberFechaIngreso, setNewMemberFechaIngreso] = useState<string>(todayBogota());
  const [newMemberTelefono, setNewMemberTelefono] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  // Sub-formularios dentro de la Ficha
  // 1. Agregar Bonificación
  const [isAddingBonus, setIsAddingBonus] = useState(false);
  const [newBonusConcept, setNewBonusConcept] = useState("");
  const [newBonusAmount, setNewBonusAmount] = useState<number>(50000);
  const [newBonusType, setNewBonusType] = useState<"No Salarial" | "Salarial">("No Salarial");
  const [newBonusPayment, setNewBonusPayment] = useState<"Por Quincena (50%)" | "Mensual Recurrente" | "Única Vez">("Por Quincena (50%)");
  const [newBonusReason, setNewBonusReason] = useState("");

  // 2. Agregar Sanción Disciplinaria / Llamado de Atención
  const [isAddingSanction, setIsAddingSanction] = useState(false);
  const [newSanctionType, setNewSanctionType] = useState<"Llamado de Atención Verbal" | "Memorando Escrito" | "Suspensión Disciplinaria" | "Acta de Descargos">("Memorando Escrito");
  const [newSanctionSeverity, setNewSanctionSeverity] = useState<"Leve" | "Moderada" | "Grave">("Moderada");
  const [newSanctionReason, setNewSanctionReason] = useState("");
  const [newSanctionDescription, setNewSanctionDescription] = useState("");
  const [newSanctionCommitment, setNewSanctionCommitment] = useState("");
  const [newSanctionDays, setNewSanctionDays] = useState<number>(1);

  // 3. Registrar Vacaciones / Permiso / Incapacidad
  const [isAddingVacation, setIsAddingVacation] = useState(false);
  const [newVacationType, setNewVacationType] = useState<"Vacaciones Disfrutadas" | "Vacaciones Compensadas en Dinero" | "Permiso Remunerado" | "Permiso No Remunerado" | "Incapacidad Médica (EPS)" | "Licencia Legal">("Vacaciones Disfrutadas");
  const [newVacationStart, setNewVacationStart] = useState(todayBogota());
  const [newVacationEnd, setNewVacationEnd] = useState(todayBogota());
  const [newVacationDays, setNewVacationDays] = useState<number>(15);
  const [newVacationPeriod, setNewVacationPeriod] = useState("2025 - 2026");
  const [newVacationNotes, setNewVacationNotes] = useState("");

  // 4. Centro de Reportes del Empleado
  const [selectedReportType, setSelectedReportType] = useState<
    "ficha_360" | "certificado_laboral" | "horario_semanal" | "memorando_reciente" | "resumen_bonos"
  >("ficha_360");
  const [reportCopied, setReportCopied] = useState(false);

  // Carga y sincronización inicial con Supabase
  const syncWithSupabase = async () => {
    setIsSyncing(true);
    try {
      const data = await hrStore.fetchHrConfigFromSupabase();
      setHrConfigs({ ...data });
      setLastSyncTime(new Date());
      setSupabaseConnected(true);
    } catch (err) {
      console.error("Error sincronizando RRHH con Supabase:", err);
      setSupabaseConnected(false);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncWithSupabase();
  }, []);

  // Obtener la configuración activa del empleado actual
  const getEmployeeData = (member: any): EmployeeSalaryConfig => {
    return hrConfigs[member?.nombre] || hrStore.getEmployeeConfig(member);
  };

  // Guardar cambios en la configuración de un empleado
  const handleSaveEmployeeUpdates = async (employeeName: string, updates: Partial<EmployeeSalaryConfig>) => {
    try {
      const updated = await hrStore.updateEmployeeConfig(employeeName, updates);
      setHrConfigs(prev => ({
        ...prev,
        [employeeName]: updated
      }));
    } catch (err) {
      console.error("Error al actualizar configuración laboral:", err);
    }
  };

  // Filtrado de colaboradores
  const filteredMembers = teamMembers.filter(member => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = !q || (member.nombre || "").toLowerCase().includes(q) || (member.cedula || "").includes(q);
    const cfg = getEmployeeData(member);
    const areaMatch = areaFilter === "TODOS" || cfg.area === areaFilter;
    const statusMatch = statusFilter === "TODOS" || 
      (statusFilter === "Activos" && member.activo !== false) || 
      (statusFilter === "Inactivos" && member.activo === false);
    return nameMatch && areaMatch && statusMatch;
  });

  // KPIs agregados
  const totalEmployees = teamMembers.length;
  const activeEmployees = teamMembers.filter(m => m.activo !== false).length;
  const employeesInRegulation42h = teamMembers.filter(m => {
    const cfg = getEmployeeData(m);
    const hours = calculateTotalWeeklyHours(cfg.horarioSemanal);
    return hours <= 42.0;
  }).length;
  const totalActiveBonuses = teamMembers.reduce((sum, m) => {
    const cfg = getEmployeeData(m);
    const bonuses = cfg.bonificaciones || [];
    const sumMonto = bonuses.reduce((bSum, b) => bSum + (b.monto || 0), 0);
    const configuredSum = (cfg.bonosConfigurados || []).reduce((cSum, c) => cSum + (c.monto || 0), 0);
    return sum + sumMonto + configuredSum;
  }, 0);

  // Formateador de moneda colombiana
  const formatCOP = (num?: number) => {
    if (num === undefined || num === null) return "$0";
    return "$" + Math.round(num).toLocaleString("es-CO");
  };

  // Manejador para crear nuevo empleado
  const handleCreateNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMemberName.trim();
    if (!cleanName) {
      alert("Por favor escribe el nombre completo del colaborador.");
      return;
    }
    if (teamMembers.some(m => m.nombre.toLowerCase() === cleanName.toLowerCase())) {
      alert("Ya existe un colaborador registrado con este nombre en el sistema.");
      return;
    }

    const calculatedPoints = getRolePoints(newMemberRole);
    try {
      const savedUser = await dbAdapter.saveTeamMember({
        nombre: cleanName,
        cedula: newMemberCedula.trim(),
        role: newMemberRole as any,
        cargo: newMemberRole as any,
        local: localName,
        puntosPropinas: calculatedPoints,
        aptoPropinas: newMemberRole !== "gerente",
        activo: true
      }, localName);

      const initialSchedule = getDefaultSchedule("Domingo");
      const initialConfig: EmployeeSalaryConfig = {
        nombre: cleanName,
        cedula: newMemberCedula.trim(),
        role: newMemberRole,
        area: newMemberArea,
        salarioBaseMensual: newMemberSalario,
        tipoContrato: newMemberTipoContrato,
        auxilioTransporteAplica: newMemberSalario <= (smmlvBase * 2),
        informacionParticular: "",
        diaDescansoContractual: "Domingo",
        horarioSemanal: initialSchedule,
        bonosConfigurados: [],
        bonificaciones: [],
        sanciones: [],
        vacaciones: [],
        hrProfile: {
          fechaIngreso: newMemberFechaIngreso,
          telefono: newMemberTelefono,
          email: newMemberEmail,
          eps: "Compensar",
          arl: "SURA (Riesgo I)",
          fondoPensiones: "Porvenir",
          fondoCesantias: "Porvenir"
        }
      };

      await hrStore.updateEmployeeConfig(cleanName, initialConfig);
      await onRefreshTeamMembers();
      await syncWithSupabase();

      setIsNewMemberModalOpen(false);
      setNewMemberName("");
      setNewMemberCedula("");
      setNewMemberTelefono("");
      setNewMemberEmail("");
      alert(`¡Colaborador "${cleanName}" creado con éxito en la nómina y fichero de RRHH! Recuerda que su contraseña de acceso se gestiona en Seguridad & Roles.`);
    } catch (err: any) {
      console.error("Error al registrar colaborador:", err);
      alert("Error al registrar colaborador: " + (err?.message || ""));
    }
  };

  // Agregar Bonificación
  const handleAddBonusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const currentCfg = getEmployeeData(selectedEmployee);
    const newBonus: EmployeeBonusRecord = {
      id: "bono-" + Date.now(),
      fecha: todayBogota(),
      concepto: newBonusConcept.trim() || "Bono de Desempeño",
      monto: Number(newBonusAmount) || 0,
      tipologia: newBonusType,
      tipoPago: newBonusPayment,
      motivo: newBonusReason.trim(),
      estado: "Aprobado"
    };

    const updatedBonuses = [newBonus, ...(currentCfg.bonificaciones || [])];
    await handleSaveEmployeeUpdates(selectedEmployee.nombre, { bonificaciones: updatedBonuses });
    setIsAddingBonus(false);
    setNewBonusConcept("");
    setNewBonusAmount(50000);
    setNewBonusReason("");
  };

  // Agregar Sanción Disciplinaria / Llamado de Atención
  const handleAddSanctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!newSanctionReason.trim() || !newSanctionDescription.trim()) {
      alert("Por favor completa el motivo y la descripción de la novedad.");
      return;
    }

    const currentCfg = getEmployeeData(selectedEmployee);
    const newSanction: DisciplinarySanction = {
      id: "sancion-" + Date.now(),
      fecha: todayBogota(),
      tipo: newSanctionType,
      gravedad: newSanctionSeverity,
      motivo: newSanctionReason.trim(),
      descripcion: newSanctionDescription.trim(),
      compromiso: newSanctionCommitment.trim(),
      diasSuspension: newSanctionType === "Suspensión Disciplinaria" ? Number(newSanctionDays) : undefined,
      estado: "Activa",
      firmadoPorEmpleado: false,
      registradoPor: currentUsername || "Gerencia"
    };

    const updatedSanctions = [newSanction, ...(currentCfg.sanciones || [])];
    await handleSaveEmployeeUpdates(selectedEmployee.nombre, { sanciones: updatedSanctions });
    setIsAddingSanction(false);
    setNewSanctionReason("");
    setNewSanctionDescription("");
    setNewSanctionCommitment("");
  };

  // Registrar Vacaciones / Permiso / Incapacidad
  const handleAddVacationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const currentCfg = getEmployeeData(selectedEmployee);
    const newRecord: VacationPeriod = {
      id: "vac-" + Date.now(),
      tipo: newVacationType,
      fechaInicio: newVacationStart,
      fechaFin: newVacationEnd,
      diasHabiles: Number(newVacationDays) || 1,
      periodoCorrespondiente: newVacationPeriod,
      estado: "Aprobado",
      observaciones: newVacationNotes.trim()
    };

    const updatedVacations = [newRecord, ...(currentCfg.vacaciones || [])];
    await handleSaveEmployeeUpdates(selectedEmployee.nombre, { vacaciones: updatedVacations });
    setIsAddingVacation(false);
    setNewVacationNotes("");
  };

  // Actualizar un día del horario semanal
  const handleUpdateScheduleDay = (
    diaIndex: number, 
    field: keyof DailySchedule, 
    value: any
  ) => {
    if (!selectedEmployee) return;
    const currentCfg = getEmployeeData(selectedEmployee);
    const currentSchedule = [...(currentCfg.horarioSemanal || getDefaultSchedule(currentCfg.diaDescansoContractual))];
    
    const dayObj = { ...currentSchedule[diaIndex], [field]: value };
    if (field === "horaEntrada" || field === "horaSalida" || field === "minutosAlmuerzo" || field === "activo") {
      if (!dayObj.activo) {
        dayObj.horasCalculadas = 0;
      } else {
        dayObj.horasCalculadas = calculateEffectiveHours(dayObj.horaEntrada, dayObj.horaSalida, dayObj.minutosAlmuerzo);
      }
    }
    currentSchedule[diaIndex] = dayObj;
    handleSaveEmployeeUpdates(selectedEmployee.nombre, { horarioSemanal: currentSchedule });
  };

  // Aplicar plantilla rápida de turnos
  const handleApplyShiftTemplate = (templateName: string) => {
    if (!selectedEmployee) return;
    const currentCfg = getEmployeeData(selectedEmployee);
    const restDay = currentCfg.diaDescansoContractual || "Domingo";
    let inTime = "11:00";
    let outTime = "19:00";
    let lunch = 60;

    if (templateName === "apertura_ventas") {
      inTime = "07:30";
      outTime = "15:00";
      lunch = 30;
    } else if (templateName === "cierre_ventas") {
      inTime = "12:30";
      outTime = "20:00";
      lunch = 30;
    } else if (templateName === "pasteleria_produccion") {
      inTime = "06:00";
      outTime = "13:30";
      lunch = 30;
    } else if (templateName === "partido_completo") {
      inTime = "10:00";
      outTime = "18:00";
      lunch = 60;
    }

    const newSchedule: DailySchedule[] = (["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const).map(d => {
      const isRest = d === restDay;
      const hours = isRest ? 0 : calculateEffectiveHours(inTime, outTime, lunch);
      return {
        dia: d,
        activo: !isRest,
        horaEntrada: inTime,
        horaSalida: outTime,
        minutosAlmuerzo: lunch,
        horasCalculadas: hours
      };
    });

    handleSaveEmployeeUpdates(selectedEmployee.nombre, { horarioSemanal: newSchedule });
  };

  // Generador de texto para reporte y envío
  const generateReportText = (member: any, type: string): string => {
    const cfg = getEmployeeData(member);
    const hr = cfg.hrProfile || {};
    const vacInfo = calculateVacationDaysAccrued(hr.fechaIngreso);
    const weeklyHours = calculateTotalWeeklyHours(cfg.horarioSemanal);
    const totalBonos = (cfg.bonificaciones || []).reduce((s, b) => s + b.monto, 0);

    if (type === "certificado_laboral") {
      return `LÓPEZ & GRACIA - CERTIFICACIÓN LABORAL
Fecha de Expedición: ${new Date().toLocaleDateString("es-CO")}

A QUIEN PUEDA INTERESAR:

Por medio de la presente se hace constar que el(la) ciudadano(a) ${member.nombre.toUpperCase()}, identificado(a) con C.C. No. ${cfg.cedula || member.cedula || "No registrada"}, labora en nuestra compañía desempeñando el cargo de ${cfg.role.toUpperCase()} en el área de ${cfg.area.toUpperCase()}.

Detalles de la vinculación:
- Tipo de Contrato: ${cfg.tipoContrato || "Término Indefinido"}
- Fecha de Ingreso: ${hr.fechaIngreso || "No registrada"}
- Sede de Operación: ${localName}
- Salario Base Mensual: ${formatCOP(cfg.salarioBaseMensual)} COP
- Auxilio de Transporte: ${cfg.auxilioTransporteAplica ? formatCOP(auxTranspBase) + " COP (Aplica de Ley)" : "No aplica"}
- Afiliación EPS: ${hr.eps || "Compensar"}
- Afiliación ARL: ${hr.arl || "SURA"}
- Fondo de Pensiones: ${hr.fondoPensiones || "Porvenir"}

La presente se expide a solicitud de la parte interesada.

Atentamente,
DIRECCIÓN DE TALENTO HUMANO & GERENCIA
López & Gracia Panadería y Pastelería Artesanal
${localName}, Bogotá D.C.`;
    }

    if (type === "horario_semanal") {
      const scheduleLines = (cfg.horarioSemanal || []).map(d => {
        if (!d.activo) return `• ${d.dia}: DESCANSO CONTRACTUAL`;
        return `• ${d.dia}: ${d.horaEntrada} - ${d.horaSalida} (Almuerzo: ${d.minutosAlmuerzo} min) = ${d.horasCalculadas.toFixed(1)} hrs`;
      }).join("\n");

      return `LÓPEZ & GRACIA - HORARIO OFICIAL SEMANAL
Colaborador: ${member.nombre} (C.C. ${cfg.cedula || member.cedula || "N/A"})
Cargo: ${cfg.role} | Área: ${cfg.area}
Sede: ${localName}

Jornada Semanal Pactada: ${weeklyHours.toFixed(1)} hrs / 42.0 hrs máx.
Día de Descanso Contractual: ${cfg.diaDescansoContractual || "Domingo"}

Programación por Días:
${scheduleLines}

Nota: Cumplimiento estricto de la jornada laboral máxima de 42 horas semanales.`;
    }

    if (type === "resumen_bonos") {
      const bonosList = (cfg.bonificaciones || []).map(b => 
        `• ${b.fecha}: ${b.concepto} - ${formatCOP(b.monto)} (${b.tipologia}) [${b.tipoPago}]`
      ).join("\n") || "No registra bonificaciones extraordinarias.";

      return `LÓPEZ & GRACIA - REPORTE DE BONIFICACIONES E INCENTIVOS
Colaborador: ${member.nombre} (C.C. ${cfg.cedula || member.cedula || "N/A"})
Total Bonos Asignados: ${formatCOP(totalBonos)} COP

Historial de Bonos:
${bonosList}

Observaciones Contractuales:
${cfg.informacionParticular || "Ninguna."}`;
    }

    // Default: Ficha 360
    return `LÓPEZ & GRACIA - INFORME INTEGRAL DE TALENTO HUMANO (FICHA 360°)
Fecha: ${new Date().toLocaleDateString("es-CO")}

1. DATOS GENERALES:
- Nombre: ${member.nombre}
- Documento: C.C. ${cfg.cedula || member.cedula || "Sin registrar"}
- Cargo: ${cfg.role} | Área: ${cfg.area}
- Tipo de Contrato: ${cfg.tipoContrato}
- Fecha de Ingreso: ${hr.fechaIngreso || "No registrada"} (${vacInfo.antiguedadAnios} años, ${vacInfo.antiguedadMeses} meses de servicio)
- Teléfono / WhatsApp: ${hr.telefono || "No registrado"}
- Correo: ${hr.email || "No registrado"}

2. SALARIOS & BENEFICIOS:
- Salario Base: ${formatCOP(cfg.salarioBaseMensual)} COP
- Auxilio de Transporte: ${cfg.auxilioTransporteAplica ? "Aplica (" + formatCOP(auxTranspBase) + ")" : "No aplica"}
- Puntos Propinas: ${getRolePoints(member.role)} pts (${member.aptoPropinas ? "Apto" : "No apto / Trainee"})
- Bonificaciones Activas: ${formatCOP(totalBonos)} COP

3. SEGURIDAD SOCIAL:
- EPS: ${hr.eps || "Compensar"}
- ARL: ${hr.arl || "SURA (Riesgo I)"}
- Fondo de Pensiones: ${hr.fondoPensiones || "Porvenir"}
- Fondo de Cesantías: ${hr.fondoCesantias || "Porvenir"}

4. VACACIONES & TIEMPO LABORAL:
- Días Causados por Ley: ${vacInfo.diasCausados} días hábiles
- Vacaciones Tomadas: ${(cfg.vacaciones || []).filter(v => v.tipo === "Vacaciones Disfrutadas").reduce((s, v) => s + v.diasHabiles, 0)} días
- Días Pendientes: ${Math.max(0, vacInfo.diasCausados - (cfg.vacaciones || []).filter(v => v.tipo === "Vacaciones Disfrutadas").reduce((s, v) => s + v.diasHabiles, 0))} días
- Jornada Semanal Actual: ${weeklyHours.toFixed(1)} / 42.0 hrs (Jornada Máxima)

5. LLAMADOS DE ATENCIÓN / SANCIONES:
${(cfg.sanciones || []).length === 0 ? "- Sin antecedentes disciplinarios en el legajo." : (cfg.sanciones || []).map(s => `- [${s.fecha}] ${s.tipo} (${s.gravedad}): ${s.motivo}`).join("\n")}

López & Gracia Talento Humano • Sistema Operativo`;
  };

  // Enviar por WhatsApp
  const handleSendViaWhatsApp = (member: any) => {
    const cfg = getEmployeeData(member);
    const phone = (cfg.hrProfile?.telefono || "").replace(/\D/g, "");
    const text = generateReportText(member, selectedReportType);
    const encoded = encodeURIComponent(text);
    const url = phone ? `https://wa.me/57${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  // Enviar por Correo
  const handleSendViaEmail = (member: any) => {
    const cfg = getEmployeeData(member);
    const email = cfg.hrProfile?.email || "";
    const subject = encodeURIComponent(`López & Gracia - ${selectedReportType === "certificado_laboral" ? "Certificación Laboral" : "Reporte de Talento Humano"} - ${member.nombre}`);
    const body = encodeURIComponent(generateReportText(member, selectedReportType));
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  };

  // Copiar al portapapeles
  const handleCopyReport = (member: any) => {
    const text = generateReportText(member, selectedReportType);
    navigator.clipboard.writeText(text);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2500);
  };

  // Imprimir reporte
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* CABECERA PRINCIPAL: PERFILES & TALENTO HUMANO */}
      <div className="bg-white p-6 border-2 border-brand-ink shadow-[4px_4px_0px_0px_#1C1917] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-lg bg-purple-900 text-white flex items-center justify-center font-black shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-brand-ink flex items-center space-x-2">
                <span>Perfiles de Empleados & Talento Humano</span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 font-mono text-[10px] font-black rounded uppercase">
                  RRHH & Bienestar
                </span>
              </h2>
              <p className="text-xs text-brand-ink/75 font-medium mt-0.5">
                Fichas contractuales, seguridad social, bonificaciones, llamados de atención disciplinarios, control de jornada semanal (42 hrs), vacaciones y centro de reportes individuales.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-100 border border-zinc-300 rounded-lg text-[11px] font-bold text-zinc-700">
            <span className={`w-2 h-2 rounded-full ${supabaseConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span>{supabaseConnected ? "Supabase Sincronizado" : "Sin Conexión"}</span>
          </div>

          <button
            type="button"
            onClick={syncWithSupabase}
            disabled={isSyncing}
            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-brand-ink border-2 border-brand-ink text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Recargar datos de Supabase Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("security")}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Ir a gestionar contraseñas, PINs y roles de acceso"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-700" />
            <span>Seguridad & Claves</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("salarios")}
            className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Ver nómina de pago"
          >
            <DollarSign className="w-3.5 h-3.5 text-purple-700" />
            <span>Nómina & Pagos</span>
          </button>

          {!showWarningBanner && (
            <button
              id="btn-show-hr-warning-header-circle"
              type="button"
              onClick={handleOpenWarningBanner}
              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-xs"
              title="Ver mensaje de advertencia: Seguridad vs. RRHH"
              aria-label="Ver mensaje de advertencia: Seguridad vs. RRHH"
            >
              <AlertCircle className="w-4 h-4 text-amber-700" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsNewMemberModalOpen(true)}
            className="px-3.5 py-2 bg-brand-ink hover:bg-black text-white text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-[2px_2px_0px_0px_#A855F7]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Colaborador</span>
          </button>
        </div>
      </div>

      {/* NOTA DE CLARIDAD CONCEPTUAL: SEGURIDAD VS RRHH */}
      {!showWarningBanner ? (
        <div className="flex items-center">
          <button
            id="btn-show-hr-warning-circle"
            type="button"
            onClick={handleOpenWarningBanner}
            className="inline-flex items-center space-x-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer group"
            title="Hacer clic para ver el mensaje de advertencia (Seguridad vs. RRHH)"
          >
            <AlertCircle className="w-4 h-4 text-amber-700 group-hover:scale-110 transition-transform shrink-0" />
            <span>Ver aviso: Separación de responsabilidades (Seguridad vs. RRHH)</span>
          </button>
        </div>
      ) : (
        <div
          id="hr-warning-banner"
          className="bg-amber-50 border-2 border-amber-300 p-3.5 rounded-xl text-xs text-amber-950 font-medium flex items-start justify-between space-x-3 shadow-xs transition-all"
        >
          <div className="flex items-start space-x-3 pr-2">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-amber-900">
                Separación de responsabilidades: Seguridad & Roles vs. Talento Humano (RRHH)
              </p>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Las <strong>contraseñas, PINs de acceso, permisos de caja, suspensión de usuario y roles de sistema</strong> se administran exclusivamente en la pestaña <strong>Seguridad & Roles</strong>. Esta sección de <strong>Perfiles & Talento Humano</strong> está dedicada a la <strong>ficha laboral contractual, seguridad social, asignación de turnos semanales (42h), bonificaciones fijas/extraordinarias, sanciones escritas, vacaciones y emisión de reportes individuales</strong>.
              </p>
            </div>
          </div>
          <button
            id="btn-close-hr-warning-banner"
            type="button"
            onClick={handleDismissWarningBanner}
            className="text-amber-800 hover:text-amber-950 hover:bg-amber-200/70 p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
            title="Quitar mensaje de advertencia"
            aria-label="Quitar mensaje de advertencia"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPIS DE TALENTO HUMANO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-brand-ink p-4 shadow-[3px_3px_0px_0px_#1C1917] rounded-xl">
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">Plantilla Total</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-brand-ink font-mono">{totalEmployees}</span>
            <span className="text-[11px] font-bold text-emerald-600">({activeEmployees} activos)</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-bold block mt-0.5">Sede {localName}</span>
        </div>

        <div className="bg-white border-2 border-brand-ink p-4 shadow-[3px_3px_0px_0px_#1C1917] rounded-xl">
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">Jornada Semanal</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-blue-900 font-mono">{employeesInRegulation42h} / {totalEmployees}</span>
            <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">En Regla</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-bold block mt-0.5">Máximo 42.0h semanales</span>
        </div>

        <div className="bg-white border-2 border-brand-ink p-4 shadow-[3px_3px_0px_0px_#1C1917] rounded-xl">
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">Bonificaciones Activas</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-xl font-black text-purple-900 font-mono">{formatCOP(totalActiveBonuses)}</span>
          </div>
          <span className="text-[10px] text-purple-700 font-bold block mt-0.5">Mensual consolidado</span>
        </div>

        <div className="bg-white border-2 border-brand-ink p-4 shadow-[3px_3px_0px_0px_#1C1917] rounded-xl">
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">Distribución de Áreas</span>
          <div className="flex items-center space-x-2 mt-1.5 text-xs font-bold font-mono">
            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded">
              Ventas: {teamMembers.filter(m => getEmployeeData(m).area === "Ventas").length}
            </span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded">
              Pastelería: {teamMembers.filter(m => getEmployeeData(m).area === "Pastelería").length}
            </span>
          </div>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="bg-white border-2 border-brand-ink p-4 shadow-[3px_3px_0px_0px_#1C1917] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nombre o cédula..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-brand-ink outline-none focus:border-brand-ink focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center space-x-1 text-xs">
            <span className="text-[10px] font-black uppercase text-zinc-500">Área:</span>
            <select
              value={areaFilter}
              onChange={(e: any) => setAreaFilter(e.target.value)}
              className="bg-zinc-50 border border-zinc-300 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="TODOS">Todas las Áreas</option>
              <option value="Ventas">Ventas / Tienda</option>
              <option value="Pastelería">Pastelería / Cocina</option>
            </select>
          </div>

          <div className="flex items-center space-x-1 text-xs">
            <span className="text-[10px] font-black uppercase text-zinc-500">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-zinc-50 border border-zinc-300 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="Activos">Solo Activos</option>
              <option value="Inactivos">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE COLABORADORES */}
      <div className="bg-white border-2 border-brand-ink shadow-[4px_4px_0px_0px_#1C1917] rounded-xl overflow-hidden">
        <div className="p-4 border-b-2 border-brand-ink bg-[#F5F2EB] flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-brand-ink flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-brand-ink" />
            <span>Fichero de Colaboradores Registrados ({filteredMembers.length})</span>
          </h3>
          <span className="text-[10px] text-zinc-500 font-bold">
            Haz clic en "Ficha RRHH" para gestionar bonos, sanciones, turnos y reportes.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 text-[10px] font-black uppercase text-zinc-600 tracking-wider">
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-3">Cargo & Área</th>
                <th className="py-3 px-3">Contrato & Sueldo</th>
                <th className="py-3 px-3 text-center">Jornada Semanal</th>
                <th className="py-3 px-3 text-center">Bonos / Incentivos</th>
                <th className="py-3 px-3 text-center">Sanciones / Actas</th>
                <th className="py-3 px-3 text-center">Vacaciones</th>
                <th className="py-3 px-4 text-right">Gestión RRHH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs font-medium">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs font-bold text-zinc-400 italic">
                    No se encontraron colaboradores que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const cfg = getEmployeeData(member);
                  const hr = cfg.hrProfile || {};
                  const weeklyHours = calculateTotalWeeklyHours(cfg.horarioSemanal);
                  const vacInfo = calculateVacationDaysAccrued(hr.fechaIngreso);
                  const bonosCount = (cfg.bonificaciones || []).length + (cfg.bonosConfigurados || []).length;
                  const sancionesCount = (cfg.sanciones || []).length;

                  return (
                    <tr key={member.id || member.nombre} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-ink text-white flex items-center justify-center font-black text-xs shrink-0">
                            {member.nombre.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-black text-brand-ink block text-sm">
                              {member.nombre}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-zinc-500">
                              <span>C.C. {cfg.cedula || member.cedula || "N/A"}</span>
                              {hr.telefono && <span>• Tel: {hr.telefono}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-brand-ink block">{cfg.role}</span>
                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border mt-0.5 ${
                          cfg.area === "Pastelería" 
                            ? "bg-amber-50 text-amber-900 border-amber-200" 
                            : "bg-blue-50 text-blue-900 border-blue-200"
                        }`}>
                          {cfg.area}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-black font-mono text-brand-ink block">
                          {formatCOP(cfg.salarioBaseMensual)}
                        </span>
                        <div className="flex items-center space-x-1 text-[9px] font-bold text-zinc-500 mt-0.5">
                          <span>{cfg.tipoContrato || "Indefinido"}</span>
                          <span>•</span>
                          <span className={cfg.auxilioTransporteAplica ? "text-emerald-700" : "text-zinc-400"}>
                            {cfg.auxilioTransporteAplica ? "+ Aux. Transp." : "Sin auxilio"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-black text-xs px-2 py-0.5 bg-zinc-100 rounded border border-zinc-300">
                          {weeklyHours.toFixed(1)}h / 42h
                        </span>
                        <div className="mt-1">
                          {weeklyHours <= 42 ? (
                            <span className="text-[8px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">
                              En regla
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase text-red-800 bg-red-100 border border-red-300 px-1.5 py-0.2 rounded">
                              Exceso +{(weeklyHours - 42).toFixed(1)}h
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {bonosCount > 0 ? (
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black rounded-lg">
                            {bonosCount} bono{bonosCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-400">Sin bonos</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {sancionesCount > 0 ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 text-[10px] font-black rounded-lg">
                            {sancionesCount} sanción{sancionesCount > 1 ? "es" : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600">Limpio (0)</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-xs font-black text-blue-900">
                          {vacInfo.diasCausados}d
                        </span>
                        <span className="text-[9px] text-zinc-400 block font-sans">causados</span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmployee(member);
                              setActiveHrTab("reports");
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-black uppercase rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
                            title="Generar y mandar reporte"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Reporte</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmployee(member);
                              setActiveHrTab("contract");
                            }}
                            className="px-3 py-1 bg-brand-ink hover:bg-black text-white text-[10px] font-black uppercase rounded-lg transition-all flex items-center space-x-1 cursor-pointer shadow-xs"
                            title="Abrir Legajo y Ficha Completa de RRHH"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Ficha RRHH</span>
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

      {/* MODAL FICHA INTEGRAL DE TALENTO HUMANO & RRHH */}
      {selectedEmployee && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEmployee(null);
          }}
          className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto"
        >
          <div className="bg-white border-2 border-brand-ink rounded-2xl shadow-[6px_6px_0px_0px_#1C1917] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left my-auto">
            {/* ENCABEZADO DEL MODAL */}
            <div className="bg-brand-ink text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-brand-ink shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm">
                  {selectedEmployee.nombre.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-base flex items-center space-x-2">
                    <span>Ficha Laboral & RRHH: {selectedEmployee.nombre}</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">
                      C.C. {getEmployeeData(selectedEmployee).cedula || selectedEmployee.cedula || "N/A"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-300 font-medium">
                    {getEmployeeData(selectedEmployee).role} • {getEmployeeData(selectedEmployee).area} • {localName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BARRA DE PESTAÑAS DENTRO DE LA FICHA */}
            <div className="bg-[#F5F2EB] border-b-2 border-brand-ink px-4 py-2 flex items-center space-x-2 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveHrTab("contract")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                  activeHrTab === "contract"
                    ? "bg-brand-ink text-white shadow-xs"
                    : "text-brand-ink/75 hover:bg-zinc-200"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>1. Contrato & Seguridad Social</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHrTab("schedule")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                  activeHrTab === "schedule"
                    ? "bg-brand-ink text-white shadow-xs"
                    : "text-brand-ink/75 hover:bg-zinc-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>2. Horarios & Turnos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHrTab("bonuses")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                  activeHrTab === "bonuses"
                    ? "bg-brand-ink text-white shadow-xs"
                    : "text-brand-ink/75 hover:bg-zinc-200"
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>3. Bonificaciones</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHrTab("sanctions")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                  activeHrTab === "sanctions"
                    ? "bg-brand-ink text-white shadow-xs"
                    : "text-brand-ink/75 hover:bg-zinc-200"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>4. Sanciones & Memorandos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHrTab("vacations")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                  activeHrTab === "vacations"
                    ? "bg-brand-ink text-white shadow-xs"
                    : "text-brand-ink/75 hover:bg-zinc-200"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>5. Vacaciones & Permisos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHrTab("reports")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                  activeHrTab === "reports"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-blue-900 bg-blue-100/60 hover:bg-blue-200/60"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>6. Enviar Reportes</span>
              </button>
            </div>

            {/* CONTENIDO SCROLLEABLE SEGÚN PESTAÑA ACTIVA */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {(() => {
                const cfg = getEmployeeData(selectedEmployee);
                const hr = cfg.hrProfile || {};
                const weeklyHours = calculateTotalWeeklyHours(cfg.horarioSemanal);
                const vacInfo = calculateVacationDaysAccrued(hr.fechaIngreso);

                // TAB 1: CONTRATO & SEGURIDAD SOCIAL
                if (activeHrTab === "contract") {
                  return (
                    <div className="space-y-6">
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-4">
                        <div className="flex items-center space-x-2 text-zinc-800 font-black text-xs uppercase tracking-wider">
                          <Briefcase className="w-4 h-4 text-brand-ink" />
                          <span>Parámetros Laborales & Salario Base</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Cédula de Ciudadanía
                            </label>
                            <input
                              type="text"
                              value={cfg.cedula || ""}
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, { cedula: e.target.value })}
                              className="w-full bg-white border border-zinc-300 p-2 font-mono font-bold rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Salario Base Mensual (COP)
                            </label>
                            <div className="flex space-x-1">
                              <input
                                type="number"
                                value={cfg.salarioBaseMensual || smmlvBase}
                                onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, { salarioBaseMensual: Number(e.target.value) })}
                                className="w-full bg-white border border-zinc-300 p-2 font-mono font-bold rounded-lg outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEmployeeUpdates(selectedEmployee.nombre, { salarioBaseMensual: smmlvBase })}
                                className="px-2.5 bg-zinc-200 hover:bg-zinc-300 text-[10px] font-black uppercase rounded-lg shrink-0 cursor-pointer"
                                title="Asignar SMMLV vigente"
                              >
                                SMMLV
                              </button>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold block mt-1">
                              {formatCOP(cfg.salarioBaseMensual)} COP / mes
                            </span>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Tipo de Contrato
                            </label>
                            <select
                              value={cfg.tipoContrato || "Indefinido"}
                              onChange={(e: any) => handleSaveEmployeeUpdates(selectedEmployee.nombre, { tipoContrato: e.target.value })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer"
                            >
                              <option value="Indefinido">Término Indefinido</option>
                              <option value="Término Fijo">Término Fijo</option>
                              <option value="Obra o Labor">Obra o Labor</option>
                              <option value="Por días">Por días / Ocasional</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Área / Sección
                            </label>
                            <select
                              value={cfg.area}
                              onChange={(e: any) => handleSaveEmployeeUpdates(selectedEmployee.nombre, { area: e.target.value })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer"
                            >
                              <option value="Ventas">Ventas / Tienda</option>
                              <option value="Pastelería">Pastelería / Cocina</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Fecha de Ingreso (Antigüedad)
                            </label>
                            <input
                              type="date"
                              value={hr.fechaIngreso || ""}
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, fechaIngreso: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                            <span className="text-[10px] text-zinc-500 block mt-0.5">
                              {vacInfo.antiguedadAnios} años, {vacInfo.antiguedadMeses} meses
                            </span>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Auxilio de Transporte
                            </label>
                            <div className="flex items-center space-x-2 pt-2">
                              <input
                                type="checkbox"
                                checked={cfg.auxilioTransporteAplica}
                                onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, { auxilioTransporteAplica: e.target.checked })}
                                className="w-4 h-4 cursor-pointer accent-brand-ink"
                              />
                              <span className="text-xs font-bold text-zinc-700">
                                {cfg.auxilioTransporteAplica ? `Aplica (${formatCOP(auxTranspBase)}/mes)` : "No Aplica"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* SEGURIDAD SOCIAL & CONTACTO */}
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-4">
                        <div className="flex items-center space-x-2 text-zinc-800 font-black text-xs uppercase tracking-wider">
                          <HeartPulse className="w-4 h-4 text-emerald-700" />
                          <span>Afiliaciones de Seguridad Social & Contacto</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              EPS Afiliada
                            </label>
                            <input
                              type="text"
                              value={hr.eps || "Compensar"}
                              placeholder="Ej. Compensar, Sanitas, Sura"
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, eps: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              ARL (Riesgo Laboral)
                            </label>
                            <input
                              type="text"
                              value={hr.arl || "SURA (Riesgo I)"}
                              placeholder="Ej. SURA, Positiva"
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, arl: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Fondo de Pensiones
                            </label>
                            <input
                              type="text"
                              value={hr.fondoPensiones || "Porvenir"}
                              placeholder="Ej. Porvenir, Protección"
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, fondoPensiones: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Fondo de Cesantías
                            </label>
                            <input
                              type="text"
                              value={hr.fondoCesantias || "Porvenir"}
                              placeholder="Ej. Porvenir, Protección"
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, fondoCesantias: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Teléfono / WhatsApp
                            </label>
                            <input
                              type="text"
                              value={hr.telefono || ""}
                              placeholder="Ej. 3101234567"
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, telefono: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Correo Electrónico
                            </label>
                            <input
                              type="email"
                              value={hr.email || ""}
                              placeholder="correo@ejemplo.com"
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, email: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Contacto de Emergencia
                            </label>
                            <input
                              type="text"
                              value={hr.contactoEmergenciaNombre || ""}
                              placeholder="Nombre (Familiar)"
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, contactoEmergenciaNombre: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">
                              Tel. Contacto de Emergencia
                            </label>
                            <input
                              type="text"
                              value={hr.contactoEmergenciaTelefono || ""}
                              placeholder="Teléfono de contacto"
                              onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, {
                                hrProfile: { ...hr, contactoEmergenciaTelefono: e.target.value }
                              })}
                              className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* INFORMACIÓN PARTICULAR / ANOTACIONES */}
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-700 tracking-wider block">
                          Anotaciones & Observaciones Contractuales
                        </label>
                        <textarea
                          rows={2}
                          value={cfg.informacionParticular || ""}
                          placeholder="Observaciones particulares, condiciones especiales de turno o pactos individuales..."
                          onChange={(e) => handleSaveEmployeeUpdates(selectedEmployee.nombre, { informacionParticular: e.target.value })}
                          className="w-full bg-white border border-zinc-300 p-2 text-xs font-medium rounded-lg outline-none focus:border-brand-ink"
                        />
                      </div>
                    </div>
                  );
                }

                // TAB 2: HORARIOS & TURNOS
                if (activeHrTab === "schedule") {
                  return (
                    <div className="space-y-5">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-blue-50 border border-blue-200 p-3.5 rounded-xl">
                        <div>
                          <h4 className="text-xs font-black text-blue-950 uppercase flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-blue-700" />
                            <span>Control de Jornada Laboral (42 Horas Semanales)</span>
                          </h4>
                          <p className="text-[11px] text-blue-900 mt-0.5">
                            El tiempo de descanso/almuerzo diario se deduce automáticamente de la jornada efectiva.
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-brand-ink">
                            Carga Total: <strong className="font-mono text-sm">{weeklyHours.toFixed(1)} hrs</strong> / 42h
                          </span>
                          {weeklyHours <= 42 ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black rounded-lg">
                              En regla
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 text-[10px] font-black rounded-lg">
                              Exceso +{(weeklyHours - 42).toFixed(1)}h
                            </span>
                          )}
                        </div>
                      </div>

                      {/* BOTONES DE PLANTILLAS RÁPIDAS DE TURNOS */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-zinc-500">Plantillas de Turno:</span>
                        <button
                          type="button"
                          onClick={() => handleApplyShiftTemplate("apertura_ventas")}
                          className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-brand-ink border border-zinc-300 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Apertura Ventas (07:30 - 15:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyShiftTemplate("cierre_ventas")}
                          className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-brand-ink border border-zinc-300 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Cierre Ventas (12:30 - 20:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyShiftTemplate("pasteleria_produccion")}
                          className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-brand-ink border border-zinc-300 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Pastelería (06:00 - 13:30)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyShiftTemplate("partido_completo")}
                          className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-brand-ink border border-zinc-300 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Turno Completo (10:00 - 18:00)
                        </button>
                      </div>

                      {/* TABLA DE TURNOS LUNES A DOMINGO */}
                      <div className="overflow-x-auto bg-white rounded-xl border border-zinc-300">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-zinc-100 border-b border-zinc-300 text-[10px] font-black text-zinc-600 uppercase">
                              <th className="p-2.5">Día de Semana</th>
                              <th className="p-2.5 text-center">Labora</th>
                              <th className="p-2.5">Hora Entrada</th>
                              <th className="p-2.5">Hora Salida</th>
                              <th className="p-2.5">Tiempo Almuerzo</th>
                              <th className="p-2.5 text-right">Horas Efectivas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 font-medium">
                            {(cfg.horarioSemanal || getDefaultSchedule(cfg.diaDescansoContractual)).map((day, idxDay) => {
                              const isRestDay = day.dia === (cfg.diaDescansoContractual || "Domingo");
                              return (
                                <tr key={day.dia} className={isRestDay ? "bg-amber-50/40" : "hover:bg-zinc-50"}>
                                  <td className="p-2.5 font-bold text-brand-ink flex items-center space-x-1.5">
                                    <span>{day.dia}</span>
                                    {isRestDay && (
                                      <span className="text-[8px] bg-amber-200 text-amber-900 font-black px-1.5 py-0.2 rounded">
                                        Descanso
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={day.activo}
                                      onChange={(e) => handleUpdateScheduleDay(idxDay, "activo", e.target.checked)}
                                      className="w-4 h-4 cursor-pointer accent-brand-ink"
                                    />
                                  </td>
                                  <td className="p-2.5">
                                    <input
                                      type="time"
                                      disabled={!day.activo}
                                      value={day.horaEntrada}
                                      onChange={(e) => handleUpdateScheduleDay(idxDay, "horaEntrada", e.target.value)}
                                      className="bg-zinc-50 border border-zinc-300 p-1 font-mono font-bold rounded text-xs disabled:opacity-40"
                                    />
                                  </td>
                                  <td className="p-2.5">
                                    <input
                                      type="time"
                                      disabled={!day.activo}
                                      value={day.horaSalida}
                                      onChange={(e) => handleUpdateScheduleDay(idxDay, "horaSalida", e.target.value)}
                                      className="bg-zinc-50 border border-zinc-300 p-1 font-mono font-bold rounded text-xs disabled:opacity-40"
                                    />
                                  </td>
                                  <td className="p-2.5">
                                    <select
                                      disabled={!day.activo}
                                      value={day.minutosAlmuerzo ?? 60}
                                      onChange={(e) => handleUpdateScheduleDay(idxDay, "minutosAlmuerzo", Number(e.target.value))}
                                      className="bg-zinc-50 border border-zinc-300 p-1 font-bold rounded text-xs disabled:opacity-40 cursor-pointer"
                                    >
                                      <option value={0}>0 min (Sin almuerzo)</option>
                                      <option value={15}>15 min</option>
                                      <option value={30}>30 min</option>
                                      <option value={45}>45 min</option>
                                      <option value={60}>60 min (1 hora)</option>
                                      <option value={90}>90 min (1.5 horas)</option>
                                    </select>
                                  </td>
                                  <td className="p-2.5 text-right font-mono font-bold text-brand-ink">
                                    {day.activo ? `${day.horasCalculadas.toFixed(1)} hrs` : "0.0 hrs"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                // TAB 3: BONIFICACIONES E INCENTIVOS
                if (activeHrTab === "bonuses") {
                  const bonusList = cfg.bonificaciones || [];
                  const fixedBonuses = cfg.bonosConfigurados || [];

                  return (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black uppercase text-brand-ink flex items-center space-x-2">
                            <Gift className="w-4 h-4 text-purple-700" />
                            <span>Bonificaciones, Auxilios e Incentivos</span>
                          </h4>
                          <p className="text-[11px] text-zinc-500 font-medium">
                            Registra bonos por ventas, puntualidad, mérito extraordinario o auxilios pactados.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsAddingBonus(true)}
                          className="px-3 py-1.5 bg-purple-900 hover:bg-black text-white text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Otorgar Bonificación</span>
                        </button>
                      </div>

                      {/* FORMULARIO AGREGAR BONO */}
                      {isAddingBonus && (
                        <form onSubmit={handleAddBonusSubmit} className="bg-purple-50/60 border-2 border-purple-300 p-4 rounded-xl space-y-3">
                          <h5 className="text-xs font-black uppercase text-purple-950">Nueva Bonificación</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Concepto</label>
                              <input
                                type="text"
                                required
                                placeholder="Ej. Bono Cumplimiento Metas"
                                value={newBonusConcept}
                                onChange={(e) => setNewBonusConcept(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-bold rounded-lg outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Monto (COP)</label>
                              <input
                                type="number"
                                required
                                value={newBonusAmount}
                                onChange={(e) => setNewBonusAmount(Number(e.target.value))}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold rounded-lg outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Tipología Legal</label>
                              <select
                                value={newBonusType}
                                onChange={(e: any) => setNewBonusType(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-bold rounded-lg outline-none cursor-pointer"
                              >
                                <option value="No Salarial">No Salarial (Art. 128 CST)</option>
                                <option value="Salarial">Salarial (Suma a IBC)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Frecuencia Pago</label>
                              <select
                                value={newBonusPayment}
                                onChange={(e: any) => setNewBonusPayment(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-bold rounded-lg outline-none cursor-pointer"
                              >
                                <option value="Por Quincena (50%)">Por Quincena (50% c/u)</option>
                                <option value="Mensual Recurrente">Mensual Recurrente</option>
                                <option value="Única Vez">Única Vez</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Motivo / Justificación</label>
                            <input
                              type="text"
                              placeholder="Ej. Reconocimiento por apoyo extraordinario en producción de temporada"
                              value={newBonusReason}
                              onChange={(e) => setNewBonusReason(e.target.value)}
                              className="w-full bg-white border border-zinc-300 p-1.5 font-medium rounded-lg outline-none"
                            />
                          </div>

                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsAddingBonus(false)}
                              className="px-3 py-1 bg-zinc-200 text-zinc-800 text-xs font-black uppercase rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1 bg-purple-900 text-white text-xs font-black uppercase rounded-lg cursor-pointer"
                            >
                              Guardar Bono
                            </button>
                          </div>
                        </form>
                      )}

                      {/* LISTADO DE BONOS */}
                      <div className="space-y-2">
                        {bonusList.length === 0 && fixedBonuses.length === 0 ? (
                          <div className="p-8 text-center text-xs text-zinc-400 font-bold italic bg-zinc-50 border border-dashed border-zinc-300 rounded-xl">
                            Este colaborador no registra bonificaciones adicionales activas.
                          </div>
                        ) : (
                          <>
                            {bonusList.map((b) => (
                              <div key={b.id} className="bg-white border border-zinc-200 p-3 rounded-xl flex items-center justify-between text-xs">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-black text-brand-ink text-sm">{b.concepto}</span>
                                    <span className="font-mono font-black text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                                      {formatCOP(b.monto)} COP
                                    </span>
                                    <span className="text-[9px] font-black uppercase bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">
                                      {b.tipologia}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-zinc-500 mt-1">
                                    Frecuencia: {b.tipoPago} • {b.motivo || "Sin justificación adicional"} • Registrado el {b.fecha}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const filtered = (cfg.bonificaciones || []).filter(x => x.id !== b.id);
                                    handleSaveEmployeeUpdates(selectedEmployee.nombre, { bonificaciones: filtered });
                                  }}
                                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                                  title="Eliminar bono"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  );
                }

                // TAB 4: SANCIONES & LLAMADOS DE ATENCIÓN
                if (activeHrTab === "sanctions") {
                  const sanctionsList = cfg.sanciones || [];

                  return (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black uppercase text-brand-ink flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-700" />
                            <span>Llamados de Atención & Medidas Disciplinarias</span>
                          </h4>
                          <p className="text-[11px] text-zinc-500 font-medium">
                            Registro de faltas, memorandos formales y descargos de acuerdo con el Código Sustantivo del Trabajo.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsAddingSanction(true)}
                          className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Expedir Sanción / Memorando</span>
                        </button>
                      </div>

                      {/* FORMULARIO EXPEDIR SANCIÓN */}
                      {isAddingSanction && (
                        <form onSubmit={handleAddSanctionSubmit} className="bg-red-50/70 border-2 border-red-300 p-4 rounded-xl space-y-3">
                          <h5 className="text-xs font-black uppercase text-red-950">Nuevo Llamado de Atención / Memorando</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Tipo de Medida</label>
                              <select
                                value={newSanctionType}
                                onChange={(e: any) => setNewSanctionType(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer"
                              >
                                <option value="Llamado de Atención Verbal">Llamado de Atención Verbal (Constancia)</option>
                                <option value="Memorando Escrito">Memorando Escrito Formal</option>
                                <option value="Suspensión Disciplinaria">Suspensión Disciplinaria</option>
                                <option value="Acta de Descargos">Acta de Descargos / Falta Grave</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Gravedad de la Falta</label>
                              <select
                                value={newSanctionSeverity}
                                onChange={(e: any) => setNewSanctionSeverity(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer"
                              >
                                <option value="Leve">Falta Leve</option>
                                <option value="Moderada">Falta Moderada</option>
                                <option value="Grave">Falta Grave</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Motivo Principal</label>
                              <input
                                type="text"
                                required
                                placeholder="Ej. Retardo injustificado de 45 min"
                                value={newSanctionReason}
                                onChange={(e) => setNewSanctionReason(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                              />
                            </div>
                          </div>

                          {newSanctionType === "Suspensión Disciplinaria" && (
                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Días de Suspensión sin Sueldo</label>
                              <input
                                type="number"
                                min={1}
                                max={8}
                                value={newSanctionDays}
                                onChange={(e) => setNewSanctionDays(Number(e.target.value))}
                                className="w-32 bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                              />
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Descripción de los Hechos</label>
                            <textarea
                              rows={2}
                              required
                              placeholder="Relato de lo sucedido, fecha, hora y afectación a la operación..."
                              value={newSanctionDescription}
                              onChange={(e) => setNewSanctionDescription(e.target.value)}
                              className="w-full bg-white border border-zinc-300 p-2 text-xs font-medium rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Compromiso Adquirido por el Empleado</label>
                            <input
                              type="text"
                              placeholder="Ej. El colaborador se compromete a reportar previamente cualquier eventualidad..."
                              value={newSanctionCommitment}
                              onChange={(e) => setNewSanctionCommitment(e.target.value)}
                              className="w-full bg-white border border-zinc-300 p-2 font-medium rounded-lg outline-none"
                            />
                          </div>

                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsAddingSanction(false)}
                              className="px-3 py-1 bg-zinc-200 text-zinc-800 text-xs font-black uppercase rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1 bg-red-800 text-white text-xs font-black uppercase rounded-lg cursor-pointer"
                            >
                              Registrar Sanción
                            </button>
                          </div>
                        </form>
                      )}

                      {/* HISTORIAL DE SANCIONES */}
                      <div className="space-y-2">
                        {sanctionsList.length === 0 ? (
                          <div className="p-8 text-center text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center space-x-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span>Colaborador con legajo limpio. No registra antecedentes disciplinarios.</span>
                          </div>
                        ) : (
                          sanctionsList.map((s) => (
                            <div key={s.id} className="bg-white border-2 border-red-200 p-4 rounded-xl text-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="font-black text-red-900 text-sm">{s.tipo}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                    s.gravedad === "Grave" ? "bg-red-600 text-white" : s.gravedad === "Moderada" ? "bg-amber-100 text-amber-900" : "bg-zinc-100 text-zinc-700"
                                  }`}>
                                    {s.gravedad}
                                  </span>
                                  <span className="text-zinc-500 font-bold">• {s.fecha}</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const filtered = (cfg.sanciones || []).filter(x => x.id !== s.id);
                                    handleSaveEmployeeUpdates(selectedEmployee.nombre, { sanciones: filtered });
                                  }}
                                  className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                  title="Eliminar registro"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <p className="font-bold text-zinc-800">
                                <strong>Motivo:</strong> {s.motivo}
                              </p>
                              <p className="text-zinc-600 leading-relaxed">
                                {s.descripcion}
                              </p>
                              {s.compromiso && (
                                <p className="text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200 font-medium">
                                  <strong>Compromiso:</strong> {s.compromiso}
                                </p>
                              )}
                              {s.diasSuspension && (
                                <p className="text-red-800 font-black">
                                  Medida: {s.diasSuspension} días de suspensión temporal de labores sin remuneración.
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                }

                // TAB 5: VACACIONES & PERMISOS
                if (activeHrTab === "vacations") {
                  const vacList = cfg.vacaciones || [];
                  const disfrutados = vacList.filter(v => v.tipo === "Vacaciones Disfrutadas").reduce((s, v) => s + v.diasHabiles, 0);
                  const pendientes = Math.max(0, vacInfo.diasCausados - disfrutados);

                  return (
                    <div className="space-y-5">
                      {/* BALANCES DE VACACIONES SEGÚN CST */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl">
                          <span className="text-[10px] font-black uppercase text-blue-800 block">Días Causados por Ley</span>
                          <span className="text-2xl font-black text-blue-950 font-mono mt-1 block">
                            {vacInfo.diasCausados} días
                          </span>
                          <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
                            {vacInfo.diasLaborados} días laborados desde {hr.fechaIngreso || "ingreso"}
                          </span>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
                          <span className="text-[10px] font-black uppercase text-amber-800 block">Días Disfrutados / Compensados</span>
                          <span className="text-2xl font-black text-amber-950 font-mono mt-1 block">
                            {disfrutados} días
                          </span>
                          <span className="text-[10px] text-amber-700 font-bold block mt-0.5">
                            Registrados formalmente
                          </span>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                          <span className="text-[10px] font-black uppercase text-emerald-800 block">Días Pendientes de Disfrute</span>
                          <span className="text-2xl font-black text-emerald-950 font-mono mt-1 block">
                            {pendientes.toFixed(1)} días
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                            Saldo a favor del colaborador
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-brand-ink">Historial de Vacaciones & Ausencias</h4>
                        <button
                          type="button"
                          onClick={() => setIsAddingVacation(true)}
                          className="px-3 py-1.5 bg-brand-ink hover:bg-black text-white text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Registrar Novedad de Tiempo</span>
                        </button>
                      </div>

                      {/* FORMULARIO AGREGAR VACACIÓN O PERMISO */}
                      {isAddingVacation && (
                        <form onSubmit={handleAddVacationSubmit} className="bg-zinc-50 border border-zinc-300 p-4 rounded-xl space-y-3 text-xs">
                          <h5 className="font-black uppercase text-brand-ink">Registrar Novedad de Tiempo / Vacaciones</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Tipo de Novedad</label>
                              <select
                                value={newVacationType}
                                onChange={(e: any) => setNewVacationType(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-bold rounded-lg outline-none cursor-pointer"
                              >
                                <option value="Vacaciones Disfrutadas">Vacaciones Disfrutadas</option>
                                <option value="Vacaciones Compensadas en Dinero">Vacaciones Compensadas en Dinero</option>
                                <option value="Incapacidad Médica (EPS)">Incapacidad Médica (EPS)</option>
                                <option value="Permiso Remunerado">Permiso Remunerado</option>
                                <option value="Permiso No Remunerado">Permiso No Remunerado</option>
                                <option value="Licencia Legal">Licencia Legal (Luto/Paternidad)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Fecha Inicio</label>
                              <input
                                type="date"
                                required
                                value={newVacationStart}
                                onChange={(e) => setNewVacationStart(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-bold rounded-lg outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Fecha Fin</label>
                              <input
                                type="date"
                                required
                                value={newVacationEnd}
                                onChange={(e) => setNewVacationEnd(e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-bold rounded-lg outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Días Hábiles</label>
                              <input
                                type="number"
                                min={1}
                                required
                                value={newVacationDays}
                                onChange={(e) => setNewVacationDays(Number(e.target.value))}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-bold rounded-lg outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Observaciones / Radicado EPS</label>
                            <input
                              type="text"
                              placeholder="Ej. Periodo 2024-2025 o No. de incapacidad EPS Sanitas..."
                              value={newVacationNotes}
                              onChange={(e) => setNewVacationNotes(e.target.value)}
                              className="w-full bg-white border border-zinc-300 p-1.5 font-medium rounded-lg outline-none"
                            />
                          </div>

                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsAddingVacation(false)}
                              className="px-3 py-1 bg-zinc-200 text-zinc-800 text-xs font-black uppercase rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1 bg-brand-ink text-white text-xs font-black uppercase rounded-lg cursor-pointer"
                            >
                              Guardar Novedad
                            </button>
                          </div>
                        </form>
                      )}

                      {/* LISTA DE VACACIONES */}
                      <div className="space-y-2">
                        {vacList.length === 0 ? (
                          <div className="p-8 text-center text-xs text-zinc-400 font-bold italic bg-zinc-50 border border-dashed border-zinc-300 rounded-xl">
                            No hay periodos de vacaciones o ausencias registradas aún.
                          </div>
                        ) : (
                          vacList.map((v) => (
                            <div key={v.id} className="bg-white border border-zinc-200 p-3 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-black text-brand-ink">{v.tipo}</span>
                                  <span className="font-mono font-bold bg-zinc-100 px-2 py-0.5 rounded text-[10px]">
                                    {v.diasHabiles} días hábiles
                                  </span>
                                  <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                                    {v.estado}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-500 mt-1">
                                  Desde {v.fechaInicio} hasta {v.fechaFin} {v.observaciones ? `• ${v.observaciones}` : ""}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const filtered = (cfg.vacaciones || []).filter(x => x.id !== v.id);
                                  handleSaveEmployeeUpdates(selectedEmployee.nombre, { vacaciones: filtered });
                                }}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                }

                // TAB 6: CENTRO DE REPORTES INDIVIDUALES (MANDAR Y DESCARGAR)
                if (activeHrTab === "reports") {
                  const reportText = generateReportText(selectedEmployee, selectedReportType);

                  return (
                    <div className="space-y-5">
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <div>
                          <h4 className="text-xs font-black text-blue-950 uppercase flex items-center space-x-1.5">
                            <Send className="w-4 h-4 text-blue-700" />
                            <span>Generador y Emisión de Reportes para el Empleado</span>
                          </h4>
                          <p className="text-[11px] text-blue-900 mt-0.5 font-medium">
                            Elige el tipo de reporte formal, visualízalo en tiempo real y envíalo directamente por WhatsApp, Correo o imprímelo.
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <label className="text-[10px] font-black uppercase text-blue-900">Tipo de Documento:</label>
                          <select
                            value={selectedReportType}
                            onChange={(e: any) => setSelectedReportType(e.target.value)}
                            className="bg-white border border-blue-300 text-xs font-bold rounded-lg px-3 py-1.5 outline-none cursor-pointer text-blue-950"
                          >
                            <option value="ficha_360">Informe Integral de Talento Humano (Ficha 360°)</option>
                            <option value="certificado_laboral">Certificación Laboral Oficial</option>
                            <option value="horario_semanal">Cuadro de Horario Semanal</option>
                            <option value="resumen_bonos">Reporte de Bonificaciones & Compensaciones</option>
                          </select>
                        </div>
                      </div>

                      {/* BOTONES DE ENVÍO Y DESCARGA */}
                      <div className="flex items-center gap-2 flex-wrap justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleSendViaWhatsApp(selectedEmployee)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Enviar por WhatsApp</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendViaEmail(selectedEmployee)}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Enviar por Correo</span>
                          </button>

                          <button
                            type="button"
                            onClick={handlePrintReport}
                            className="px-3.5 py-2 bg-zinc-800 hover:bg-black text-white text-xs font-black uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir / PDF</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyReport(selectedEmployee)}
                          className="px-3 py-2 bg-white hover:bg-zinc-100 text-brand-ink border border-zinc-300 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer"
                        >
                          {reportCopied ? "¡Texto Copiado!" : "Copiar Texto"}
                        </button>
                      </div>

                      {/* VISTA PREVIA DEL REPORTE */}
                      <div className="bg-white border-2 border-brand-ink rounded-xl p-5 shadow-xs font-mono text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                        {reportText}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR NUEVO COLABORADOR */}
      {isNewMemberModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewMemberModalOpen(false);
          }}
          className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto"
        >
          <div className="bg-white border-2 border-brand-ink rounded-2xl shadow-[6px_6px_0px_0px_#1C1917] max-w-lg w-full overflow-hidden text-left my-auto">
            <div className="bg-brand-ink text-white p-4 flex items-center justify-between border-b-2 border-brand-ink">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-purple-400" />
                <span>Nuevo Colaborador (Ficha Laboral)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewMemberModalOpen(false)}
                className="p-1 text-zinc-300 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewMember} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. María Fernanda Gómez"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Cédula de Ciudadanía</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 1020730746"
                    value={newMemberCedula}
                    onChange={(e) => setNewMemberCedula(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 p-2 font-mono font-bold rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Cargo Laboral</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => {
                      const role = e.target.value;
                      setNewMemberRole(role);
                      if (role.toLowerCase().includes("pasteler") || role.toLowerCase().includes("cocina")) {
                        setNewMemberArea("Pastelería");
                      } else {
                        setNewMemberArea("Ventas");
                      }
                    }}
                    className="w-full bg-zinc-50 border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer"
                  >
                    <option value="Líder operador">Líder operador (2.0 pts)</option>
                    <option value="Asistente de Servicio">Asistente de Servicio (1.3 pts)</option>
                    <option value="Líder de pastelería">Líder de pastelería (1.5 pts)</option>
                    <option value="Auxiliar de pastelería">Auxiliar de pastelería (0.8 pts)</option>
                    <option value="gerente">Gerente (0.0 pts)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Área</label>
                  <select
                    value={newMemberArea}
                    onChange={(e: any) => setNewMemberArea(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer"
                  >
                    <option value="Ventas">Ventas / Tienda</option>
                    <option value="Pastelería">Pastelería / Cocina</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Salario Base Mensual</label>
                  <input
                    type="number"
                    value={newMemberSalario}
                    onChange={(e) => setNewMemberSalario(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-300 p-2 font-mono font-bold rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Tipo de Contrato</label>
                  <select
                    value={newMemberTipoContrato}
                    onChange={(e: any) => setNewMemberTipoContrato(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer"
                  >
                    <option value="Indefinido">Término Indefinido</option>
                    <option value="Término Fijo">Término Fijo</option>
                    <option value="Obra o Labor">Obra o Labor</option>
                    <option value="Por días">Por días / Ocasional</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="3101234567"
                    value={newMemberTelefono}
                    onChange={(e) => setNewMemberTelefono(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-600 block mb-1">Fecha de Ingreso</label>
                  <input
                    type="date"
                    value={newMemberFechaIngreso}
                    onChange={(e) => setNewMemberFechaIngreso(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 p-2 font-bold rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-[11px] text-purple-900">
                Al guardar, se creará el perfil laboral en la nómina. Si el colaborador requiere acceso al sistema para ingresar pedidos o registrar caja, puedes asignarle su clave en <strong>Seguridad & Roles</strong>.
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewMemberModalOpen(false)}
                  className="px-4 py-2 bg-zinc-200 text-zinc-800 font-black uppercase rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-ink text-white font-black uppercase rounded-lg cursor-pointer shadow-xs hover:bg-black"
                >
                  Crear Ficha Laboral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
