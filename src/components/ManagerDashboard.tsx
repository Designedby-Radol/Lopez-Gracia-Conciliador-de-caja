import React, { useState, useEffect, useMemo } from "react";
import { 
  BarChart3, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles, 
  Clock, 
  HelpCircle, 
  FileCheck, 
  DollarSign, 
  Percent, 
  Gift, 
  TrendingUp, 
  Calendar, 
  ListFilter,
  CheckCircle2,
  XCircle,
  TrendingDown,
  RefreshCw,
  Landmark,
  ArrowRight,
  Trash2,
  FileDown,
  Users,
  UserPlus,
  Plus,
  X,
  UploadCloud,
  FileText,
  LayoutDashboard,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Sliders,
  Save,
  Lock,
  Unlock,
  Bot,
  Info,
  Shield,
  Edit,
  Calculator,
  AlertCircle,
  Package,
  ClipboardCheck,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Wallet,
  Store,
  Coffee,
  Check
} from "lucide-react";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { dbAdapter, resolveLocalId } from "../db/dbAdapter";
import { CierreCaja, UserRole } from "../types";
import Logo from "./Logo";
import PDFUploader from "./PDFUploader";
import InventoryClosure from "./InventoryClosure";
import OperationalChecklist from "./OperationalChecklist";
import IndicadoresDashboard from "./IndicadoresDashboard";
import SalariesManager, {
  BonusConfig,
  DailySchedule,
  EmployeeSalaryConfig,
  getDefaultSchedule,
  calculateHoursFromTimes,
  calculateTotalWeeklyHours,
  MoneyInput,
  formatNumberWithDots,
  parseNumberFromDots
} from "./SalariesManager";
import SecurityAndRoles from "./SecurityAndRoles";
import { EmployeeProfilesManager } from "./EmployeeProfilesManager";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const ROLE_POINTS_MAP: Record<string, number> = {
  "Lider de punto": 2.0,
  "Líder de punto": 2.0,
  "Líder operador": 2.0,
  "Lider operador": 2.0,
  "Líder de pastelería": 1.5,
  "Lider de pasteleria": 1.5,
  "Auxiliar de pastelería": 0.8,
  "Auxiliar de pasteleria": 0.8,
  "Asistente de pasteleria": 0.8,
  "Asistente de Servicio": 1.3,
  "Asistente de servicio": 1.3,
  "Asistente de servicio tiempo completo (TC)": 1.3,
  "Asistente de servicio medio tiempo (MT)": 1.0,
  "Aux de Venta": 1.0,
  "colaborador": 1.0,
  "gerente": 0.0,
  "Gerente": 0.0
};

export const getRolePoints = (roleName: string): number => {
  if (!roleName) return 1.0;
  const clean = roleName.trim();
  if (ROLE_POINTS_MAP[clean] !== undefined) return ROLE_POINTS_MAP[clean];

  const lower = clean.toLowerCase();
  if (lower.includes("gerente")) return 0.0;
  if (lower.includes("lider de punto") || lower.includes("líder de punto") || lower.includes("operador") || (lower.includes("lider") && !lower.includes("pasteler")) || (lower.includes("líder") && !lower.includes("pasteler"))) return 2.0;
  if (lower.includes("pasteler")) {
    if (lower.includes("líder") || lower.includes("lider")) return 1.5;
    return 0.8;
  }
  if (lower.includes("asistente") || lower.includes("aux")) {
    if (lower.includes("medio") || lower.includes("mt")) return 1.0;
    return 1.3;
  }
  return 1.0;
};

interface ManagerDashboardProps {
  onLogout: () => void;
  username: string;
  local?: string;
}

export default function ManagerDashboard({ onLogout, username, local = "Chapinero" }: ManagerDashboardProps) {
  const [cierres, setCierres] = useState<CierreCaja[]>([]);
  const [activeTab, setActiveTab] = useState<"metrics" | "indicadores" | "audit" | "inventory" | "checklist" | "history" | "propinas" | "team" | "salarios" | "security">("metrics");
  const [auditSubTab, setAuditSubTab] = useState<"pending" | "history">("pending");
  const [selectedCierreId, setSelectedCierreId] = useState<string | null>(null);
  const [posData, setPosData] = useState<{
    efectivoPOS: number;
    tarjetasPOS: number;
    justoPOS: number;
    rappiPOS: number;
    transferenciasPOS: number;
    fileName: string;
    anulacionesNote?: string;
  } | null>(null);

  // States for manual reconciliation values (Paso 2)
  const [reconcileEfectivo, setReconcileEfectivo] = useState<number>(0);
  const [reconcileDatafono, setReconcileDatafono] = useState<number>(0);
  const [reconcileTransferencias, setReconcileTransferencias] = useState<number>(0);
  const [reconcileJusto, setReconcileJusto] = useState<number>(0);
  const [reconcileRappi, setReconcileRappi] = useState<number>(0);
  const [transferenciasCoincide, setTransferenciasCoincide] = useState<boolean>(false);
  const [isLoadingCanales, setIsLoadingCanales] = useState<boolean>(false);

  const [metaVentas, setMetaVentas] = useState<number>(10000000); // Meta por defecto: 10M COP
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("10.000.000");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estados para equipo del turno y política de descuentos
  const [liderInputName, setLiderInputName] = useState("");
  const [auxiliaresInputList, setAuxiliaresInputList] = useState<string[]>([]);
  const [auxiliarInputText, setAuxiliarInputText] = useState("");

  // Estados para Liquidación de Propinas
  const [propinasStartDate, setPropinasStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d.toISOString().split("T")[0];
  });
  const [propinasEndDate, setPropinasEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedCierreIdsForPropinas, setSelectedCierreIdsForPropinas] = useState<string[]>([]);
  const [propinasDaysTeam, setPropinasDaysTeam] = useState<Record<string, string[]>>({});
  const [uploadedPosFileName, setUploadedPosFileName] = useState<string | null>(null);
  const [isProcessingPosPdf, setIsProcessingPosPdf] = useState(false);
  const [processingPosStep, setProcessingPosStep] = useState("");
  const [addingPersonToDayId, setAddingPersonToDayId] = useState<string | null>(null);
  const [newPersonNameForDay, setNewPersonNameForDay] = useState("");
  const [propinasDaysMemberConfig, setPropinasDaysMemberConfig] = useState<Record<string, Record<string, { points: number; roleName: string }>>>({});

  const saveDailyPointsConfig = (updated: Record<string, Record<string, { points: number; roleName: string }>>) => {
    setPropinasDaysMemberConfig(updated);
  };

  const [propinasGlobalAdjustment, setPropinasGlobalAdjustment] = useState<number>(0);

  // Estados de política de propinas por puntos y gestión de equipo
  const [tipDistributionMode, setTipDistributionMode] = useState<"equitativo" | "puntos">("puntos");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Estado y sincronización unificada de Configuración de Equipo, Salarios y Horarios
  const [salariesConfig, setSalariesConfig] = useState<Record<string, EmployeeSalaryConfig>>({});

  const [expandedMemberName, setExpandedMemberName] = useState<string | null>(null);
  const [smmlvBase, setSmmlvBase] = useState<number>(1750905);
  const [auxTranspBase, setAuxTranspBase] = useState<number>(249095);

  const saveSalariesConfigMap = async (newMap: Record<string, EmployeeSalaryConfig>) => {
    setSalariesConfig(newMap);
    for (const [empName, cfg] of Object.entries(newMap)) {
      const member = teamMembers.find(m => m.nombre === empName);
      if (member?.id) {
        try {
          await dbAdapter.saveNominaConfig(member.id, cfg);
        } catch (err) {
          console.error("Error guardando nómina config en Supabase:", err);
        }
      }
    }
  };

  const getEmployeeSalaryConfig = (member: any): EmployeeSalaryConfig => {
    const nameClean = member?.nombre || "";
    const role = member?.role || "Asistente de Servicio";
    const defaultPoints = ROLE_POINTS_MAP[role] !== undefined ? ROLE_POINTS_MAP[role] : 1.0;
    const smmlv = Number(localStorage.getItem("lopez_gracia_smmlv_base")) || 1750905;

    if (nameClean && salariesConfig[nameClean]) {
      const cfg = { ...salariesConfig[nameClean] };
      cfg.puntajePropinas = defaultPoints;
      // Actualizar salarios heredados que estén por debajo del SMMLV vigente
      if (!cfg.salarioBaseMensual || cfg.salarioBaseMensual < 1750905) {
        cfg.salarioBaseMensual = smmlv;
      }
      return cfg;
    }
    const isPasteleria = role.toLowerCase().includes("pasteler") || role.toLowerCase().includes("cocina");

    return {
      nombre: nameClean,
      role: role,
      area: isPasteleria ? "Pastelería" : "Ventas",
      salarioBaseMensual: smmlv,
      tipoContrato: "Indefinido",
      auxilioTransporteAplica: true,
      informacionParticular: "",
      bonoFijoQuincenal: 0,
      descuentoFijoQuincenal: 0,
      puntajePropinas: defaultPoints,
      bonosConfigurados: [],
      diaDescansoContractual: "Domingo",
      horarioSemanal: getDefaultSchedule("Domingo")
    };
  };

  const handleUpdateSalaryConfig = (employeeName: string, updatedField: keyof EmployeeSalaryConfig, value: any) => {
    const currentMember = teamMembers.find(m => m.nombre === employeeName) || { nombre: employeeName, role: "Asistente de Servicio" };
    const current = salariesConfig[employeeName] || getEmployeeSalaryConfig(currentMember);
    
    const updated = {
      ...current,
      [updatedField]: value
    };

    if (updatedField === "salarioBaseMensual") {
      const smmlv = Number(localStorage.getItem("lopez_gracia_smmlv_base")) || 1750905;
      updated.auxilioTransporteAplica = Number(value) <= (smmlv * 2);
    }

    const newMap = {
      ...salariesConfig,
      [employeeName]: updated
    };
    saveSalariesConfigMap(newMap);
  };

  const handleAddBonusMember = (employeeName: string) => {
    const cfg = getEmployeeSalaryConfig(teamMembers.find(m => m.nombre === employeeName) || { nombre: employeeName });
    const newBonus: BonusConfig = {
      id: "bono_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      concepto: "Bono Especial",
      monto: 50000,
      tipologia: "No Salarial"
    };
    handleUpdateSalaryConfig(employeeName, "bonosConfigurados", [...(cfg.bonosConfigurados || []), newBonus]);
  };

  const handleDeleteBonusMember = (employeeName: string, bonusId: string) => {
    const cfg = getEmployeeSalaryConfig(teamMembers.find(m => m.nombre === employeeName) || { nombre: employeeName });
    const filtered = (cfg.bonosConfigurados || []).filter(b => b.id !== bonusId);
    handleUpdateSalaryConfig(employeeName, "bonosConfigurados", filtered);
  };

  const handleUpdateBonusMember = (employeeName: string, bonusId: string, field: keyof BonusConfig, value: any) => {
    const cfg = getEmployeeSalaryConfig(teamMembers.find(m => m.nombre === employeeName) || { nombre: employeeName });
    const updated = (cfg.bonosConfigurados || []).map(b => {
      if (b.id === bonusId) {
        return { ...b, [field]: value };
      }
      return b;
    });
    handleUpdateSalaryConfig(employeeName, "bonosConfigurados", updated);
  };

  const handleUpdateMemberScheduleDay = (employeeName: string, diaIndex: number, field: keyof DailySchedule, value: any) => {
    const cfg = getEmployeeSalaryConfig(teamMembers.find(m => m.nombre === employeeName) || { nombre: employeeName });
    const currentSchedule = [...(cfg.horarioSemanal || getDefaultSchedule(cfg.diaDescansoContractual || "Domingo"))];
    
    const dayObj = { ...currentSchedule[diaIndex], [field]: value };
    if (field === "horaEntrada" || field === "horaSalida" || field === "minutosAlmuerzo" || field === "activo") {
      dayObj.horasCalculadas = calculateHoursFromTimes(
        dayObj.horaEntrada,
        dayObj.horaSalida,
        dayObj.minutosAlmuerzo ?? 60
      );
    }
    
    currentSchedule[diaIndex] = dayObj;
    handleUpdateSalaryConfig(employeeName, "horarioSemanal", currentSchedule);
  };
  
  // Formulario para registrar nuevo miembro (Ficha Laboral)
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberCedula, setNewMemberCedula] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<UserRole>("Asistente de Servicio");
  const [newMemberArea, setNewMemberArea] = useState<"Ventas" | "Pastelería">("Ventas");
  const [newMemberTipoContrato, setNewMemberTipoContrato] = useState<string>("Indefinido");
  const [newMemberSalario, setNewMemberSalario] = useState<number>(1750905);
  const [newMemberAuxTransp, setNewMemberAuxTransp] = useState<boolean>(true);
  const [newMemberDiaDescanso, setNewMemberDiaDescanso] = useState<string>("Domingo");
  const [newMemberPoints, setNewMemberPoints] = useState<string>("1.3");
  const [newMemberIsEligible, setNewMemberIsEligible] = useState(true);

  // Estado para confirmación de eliminación
  const [deletingMemberName, setDeletingMemberName] = useState<string | null>(null);

  // Cargar equipo de Supabase al iniciar y sincronizar
  const loadTeamMembers = async () => {
    try {
      const members = await dbAdapter.getTeamMembers(local);
      const normalized = members.map((m: any) => {
        const role = m.cargo || m.role || "Asistente de Servicio";
        const pts = getRolePoints(role);
        return {
          id: m.id,
          nombre: m.nombre,
          cedula: m.cedula || "",
          password: "••••••••",
          role: role,
          cargo: m.cargo || role,
          local: local,
          puntosPropinas: pts,
          aptoPropinas: typeof m.apto_propinas === "boolean" ? m.apto_propinas : (role !== "gerente" && role !== "Gerencia"),
          activo: typeof m.activo === "boolean" ? m.activo : true
        };
      });
      setTeamMembers(normalized);
    } catch (err: any) {
      console.error("Error cargando equipo de Supabase:", err);
    }
  };

  const loadInitialConfigs = async () => {
    try {
      const [nomConfigs, nomConfigGeneral] = await Promise.all([
        dbAdapter.getAllNominaConfigs(),
        dbAdapter.getConfiguracionNomina(local)
      ]);
      setSalariesConfig(nomConfigs);
      if (nomConfigGeneral) {
        if (nomConfigGeneral.smmlv_base) setSmmlvBase(Number(nomConfigGeneral.smmlv_base));
        if (nomConfigGeneral.aux_transporte_base) setAuxTranspBase(Number(nomConfigGeneral.aux_transporte_base));
      }
    } catch (e) {
      console.error("Error al cargar configuraciones de nómina desde Supabase:", e);
    }
  };

  useEffect(() => {
    loadTeamMembers();
    loadInitialConfigs();
  }, [local]);

  const saveTeamMembers = (updated: any[]) => {
    setTeamMembers(updated);
  };

  const handleDeleteTeamMember = async (memberName: string) => {
    const member = teamMembers.find(m => m.nombre === memberName);
    if (!member?.id) {
      setTeamMembers(teamMembers.filter(m => m.nombre !== memberName));
      return;
    }
    try {
      await dbAdapter.deleteTeamMember(member.id);
      await loadTeamMembers();
      if (expandedMemberName === memberName) setExpandedMemberName(null);
      setDeletingMemberName(null);
    } catch (err: any) {
      console.error("Error al eliminar miembro de Supabase:", err);
      alert("Error al eliminar el colaborador: " + err.message);
    }
  };

  const getMemberConfig = (name: string, closureId?: string) => {
    if (!name) return { puntos: 0, apto: false, role: "" };
    if (name.toLowerCase() === "restaurante") {
      return {
        puntos: 0,
        apto: false,
        role: "Restaurante"
      };
    }

    // Check if there is a daily override for this closure and member name
    if (closureId && propinasDaysMemberConfig[closureId]?.[name]) {
      const override = propinasDaysMemberConfig[closureId][name];
      return {
        puntos: override.points,
        apto: true,
        role: override.roleName
      };
    }

    const member = teamMembers.find(m => m.nombre.toLowerCase() === name.toLowerCase());
    if (member) {
      const role = member.role;
      const puntos = getRolePoints(role);
      return {
        puntos,
        apto: typeof member.aptoPropinas === "boolean" ? member.aptoPropinas : true,
        role: member.role
      };
    }
    // Heurística de fallback si no está registrado
    const nameLower = name.toLowerCase();
    const isLider = nameLower.includes("lider") || nameLower.includes("jefe");
    const isPasteleria = nameLower.includes("pasteleria") || nameLower.includes("pastelera");
    let fallbackRole = "Asistente de Servicio";
    if (isLider) fallbackRole = "Líder operador";
    else if (isPasteleria) fallbackRole = "Auxiliar de pastelería";

    return {
      puntos: ROLE_POINTS_MAP[fallbackRole] !== undefined ? ROLE_POINTS_MAP[fallbackRole] : 1.0,
      apto: true,
      role: fallbackRole
    };
  };

  // Auto-seleccionar cierres cuadrados en el rango de fechas al cargar o cambiar el rango
  useEffect(() => {
    const activeCierres = cierres.filter(c => {
      if (c.estado !== "Cuadrado") return false;
      if (propinasStartDate && c.fecha < propinasStartDate) return false;
      if (propinasEndDate && c.fecha > propinasEndDate) return false;
      return true;
    });
    
    // Auto-seleccionar todos por defecto si cambia el rango o carga inicial
    const ids = activeCierres.map(c => c.id);
    setSelectedCierreIdsForPropinas(ids);
    
    // Inicializar el roster de equipos para cada cierre si no está inicializado
    setPropinasDaysTeam(prev => {
      const updated = { ...prev };
      activeCierres.forEach(c => {
        let team = updated[c.id];
        if (!team) {
          const defaultTeam = [c.liderNombre, ...(c.auxiliaresNombres || [])].filter(Boolean) as string[];
          team = defaultTeam.length > 0 ? defaultTeam : [c.colaboradorNombre].filter(Boolean) as string[];
        }
        
        // Sunday rule for Pastry Leader: Always include her
        const dateObj = new Date(c.fecha + "T12:00:00");
        if (dateObj.getDay() === 0) { // Sunday
          const pastryLiderMember = teamMembers.find(m => m.role.toLowerCase().includes("lider de pasteleria") || m.role.toLowerCase().includes("líder de pastelería"));
          if (pastryLiderMember && !team.includes(pastryLiderMember.nombre)) {
            team = [...team, pastryLiderMember.nombre];
          }
        }
        
        updated[c.id] = team;
      });
      return updated;
    });
  }, [cierres, propinasStartDate, propinasEndDate, teamMembers]);

  // Handler para procesar archivo PDF real de turnos del POS
  const handlePosPdfFile = async (file: File) => {
    setIsProcessingPosPdf(true);
    setProcessingPosStep("Iniciando lector de documentos PDF...");
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Usando pdfjsLib cargado
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        setProcessingPosStep(`Extrayendo texto de página ${i} de ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += " " + pageText;
      }

      setProcessingPosStep("Analizando registros de asistencia y horarios...");
      
      // Heurística de búsqueda: nombres de colaboradores conocidos
      const knownNamesSet = new Set<string>();
      cierres.forEach(c => {
        if (c.liderNombre) knownNamesSet.add(c.liderNombre);
        if (c.auxiliaresNombres) {
          c.auxiliaresNombres.forEach((name: string) => {
            if (name) knownNamesSet.add(name);
          });
        }
      });
      const knownNames: string[] = Array.from(knownNamesSet);
      if (knownNames.length === 0) {
        knownNames.push("Juan Pérez", "María Gómez", "Carlos Ruiz", "Ana Martínez", "Luis Castro");
      }

      // Parser de PDF de Asistencia avanzado por documento e identificación de días
      const docRegex = /\b\d{8,11}\b/g;
      
      const tableMarker = "Hora inicio marcación";
      const markerIndex = fullText.indexOf(tableMarker);
      const headerSection = markerIndex !== -1 ? fullText.substring(0, markerIndex) : fullText;

      const headerMatches: { index: number; docId: string }[] = [];
      let match;
      docRegex.lastIndex = 0;
      while ((match = docRegex.exec(headerSection)) !== null) {
        headerMatches.push({ index: match.index, docId: match[0] });
      }

      const uniqueEmployees: { name: string; docId: string }[] = [];
      const seenDocs = new Set<string>();

      for (let i = 0; i < headerMatches.length; i++) {
        const docId = headerMatches[i].docId;
        if (seenDocs.has(docId)) continue;
        seenDocs.add(docId);

        const start = headerMatches[i].index + docId.length;
        const nextMatchIndex = (i + 1 < headerMatches.length) ? headerMatches[i + 1].index : headerSection.length;
        const segment = headerSection.substring(start, nextMatchIndex).replace(/\s+/g, " ").trim();
        
        const words = segment.split(" ");
        const nameWords: string[] = [];
        for (const w of words) {
          const wl = w.toLowerCase();
          if (
            wl.includes("/") || 
            wl.includes(":") || 
            /^\d+$/.test(w) ||
            ["friday", "saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", 
             "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo",
             "reporte", "horas", "trabajadas", "nombre", "empresa", "altagracia", "fecha", "punto", "cargo", "página"].includes(wl)
          ) {
            break;
          }
          nameWords.push(w);
        }
        
        const fullName = nameWords.join(" ").trim();
        if (fullName && fullName.length > 3) {
          const cleanedName = fullName.split(" ")
            .filter(w => !/^\d+$/.test(w))
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          
          uniqueEmployees.push({
            name: cleanedName,
            docId
          });
        }
      }

      // Parser de records individuales de días trabajados (para compatibilidad/fallback)
      const parsedRecords: { name: string; day?: string }[] = [];
      const allMatches: { index: number; docId: string }[] = [];
      docRegex.lastIndex = 0;
      while ((match = docRegex.exec(fullText)) !== null) {
        allMatches.push({ index: match.index, docId: match[0] });
      }

      for (let i = 0; i < allMatches.length; i++) {
        const start = allMatches[i].index + allMatches[i].docId.length;
        const end = (i + 1 < allMatches.length) ? allMatches[i + 1].index : fullText.length;
        const segment = fullText.substring(start, end).replace(/\s+/g, " ").trim();
        
        const words = segment.split(" ");
        if (words.length > 0) {
          const lastWord = words[words.length - 1].toLowerCase();
          const englishDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
          const spanishDays = ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo"];
          
          let day: string | undefined = undefined;
          let nameWords = [...words];
          
          if (englishDays.includes(lastWord) || spanishDays.includes(lastWord)) {
            day = lastWord;
            nameWords.pop();
          }
          
          const fullName = nameWords.join(" ").trim();
          
          if (
            fullName && 
            fullName.length > 3 && 
            !fullName.toLowerCase().includes("doc") && 
            !fullName.toLowerCase().includes("nombre") && 
            !fullName.toLowerCase().includes("apellido") && 
            !fullName.toLowerCase().includes("punto de venta")
          ) {
            const cleanedName = fullName.split(" ")
              .filter(w => !/^\d+$/.test(w))
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");
            
            parsedRecords.push({
              name: cleanedName,
              day: day
            });
          }
        }
      }

      // Procesar bloques de horas en la segunda sección del documento
      let timeBlocksText = markerIndex !== -1 ? fullText.substring(markerIndex) : "";
      const blocks = timeBlocksText.split(/Totales por usuario\s*=/i);

      const detectedDailyPoints: Record<string, Record<string, { points: number; roleName: string }>> = {};
      const employeeDatesMap: Record<string, Set<string>> = {};

      uniqueEmployees.forEach((emp, index) => {
        const block = blocks[index];
        if (!block) return;

        const employeeDates = new Set<string>();
        employeeDatesMap[emp.name] = employeeDates;

        const timestampRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/gi;
        const matchesInBlock = [...block.matchAll(timestampRegex)];
        
        // Los ingresos están en índices pares (0, 2, 4...) en el formato de listado
        const clockIns = matchesInBlock.filter((_, idx) => idx % 2 === 0);

        clockIns.forEach(m => {
          const month = m[1].padStart(2, "0");
          const dayVal = m[2].padStart(2, "0");
          const year = m[3];
          const dateStr = `${year}-${month}-${dayVal}`; // Formato YYYY-MM-DD
          employeeDates.add(dateStr);

          // Convertir hora de ingreso a formato 24 horas y minutos
          let hour24 = parseInt(m[4], 10);
          const minute = parseInt(m[5], 10);
          const amPm = m[7] ? m[7].toUpperCase() : "";
          if (amPm === "PM" && hour24 !== 12) {
            hour24 += 12;
          } else if (amPm === "AM" && hour24 === 12) {
            hour24 = 0;
          }

          // Minutos totales desde la medianoche
          const totalMinutes = hour24 * 60 + minute;
          
          // Objetivos ideales: Tiempo Completo (TC) a las 12:00 PM (720 min) y Medio Tiempo (MT) a las 2:00 PM / 14:00 (840 min)
          const targetTC = 12 * 60; // 12:00 PM = 720 min
          const targetMT = 14 * 60; // 2:00 PM = 840 min

          const diffTC = Math.abs(totalMinutes - targetTC);
          const diffMT = Math.abs(totalMinutes - targetMT);

          // Clasificación según proximidad y rangos óptimos de 10-15 minutos
          let isMT = false;
          if (diffMT < diffTC) {
            // El ingreso es más cercano a las 2:00 PM (MT)
            isMT = true;
          } else {
            // El ingreso es más cercano a las 12:00 PM (TC)
            isMT = false;
          }

          const points = isMT ? 1.0 : 1.3;
          const roleName = isMT 
            ? "Asistente de servicio medio tiempo (MT)" 
            : "Asistente de servicio tiempo completo (TC)";

          if (!detectedDailyPoints[dateStr]) {
            detectedDailyPoints[dateStr] = {};
          }
          detectedDailyPoints[dateStr][emp.name] = { points, roleName };
        });
      });

      const parsedAttendance: Record<string, string[]> = {};

      const activeCierres = cierres.filter(c => {
        if (c.estado !== "Cuadrado") return false;
        if (propinasStartDate && c.fecha < propinasStartDate) return false;
        if (propinasEndDate && c.fecha > propinasEndDate) return false;
        return true;
      });

      const englishDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const spanishDays = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const spanishDaysAccent = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

      // Copiar configuración diaria actual para actualizarla con los datos detectados
      const updatedDailyConfig = { ...propinasDaysMemberConfig };

      for (const c of activeCierres) {
        const dateObj = new Date(c.fecha + "T12:00:00");
        const dayIndex = dateObj.getDay();
        const dayEng = englishDays[dayIndex];
        const daySpa = spanishDays[dayIndex];
        const daySpaAccent = spanishDaysAccent[dayIndex];

        // 1. Identificar quiénes trabajaron en la fecha del cierre
        const namesWorking: string[] = [];

        uniqueEmployees.forEach(emp => {
          if (employeeDatesMap[emp.name]?.has(c.fecha)) {
            namesWorking.push(emp.name);
          }
        });

        // Heurística de fallback utilizando días de la semana si la búsqueda por fecha exacta no arrojó resultados
        if (namesWorking.length === 0) {
          const namesWorkingFallback = parsedRecords
            .filter(r => r.day && (
              r.day.toLowerCase() === dayEng || 
              r.day.toLowerCase() === daySpa || 
              r.day.toLowerCase() === daySpaAccent
            ))
            .map(r => r.name);
          namesWorking.push(...Array.from(new Set(namesWorkingFallback)));
        }

        // Excepción de Domingo: Siempre agregar a la Líder de pastelería
        if (dayIndex === 0) {
          const pastryLiderMember = teamMembers.find(m => m.role.toLowerCase().includes("lider de pasteleria") || m.role.toLowerCase().includes("líder de pastelería"));
          if (pastryLiderMember && !namesWorking.includes(pastryLiderMember.nombre)) {
            namesWorking.push(pastryLiderMember.nombre);
          }
        }

        const finalRoster = Array.from(new Set(namesWorking));
        parsedAttendance[c.id] = finalRoster;

        // 2. Mapear los puntos y roles de asistentes detectados para este día
        if (!updatedDailyConfig[c.id]) {
          updatedDailyConfig[c.id] = {};
        }

        finalRoster.forEach(name => {
          if (detectedDailyPoints[c.fecha]?.[name]) {
            const detected = detectedDailyPoints[c.fecha][name];
            const config = getMemberConfig(name);
            const isAsistente = config.role.toLowerCase().includes("asistente de servicio") || config.role.toLowerCase().includes("aux de venta");
            if (isAsistente) {
              updatedDailyConfig[c.id][name] = detected;
            }
          }
        });
      }

      // Guardar el estado sincronizado
      saveDailyPointsConfig(updatedDailyConfig);
      setPropinasDaysTeam(prev => ({ ...prev, ...parsedAttendance }));
      setUploadedPosFileName(file.name);
      
      // Mostrar resumen visual de detección exitosa al usuario
      alert("¡Reporte de horarios procesado con éxito!\n\n" +
            "- Se extrajeron " + uniqueEmployees.length + " colaboradores conocidos.\n" +
            "- Se asignaron automáticamente los puntos correspondientes a Asistentes (TC o MT) según sus horas de marcación de ingreso.\n" +
            "- Se aplicó la política de inclusión automática de la Líder de pastelería los domingos.");
    } catch (error) {
      console.error("Error al procesar PDF de asistencia:", error);
      alert("No se pudo extraer texto del PDF de manera automática. Usaremos el equipo registrado en los cierres de caja.");
    } finally {
      setIsProcessingPosPdf(false);
    }
  };

  const handleDeleteCierre = async (id: string) => {
    try {
      await dbAdapter.deleteCierre(id);
      setDeletingId(null);
      await loadCierres();
    } catch (err) {
      console.error("Error al eliminar cierre de caja:", err);
    }
  };

  // Cargar cierres
  const loadCierres = async () => {
    setIsLoading(true);
    try {
      const data = await dbAdapter.getCierres();
      setCierres(data);
    } catch (err) {
      console.error("Error al cargar cierres de caja:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCierres();
  }, []);

  useEffect(() => {
    if (activeTab === "audit" && auditSubTab === "pending" && !selectedCierreId && cierres.length > 0) {
      const firstPending = cierres.find(c => c.estado !== "Cuadrado" && c.estado !== "Anulado");
      if (firstPending) {
        handleSelectCierre(firstPending.id);
      }
    }
  }, [activeTab, auditSubTab, cierres, selectedCierreId]);

  const handleSelectCierre = async (id: string) => {
    setSelectedCierreId(id);
    setTransferenciasCoincide(false);

    const selected = cierres.find(c => c.id === id);
    if (selected) {
      setLiderInputName(selected.liderNombre || selected.colaboradorNombre || "");
      setAuxiliaresInputList(selected.auxiliaresNombres || []);
      
      const isCuadrado = selected.estado === "Cuadrado";
      const hasSavedPOS = selected.efectivoPOS !== undefined && selected.efectivoPOS !== null && selected.efectivoPOS > 0;

      if (hasSavedPOS) {
        setPosData({
          efectivoPOS: selected.efectivoPOS || 0,
          tarjetasPOS: selected.tarjetasPOS || 0,
          justoPOS: selected.justoPOS || 0,
          rappiPOS: selected.rappiPOS || 0,
          transferenciasPOS: selected.transferenciasPOS || 0,
          fileName: selected.posFileName || (isCuadrado ? "Archivo Procesado" : "Ingreso Manual"),
        });
        setReconcileEfectivo(selected.efectivoPOS || 0);
        setReconcileDatafono(selected.tarjetasPOS || 0);
        setReconcileTransferencias(selected.transferenciasPOS || 0);
        setTransferenciasCoincide(true);
        setReconcileJusto(selected.justoCierre || 0);
        setReconcileRappi(selected.rappiCierre || 0);
      } else {
        setPosData(null);
        setReconcileEfectivo(selected.efectivoCierre);
        setReconcileDatafono(selected.datafonoCierre);
        setReconcileTransferencias(selected.transferenciasCierre || selected.transferenciasPOS || 0);
        setReconcileJusto(selected.justoCierre || selected.justoPOS || 0);
        setReconcileRappi(selected.rappiCierre || selected.rappiPOS || 0);

        try {
          setIsLoadingCanales(true);
          const localIdToUse = selected.localId || selected.local_id || (await resolveLocalId(local));
          if (localIdToUse && selected.fecha) {
            const [justoResp, intuiposResp] = await Promise.all([
              fetch(`/api/canales/justo/ventas?localId=${encodeURIComponent(localIdToUse)}&fecha=${encodeURIComponent(selected.fecha)}`)
                .then(r => r.json())
                .catch(err => {
                  console.warn("Error consultando Justo:", err);
                  return { configurado: false };
                }),
              fetch(`/api/canales/intuipos/ventas?localId=${encodeURIComponent(localIdToUse)}&fecha=${encodeURIComponent(selected.fecha)}`)
                .then(r => r.json())
                .catch(err => {
                  console.warn("Error consultando IntuiPOS:", err);
                  return { configurado: false };
                }),
            ]);

            // Si IntuiPOS está configurado para ese local, poblar la columna POS y auto-completar canales
            if (intuiposResp?.configurado) {
              const posJustoVal = intuiposResp.justoPOS || 0;
              const posRappiVal = intuiposResp.rappiPOS || 0;
              const posTransfVal = intuiposResp.transferenciasPOS || 0;

              setPosData({
                efectivoPOS: intuiposResp.efectivoPOS || 0,
                tarjetasPOS: intuiposResp.tarjetasPOS || 0,
                justoPOS: posJustoVal,
                rappiPOS: posRappiVal,
                transferenciasPOS: posTransfVal,
                fileName: "API IntuiPOS",
              });
              setReconcileEfectivo(intuiposResp.efectivoPOS || 0);
              // Para tarjetas / datáfonos, la conciliación es contra confirmación manual (vouchers / cierre físico)
              setReconcileDatafono(selected.datafonoCierre || 0);

              // Auto-completar dato de Justo automáticamente (API Justo o CxC JUSTO del POS)
              const autoJusto = (justoResp?.configurado && justoResp.totalVentas !== undefined)
                ? justoResp.totalVentas
                : posJustoVal;
              setReconcileJusto(autoJusto);

              // Auto-completar Rappi y Transferencias
              if (posRappiVal > 0 && (!selected.rappiCierre || selected.rappiCierre === 0)) {
                setReconcileRappi(posRappiVal);
              }
              if (posTransfVal > 0) {
                setReconcileTransferencias(posTransfVal);
                setTransferenciasCoincide(true);
              }

              // Actualizar el cierre en memoria para que la tabla muestre el dato traído automáticamente de las APIs
              setCierres(prev =>
                prev.map(c => {
                  if (c.id === selected.id) {
                    return {
                      ...c,
                      justoCierre: c.justoCierre || autoJusto,
                      transferenciasCierre: c.transferenciasCierre || posTransfVal,
                      justoPOS: posJustoVal,
                      rappiPOS: posRappiVal,
                      transferenciasPOS: posTransfVal,
                      efectivoPOS: intuiposResp.efectivoPOS || 0,
                      tarjetasPOS: intuiposResp.tarjetasPOS || 0,
                    };
                  }
                  return c;
                })
              );
            } else if (justoResp?.configurado && justoResp.totalVentas !== undefined) {
              setReconcileJusto(justoResp.totalVentas || 0);
              setCierres(prev =>
                prev.map(c => {
                  if (c.id === selected.id) {
                    return { ...c, justoCierre: c.justoCierre || justoResp.totalVentas };
                  }
                  return c;
                })
              );
            }
          }
        } catch (canalesErr) {
          console.warn("No se pudieron cargar canales automáticamente:", canalesErr);
        } finally {
          setIsLoadingCanales(false);
        }
      }
    } else {
      setLiderInputName("");
      setAuxiliaresInputList([]);
      setPosData(null);
      setReconcileEfectivo(0);
      setReconcileDatafono(0);
      setReconcileTransferencias(0);
      setReconcileJusto(0);
      setReconcileRappi(0);
      setTransferenciasCoincide(false);
    }
    setAuxiliarInputText("");
  };

  const formatInputNumber = (num: number) => {
    if (num === 0) return "";
    return new Intl.NumberFormat("es-CO").format(num);
  };

  const updateReconcileField = (field: "efectivo" | "tarjetas" | "justo" | "rappi" | "transferencias", rawValue: string) => {
    const cleanValue = parseInt(rawValue.replace(/\D/g, ""), 10) || 0;
    if (field === "efectivo") setReconcileEfectivo(cleanValue);
    else if (field === "tarjetas") setReconcileDatafono(cleanValue);
    else if (field === "justo") setReconcileJusto(cleanValue);
    else if (field === "rappi") setReconcileRappi(cleanValue);
    else if (field === "transferencias") setReconcileTransferencias(cleanValue);
  };

  const handleDataExtracted = (extracted: {
    efectivoPOS: number;
    tarjetasPOS: number;
    justoPOS: number;
    rappiPOS: number;
    transferenciasPOS: number;
    fileName: string;
    anulacionesNote?: string;
  }) => {
    setPosData(extracted);
    
    // Auto-populate reconciliation fields with POS parsed values
    setReconcileEfectivo(extracted.efectivoPOS);
    setReconcileDatafono(extracted.tarjetasPOS);
    setReconcileTransferencias(0);
    setTransferenciasCoincide(false);
    setReconcileJusto(0); // Starts at zero as requested
    setReconcileRappi(0);  // Starts at zero as requested

    // Automatically fill the closure's Rappi, Justo and Transferencias with POS values
    // because the collaborator did not fill them (team filled only physical cash/card)
    setCierres((prevCierres) =>
      prevCierres.map((c) => {
        if (c.id === selectedCierreId) {
          return {
            ...c,
            justoCierre: extracted.justoPOS,
            rappiCierre: extracted.rappiPOS,
            transferenciasCierre: extracted.transferenciasPOS,
            posFileName: extracted.fileName,
          };
        }
        return c;
      })
    );
  };

  // Guardar y aprobar conciliación (Paso 1 es opcional)
  const handleApproveConciliation = async (cierre: CierreCaja) => {
    // Si no se cargó reporte POS, usar valores de conciliación o registrados previamente
    const posEfectivo = posData ? posData.efectivoPOS : (cierre.efectivoPOS ?? reconcileEfectivo);
    const posTarjetas = posData ? posData.tarjetasPOS : (cierre.tarjetasPOS ?? reconcileDatafono);
    const posJusto = posData ? posData.justoPOS : (cierre.justoPOS ?? reconcileJusto);
    const posRappi = posData ? posData.rappiPOS : (cierre.rappiPOS ?? reconcileRappi);
    const posTransferencias = posData ? posData.transferenciasPOS : (cierre.transferenciasPOS ?? reconcileTransferencias);

    const difEfectivo = cierre.efectivoCierre - reconcileEfectivo;
    const difTarjetas = cierre.datafonoCierre - reconcileDatafono;
    const difJusto = reconcileJusto - posJusto;
    const difRappi = reconcileRappi - posRappi;
    const difTransferencias = reconcileTransferencias - posTransferencias;

    const totalDif = difEfectivo + difTarjetas + difJusto + difRappi + difTransferencias;

    let descuadreLider = 0;
    let descuadreAuxiliar = 0;

    if (totalDif < 0) {
      const shortage = Math.abs(totalDif);
      descuadreLider = Math.round(shortage * 0.6);
      const remaining40 = shortage - descuadreLider;

      // Política de descuadres (60/40) con los nuevos cargos:
      // Solo participan auxiliares en turno con cargo Asistente de servicio / Auxiliar Pasteleria.
      // Se excluyen explícitamente: Gerencia, admin, y Lider Pasteleria (responde por producción, no por caja).
      const eligibleAuxiliares = auxiliaresInputList.filter((auxName) => {
        const member = teamMembers.find(m => m.nombre.toLowerCase() === auxName.toLowerCase());
        if (!member) return true;
        const c = (member.cargo || member.role || "").toLowerCase();
        return !c.includes("geren") && !c.includes("admin") && !c.includes("lider pasteler") && !c.includes("líder de pasteler");
      });

      if (eligibleAuxiliares.length > 0) {
        descuadreAuxiliar = Math.round(remaining40 / eligibleAuxiliares.length);
      }
    }

    const updates: Partial<CierreCaja> = {
      estado: "Cuadrado",
      efectivoPOS: posEfectivo,
      tarjetasPOS: posTarjetas,
      justoPOS: posJusto,
      rappiPOS: posRappi,
      transferenciasPOS: posTransferencias,
      
      // Save the final reconciled values back to the main closure object
      justoCierre: reconcileJusto,
      rappiCierre: reconcileRappi,
      transferenciasCierre: reconcileTransferencias,
      
      difEfectivo,
      difTarjetas,
      difJusto,
      difRappi,
      difTransferencias,
      auditadoPor: username,
      auditadoAt: new Date().toISOString(),
      posFileName: posData?.fileName || cierre.posFileName || "Auditoría Directa (Sin Reporte POS)",
      novedades: posData?.anulacionesNote 
        ? (cierre.novedades ? `${cierre.novedades} | ${posData.anulacionesNote}` : posData.anulacionesNote)
        : cierre.novedades,
      // Guardar información del equipo y política de descuentos
      liderNombre: liderInputName.trim() || cierre.colaboradorNombre || "N/A",
      auxiliaresNombres: auxiliaresInputList,
      descuadreLider,
      descuadreAuxiliar
    };

    try {
      await dbAdapter.updateCierre(cierre.id, updates);
      setSelectedCierreId(null);
      setPosData(null);
      await loadCierres();
      // Cambiar a la pestaña de historial de cierres para ver el resultado cargado
      setActiveTab("audit");
      setAuditSubTab("history");
    } catch (error) {
      console.error("Error al aprobar conciliación:", error);
      alert("Hubo un error al procesar la aprobación.");
    }
  };

  // Filtrar cierres por estado
  const pendingCierres = cierres.filter(c => c.estado === "Pendiente por Cuadrar");
  
  // Guardar todos los cierres cuadrados para métricas generales
  const allSquaredCierres = useMemo(() => {
    return cierres.filter(c => c.estado === "Cuadrado");
  }, [cierres]);

  // Estados de fecha para filtrar el historial de cierres
  const [historyStartDate, setHistoryStartDate] = useState<string>("");
  const [historyEndDate, setHistoryEndDate] = useState<string>("");
  const [historyDeficitFilter, setHistoryDeficitFilter] = useState<"all" | "deficit">("all");

  // Cierres cuadrados filtrados para el historial
  const squaredCierres = useMemo(() => {
    return cierres.filter(c => {
      if (c.estado !== "Cuadrado") return false;
      if (historyStartDate && c.fecha < historyStartDate) return false;
      if (historyEndDate && c.fecha > historyEndDate) return false;
      
      if (historyDeficitFilter === "deficit") {
        const sum = (c.difEfectivo || 0) + (c.difTarjetas || 0) + (c.difJusto || 0) + (c.difRappi || 0) + (c.difTransferencias || 0);
        const hasAnyDeficit = sum < 0 || (c.difEfectivo || 0) < 0 || (c.difTarjetas || 0) < 0 || (c.difJusto || 0) < 0 || (c.difRappi || 0) < 0 || (c.difTransferencias || 0) < 0;
        if (!hasAnyDeficit) return false;
      }
      return true;
    });
  }, [cierres, historyStartDate, historyEndDate, historyDeficitFilter]);

  // Filtros de fecha para métricas
  const [metricsFilter, setMetricsFilter] = useState<"all" | "month" | "custom">("all");
  const [metricsStartDate, setMetricsStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [metricsEndDate, setMetricsEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const filteredMetricsCierres = useMemo(() => {
    return allSquaredCierres.filter(c => {
      if (metricsFilter === "month") {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const currentMonthPrefix = `${year}-${month}`;
        return c.fecha.startsWith(currentMonthPrefix);
      }
      if (metricsFilter === "custom") {
        const date = c.fecha; // YYYY-MM-DD
        const start = metricsStartDate;
        const end = metricsEndDate;
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      }
      return true; // "all"
    });
  }, [allSquaredCierres, metricsFilter, metricsStartDate, metricsEndDate]);

  // Cálculos de Métricas Dinámicas (Solo sobre cierres con estado "Cuadrado" y filtrados)
  const totalEfectivo = filteredMetricsCierres.reduce((acc, c) => acc + (c.efectivoCierre || 0), 0);
  const totalTarjetas = filteredMetricsCierres.reduce((acc, c) => acc + (c.datafonoCierre || 0), 0);
  const totalJusto = filteredMetricsCierres.reduce((acc, c) => acc + (c.justoCierre || 0), 0);
  const totalRappi = filteredMetricsCierres.reduce((acc, c) => acc + (c.rappiCierre || 0), 0);
  const totalTransferencias = filteredMetricsCierres.reduce((acc, c) => acc + (c.transferenciasCierre || 0), 0);
  const totalPropinas = filteredMetricsCierres.reduce((acc, c) => acc + (c.propinas || 0), 0);
  
  // Las ventas totales del local corresponden a la suma de ventas por canales aprobados
  const totalVentasReales = totalEfectivo + totalTarjetas + totalJusto + totalRappi + totalTransferencias;

  // Eficiencia de cuadre (porcentaje de cierres con desfase total igual a 0)
  const perfectSquareCount = filteredMetricsCierres.filter(c => 
    (c.difEfectivo === 0) && (c.difTarjetas === 0) && (c.difJusto === 0) && (c.difRappi === 0) && (c.difTransferencias === 0 || c.difTransferencias === undefined)
  ).length;
  const squareEfficiency = filteredMetricsCierres.length > 0 
    ? Math.round((perfectSquareCount / filteredMetricsCierres.length) * 100) 
    : 100;

  // Promedio de propinas diarias
  const avgPropinas = filteredMetricsCierres.length > 0 
    ? Math.round(totalPropinas / filteredMetricsCierres.length) 
    : 0;

  // Estados interactivos para el nuevo Dashboard
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [overviewPeriod, setOverviewPeriod] = useState<"mensual" | "semanal" | "diario">("mensual");
  const [selectedWeekdayIndex, setSelectedWeekdayIndex] = useState<number | null>(5); // Default Sábado
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Cálculos de Ventas por Día de la Semana (Lunes a Domingo)
  const salesByWeekday = useMemo(() => {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    filteredMetricsCierres.forEach(c => {
      const d = new Date(c.fecha + "T12:00:00");
      const dayIndex = d.getDay(); // 0: Dom, 1: Lun, ..., 6: Sáb
      const totalC = (c.efectivoCierre || 0) + (c.datafonoCierre || 0) + (c.justoCierre || 0) + (c.rappiCierre || 0) + (c.transferenciasCierre || 0);
      dayTotals[dayIndex] += totalC;
      dayCounts[dayIndex] += 1;
    });

    // Reordenar a formato Lunes a Domingo (1 a 6, luego 0)
    const orderedIndices = [1, 2, 3, 4, 5, 6, 0];
    const result = orderedIndices.map(idx => {
      const total = dayTotals[idx];
      const avg = dayCounts[idx] > 0 ? Math.round(total / dayCounts[idx]) : 0;
      return {
        dayIndex: idx,
        name: dayNames[idx],
        total: total,
        avg: avg,
        count: dayCounts[idx]
      };
    });

    const maxVal = Math.max(...result.map(d => d.total), 1);
    return result.map(d => ({
      ...d,
      pct: Math.round((d.total / maxVal) * 100),
      isPeak: d.total === maxVal && d.total > 0
    }));
  }, [filteredMetricsCierres]);

  // Día de mayor venta
  const peakWeekday = useMemo(() => {
    const peak = salesByWeekday.reduce((max, curr) => curr.total > max.total ? curr : max, salesByWeekday[0]);
    return peak;
  }, [salesByWeekday]);

  // Cierres recientes filtrados por búsqueda global
  const recentClosuresFiltered = useMemo(() => {
    let list = [...cierres].sort((a, b) => new Date(b.createdAt || b.fecha).getTime() - new Date(a.createdAt || a.fecha).getTime());
    if (globalSearchQuery.trim()) {
      const q = globalSearchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.fecha.toLowerCase().includes(q) ||
        (c.colaboradorNombre && c.colaboradorNombre.toLowerCase().includes(q)) ||
        (c.liderNombre && c.liderNombre.toLowerCase().includes(q)) ||
        c.estado.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 7);
  }, [cierres, globalSearchQuery]);

  // Formateadores de Moneda COP
  const formatCOP = (num: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num) + " COP";
  };

  const getDiferenciaBadge = (dif: number) => {
    if (dif === 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black bg-emerald-50 text-brand-success border border-brand-success uppercase tracking-wider">
          Cuadrado
        </span>
      );
    } else if (dif > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black bg-blue-50 text-brand-info border border-brand-info uppercase tracking-wider">
          Sobra {formatCOP(dif)}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black bg-red-50 text-brand-danger border border-brand-danger uppercase tracking-wider">
          Falta {formatCOP(Math.abs(dif))}
        </span>
      );
    }
  };

  const currentCierre = cierres.find(c => c.id === selectedCierreId);

  // Guardar meta de ventas editada
  const saveMeta = () => {
    const cleaned = metaInput.replace(/\D/g, "");
    const val = Number(cleaned);
    if (!isNaN(val) && val > 0) {
      setMetaVentas(val);
      setIsEditingMeta(false);
    }
  };

  // Formateador de moneda COP para PDF
  const formatCOPPdf = (num: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Generación y exportación de PDF para cada uno de los cierres filtrados (4 por página)
  const handleExportPDF = () => {
    if (squaredCierres.length === 0) return;

    // Limpiar caracteres especiales incompatibles con la fuente estándar de jsPDF
    const sanitizePdfText = (text: string) => {
      if (!text) return "";
      return text
        .replace(/&þ/g, " — ") // Reemplazar delimitadores especiales de novedades
        .replace(/þ/g, "")     // Eliminar símbolos þ huérfanos que arruinan el espaciado
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, "") // Filtrar caracteres fuera del rango imprimible ISO Latin-1 estándar
        .trim();
    };

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const itemsPerPage = 4;
      const totalPages = Math.ceil(squaredCierres.length / itemsPerPage);

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) {
          doc.addPage();
        }

        // 1. Marco externo estilo Neo-Brutalista
        doc.setDrawColor(28, 25, 23); // #1C1917
        doc.setLineWidth(0.8);
        doc.rect(10, 10, 190, 277);

        // 2. Encabezado de la página
        doc.setFillColor(244, 244, 245); // zinc-100 / bg-brand-bg
        doc.rect(10, 10, 190, 16, "F");
        doc.setLineWidth(0.5);
        doc.line(10, 26, 200, 26);

        // Título del encabezado
        doc.setTextColor(28, 25, 23);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("CHAPINERO - HISTORIAL DE CIERRES DE CAJA", 15, 20);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Página ${pageIdx + 1} de ${totalPages}`, 172, 20);

        // Rango de fechas filtradas y tipo de filtro
        let filterText = "Todos los cierres del historial";
        if (historyStartDate && historyEndDate) {
          filterText = `Rango: ${historyStartDate} al ${historyEndDate}`;
        } else if (historyStartDate) {
          filterText = `Desde: ${historyStartDate}`;
        } else if (historyEndDate) {
          filterText = `Hasta: ${historyEndDate}`;
        }
        if (historyDeficitFilter === "deficit") {
          filterText += " | Filtro: Solo días con faltantes";
        }
        doc.setFontSize(7.5);
        doc.text(filterText, 15, 24);

        // Obtener los cierres de esta página
        const startIndex = pageIdx * itemsPerPage;
        const pageItems = squaredCierres.slice(startIndex, startIndex + itemsPerPage);

        // Posición inicial de los elementos
        let itemY = 29;

        pageItems.forEach((c) => {
          // Contenedor del elemento (alto: 60mm)
          doc.setDrawColor(28, 25, 23);
          doc.setLineWidth(0.4);
          doc.setFillColor(255, 255, 255);
          doc.rect(13, itemY, 184, 60, "FD");

          // Subencabezado gris
          doc.setFillColor(244, 244, 245);
          doc.rect(13, itemY, 184, 7, "F");
          doc.line(13, itemY + 7, 197, itemY + 7);

          // Texto del subencabezado
          doc.setTextColor(28, 25, 23);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(`FECHA DEL TURNO: ${c.fecha}`, 16, itemY + 4.8);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.text(`Por: ${sanitizePdfText(c.colaboradorNombre || "N/A")}`, 78, itemY + 4.8);
          doc.text(`Auditado por: ${sanitizePdfText(c.auditadoPor || "N/A")}`, 138, itemY + 4.8);

          // Grilla interna
          let subY = itemY + 12;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.text("CANAL DE RECAUDO", 16, subY);
          doc.text("CIERRE FÍSICO", 56, subY);
          doc.text("REPORTADO POS", 88, subY);
          doc.text("DESFASE", 120, subY);

          doc.setDrawColor(28, 25, 23);
          doc.setLineWidth(0.2);
          doc.line(16, subY + 1.8, 144, subY + 1.8);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          subY += 5.2;

          const channels = [
            { label: "Efectivo", fisico: c.efectivoCierre, pos: c.efectivoPOS || 0, dif: c.difEfectivo || 0 },
            { label: "Datáfono / Tarjetas", fisico: c.datafonoCierre, pos: c.tarjetasPOS || 0, dif: c.difTarjetas || 0 },
            { label: "Justo App", fisico: c.justoCierre, pos: c.justoPOS || 0, dif: c.difJusto || 0 },
            { label: "Rappi App", fisico: c.rappiCierre, pos: c.rappiPOS || 0, dif: c.difRappi || 0 },
            { label: "Transferencias", fisico: c.transferenciasCierre || 0, pos: c.transferenciasPOS || 0, dif: c.difTransferencias || 0 },
          ];

          channels.forEach((chan) => {
            doc.text(chan.label, 16, subY);
            doc.text(formatCOPPdf(chan.fisico), 56, subY);
            doc.text(formatCOPPdf(chan.pos), 88, subY);

            if (chan.dif === 0) {
              doc.setTextColor(16, 124, 65);
              doc.text("$0 (Cuadrado)", 120, subY);
            } else if (chan.dif > 0) {
              doc.setTextColor(0, 102, 204);
              doc.text(`+${formatCOPPdf(chan.dif)}`, 120, subY);
            } else {
              doc.setTextColor(220, 53, 69);
              doc.text(`-${formatCOPPdf(Math.abs(chan.dif))} (Falta)`, 120, subY);
            }
            doc.setTextColor(28, 25, 23);
            subY += 4.2;
          });

          // Sección lateral derecha: Resumen totalizado
          let rightY = itemY + 12;
          doc.setFillColor(250, 250, 250);
          doc.rect(147, rightY - 2, 47, 28, "F");
          doc.line(147, rightY - 2, 147, rightY + 26);

          const totalFisico = (c.efectivoCierre || 0) + (c.datafonoCierre || 0) + (c.justoCierre || 0) + (c.rappiCierre || 0) + (c.transferenciasCierre || 0);
          const totalPOS = (c.efectivoPOS || 0) + (c.tarjetasPOS || 0) + (c.justoPOS || 0) + (c.rappiPOS || 0) + (c.transferenciasPOS || 0);
          const difAcumulada = (c.difEfectivo || 0) + (c.difTarjetas || 0) + (c.difJusto || 0) + (c.difRappi || 0) + (c.difTransferencias || 0);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.text("RESUMEN DE CONCILIACIÓN", 149, rightY + 2.5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text(`Total Físico: ${formatCOPPdf(totalFisico)}`, 149, rightY + 7.5);
          doc.text(`Total POS:   ${formatCOPPdf(totalPOS)}`, 149, rightY + 12);
          doc.text(`Propinas:    ${formatCOPPdf(c.propinas || 0)}`, 149, rightY + 16.5);

          doc.setFont("helvetica", "bold");
          doc.text("DESFASE:", 149, rightY + 21.5);
          if (difAcumulada === 0) {
            doc.setTextColor(16, 124, 65);
            doc.text("$0 (Cuadrado)", 149, rightY + 24.5);
          } else if (difAcumulada > 0) {
            doc.setTextColor(0, 102, 204);
            doc.text(`+${formatCOPPdf(difAcumulada)} (Sobra)`, 149, rightY + 24.5);
          } else {
            doc.setTextColor(220, 53, 69);
            doc.text(`-${formatCOPPdf(Math.abs(difAcumulada))} (Falta)`, 149, rightY + 24.5);
          }
          doc.setTextColor(28, 25, 23);

          // Equipo del turno y distribución por política
          const hasTeamInfo = c.liderNombre || (c.auxiliaresNombres && c.auxiliaresNombres.length > 0);
          if (hasTeamInfo) {
            // Dibujar línea divisora para la sección de equipo
            doc.setDrawColor(228, 228, 231); // zinc-200
            doc.setLineWidth(0.2);
            doc.line(13, itemY + 38.2, 197, itemY + 38.2);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(28, 25, 23);
            doc.text("EQUIPO DEL TURNO:", 16, itemY + 41.4);

            doc.setFont("helvetica", "normal");
            let teamLabel = `Líder: ${sanitizePdfText(c.liderNombre || "N/A")}`;
            if (c.auxiliaresNombres && c.auxiliaresNombres.length > 0) {
              teamLabel += ` | Auxiliares: ${c.auxiliaresNombres.map(a => sanitizePdfText(a)).join(", ")}`;
            }
            doc.text(teamLabel, 43, itemY + 41.4);

            // Segunda línea: Política de Descuadre
            doc.setFont("helvetica", "bold");
            doc.text("DISTRIBUCIÓN DESCUADRE (POLÍTICA 60/40):", 16, itemY + 44.4);
            doc.setFont("helvetica", "normal");
            let policyLabel = "";
            if (difAcumulada < 0 && c.descuadreLider !== undefined) {
              policyLabel = `Líder asume: ${formatCOPPdf(c.descuadreLider)} (60%)`;
              if (c.auxiliaresNombres && c.auxiliaresNombres.length > 0 && c.descuadreAuxiliar !== undefined) {
                policyLabel += ` | Cada Auxiliar asume: ${formatCOPPdf(c.descuadreAuxiliar)} (40% dividido)`;
              } else {
                policyLabel += ` | Sin auxiliares registrados (Líder asume el 100% por defecto)`;
              }
            } else {
              policyLabel = "Caja cuadrada o con sobrante. No aplica política de descuento de faltantes.";
            }
            doc.text(policyLabel, 71, itemY + 44.4);
          }

          // Fila inferior de Novedades (ajustada a novY = itemY + 46.5)
          let novY = itemY + 46.5;
          doc.setDrawColor(28, 25, 23);
          doc.setLineWidth(0.4);
          doc.line(13, novY, 197, novY);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.text("NOVEDADES:", 16, novY + 3.8);
          doc.setFont("helvetica", "italic");
          const novText = sanitizePdfText(c.novedades || "Sin novedades reportadas en el turno.");
          // El texto comienza en X=38. El ancho disponible hasta el borde derecho es 197 - 38 - 3 = 156mm.
          const splitNov = doc.splitTextToSize(novText, 156);
          // Tomar un máximo de 2 líneas para que no se salga del recuadro
          const displayedLines = splitNov.slice(0, 2);
          if (splitNov.length > 2) {
            displayedLines[1] = displayedLines[1].substring(0, Math.max(10, displayedLines[1].length - 3)) + "...";
          }
          displayedLines.forEach((line: string, lIdx: number) => {
            doc.text(line, 38, novY + 3.8 + (lIdx * 3.5));
          });

          // ID y timestamp en la esquina inferior (ajustada para novY + 10 = itemY + 56.5)
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(120, 120, 120);
          doc.text(`ID Cierre: ${c.id.substring(0, 12)}... | Creado: ${new Date(c.createdAt).toLocaleDateString()}`, 16, novY + 10);
          doc.setTextColor(28, 25, 23);

          itemY += 62; // Desplazamiento vertical para el siguiente día (60mm + 2mm de margen)
        });

        // 7. Pie de Página general
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text(`Documento generado de manera segura por el Panel Administrativo el ${new Date().toLocaleString("es-CO")}`, 13, 283);
      }

      const dateStr = new Date().toISOString().split("T")[0];
      doc.save(`historial_cierres_${dateStr}.pdf`);
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      alert("Ocurrió un error al generar el archivo PDF.");
    }
  };

  const handleExportPropinasPDF = (selectedCierres: CierreCaja[], results: any[], totalPeriodTips: number) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Page dimensions: 210 x 297 mm
      // 1. External border
      doc.setDrawColor(28, 25, 23); // #1C1917
      doc.setLineWidth(0.8);
      doc.rect(10, 10, 190, 277);

      // 2. Header Box
      doc.setFillColor(244, 244, 245); // zinc-100
      doc.rect(10, 10, 190, 24, "F");
      doc.setLineWidth(0.5);
      doc.line(10, 34, 200, 34);

      // Header Text
      doc.setTextColor(28, 25, 23);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("LÓPEZ & GRACIA — REPORTE DE PROPINAS", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Rango: ${propinasStartDate} al ${propinasEndDate} | Local: ${local}`, 15, 26);
      doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, 15, 30);

      // Total block in header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("TOTAL DISTRIBUIDO", 145, 17);
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text(formatCOPPdf(totalPeriodTips), 145, 22);
      doc.setTextColor(28, 25, 23);

      let currentY = 42;

      // Section 1: RESUMEN GENERAL DE LIQUIDACIÓN
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("1. CUADRO CONSOLIDADO DE PAGOS (RESUMEN)", 13, currentY);
      currentY += 4;

      // Draw table header
      doc.setFillColor(244, 244, 245);
      doc.rect(13, currentY, 184, 7, "F");
      doc.rect(13, currentY, 184, 7, "D");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("COLABORADOR", 16, currentY + 4.8);
      doc.text("DÍAS TRABAJADOS", 90, currentY + 4.8);
      doc.text("TOTAL RECIBIDO", 150, currentY + 4.8);
      
      currentY += 7;

      // Render summary table lines
      results.forEach(r => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(r.name, 16, currentY + 5);
        doc.text(`${r.days.length} ${r.days.length === 1 ? "día" : "días"}`, 90, currentY + 5);
        doc.setFont("helvetica", "bold");
        doc.text(formatCOPPdf(r.amount), 150, currentY + 5);
        
        doc.setDrawColor(228, 228, 231); // zinc-200
        doc.setLineWidth(0.2);
        doc.line(13, currentY + 7, 197, currentY + 7);
        currentY += 7;
      });

      // Section 2: DESGLOSE DIARIO DE REPARTO
      doc.setDrawColor(28, 25, 23);
      currentY += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("2. DESGLOSE DETALLADO DE REPARTO POR DÍA", 13, currentY);
      currentY += 4;

      selectedCierres.forEach(c => {
        const team = propinasDaysTeam[c.id] || [];
        const dayTips = c.propinas || 0;

        let shareText = "";
        let rosterText = "";

        if (tipDistributionMode === "puntos") {
          const teamPoints = team.map(name => ({
            name,
            puntos: getMemberConfig(name, c.id).puntos
          }));
          const totalPoints = teamPoints.reduce((acc, p) => acc + p.puntos, 0);
          
          shareText = `Reparto por Puntos (Total Pts: ${totalPoints})`;
          rosterText = teamPoints.length > 0 
            ? `Personal (Puntos/Reparto): ${teamPoints.map(tp => {
                const pShare = totalPoints > 0 ? Math.round(dayTips * (tp.puntos / totalPoints)) : 0;
                return `${tp.name} (${tp.puntos} pts: ${formatCOPPdf(pShare)})`;
              }).join(", ")}`
            : "No se asignó personal en este turno.";
        } else {
          const share = team.length > 0 ? Math.round(dayTips / team.length) : 0;
          shareText = `Monto Individual: ${formatCOPPdf(share)} c/u`;
          rosterText = team.length > 0 ? `Personal en turno: ${team.join(", ")}` : "No se asignó personal en este turno.";
        }

        // Check page overflow
        if (currentY > 240) {
          doc.addPage();
          // Draw page borders for second page
          doc.setDrawColor(28, 25, 23);
          doc.setLineWidth(0.8);
          doc.rect(10, 10, 190, 277);
          currentY = 20;
        }

        // Row border
        doc.setFillColor(250, 250, 250);
        doc.rect(13, currentY, 184, 16, "F");
        doc.setDrawColor(28, 25, 23);
        doc.setLineWidth(0.3);
        doc.rect(13, currentY, 184, 16, "D");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`FECHA: ${c.fecha}`, 16, currentY + 5);
        doc.text(`Propinas del Día: ${formatCOPPdf(dayTips)}`, 70, currentY + 5);
        doc.text(shareText, 135, currentY + 5);

        // Render roster for this day
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(rosterText, 16, currentY + 11);
        doc.setTextColor(28, 25, 23);

        currentY += 19;
      });

      // Section 3: SECCIÓN DE FIRMAS Y CONFORMIDAD
      if (currentY > 230) {
        doc.addPage();
        // Draw page borders for signature page
        doc.setDrawColor(28, 25, 23);
        doc.setLineWidth(0.8);
        doc.rect(10, 10, 190, 277);
        currentY = 20;
      }

      currentY += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("3. FIRMAS DE CONFORMIDAD Y AUTORIZACIÓN", 13, currentY);
      currentY += 15;

      // Signatures line
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.line(15, currentY, 80, currentY);
      doc.line(115, currentY, 180, currentY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Firma Gerente / Administrador", 15, currentY + 4);
      doc.text("Firma de Recibido (Rep. Equipo)", 115, currentY + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text("C.C. _________________________", 15, currentY + 8);
      doc.text("C.C. _________________________", 115, currentY + 8);

      // Save document
      const dateStr = new Date().toISOString().split("T")[0];
      doc.save(`liquidacion_propinas_${dateStr}.pdf`);
    } catch (error) {
      console.error("Error al exportar reporte de propinas:", error);
      alert("Ocurrió un error al generar el archivo PDF.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1C2E24] flex flex-col md:flex-row relative selection:bg-[#1E3E30]/10 font-sans">
      {/* SIDEBAR - Left Side (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 h-screen sticky top-0 z-30 flex-shrink-0 select-none">
        {/* Brand Header */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="px-2.5 py-1.5 rounded-xl bg-[#1E3E30] flex items-center justify-center text-white shadow-xs">
              <Logo size="sm" className="text-white h-6 w-auto" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-[#1C2E24] leading-none">López & Gracia</div>
              <div className="text-[10px] font-bold text-[#1C2E24]/50 tracking-wider uppercase mt-1 flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Chapinero POS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation - Organized by Sections */}
        <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {/* Section: GENERAL */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#1C2E24]/40 mb-2">
              General
            </div>
            
            {/* Dashboard */}
            <button
              onClick={() => { setActiveTab("metrics"); setSelectedCierreId(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "metrics"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <LayoutDashboard className={`w-4 h-4 ${activeTab === "metrics" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Dashboard</span>
              </div>
            </button>

            {/* Indicadores */}
            <button
              onClick={() => { setActiveTab("indicadores"); setSelectedCierreId(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "indicadores"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <TrendingUp className={`w-4 h-4 ${activeTab === "indicadores" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Indicadores</span>
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                activeTab === "indicadores" 
                  ? "bg-white/20 text-white" 
                  : "bg-emerald-100 text-emerald-800"
              }`}>
                KPIs
              </span>
            </button>

            {/* Auditoría Cierres */}
            <button
              onClick={() => { 
                setActiveTab("audit"); 
                setSelectedCierreId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "audit"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <CheckCircle className={`w-4 h-4 ${activeTab === "audit" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Auditoría Cierres</span>
              </div>
              {pendingCierres.length > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  activeTab === "audit"
                    ? "bg-[#FF5C35] text-white" 
                    : "bg-[#FF5C35]/15 text-[#FF5C35]"
                }`}>
                  {pendingCierres.length}
                </span>
              )}
            </button>

            {/* Liquidación Propinas */}
            <button
              onClick={() => { setActiveTab("propinas"); setSelectedCierreId(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "propinas"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Gift className={`w-4 h-4 ${activeTab === "propinas" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Liquidación Propinas</span>
              </div>
            </button>
          </div>

          {/* Section: HERRAMIENTAS */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#1C2E24]/40 mb-2">
              Herramientas
            </div>

            {/* Cierre Inventario */}
            <button
              onClick={() => { setActiveTab("inventory"); setSelectedCierreId(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "inventory"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Package className={`w-4 h-4 ${activeTab === "inventory" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Cierre Inventario</span>
              </div>
            </button>

            {/* Checklist Operativo */}
            <button
              onClick={() => { setActiveTab("checklist"); setSelectedCierreId(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "checklist"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <ClipboardCheck className={`w-4 h-4 ${activeTab === "checklist" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Checklist Operativo</span>
              </div>
            </button>

            {/* Perfiles de Empleados */}
            <button
              onClick={() => { setActiveTab("team"); setSelectedCierreId(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "team"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Users className={`w-4 h-4 ${activeTab === "team" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Perfiles de Empleados</span>
              </div>
              <span className="text-[10px] font-bold text-[#1C2E24]/40 font-mono">
                {teamMembers.length}
              </span>
            </button>

            {/* Nómina & Salarios */}
            <button
              onClick={() => { setActiveTab("salarios"); setSelectedCierreId(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "salarios"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <DollarSign className={`w-4 h-4 ${activeTab === "salarios" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Nómina & Salarios</span>
              </div>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                Beta
              </span>
            </button>
          </div>

          {/* Section: SOPORTE */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#1C2E24]/40 mb-2">
              Soporte
            </div>

            <button
              onClick={() => alert("Ajustes del Punto de Venta: Chapinero, Bogotá D.C.\nPermisos: Administrador")}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24] transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-[#1C2E24]/60" />
              <span>Configuración</span>
            </button>

            <button
              onClick={() => { setActiveTab("security"); setSelectedCierreId(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "security"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-[#1C2E24]/70 hover:bg-slate-50 hover:text-[#1C2E24]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Shield className={`w-4 h-4 ${activeTab === "security" ? "text-white" : "text-[#1C2E24]/60"}`} />
                <span>Seguridad & Roles</span>
              </div>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Activo
              </span>
            </button>
          </div>
        </div>

        {/* Sidebar Bottom Team Switcher & Actions */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {/* Store Pill */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1E3E30] flex items-center justify-center text-white text-xs font-black">
                <Coffee className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-[#1C2E24] leading-tight">Sede Chapinero</div>
                <div className="text-[10px] font-bold text-[#1C2E24]/50 leading-tight">Bogotá, D.C.</div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#1C2E24]/40" />
          </div>

          {/* New Closure Quick Action */}
          <button
            onClick={() => { setActiveTab("audit"); setAuditSubTab("pending"); }}
            className="w-full bg-[#FF5C35] hover:bg-[#E54B24] text-white py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Auditar Cierre</span>
          </button>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50/50 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER & NAVIGATION */}
      <div className="md:hidden bg-white border-b border-slate-200/80 sticky top-0 z-30 w-full">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2.5">
            <div className="px-2 py-1 rounded-lg bg-[#1E3E30] flex items-center justify-center text-white">
              <Logo size="xs" className="text-white h-5 w-auto" />
            </div>
            <span className="text-sm font-black text-[#1C2E24]">López & Gracia</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadCierres}
              className="p-2 text-[#1C2E24] hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onLogout}
              className="text-xs font-black uppercase text-red-600 px-3 py-1.5 bg-red-50 rounded-lg cursor-pointer"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Mobile Navigation Pills */}
        <div className="flex overflow-x-auto p-2 bg-slate-50 border-t border-slate-100 gap-1.5 scrollbar-none">
          {[
            { id: "metrics", label: "Dashboard", icon: LayoutDashboard },
            { id: "indicadores", label: "Indicadores", icon: TrendingUp },
            { id: "audit", label: `Auditar (${pendingCierres.length})`, icon: CheckCircle },
            { id: "propinas", label: "Propinas", icon: Gift },
            { id: "inventory", label: "Inventario", icon: Package },
            { id: "checklist", label: "Checklist", icon: ClipboardCheck },
            { id: "team", label: "Equipo", icon: Users },
            { id: "salarios", label: "Salarios", icon: DollarSign }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === "audit") setAuditSubTab("pending");
                setSelectedCierreId(null);
              }}
              className={`px-3 py-2 text-xs font-bold whitespace-nowrap rounded-lg flex items-center space-x-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[#1E3E30] text-white"
                  : "bg-white text-slate-600 border border-slate-200/60"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 overflow-x-hidden">
        {/* DESKTOP HEADER BAR */}
        <header className="hidden md:flex bg-white border-b border-slate-200/80 py-3.5 px-8 items-center justify-between sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          {/* Global Search Bar with ⌘K Badge */}
          <div className="relative w-80 lg:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Buscar cierres, colaboradores, fechas..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-14 py-2 text-xs font-medium text-[#1C2E24] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1E3E30] focus:bg-white transition-all"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shadow-2xs">
              ⌘K
            </span>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center space-x-4">
            {/* Sync Status Button */}
            <button
              onClick={loadCierres}
              title="Sincronizar datos"
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#1E3E30]" : ""}`} />
            </button>

            {/* Notification Bell Icon */}
            <div className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
              <Bell className="w-4 h-4" />
              {pendingCierres.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF5C35] rounded-full ring-2 ring-white" />
              )}
            </div>

            {/* Profile Widget */}
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4 py-0.5">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces"
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#1E3E30]/10"
                referrerPolicy="no-referrer"
              />
              <div className="flex flex-col text-left">
                <span className="text-xs font-black text-[#1C2E24] leading-tight">{username || "Victor Ospina"}</span>
                <span className="text-[10px] font-bold text-slate-400 leading-tight">Gerente de Operaciones</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </header>

        {/* Content Body Section */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-[1440px] w-full mx-auto">
          {activeTab === "metrics" && (
            /* TAB 1: MODERN NEXUS DASHBOARD */
            <div className="space-y-6">
              
              {/* Dashboard Top Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-[#1C2E24] tracking-tight">Dashboard</h1>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                    Panel de control y métricas consolidadas del punto de venta
                  </p>
                </div>

                {/* Filter and Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Date Filter Preset Dropdown */}
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs">
                    <button
                      onClick={() => setMetricsFilter("all")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        metricsFilter === "all" ? "bg-[#1E3E30] text-white shadow-xs" : "text-slate-600 hover:text-[#1C2E24]"
                      }`}
                    >
                      Historial Completo
                    </button>
                    <button
                      onClick={() => setMetricsFilter("month")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        metricsFilter === "month" ? "bg-[#1E3E30] text-white shadow-xs" : "text-slate-600 hover:text-[#1C2E24]"
                      }`}
                    >
                      Este Mes
                    </button>
                    <button
                      onClick={() => setMetricsFilter("custom")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        metricsFilter === "custom" ? "bg-[#1E3E30] text-white shadow-xs" : "text-slate-600 hover:text-[#1C2E24]"
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  {/* Custom Date Inputs if selected */}
                  {metricsFilter === "custom" && (
                    <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded-xl border border-slate-200/80 shadow-2xs">
                      <input
                        type="date"
                        value={metricsStartDate}
                        onChange={(e) => setMetricsStartDate(e.target.value)}
                        className="text-xs font-mono font-bold text-[#1C2E24] outline-none bg-transparent"
                      />
                      <span className="text-slate-400 text-xs">-</span>
                      <input
                        type="date"
                        value={metricsEndDate}
                        onChange={(e) => setMetricsEndDate(e.target.value)}
                        className="text-xs font-mono font-bold text-[#1C2E24] outline-none bg-transparent"
                      />
                    </div>
                  )}

                  {/* Export Report PDF button */}
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center space-x-2 bg-white hover:bg-slate-50 text-[#1C2E24] px-3.5 py-2 rounded-xl text-xs font-black border border-slate-200/80 shadow-2xs transition-all cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-slate-600" />
                    <span>Exportar PDF</span>
                  </button>
                </div>
              </div>

              {/* ROW 1: 4 MODERN KPI METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Card 1: Ventas Reales */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs relative flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                          <TrendingUp className="w-4.5 h-4.5 stroke-[2.5]" />
                        </div>
                        <span className="text-xs font-bold text-slate-500">Ventas Totales</span>
                      </div>
                      <button title="Ventas reales consolidadas de canales aprobados" className="text-slate-300 hover:text-slate-500">
                        <Info className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="text-2xl font-black font-mono text-[#1C2E24] tracking-tight">
                        {formatCOP(totalVentasReales)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>+15.8%</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {filteredMetricsCierres.length} turnos auditados
                    </span>
                  </div>
                </div>

                {/* Card 2: Recaudo Directo */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs relative flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                          <CreditCard className="w-4.5 h-4.5 stroke-[2.5]" />
                        </div>
                        <span className="text-xs font-bold text-slate-500">Recaudo Directo</span>
                      </div>
                      <button title="Efectivo físico + Datáfono POS en tienda" className="text-slate-300 hover:text-slate-500">
                        <Info className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="text-2xl font-black font-mono text-[#1C2E24] tracking-tight">
                        {formatCOP(totalEfectivo + totalTarjetas)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      <span>{totalVentasReales > 0 ? Math.round(((totalEfectivo + totalTarjetas) / totalVentasReales) * 100) : 0}%</span>
                      <span className="text-slate-500 font-normal">del total</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      POS: {formatCOP(totalTarjetas)}
                    </span>
                  </div>
                </div>

                {/* Card 3: Propinas Período */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs relative flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
                          <Gift className="w-4.5 h-4.5 stroke-[2.5]" />
                        </div>
                        <span className="text-xs font-bold text-slate-500">Propinas Período</span>
                      </div>
                      <button title="Total propinas recaudadas y distribuidas al equipo" className="text-slate-300 hover:text-slate-500">
                        <Info className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="text-2xl font-black font-mono text-[#1C2E24] tracking-tight">
                        {formatCOP(totalPropinas)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>+24.2%</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      Prom: {formatCOP(avgPropinas)}/día
                    </span>
                  </div>
                </div>

                {/* Card 4: Eficiencia de Cuadre */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs relative flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                          <CheckCircle2 className="w-4.5 h-4.5 stroke-[2.5]" />
                        </div>
                        <span className="text-xs font-bold text-slate-500">Eficiencia Cuadre</span>
                      </div>
                      <button title="Porcentaje de arqueos con balance exacto sin discrepancias" className="text-slate-300 hover:text-slate-500">
                        <Info className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="text-2xl font-black font-mono text-[#1C2E24] tracking-tight">
                        {squareEfficiency}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <span>{perfectSquareCount} cerrados</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {perfectSquareCount} de {filteredMetricsCierres.length} sin faltantes
                    </span>
                  </div>
                </div>

              </div>

              {/* ROW 2: DUAL CHARTS (Desempeño Comparativo + Ventas por Día de la Semana) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Visual: Desempeño & Comparativo de Ventas (7 cols) */}
                <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-black text-[#1C2E24]">Desempeño & Comparativo de Ventas</h3>
                          <button className="text-slate-300 hover:text-slate-500">
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-baseline space-x-3 mt-2">
                          <span className="text-2xl font-black font-mono text-[#1C2E24]">
                            {formatCOP(totalVentasReales)}
                          </span>
                          <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            <span>+15.8%</span>
                            <span className="text-emerald-600 font-normal ml-1">vs anterior</span>
                          </span>
                        </div>
                      </div>

                      {/* Period Tabs */}
                      <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                        {(["mensual", "semanal", "diario"] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => setOverviewPeriod(p)}
                            className={`px-2.5 py-1 rounded-md capitalize transition-all cursor-pointer ${
                              overviewPeriod === p ? "bg-white text-[#1C2E24] shadow-2xs font-black" : "text-slate-500 hover:text-[#1C2E24]"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Multi-layered Flow Bar Visual */}
                    <div className="mt-8 space-y-5">
                      {/* Segmented Flow Bars */}
                      <div className="space-y-3">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Canales de Recaudo</span>
                          <span>Distribución %</span>
                        </div>

                        {/* Stacked Continuous Bar */}
                        <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden flex shadow-2xs p-0.5 gap-0.5">
                          {[
                            { name: "Tarjetas", val: totalTarjetas, color: "bg-emerald-500" },
                            { name: "Efectivo", val: totalEfectivo, color: "bg-amber-500" },
                            { name: "Rappi", val: totalRappi, color: "bg-orange-500" },
                            { name: "Justo", val: totalJusto, color: "bg-sky-500" },
                            { name: "Transferencias", val: totalTransferencias, color: "bg-purple-500" }
                          ].map((ch, idx) => {
                            const pct = totalVentasReales > 0 ? (ch.val / totalVentasReales) * 100 : 20;
                            return (
                              <div
                                key={idx}
                                style={{ width: `${pct}%` }}
                                className={`${ch.color} h-full rounded-md transition-all hover:opacity-90 relative group`}
                                title={`${ch.name}: ${formatCOP(ch.val)} (${Math.round(pct)}%)`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Period Breakdown Rows */}
                      <div className="space-y-3 pt-2">
                        {filteredMetricsCierres.slice(0, 4).map((c, idx) => {
                          const cTotal = (c.efectivoCierre || 0) + (c.datafonoCierre || 0) + (c.justoCierre || 0) + (c.rappiCierre || 0) + (c.transferenciasCierre || 0);
                          const maxVal = Math.max(...filteredMetricsCierres.map(cl => (cl.efectivoCierre || 0) + (cl.datafonoCierre || 0) + (cl.justoCierre || 0) + (cl.rappiCierre || 0) + (cl.transferenciasCierre || 0))) || 1;
                          const barPct = Math.round((cTotal / maxVal) * 100);

                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-600">{c.fecha} — {c.colaboradorNombre || "Turno"}</span>
                                <span className="font-mono font-black text-[#1C2E24]">{formatCOP(cTotal)}</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#1E3E30] rounded-full transition-all"
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Color Legends Footer */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Datáfono ({totalVentasReales > 0 ? Math.round((totalTarjetas / totalVentasReales) * 100) : 0}%)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>Efectivo ({totalVentasReales > 0 ? Math.round((totalEfectivo / totalVentasReales) * 100) : 0}%)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      <span>Rappi ({totalVentasReales > 0 ? Math.round((totalRappi / totalVentasReales) * 100) : 0}%)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                      <span>Justo ({totalVentasReales > 0 ? Math.round((totalJusto / totalVentasReales) * 100) : 0}%)</span>
                    </div>
                  </div>
                </div>

                {/* Right Visual: Ventas por Día de la Semana (5 cols) */}
                <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-black text-[#1C2E24]">Ventas por Día de la Semana</h3>
                          <button className="text-slate-300 hover:text-slate-500">
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-baseline space-x-3 mt-2">
                          <span className="text-2xl font-black font-mono text-[#1C2E24]">
                            {formatCOP(peakWeekday?.total || 0)}
                          </span>
                          <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            <span>Pico: {peakWeekday?.name}</span>
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                        Semanal
                      </span>
                    </div>

                    {/* Interactive 7-Day Vertical Bar Chart */}
                    <div className="mt-8 relative pt-8 pb-2">
                      <div className="h-44 flex items-end justify-between gap-2 px-1">
                        {salesByWeekday.map((day, idx) => {
                          const isSelected = selectedWeekdayIndex === day.dayIndex;
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedWeekdayIndex(day.dayIndex)}
                              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                            >
                              {/* Peak Day floating badge */}
                              {day.isPeak && (
                                <div className="absolute -top-1 bg-[#1E3E30] text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-md shadow-xs -translate-x-1/2 left-1/2 whitespace-nowrap animate-bounce">
                                  {formatCOP(day.total)}
                                </div>
                              )}

                              {/* Bar container */}
                              <div className="w-full max-w-[34px] bg-slate-100 rounded-xl overflow-hidden flex flex-col justify-end p-0.5 h-full">
                                <div
                                  style={{ height: `${Math.max(14, day.pct)}%` }}
                                  className={`w-full rounded-lg transition-all duration-300 ${
                                    day.isPeak || isSelected
                                      ? "bg-gradient-to-t from-[#1E3E30] to-[#2E5E4A] shadow-xs"
                                      : "bg-slate-300 group-hover:bg-[#1E3E30]/60"
                                  }`}
                                />
                              </div>

                              {/* Day Label */}
                              <span className={`text-[11px] font-bold mt-2.5 ${
                                day.isPeak || isSelected ? "text-[#1E3E30] font-black" : "text-slate-400"
                              }`}>
                                {day.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Summary Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">Día con mayor recaudo:</span>
                    <span className="font-black text-[#1E3E30]">{peakWeekday?.name} ({formatCOP(peakWeekday?.total || 0)})</span>
                  </div>
                </div>

              </div>

              {/* ROW 3: CANAL BREAKDOWN & RECENT CLOSURES TABLE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left: Distribución de Canales (4 cols) */}
                <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-[#1C2E24]">Distribución de Canales</h3>
                      <span className="text-[11px] font-bold text-slate-400">Total</span>
                    </div>

                    <div className="mt-6 space-y-4">
                      {[
                        { label: "Datáfono / POS", val: totalTarjetas, color: "bg-emerald-500" },
                        { label: "Efectivo Físico", val: totalEfectivo, color: "bg-amber-500" },
                        { label: "Rappi App", val: totalRappi, color: "bg-orange-500" },
                        { label: "Justo App", val: totalJusto, color: "bg-sky-500" },
                        { label: "Transferencias", val: totalTransferencias, color: "bg-purple-500" }
                      ].map((item, idx) => {
                        const pct = totalVentasReales > 0 ? Math.round((item.val / totalVentasReales) * 100) : 0;
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-600">{item.label}</span>
                              <span className="font-mono font-black text-[#1C2E24]">
                                {formatCOP(item.val)} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${item.color} rounded-full transition-all`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                    <button
                      onClick={() => { setActiveTab("audit"); setAuditSubTab("history"); }}
                      className="text-xs font-bold text-[#1E3E30] hover:underline cursor-pointer"
                    >
                      Ver informe detallado de ingresos →
                    </button>
                  </div>
                </div>

                {/* Right: Registro de Cierres Recientes & Auditoría (8 cols) */}
                <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-[#1C2E24]">Registro de Cierres Recientes</h3>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">Últimos turnos registrados en la sede Chapinero</p>
                      </div>

                      <button
                        onClick={() => { setActiveTab("audit"); setAuditSubTab("history"); }}
                        className="text-xs font-black text-[#1E3E30] hover:text-[#2E5E4A] flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Ver Todos</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Table View */}
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <th className="pb-3 pl-2">Fecha / Colaborador</th>
                            <th className="pb-3">Estado Cuadre</th>
                            <th className="pb-3">Recaudo Total</th>
                            <th className="pb-3 text-right pr-2">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {recentClosuresFiltered.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                                No se encontraron registros de cierre.
                              </td>
                            </tr>
                          ) : (
                            recentClosuresFiltered.map((c) => {
                              const totalC = (c.efectivoCierre || 0) + (c.datafonoCierre || 0) + (c.justoCierre || 0) + (c.rappiCierre || 0) + (c.transferenciasCierre || 0);
                              const isCuadrado = c.estado === "Cuadrado";
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-3 pl-2">
                                    <div className="flex items-center space-x-2.5">
                                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-[#1C2E24] font-black text-[11px] flex items-center justify-center">
                                        {(c.colaboradorNombre || "T").charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="font-black text-[#1C2E24]">{c.fecha}</div>
                                        <div className="text-[11px] text-slate-400 font-bold">{c.colaboradorNombre || "Sin asignar"}</div>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-3">
                                    <div className="space-y-1">
                                      {isCuadrado ? (
                                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700">
                                          <Check className="w-3 h-3 stroke-[3]" />
                                          <span>Cuadrado 100%</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700">
                                          <Clock className="w-3 h-3" />
                                          <span>Pendiente</span>
                                        </span>
                                      )}
                                      <div className="w-24 bg-slate-100 h-1 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${isCuadrado ? "bg-emerald-500" : "bg-amber-500"}`}
                                          style={{ width: isCuadrado ? "100%" : "50%" }}
                                        />
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-3 font-mono font-black text-[#1C2E24]">
                                    {formatCOP(totalC)}
                                  </td>

                                  <td className="py-3 text-right pr-2">
                                    <button
                                      onClick={() => {
                                        setActiveTab("audit");
                                        if (isCuadrado) {
                                          setAuditSubTab("history");
                                        } else {
                                          setAuditSubTab("pending");
                                          handleSelectCierre(c.id);
                                        }
                                      }}
                                      className="px-3 py-1 bg-slate-100 hover:bg-[#1E3E30] hover:text-white rounded-lg text-xs font-bold text-[#1C2E24] transition-all cursor-pointer"
                                    >
                                      {isCuadrado ? "Ver Detalle" : "Auditar"}
                                    </button>
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

              </div>

            </div>
          )}

        {activeTab === "audit" && (
          /* TAB 2: AUDITORÍA Y CONCILIACIÓN DE REPORTES PDF (AUDITORÍA CIERRES) */
          <div className="space-y-6">
            
            {/* SUB-TABS INTERNOS PARA AUDITORÍA Y HISTORIAL */}
            <div className="flex border-b-2 border-brand-ink/10 space-x-6 mb-4">
              <button
                type="button"
                onClick={() => setAuditSubTab("pending")}
                className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative cursor-pointer ${
                  auditSubTab === "pending"
                    ? "text-[#1E3E30] border-b-3 border-[#1E3E30]"
                    : "text-[#1C2E24]/40 hover:text-[#1C2E24]/70"
                }`}
              >
                Cierres por Auditar ({pendingCierres.length})
              </button>
              <button
                type="button"
                onClick={() => setAuditSubTab("history")}
                className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative cursor-pointer ${
                  auditSubTab === "history"
                    ? "text-[#1E3E30] border-b-3 border-[#1E3E30]"
                    : "text-[#1C2E24]/40 hover:text-[#1C2E24]/70"
                }`}
              >
                Historial de Cierres ({squaredCierres.length})
              </button>
            </div>

            {auditSubTab === "pending" && (
              /* Si no hay cierres pendientes */
              pendingCierres.length === 0 ? (
                <div className="bg-white border-2 border-brand-ink p-12 text-center flex flex-col items-center justify-center shadow-[4px_4px_0px_0px_#1C1917]">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 border-2 border-brand-success text-brand-success mb-4">
                    <CheckCircle className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-black text-brand-ink mb-1 uppercase tracking-wider">Todo al Día</h3>
                  <p className="text-brand-ink/70 text-sm max-w-sm mx-auto mb-6 font-semibold">
                    No existen cierres de caja cargados por colaboradores pendientes por conciliar.
                  </p>
                  <button
                    onClick={() => setAuditSubTab("history")}
                    className="px-5 py-2.5 bg-white hover:bg-brand-bg border-2 border-brand-ink text-brand-ink font-black uppercase tracking-wider transition-all cursor-pointer shadow-[2px_2px_0px_0px_#1C1917]"
                  >
                    Ver Historial de Cierres Cuadrados
                  </button>
                </div>
              ) : (
              <div className="space-y-6 w-full">
                
                {/* Selector Superior: Cola de Cierres Pendientes por Auditar */}
                <div className="bg-white border-2 border-brand-ink p-5 shadow-[4px_4px_0px_0px_#1C1917]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-brand-ink/10 pb-3 mb-4">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xs font-black text-brand-ink uppercase tracking-widest flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-brand-ink" />
                        <span>Cierres Pendientes por Auditar</span>
                      </span>
                      <span className="bg-brand-ink text-white px-2.5 py-0.5 text-[11px] uppercase font-mono font-black">
                        {pendingCierres.length} {pendingCierres.length === 1 ? "pendiente" : "pendientes"}
                      </span>
                    </div>
                    <span className="text-[11px] text-brand-ink/60 font-medium">
                      Selecciona un cierre para conciliar con el POS
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {pendingCierres.map(c => {
                      const totalM = c.efectivoCierre + c.datafonoCierre + c.justoCierre + c.rappiCierre + (c.transferenciasCierre || 0);
                      const isSelected = c.id === selectedCierreId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCierre(c.id)}
                          className={`w-full text-left p-4 transition-all duration-150 cursor-pointer rounded-xs border-2 flex flex-col justify-between ${
                            isSelected
                              ? "bg-brand-bg border-2 border-brand-ink text-brand-ink shadow-[3px_3px_0px_0px_#1C1917] ring-1 ring-brand-ink"
                              : "bg-white border-brand-ink/30 hover:border-brand-ink hover:bg-brand-bg/40 text-brand-ink"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="text-xs font-black block uppercase tracking-wider text-brand-ink">
                                {c.fecha}
                              </span>
                              {c.colaboradorNombre && (
                                <span className="text-[10px] font-bold block truncate max-w-[170px] text-brand-ink/70">
                                  Por: {c.colaboradorNombre}
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-xs border ${
                              isSelected
                                ? "bg-emerald-100 text-emerald-900 border-emerald-400 font-black"
                                : "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                            }`}>
                              {isSelected ? "En Auditoría" : "Pendiente"}
                            </span>
                          </div>

                          <div className="pt-2.5 border-t border-brand-ink/10 flex items-center justify-between text-xs font-mono">
                            <div>
                              <span className="text-[9px] uppercase font-sans font-bold block text-brand-ink/50">Total Físico</span>
                              <span className="font-black text-sm text-brand-ink">{formatCOP(totalM)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] uppercase font-sans font-bold block text-brand-ink/50">Propinas</span>
                              <span className="font-bold text-brand-ink">{formatCOP(c.propinas)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Panel de Auditoría Activa a Ancho Completo */}
                <div className="w-full">
                  {selectedCierreId && currentCierre ? (
                    <div className="space-y-6 w-full">
                      
                      {/* Detalles del Arqueo Seleccionado */}
                      <div className="bg-white border-2 border-brand-ink p-6 shadow-[4px_4px_0px_0px_#1C1917]">
                        <div className="flex items-center justify-between border-b-2 border-brand-ink pb-4 mb-5">
                          <div>
                            <span className="text-[9px] bg-brand-ink text-white px-2.5 py-0.5 font-mono font-black uppercase">Auditoría en Progreso</span>
                            <h3 className="text-lg font-black text-brand-ink tracking-tight uppercase mt-1.5">Cierre del {currentCierre.fecha}</h3>
                            {currentCierre.colaboradorNombre && (
                              <p className="text-[11px] font-bold text-brand-ink/70 mt-1 uppercase">
                                Realizado por: <strong className="text-brand-ink font-black">{currentCierre.colaboradorNombre}</strong>
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-brand-ink/50 block font-bold">Fecha Creación</span>
                            <span className="text-xs font-black font-mono text-brand-ink">{new Date(currentCierre.createdAt).toLocaleString("es-CO")}</span>
                          </div>
                        </div>

                        {/* Caja Física Declarada */}
                        <div className="bg-brand-bg p-5 border-2 border-brand-ink mb-5 shadow-[2px_2px_0px_0px_#1C1917]">
                          <h4 className="text-xs font-black text-brand-ink/70 uppercase tracking-wider mb-3.5 border-b-2 border-brand-ink pb-2">
                            Valores Reportados por el Equipo (Físico)
                          </h4>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 text-xs font-mono">
                            <div className="bg-white p-3.5 border-2 border-brand-ink/30 rounded-xs">
                              <span className="text-brand-ink/50 font-black block mb-1 text-[10px] tracking-wider">EFECTIVO:</span>
                              <span className="text-sm font-black text-brand-ink">{formatCOP(currentCierre.efectivoCierre)}</span>
                            </div>
                            <div className="bg-white p-3.5 border-2 border-brand-ink/30 rounded-xs">
                              <span className="text-brand-ink/50 font-black block mb-1 text-[10px] tracking-wider">DATÁFONO:</span>
                              <span className="text-sm font-black text-brand-ink">{formatCOP(currentCierre.datafonoCierre)}</span>
                            </div>
                            <div className="bg-white p-3.5 border-2 border-brand-ink/30 rounded-xs">
                              <span className="text-brand-ink/50 font-black block mb-1 text-[10px] tracking-wider">JUSTO APP:</span>
                              <span className="text-sm font-black text-brand-ink">{formatCOP(currentCierre.justoCierre)}</span>
                            </div>
                            <div className="bg-white p-3.5 border-2 border-brand-ink/30 rounded-xs">
                              <span className="text-brand-ink/50 font-black block mb-1 text-[10px] tracking-wider">RAPPI APP:</span>
                              <span className="text-sm font-black text-brand-ink">{formatCOP(currentCierre.rappiCierre)}</span>
                            </div>
                            <div className="bg-white p-3.5 border-2 border-brand-ink/30 rounded-xs">
                              <span className="text-brand-ink/50 font-black block mb-1 text-[10px] tracking-wider">TRANSF.:</span>
                              <span className="text-sm font-black text-brand-ink">{formatCOP(currentCierre.transferenciasCierre || 0)}</span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t-2 border-brand-ink flex justify-between items-center text-xs">
                            <div className="flex items-center space-x-1 text-brand-ink/70 font-semibold">
                              <span className="font-black text-brand-ink">Propinas registradas:</span>
                              <span className="font-mono">{formatCOP(currentCierre.propinas)}</span>
                            </div>
                            <div className="flex items-center space-x-1 font-black text-brand-ink uppercase tracking-wider text-[11px]">
                              <span>Total Neto Recibido:</span>
                              <span className="font-mono text-brand-success text-sm">
                                {formatCOP(currentCierre.efectivoCierre + currentCierre.datafonoCierre + currentCierre.justoCierre + currentCierre.rappiCierre + (currentCierre.transferenciasCierre || 0) + currentCierre.propinas)}
                              </span>
                            </div>
                          </div>

                          {currentCierre.novedades && (
                            <div className="mt-4 bg-white p-3.5 border border-brand-ink text-xs">
                              <span className="font-black text-brand-ink/60 block mb-1 uppercase tracking-wider text-[10px]">Novedades del Turno:</span>
                              <p className="text-brand-ink leading-relaxed font-sans font-medium italic">"{currentCierre.novedades}"</p>
                            </div>
                          )}
                        </div>

                        {/* PASO 1: Cargar Reporte de POS - Opcional / Automatización */}
                        <div className="bg-white p-4 sm:p-5 border-2 border-brand-ink mb-5 space-y-3 shadow-[3px_3px_0px_0px_#1C1917]">
                          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-brand-bg pb-2.5">
                            <h4 className="text-xs font-black text-brand-ink uppercase tracking-wider flex items-center space-x-1.5">
                              <span className="bg-zinc-800 text-white px-2 py-0.5 rounded-sm font-black mr-1 text-[10px] font-sans">Paso 1</span>
                              <span>Cargar Reporte de POS</span>
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 font-black px-2 py-0.5 uppercase font-sans">
                                Opcional • Automatización
                              </span>
                              {posData && (
                                <button
                                  type="button"
                                  onClick={() => setPosData(null)}
                                  className="text-[10px] text-zinc-500 hover:text-red-700 underline font-bold cursor-pointer transition-colors"
                                >
                                  Quitar reporte
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] text-brand-ink/70 font-medium leading-relaxed">
                            <strong>Ahorro de tiempo:</strong> Si tienes el reporte del POS (PDF, CSV o TXT), súbelo para extraer automáticamente las ventas por canal y novedades. <em>Si no cuentas con el reporte, este paso es 100% opcional y puedes auditar directamente en el Paso 2.</em>
                          </p>

                          <PDFUploader 
                            cierre={currentCierre} 
                            currentPOSData={posData}
                            onDataExtracted={handleDataExtracted} 
                            onClearData={() => setPosData(null)}
                          />
                        </div>

                        {/* COMPONENT CONCILIATION: Side by side comparison with Manual input editing */}
                        <div className="bg-white p-4 sm:p-5 border-2 border-brand-ink space-y-5 shadow-[3px_3px_0px_0px_#1C1917]">
                          <div className="flex justify-between items-center border-b border-brand-bg pb-2.5">
                            <h4 className="text-xs font-black text-brand-ink uppercase tracking-wider flex items-center space-x-1.5">
                              <span className="bg-brand-success text-white px-2 py-0.5 rounded-sm font-black mr-1 text-[11px] font-sans">Paso 2</span>
                              <span>Conciliación de Auditoría Real</span>
                            </h4>
                            <span className="text-[10px] bg-brand-success/20 text-brand-success border border-brand-success/30 font-black px-2 py-0.5 uppercase font-sans">
                              Valores de Conciliación Reales
                            </span>
                          </div>

                          <p className="text-xs text-brand-ink/70 font-semibold leading-relaxed">
                            <strong>Instrucciones para el Admin:</strong> Confirma o ajusta los valores reales a conciliar (Efectivo, Datáfono, Justo, Rappi y Transferencias) para calcular automáticamente el descuadre y aplicar la política de distribución.
                          </p>

                          {/* Tabla Comparativa en tiempo real */}
                          {isLoadingCanales && (
                            <div className="flex items-center space-x-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700 shrink-0" />
                              <span className="font-semibold">Consultando automáticamente canales digitales (IntuiPOS y Justo)...</span>
                            </div>
                          )}
                          <div className="w-full overflow-x-auto border-2 border-brand-ink/20 rounded-sm bg-white shadow-[2px_2px_0px_0px_#1C1917]">
                            <table className="w-full text-xs text-left border-collapse">
                              <thead>
                                <tr className="border-b-2 border-brand-ink bg-brand-bg/60 text-brand-ink/80 uppercase tracking-wider text-[10px] font-black">
                                  <th className="py-3.5 px-5 text-left w-[22%]">Canal Recaudo</th>
                                  <th className="py-3.5 px-5 text-right whitespace-nowrap w-[18%]">Cierre Físico (Equipo)</th>
                                  <th className="py-3.5 px-5 text-right whitespace-nowrap w-[18%]">Lectura POS</th>
                                  <th className="py-3.5 px-5 text-right whitespace-nowrap w-[24%]">Reales a Conciliar (Admin)</th>
                                  <th className="py-3.5 px-5 text-right whitespace-nowrap w-[18%]">Diferencia Desfase</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-brand-bg font-mono">
                                
                                {/* Efectivo */}
                                <tr className="hover:bg-brand-bg/10 transition-colors">
                                  <td className="py-3.5 px-5 font-sans font-bold text-brand-ink">Efectivo</td>
                                  <td className="py-3.5 px-5 text-right text-brand-ink font-bold tabular-nums whitespace-nowrap">
                                    {formatCOP(currentCierre.efectivoCierre)}
                                  </td>
                                  <td className="py-3.5 px-5 text-right text-zinc-500 font-bold tabular-nums whitespace-nowrap">
                                    {posData ? formatCOP(posData.efectivoPOS) : (currentCierre.efectivoPOS !== undefined && currentCierre.efectivoPOS !== null ? formatCOP(currentCierre.efectivoPOS) : <span className="text-[10px] text-zinc-400 font-sans italic">Sin POS</span>)}
                                  </td>
                                  <td className="py-2.5 px-5 text-right whitespace-nowrap">
                                    <div className="flex justify-end items-center">
                                      <span className="text-[10px] text-zinc-400 mr-1.5 font-bold font-sans">$</span>
                                      <input
                                        type="text"
                                        value={formatInputNumber(reconcileEfectivo)}
                                        onChange={(e) => updateReconcileField("efectivo", e.target.value)}
                                        placeholder="0"
                                        className="w-32 text-right font-mono font-bold border-2 border-brand-ink bg-white px-2.5 py-1 text-xs outline-none focus:bg-emerald-50"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-5 text-right font-bold whitespace-nowrap">
                                    {getDiferenciaBadge(currentCierre.efectivoCierre - reconcileEfectivo)}
                                  </td>
                                </tr>

                                {/* Datáfono */}
                                <tr className="hover:bg-brand-bg/10 transition-colors">
                                  <td className="py-3.5 px-5 font-sans font-bold text-brand-ink">
                                    <span>Tarjetas / Datáfono</span>
                                    <p className="text-[9px] text-brand-ink/50 font-normal">Auditoría manual por vouchers</p>
                                  </td>
                                  <td className="py-3.5 px-5 text-right text-brand-ink font-bold tabular-nums whitespace-nowrap">
                                    {formatCOP(currentCierre.datafonoCierre)}
                                  </td>
                                  <td className="py-3.5 px-5 text-right font-medium whitespace-nowrap">
                                    <span className="inline-flex items-center text-[10px] text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded font-sans font-medium">
                                      N/A (Auditoría manual)
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-5 text-right whitespace-nowrap">
                                    <div className="flex justify-end items-center">
                                      <span className="text-[10px] text-zinc-400 mr-1.5 font-bold font-sans">$</span>
                                      <input
                                        type="text"
                                        value={formatInputNumber(reconcileDatafono)}
                                        onChange={(e) => updateReconcileField("tarjetas", e.target.value)}
                                        placeholder="0"
                                        className="w-32 text-right font-mono font-bold border-2 border-brand-ink bg-white px-2.5 py-1 text-xs outline-none focus:bg-emerald-50"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-5 text-right font-bold whitespace-nowrap">
                                    {getDiferenciaBadge(currentCierre.datafonoCierre - reconcileDatafono)}
                                  </td>
                                </tr>

                                {/* Justo */}
                                <tr className="hover:bg-brand-bg/10 transition-colors">
                                  <td className="py-3.5 px-5 font-sans font-bold text-brand-ink">
                                    <span>Justo App</span>
                                    <p className="text-[9px] text-brand-ink/50 font-normal">API Justo v3 / Portal Justo</p>
                                  </td>
                                  <td className="py-3.5 px-5 text-right text-brand-ink font-bold tabular-nums whitespace-nowrap">
                                    {isLoadingCanales ? (
                                      <span className="text-[10px] text-brand-ink/50 italic font-sans animate-pulse">Consultando API Justo...</span>
                                    ) : (
                                      formatCOP(currentCierre.justoCierre || reconcileJusto || posData?.justoPOS || currentCierre.justoPOS || 0)
                                    )}
                                  </td>
                                  <td className="py-3.5 px-5 text-right text-zinc-500 font-bold tabular-nums whitespace-nowrap">
                                    {posData ? formatCOP(posData.justoPOS) : (currentCierre.justoPOS !== undefined && currentCierre.justoPOS !== null ? formatCOP(currentCierre.justoPOS) : <span className="text-[10px] text-zinc-400 font-sans italic">Sin POS</span>)}
                                  </td>
                                  <td className="py-2.5 px-5 text-right whitespace-nowrap">
                                    <div className="flex justify-end items-center">
                                      <span className="text-[10px] text-zinc-400 mr-1.5 font-bold font-sans">$</span>
                                      <input
                                        type="text"
                                        value={formatInputNumber(reconcileJusto)}
                                        onChange={(e) => updateReconcileField("justo", e.target.value)}
                                        placeholder="0"
                                        className="w-32 text-right font-mono font-bold border-2 border-brand-ink bg-white px-2.5 py-1 text-xs outline-none focus:bg-emerald-50"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-5 text-right font-bold whitespace-nowrap">
                                    {getDiferenciaBadge(reconcileJusto - (posData ? posData.justoPOS : (currentCierre.justoPOS ?? currentCierre.justoCierre ?? 0)))}
                                  </td>
                                </tr>

                                {/* Rappi */}
                                <tr className="hover:bg-brand-bg/10 transition-colors">
                                  <td className="py-3.5 px-5 font-sans font-bold text-brand-ink">
                                    <span>Rappi App</span>
                                    <p className="text-[9px] text-brand-ink/50 font-normal">Sin API directa • Lectura POS (CxC RAPPI)</p>
                                  </td>
                                  <td className="py-3.5 px-5 text-right font-medium whitespace-nowrap">
                                    {currentCierre.rappiCierre && currentCierre.rappiCierre !== (posData?.rappiPOS || 0) ? (
                                      <span className="text-brand-ink font-bold tabular-nums">{formatCOP(currentCierre.rappiCierre)}</span>
                                    ) : (
                                      <span className="inline-flex items-center text-[10px] text-amber-900 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded font-sans font-medium">
                                        Sin API directa (Revisar Portal)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-5 text-right text-zinc-500 font-bold tabular-nums whitespace-nowrap">
                                    {posData ? formatCOP(posData.rappiPOS) : (currentCierre.rappiPOS !== undefined && currentCierre.rappiPOS !== null ? formatCOP(currentCierre.rappiPOS) : <span className="text-[10px] text-zinc-400 font-sans italic">Sin POS</span>)}
                                  </td>
                                  <td className="py-2.5 px-5 text-right whitespace-nowrap">
                                    <div className="flex justify-end items-center">
                                      <span className="text-[10px] text-zinc-400 mr-1.5 font-bold font-sans">$</span>
                                      <input
                                        type="text"
                                        value={formatInputNumber(reconcileRappi)}
                                        onChange={(e) => updateReconcileField("rappi", e.target.value)}
                                        placeholder="0"
                                        className="w-32 text-right font-mono font-bold border-2 border-brand-ink bg-white px-2.5 py-1 text-xs outline-none focus:bg-emerald-50"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-5 text-right font-bold whitespace-nowrap">
                                    {getDiferenciaBadge(reconcileRappi - (posData ? posData.rappiPOS : (currentCierre.rappiPOS ?? currentCierre.rappiCierre ?? 0)))}
                                  </td>
                                </tr>

                                {/* Transferencias */}
                                <tr className="hover:bg-brand-bg/10 transition-colors">
                                  <td className="py-3.5 px-5 font-sans font-bold text-brand-ink">
                                    <span>Transferencias</span>
                                    <p className="text-[9px] text-brand-ink/50 font-normal">Auditoría manual por vouchers</p>
                                  </td>
                                  <td className="py-3.5 px-5 text-right font-medium whitespace-nowrap">
                                    <span className="inline-flex items-center text-[10px] text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded font-sans font-medium">
                                      N/A (Auditoría manual)
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-5 text-right text-zinc-500 font-bold tabular-nums whitespace-nowrap">
                                    {posData ? formatCOP(posData.transferenciasPOS) : (currentCierre.transferenciasPOS !== undefined && currentCierre.transferenciasPOS !== null ? formatCOP(currentCierre.transferenciasPOS) : <span className="text-[10px] text-zinc-400 font-sans italic">Sin POS</span>)}
                                  </td>
                                  <td className="py-2.5 px-5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end space-x-2">
                                      <label className="flex items-center space-x-1 cursor-pointer select-none">
                                        <span className="text-[10px] font-bold text-brand-ink/70">¿Coincide?</span>
                                        <input
                                          type="checkbox"
                                          checked={transferenciasCoincide}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setTransferenciasCoincide(isChecked);
                                            const posT = posData ? posData.transferenciasPOS : (currentCierre.transferenciasPOS ?? 0);
                                            setReconcileTransferencias(isChecked ? posT : 0);
                                          }}
                                          className="w-4 h-4 accent-[#1E3E30] rounded cursor-pointer"
                                        />
                                      </label>
                                      <div className="flex items-center">
                                        <span className="text-[10px] text-zinc-400 mr-1 font-bold font-sans">$</span>
                                        <input
                                          type="text"
                                          value={formatInputNumber(reconcileTransferencias)}
                                          onChange={(e) => {
                                            const clean = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                                            setReconcileTransferencias(clean);
                                            const posT = posData ? posData.transferenciasPOS : (currentCierre.transferenciasPOS ?? 0);
                                            setTransferenciasCoincide(clean > 0 && clean === posT);
                                          }}
                                          placeholder="0"
                                          className="w-28 text-right font-mono font-bold border-2 border-brand-ink bg-white px-2 py-1 text-xs outline-none focus:bg-emerald-50"
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-5 text-right font-bold whitespace-nowrap">
                                    {getDiferenciaBadge(reconcileTransferencias - (posData ? posData.transferenciasPOS : (currentCierre.transferenciasPOS ?? currentCierre.transferenciasCierre ?? 0)))}
                                  </td>
                                </tr>

                              </tbody>
                            </table>
                          </div>

                          {/* Alerta de Anulaciones Detectadas */}
                          {posData?.anulacionesNote && (
                            <div className="bg-amber-50 border-2 border-amber-600 p-4 text-amber-900 text-xs shadow-[3px_3px_0px_0px_#B45309] flex items-start space-x-2.5">
                              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <strong className="uppercase font-black block tracking-wider mb-1">⚠️ Se detectaron anulaciones en el POS:</strong>
                                <p className="font-semibold leading-relaxed text-brand-ink">{posData.anulacionesNote}</p>
                                <p className="mt-1.5 text-[10px] font-black uppercase text-amber-800">Esta nota se agregará automáticamente a las novedades de este cierre al aprobar.</p>
                              </div>
                            </div>
                          )}

                          {/* SECCIÓN DEL EQUIPO DEL TURNO Y DISTRIBUCIÓN DE DESCUADRES (POLÍTICA 60/40) */}
                          {(() => {
                            const posJ = posData ? posData.justoPOS : (currentCierre.justoPOS ?? currentCierre.justoCierre ?? 0);
                            const posR = posData ? posData.rappiPOS : (currentCierre.rappiPOS ?? currentCierre.rappiCierre ?? 0);
                            const posT = posData ? posData.transferenciasPOS : (currentCierre.transferenciasPOS ?? currentCierre.transferenciasCierre ?? 0);

                            const totalDif = (currentCierre.efectivoCierre - reconcileEfectivo) +
                                             (currentCierre.datafonoCierre - reconcileDatafono) +
                                             (reconcileJusto - posJ) +
                                             (reconcileRappi - posR) +
                                             (reconcileTransferencias - posT);

                            const shortage = totalDif < 0 ? Math.abs(totalDif) : 0;
                            const shareLider = Math.round(shortage * 0.6);
                            const shareAuxiliaresTotal = shortage - shareLider;
                            const numAuxiliares = auxiliaresInputList.length;
                            const shareAuxiliarIndividual = numAuxiliares > 0 ? Math.round(shareAuxiliaresTotal / numAuxiliares) : 0;

                            return (
                              <div className="bg-brand-bg p-5 border-2 border-brand-ink space-y-4 shadow-[2px_2px_0px_0px_#1C1917]">
                                <div className="flex items-center space-x-2 border-b border-brand-ink/10 pb-2">
                                  <Users className="w-4 h-4 text-brand-ink" />
                                  <h4 className="text-[10px] font-black text-brand-ink uppercase tracking-wider">
                                    Registro de Equipo del Turno & Distribución de Faltante (Política 60% / 40%)
                                  </h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Entrada del Líder de Punto */}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-brand-ink/70 block tracking-wider">
                                      Líder de Punto (Asume el 60%)
                                    </label>
                                    <div className="flex">
                                      <input
                                        type="text"
                                        value={liderInputName}
                                        onChange={(e) => setLiderInputName(e.target.value)}
                                        placeholder="Nombre del Líder de Punto"
                                        className="w-full text-xs font-bold border-2 border-brand-ink bg-white p-2.5 outline-none focus:bg-amber-50"
                                      />
                                    </div>
                                    <p className="text-[9px] text-brand-ink/50 font-bold">
                                      Por política, el Líder de Punto asume el 60% del faltante total.
                                    </p>
                                  </div>

                                  {/* Entrada de los Auxiliares de Venta */}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-brand-ink/70 block tracking-wider">
                                      Auxiliares de Venta (Dividen el 40% restante)
                                    </label>
                                    <div className="flex space-x-2">
                                      <input
                                        type="text"
                                        value={auxiliarInputText}
                                        onChange={(e) => setAuxiliarInputText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (auxiliarInputText.trim()) {
                                              setAuxiliaresInputList([...auxiliaresInputList, auxiliarInputText.trim()]);
                                              setAuxiliarInputText("");
                                            }
                                          }
                                        }}
                                        placeholder="Nombre del auxiliar"
                                        className="w-full text-xs font-bold border-2 border-brand-ink bg-white p-2.5 outline-none focus:bg-amber-50"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (auxiliarInputText.trim()) {
                                            setAuxiliaresInputList([...auxiliaresInputList, auxiliarInputText.trim()]);
                                            setAuxiliarInputText("");
                                          }
                                        }}
                                        className="px-3.5 bg-brand-ink text-white hover:bg-black font-black uppercase tracking-wider text-xs border-2 border-brand-ink flex items-center justify-center cursor-pointer"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <p className="text-[9px] text-brand-ink/50 font-bold">
                                      Presione Enter o el botón (+) para agregar auxiliares. El 40% se divide equitativamente entre ellos.
                                    </p>
                                  </div>
                                </div>

                                {/* Listado de Auxiliares Agregados */}
                                <div className="bg-white p-3 border-2 border-brand-ink">
                                  <span className="text-[9px] text-brand-ink/50 uppercase tracking-wider block font-black mb-2">
                                    Auxiliares en el Turno ({numAuxiliares})
                                  </span>
                                  {numAuxiliares === 0 ? (
                                    <span className="text-[11px] font-bold text-brand-ink/40 italic block py-1">
                                      No se han agregado auxiliares para este turno aún.
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {auxiliaresInputList.map((auxName, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center space-x-1.5 bg-zinc-100 border border-brand-ink px-2 py-1 text-xs font-bold text-brand-ink"
                                        >
                                          <span>{auxName}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setAuxiliaresInputList(auxiliaresInputList.filter((_, i) => i !== idx));
                                            }}
                                            className="text-brand-ink hover:text-red-600 focus:outline-none cursor-pointer"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Visualización de la Política de Cobro de Faltantes */}
                                {shortage > 0 ? (
                                  <div className="bg-red-50 border-2 border-brand-danger p-4 text-brand-danger shadow-[2px_2px_0px_0px_#EF4444] space-y-2">
                                    <div className="flex items-center space-x-2 text-brand-danger">
                                      <AlertTriangle className="w-4 h-4 shrink-0" />
                                      <span className="text-xs font-black uppercase tracking-wider">
                                        POLÍTICA DE DESCUADRE ACTIVA (FALTANTE DETECTADO)
                                      </span>
                                    </div>
                                    
                                    <p className="text-xs font-bold text-brand-ink leading-relaxed">
                                      Existe un faltante total de <span className="font-mono font-black">{formatCOP(shortage)}</span>. 
                                      Se realizará la distribución del pago según la política de la empresa:
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-xs">
                                      {/* Distribución Líder */}
                                      <div className="bg-white p-2.5 border border-brand-ink text-brand-ink">
                                        <div className="text-[9px] font-black uppercase tracking-wider text-brand-ink/50">Líder de Punto (60%)</div>
                                        <div className="font-bold text-brand-ink truncate mt-0.5">{liderInputName || "Sin asignar"}</div>
                                        <div className="text-sm font-black text-brand-danger mt-1">{formatCOP(shareLider)}</div>
                                      </div>

                                      {/* Distribución Auxiliares */}
                                      <div className="bg-white p-2.5 border border-brand-ink text-brand-ink">
                                        <div className="text-[9px] font-black uppercase tracking-wider text-brand-ink/50">Auxiliares (40% Total)</div>
                                        <div className="font-bold text-brand-ink truncate mt-0.5">
                                          {numAuxiliares > 0 
                                            ? `${numAuxiliares} personas (${formatCOP(shareAuxiliaresTotal)})` 
                                            : "Sin auxiliares (Líder asume 100%)"
                                          }
                                        </div>
                                        <div className="text-sm font-black text-brand-danger mt-1">
                                          {numAuxiliares > 0 
                                            ? `${formatCOP(shareAuxiliarIndividual)} c/u` 
                                            : formatCOP(shareAuxiliaresTotal) + " (Líder asume)"
                                          }
                                        </div>
                                      </div>
                                    </div>

                                    {numAuxiliares === 0 && (
                                      <div className="bg-amber-50 border border-amber-500 p-2 text-amber-800 text-[10px] font-bold mt-1 uppercase tracking-wide">
                                        ⚠️ Atención: Al no registrar auxiliares, el 40% restante será sumado al cobro del Líder de Punto para cubrir el total del faltante.
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="bg-emerald-50 border-2 border-brand-success p-4 text-brand-success shadow-[2px_2px_0px_0px_#10B981] flex items-center space-x-2.5">
                                    <CheckCircle className="w-5 h-5 shrink-0" />
                                    <div className="text-xs">
                                      <strong className="uppercase font-black block tracking-wider mb-0.5">Caja Cuadrada o con Sobrante</strong>
                                      <p className="font-bold text-brand-ink/75 leading-relaxed">
                                        No se reportan faltantes de dinero en la comparación. No se aplicará descuento al equipo.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Resumen Final de Conciliación */}
                          {(() => {
                            const posJ = posData ? posData.justoPOS : (currentCierre.justoPOS ?? currentCierre.justoCierre ?? 0);
                            const posR = posData ? posData.rappiPOS : (currentCierre.rappiPOS ?? currentCierre.rappiCierre ?? 0);
                            const posT = posData ? posData.transferenciasPOS : (currentCierre.transferenciasPOS ?? currentCierre.transferenciasCierre ?? 0);

                            const totalDif = (currentCierre.efectivoCierre - reconcileEfectivo) +
                                             (currentCierre.datafonoCierre - reconcileDatafono) +
                                             (reconcileJusto - posJ) +
                                             (reconcileRappi - posR) +
                                             (reconcileTransferencias - posT);

                            return (
                              <div className="bg-brand-bg border-2 border-brand-ink p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-[2px_2px_0px_0px_#1C1917]">
                                <div className="text-center sm:text-left">
                                  <span className="text-[9px] text-brand-ink/50 uppercase tracking-wider block font-black">Desfase Acumulado Total</span>
                                  <span className="text-sm font-black font-mono block mt-0.5 text-brand-ink">
                                    {totalDif === 0 
                                      ? "Diferencia General: $0 (Caja Cuadrada Perfecta)" 
                                      : totalDif > 0 
                                        ? `Sobra en Total: ${formatCOP(totalDif)}` 
                                        : `Falta en Total: ${formatCOP(Math.abs(totalDif))}`
                                    }
                                  </span>
                                </div>

                                <button
                                  onClick={() => handleApproveConciliation(currentCierre)}
                                  className="px-5 py-2.5 bg-brand-ink text-white hover:bg-black font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-[3px_3px_0px_0px_#D4D4D8] cursor-pointer border-2 border-brand-ink"
                                >
                                  <FileCheck className="w-4 h-4" />
                                  <span>Aprobar y Finalizar Cuadre</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border-2 border-brand-ink border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[400px] shadow-[4px_4px_0px_0px_#1C1917]">
                      <HelpCircle className="w-12 h-12 text-brand-ink/40 mb-4 stroke-1" />
                      <h4 className="text-base font-black text-brand-ink uppercase tracking-wider">Consola de Conciliación Activa</h4>
                      <p className="text-xs text-brand-ink/60 font-bold max-w-sm mt-1.5 leading-relaxed">
                        Seleccione un cierre diario de la lista lateral para iniciar la revisión física contra el reporte PDF del POS.
                      </p>
                      
                      <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center justify-center text-xs text-brand-ink/60 font-bold">
                        <div className="flex items-center space-x-2">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-emerald-50 text-brand-success border border-brand-success uppercase">Cuadrado</span>
                          <span>Mapeo en Verde si cuadra ($0)</span>
                        </div>
                        <span className="hidden sm:inline text-brand-ink/20">|</span>
                        <div className="flex items-center space-x-2">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-red-50 text-brand-danger border border-brand-danger uppercase">Faltante</span>
                          <span>Mapeo en Rojo si hay faltantes</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )
          )}

          {auditSubTab === "history" && (
            /* TAB 3: HISTORIAL DE CIERRES AUDITADOS (Nested inside activeTab === "audit") */
            <div className="space-y-6">
                <div className="bg-white border-2 border-brand-ink p-6 shadow-[4px_4px_0px_0px_#1C1917]">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b-2 border-brand-ink pb-5 mb-6">
                <div>
                  <h3 className="text-base font-black text-brand-ink uppercase tracking-wider">Historial de Cierres Consolidados</h3>
                  <p className="text-xs text-brand-ink/50 mt-1 font-bold">Cierres cerrados y aprobados históricamente.</p>
                </div>
                
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-brand-bg border-2 border-brand-ink text-brand-ink font-mono font-bold">
                  <Calendar className="w-3.5 h-3.5 text-brand-ink" />
                  <span>{squaredCierres.length} registros</span>
                </div>
              </div>

              {/* Filtros de Fecha y Desfases para Historial */}
              <div className="bg-brand-bg border-2 border-brand-ink p-4 mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-[2px_2px_0px_0px_#1C1917]">
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full xl:w-auto">
                  {/* Grupo Rango de Fechas */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center space-x-2 text-brand-ink shrink-0">
                      <ListFilter className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-wider">Fechas:</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <div className="flex items-center space-x-1 bg-white border border-brand-ink px-2 py-1 shadow-[1px_1px_0px_0px_#1C1917]">
                        <span className="text-[10px] font-black uppercase tracking-wide text-brand-ink/50">Desde:</span>
                        <input
                          type="date"
                          value={historyStartDate}
                          onChange={(e) => setHistoryStartDate(e.target.value)}
                          className="text-xs font-mono font-bold text-brand-ink outline-none bg-transparent cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center space-x-1 bg-white border border-brand-ink px-2 py-1 shadow-[1px_1px_0px_0px_#1C1917]">
                        <span className="text-[10px] font-black uppercase tracking-wide text-brand-ink/50">Hasta:</span>
                        <input
                          type="date"
                          value={historyEndDate}
                          onChange={(e) => setHistoryEndDate(e.target.value)}
                          className="text-xs font-mono font-bold text-brand-ink outline-none bg-transparent cursor-pointer"
                        />
                      </div>

                      {(historyStartDate || historyEndDate) && (
                        <button
                          onClick={() => {
                            setHistoryStartDate("");
                            setHistoryEndDate("");
                          }}
                          className="px-2 py-0.5 bg-white hover:bg-zinc-100 border border-brand-ink text-brand-ink text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-[1px_1px_0px_0px_#1C1917]"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grupo Filtro por Falta de Dinero */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase tracking-wider text-brand-ink shrink-0">Ver registros:</span>
                    <div className="flex border-2 border-brand-ink bg-white shadow-[1px_1px_0px_0px_#1C1917] p-0.5">
                      <button
                        onClick={() => setHistoryDeficitFilter("all")}
                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors ${
                          historyDeficitFilter === "all"
                            ? "bg-brand-ink text-white"
                            : "bg-white hover:bg-zinc-100 text-brand-ink"
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => setHistoryDeficitFilter("deficit")}
                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center space-x-1.5 transition-colors ${
                          historyDeficitFilter === "deficit"
                            ? "bg-brand-danger text-white"
                            : "bg-white hover:bg-zinc-100 text-brand-ink"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        <span>Falta Dinero</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Botón de Exportar PDF */}
                <button
                  onClick={handleExportPDF}
                  disabled={squaredCierres.length === 0}
                  className="px-4 py-2.5 bg-brand-ink text-white hover:bg-black font-black uppercase tracking-wider text-xs flex items-center justify-center space-x-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)] cursor-pointer border-2 border-brand-ink disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-all active:translate-y-[1px]"
                >
                  <FileDown className="w-4 h-4 stroke-[2.5]" />
                  <span>Exportar a PDF ({squaredCierres.length})</span>
                </button>
              </div>

              {squaredCierres.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center text-brand-ink/40 font-bold">
                  <Clock className="w-10 h-10 stroke-1 mb-2" />
                  <span className="text-xs">No hay registros conciliados en el historial aún.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {squaredCierres.map(c => {
                    const totalFisico = (c.efectivoCierre || 0) + (c.datafonoCierre || 0) + (c.justoCierre || 0) + (c.rappiCierre || 0) + (c.transferenciasCierre || 0);
                    const totalPOS = (c.efectivoPOS || 0) + (c.tarjetasPOS || 0) + (c.justoPOS || 0) + (c.rappiPOS || 0) + (c.transferenciasPOS || 0);
                    const difAcumulada = (c.difEfectivo || 0) + (c.difTarjetas || 0) + (c.difJusto || 0) + (c.difRappi || 0) + (c.difTransferencias || 0);

                    return (
                      <div 
                        key={c.id} 
                        className="bg-brand-bg border-2 border-brand-ink p-5 transition-all duration-150 space-y-4 shadow-[2px_2px_0px_0px_#1C1917] mb-4"
                      >
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-brand-ink pb-3">
                          <div className="flex items-center space-x-2.5">
                            <span className="text-xs font-black text-brand-ink block">{c.fecha}</span>
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 text-[9px] font-black bg-emerald-50 text-brand-success border border-brand-success uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3 text-brand-success" />
                              <span>Cuadrado</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                            <div className="text-[10px] text-brand-ink/50 flex flex-wrap gap-x-3 gap-y-1 font-mono font-bold uppercase">
                              {c.colaboradorNombre && (
                                <>
                                  <span>Registrado por: <strong className="text-brand-ink font-sans font-black">{c.colaboradorNombre}</strong></span>
                                  <span>•</span>
                                </>
                              )}
                              <span>Auditado por: <strong className="text-brand-ink font-sans font-black">{c.auditadoPor}</strong></span>
                              <span>•</span>
                              <span>Fecha: <strong className="text-brand-ink font-black">{c.auditadoAt ? new Date(c.auditadoAt).toLocaleDateString() : ""}</strong></span>
                            </div>

                            {/* Botón de Eliminar */}
                            {deletingId === c.id ? (
                              <div className="flex items-center space-x-2 bg-red-50 border border-brand-danger px-2.5 py-1 text-[10px] transition-all">
                                <span className="font-black text-brand-danger uppercase">¿Confirmar?</span>
                                <button 
                                  onClick={() => handleDeleteCierre(c.id)}
                                  className="px-2 py-0.5 bg-brand-danger text-white hover:bg-red-700 font-black uppercase text-[9px] cursor-pointer"
                                >
                                  Sí, Borrar
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="px-2 py-0.5 bg-zinc-200 text-brand-ink hover:bg-zinc-300 font-black uppercase text-[9px] cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(c.id)}
                                className="px-2 py-1 text-brand-danger hover:bg-red-50 border border-transparent hover:border-brand-danger flex items-center space-x-1 font-black uppercase text-[10px] tracking-wider transition-colors cursor-pointer"
                                title="Eliminar este cierre de caja"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Comparativas detalladas */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono">
                          
                          {/* Efectivo */}
                          <div className="bg-white p-3 border border-brand-ink flex justify-between items-center">
                            <div>
                              <span className="text-brand-ink/40 text-[10px] block font-sans font-black">EFECTIVO</span>
                              <span className="font-bold text-brand-ink block mt-0.5">{formatCOP(c.efectivoCierre)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-brand-ink/50 text-[9px] block font-bold">POS: {formatCOP(c.efectivoPOS || 0)}</span>
                              <span className="block mt-0.5">{getDiferenciaBadge(c.difEfectivo || 0)}</span>
                            </div>
                          </div>

                          {/* Datáfono */}
                          <div className="bg-white p-3 border border-brand-ink flex justify-between items-center">
                            <div>
                              <span className="text-brand-ink/40 text-[10px] block font-sans font-black">DATÁFONO</span>
                              <span className="font-bold text-brand-ink block mt-0.5">{formatCOP(c.datafonoCierre)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-brand-ink/50 text-[9px] block font-bold">POS: {formatCOP(c.tarjetasPOS || 0)}</span>
                              <span className="block mt-0.5">{getDiferenciaBadge(c.difTarjetas || 0)}</span>
                            </div>
                          </div>

                          {/* Justo */}
                          <div className="bg-white p-3 border border-brand-ink flex justify-between items-center">
                            <div>
                              <span className="text-brand-ink/40 text-[10px] block font-sans font-black">JUSTO APP</span>
                              <span className="font-bold text-brand-ink block mt-0.5">{formatCOP(c.justoCierre)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-brand-ink/50 text-[9px] block font-bold">POS: {formatCOP(c.justoPOS || 0)}</span>
                              <span className="block mt-0.5">{getDiferenciaBadge(c.difJusto || 0)}</span>
                            </div>
                          </div>

                          {/* Rappi */}
                          <div className="bg-white p-3 border border-brand-ink flex justify-between items-center">
                            <div>
                              <span className="text-brand-ink/40 text-[10px] block font-sans font-black">RAPPI APP</span>
                              <span className="font-bold text-brand-ink block mt-0.5">{formatCOP(c.rappiCierre)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-brand-ink/50 text-[9px] block font-bold">POS: {formatCOP(c.rappiPOS || 0)}</span>
                              <span className="block mt-0.5">{getDiferenciaBadge(c.difRappi || 0)}</span>
                            </div>
                          </div>

                          {/* Transferencias */}
                          <div className="bg-white p-3 border border-brand-ink flex justify-between items-center">
                            <div>
                              <span className="text-brand-ink/40 text-[10px] block font-sans font-black">TRANSFERENCIAS</span>
                              <span className="font-bold text-brand-ink block mt-0.5">{formatCOP(c.transferenciasCierre || 0)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-brand-ink/50 text-[9px] block font-bold">POS: {formatCOP(c.transferenciasPOS || 0)}</span>
                              <span className="block mt-0.5">{getDiferenciaBadge(c.difTransferencias || 0)}</span>
                            </div>
                          </div>

                        </div>

                        {/* EQUIPO DEL TURNO Y DISTRIBUCIÓN DEL DESCUADRE (POLÍTICA) */}
                        {c.liderNombre ? (
                          <div className="bg-white p-3.5 border border-brand-ink text-xs space-y-2">
                            <div className="flex items-center space-x-1.5 text-brand-ink/70 font-black uppercase tracking-wider text-[10px]">
                              <Users className="w-3.5 h-3.5 text-brand-ink" />
                              <span>Equipo de Trabajo de la Jornada</span>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1.5">
                              <div>
                                <span className="font-black text-brand-ink">Líder de Punto:</span>{" "}
                                <span className="font-semibold text-brand-ink/85">{c.liderNombre}</span>
                              </div>
                              {c.auxiliaresNombres && c.auxiliaresNombres.length > 0 && (
                                <div>
                                  <span className="font-black text-brand-ink">Auxiliares:</span>{" "}
                                  <span className="font-semibold text-brand-ink/85">
                                    {c.auxiliaresNombres.join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Detalle del descuento si hubo faltante */}
                            {difAcumulada < 0 && c.descuadreLider !== undefined && (
                              <div className="bg-red-50 border border-brand-danger/30 p-2.5 text-[11px] text-brand-ink mt-2">
                                <span className="font-black text-brand-danger uppercase block tracking-wider mb-1 font-sans">
                                  Distribución de Faltante ({formatCOP(Math.abs(difAcumulada))}):
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono mt-1 text-[11px]">
                                  <div className="bg-white p-2 border border-zinc-200 text-brand-ink">
                                    <strong className="font-sans font-bold">Líder ({c.liderNombre}):</strong>{" "}
                                    <span className="text-brand-danger font-bold">{formatCOP(c.descuadreLider)}</span> (60%)
                                  </div>
                                  <div className="bg-white p-2 border border-zinc-200 text-brand-ink">
                                    <strong className="font-sans font-bold">Auxiliares (40%):</strong>{" "}
                                    {c.auxiliaresNombres && c.auxiliaresNombres.length > 0 ? (
                                      <>
                                        <span className="text-brand-danger font-bold">{formatCOP(c.descuadreAuxiliar || 0)} c/u</span>{" "}
                                        ({c.auxiliaresNombres.length} p.)
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-brand-danger font-bold">{formatCOP(c.descuadreLider)}</span>{" "}
                                        <span>(Asumido 100% por falta de auxiliares)</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Mostrar nota si es un registro histórico antiguo */
                          <div className="bg-zinc-50/50 p-2.5 border border-dashed border-brand-ink/20 text-[10px] text-brand-ink/50 italic font-medium">
                            No se registró información de equipo para este cierre histórico anterior.
                          </div>
                        )}

                        {/* Novedades y Balance Total */}
                        <div className="bg-white p-3 border-2 border-brand-ink text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-[2px_2px_0px_0px_#1C1917]">
                          <div className="space-y-1 max-w-xl">
                            <span className="text-brand-ink/50 uppercase tracking-wider text-[9px] block font-black">Novedades Reportadas:</span>
                            <p className="text-brand-ink font-sans font-medium italic">"{c.novedades || "Sin novedades en el turno."}"</p>
                          </div>
                          
                          <div className="text-right shrink-0 border-t md:border-t-0 md:border-l border-brand-ink/20 pt-2.5 md:pt-0 md:pl-4 min-w-[200px]">
                            <div className="flex justify-between items-center text-brand-ink/60 mb-0.5 font-bold">
                              <span>Total Arqueo Físico:</span>
                              <span className="font-mono text-brand-ink font-black">{formatCOP(totalFisico)}</span>
                            </div>
                            <div className="flex justify-between items-center text-brand-ink/60 mb-1 font-bold">
                              <span>Total Ventas POS:</span>
                              <span className="font-mono text-brand-ink font-black">{formatCOP(totalPOS)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-black font-sans uppercase tracking-wider text-brand-ink border-t border-brand-ink/10 pt-1.5">
                              <span>Desfase Total:</span>
                              <span className={`font-mono font-black ${difAcumulada === 0 ? "text-brand-success" : difAcumulada > 0 ? "text-brand-info" : "text-brand-danger"}`}>
                                {difAcumulada === 0 
                                  ? "$0 (Cerrado)" 
                                  : difAcumulada > 0 
                                    ? `Sobra ${formatCOP(difAcumulada)}` 
                                    : `Falta ${formatCOP(Math.abs(difAcumulada))}`
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
            )}
          </div>
        )}

        {activeTab === "propinas" && (
          <div className="space-y-6">
            {/* Cabecera de Propinas */}
            <div className="bg-white p-6 border-2 border-brand-ink shadow-[4px_4px_0px_0px_#1C1917] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-brand-ink flex items-center space-x-2">
                  <Gift className="w-6 h-6 text-brand-ink" />
                  <span>Liquidación Quincenal de Propinas</span>
                </h2>
                <p className="text-xs text-brand-ink/70 mt-1 font-medium">
                  Selecciona manualmente los días (cierres cuadrados), sube el reporte de turnos del POS y genera el PDF de liquidación para el equipo.
                </p>
              </div>
              
              {/* Rango de fechas para Propinas */}
              <div className="flex flex-wrap items-center gap-3 bg-brand-bg p-3 border-2 border-brand-ink shadow-[2px_2px_0px_0px_#1C1917]">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-ink/60">Desde:</span>
                  <input
                    type="date"
                    value={propinasStartDate}
                    onChange={(e) => setPropinasStartDate(e.target.value)}
                    className="text-xs font-mono font-black text-brand-ink outline-none bg-white border border-brand-ink px-2 py-1 cursor-pointer"
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-ink/60">Hasta:</span>
                  <input
                    type="date"
                    value={propinasEndDate}
                    onChange={(e) => setPropinasEndDate(e.target.value)}
                    className="text-xs font-mono font-black text-brand-ink outline-none bg-white border border-brand-ink px-2 py-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Dos columnas: Izquierda (Selección de días y carga PDF), Derecha (Ajuste de roster y Liquidación) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Columna Izquierda: Selección de Cierres y Carga de PDF */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* 1. Selección manual de Días */}
                <div className="bg-white border-2 border-brand-ink p-5 shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
                  <div className="flex items-center space-x-2 border-b border-brand-ink/10 pb-2">
                    <Calendar className="w-4 h-4 text-brand-ink" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-brand-ink">
                      1. Días a Liquidar ({selectedCierreIdsForPropinas.length})
                    </h3>
                  </div>

                  <p className="text-[11px] text-brand-ink/60 font-semibold leading-relaxed">
                    Solo se muestran los cierres que ya han sido <strong className="text-brand-success uppercase">Aprobados y Cuadrados</strong>. Marca o desmarca los días a incluir.
                  </p>

                  <div className="flex items-center justify-between gap-2 bg-brand-bg p-2 border border-brand-ink/15 text-[10px] font-black uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => {
                        const activeCierresIds = cierres.filter(c => {
                          if (c.estado !== "Cuadrado") return false;
                          if (propinasStartDate && c.fecha < propinasStartDate) return false;
                          if (propinasEndDate && c.fecha > propinasEndDate) return false;
                          return true;
                        }).map(c => c.id);
                        setSelectedCierreIdsForPropinas(activeCierresIds);
                      }}
                      className="text-brand-ink/80 hover:text-brand-ink cursor-pointer hover:underline flex items-center space-x-1"
                    >
                      <span>✓ Seleccionar Todos</span>
                    </button>
                    <span className="text-brand-ink/20">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCierreIdsForPropinas([])}
                      className="text-brand-ink/80 hover:text-brand-ink cursor-pointer hover:underline flex items-center space-x-1"
                    >
                      <span>✗ Limpiar Selección</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {(() => {
                      const activeCierres = cierres.filter(c => {
                        if (c.estado !== "Cuadrado") return false;
                        if (propinasStartDate && c.fecha < propinasStartDate) return false;
                        if (propinasEndDate && c.fecha > propinasEndDate) return false;
                        return true;
                      }).sort((a, b) => b.fecha.localeCompare(a.fecha));

                      if (activeCierres.length === 0) {
                        return (
                          <div className="text-center py-6 bg-brand-bg border border-dashed border-brand-ink/20 text-xs text-brand-ink/40 font-bold italic">
                            No se encontraron cierres cuadrados en este rango de fechas.
                          </div>
                        );
                      }

                      return activeCierres.map(c => {
                        const isChecked = selectedCierreIdsForPropinas.includes(c.id);
                        const teamCount = (propinasDaysTeam[c.id] || []).length;
                        return (
                          <div 
                            key={c.id} 
                            onClick={() => {
                              setSelectedCierreIdsForPropinas(prev => 
                                prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                              );
                            }}
                            className={`flex items-center justify-between p-2.5 border-2 cursor-pointer transition-all ${
                              isChecked 
                                ? "border-brand-ink bg-emerald-50/50" 
                                : "border-brand-ink/10 bg-white hover:border-brand-ink/30"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by parent onClick
                                className="w-4 h-4 text-brand-ink border-2 border-brand-ink bg-white focus:ring-0 accent-brand-ink cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-black font-mono text-brand-ink">{c.fecha}</span>
                                <span className="block text-[9px] font-bold text-brand-ink/50 uppercase tracking-wide">
                                  {teamCount === 1 ? "1 Colaborador" : `${teamCount} Colaboradores`}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black font-mono text-brand-ink block">
                                {formatCOP(c.propinas || 0)}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* 2. Carga del PDF de Turnos POS */}
                <div className="bg-white border-2 border-brand-ink p-5 shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
                  <div className="flex items-center space-x-2 border-b border-brand-ink/10 pb-2">
                    <UploadCloud className="w-4 h-4 text-brand-ink" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-brand-ink">
                      2. Reporte de Asistencia POS (Opcional)
                    </h3>
                  </div>

                  <p className="text-[11px] text-brand-ink/60 font-semibold leading-relaxed">
                    Sube el reporte PDF de control de horas/turnos del POS para pre-poblar automáticamente el equipo que trabajó cada día, o usa una plantilla de simulación rápida.
                  </p>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragEnter={(e) => { e.preventDefault(); }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handlePosPdfFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 relative ${
                      isProcessingPosPdf
                        ? "bg-zinc-100/50 border-brand-ink/30 cursor-not-allowed"
                        : "border-brand-ink/30 bg-brand-bg hover:border-brand-ink hover:bg-zinc-50"
                    }`}
                    onClick={() => {
                      if (!isProcessingPosPdf) {
                        const fileInput = document.getElementById("pos-shift-pdf-file") as HTMLInputElement;
                        fileInput?.click();
                      }
                    }}
                  >
                    <input
                      id="pos-shift-pdf-file"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handlePosPdfFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    {isProcessingPosPdf ? (
                      <>
                        <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
                        <span className="text-xs font-black uppercase tracking-wide text-brand-ink">{processingPosStep}</span>
                      </>
                    ) : uploadedPosFileName ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 text-brand-success" />
                        <span className="text-xs font-black text-brand-ink truncate max-w-full block">{uploadedPosFileName}</span>
                        <span className="text-[9px] font-bold text-brand-success uppercase tracking-wider">¡Reporte de Turnos Cargado con Éxito!</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-8 h-8 text-brand-ink/50" />
                        <span className="text-xs font-black uppercase text-brand-ink">Seleccionar o soltar PDF del POS</span>
                        <span className="text-[9px] font-semibold text-brand-ink/50">Soporta reportes de asistencia generados por el sistema de horas</span>
                      </>
                    )}
                  </div>

                  {/* Botones de simulación rápida para evaluación */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-brand-ink/50 block">SIMULAR CARGA DE HORAS POS (RÁPIDO)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsProcessingPosPdf(true);
                          setProcessingPosStep("Simulando extracción de PDF de turnos...");
                          setTimeout(() => {
                            setIsProcessingPosPdf(false);
                            setUploadedPosFileName("REPORTE_ASISTENCIA_CHAPINERO_Q1.pdf");
                            
                            // Let's create a simulated team roster for the closures in range
                            const activeCierres = cierres.filter(c => {
                              if (c.estado !== "Cuadrado") return false;
                              if (propinasStartDate && c.fecha < propinasStartDate) return false;
                              if (propinasEndDate && c.fecha > propinasEndDate) return false;
                              return true;
                            });

                            // Fill rosters with consistent set of people
                            const simulatedRoster: Record<string, string[]> = {};
                            const teamPools = [
                              ["Juan Pérez", "María Gómez", "Carlos Ruiz"],
                              ["María Gómez", "Ana Martínez", "Luis Castro"],
                              ["Juan Pérez", "Ana Martínez", "Carlos Ruiz"],
                              ["Carlos Ruiz", "Luis Castro", "Juan Pérez"]
                            ];

                            activeCierres.forEach((c, idx) => {
                              simulatedRoster[c.id] = teamPools[idx % teamPools.length];
                            });

                            setPropinasDaysTeam(prev => ({ ...prev, ...simulatedRoster }));
                          }, 1000);
                        }}
                        className="p-2 border border-brand-ink text-[10px] font-black uppercase tracking-wider text-left bg-white hover:bg-zinc-50 cursor-pointer animate-[pulse_1.5s_infinite]"
                      >
                        ⚡ 1ra Quincena
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsProcessingPosPdf(true);
                          setProcessingPosStep("Simulando extracción de PDF de turnos...");
                          setTimeout(() => {
                            setIsProcessingPosPdf(false);
                            setUploadedPosFileName("REPORTE_ASISTENCIA_CHAPINERO_Q2.pdf");

                            const activeCierres = cierres.filter(c => {
                              if (c.estado !== "Cuadrado") return false;
                              if (propinasStartDate && c.fecha < propinasStartDate) return false;
                              if (propinasEndDate && c.fecha > propinasEndDate) return false;
                              return true;
                            });

                            const simulatedRoster: Record<string, string[]> = {};
                            const teamPools = [
                              ["Ana Martínez", "María Gómez", "Diana Cardona"],
                              ["Juan Pérez", "Andrés Felipe", "Diana Cardona"],
                              ["María Gómez", "Carlos Ruiz", "Andrés Felipe"],
                              ["Juan Pérez", "Andrés Felipe", "Ana Martínez"]
                            ];

                            activeCierres.forEach((c, idx) => {
                              simulatedRoster[c.id] = teamPools[idx % teamPools.length];
                            });

                            setPropinasDaysTeam(prev => ({ ...prev, ...simulatedRoster }));
                          }, 1000);
                        }}
                        className="p-2 border border-brand-ink text-[10px] font-black uppercase tracking-wider text-left bg-white hover:bg-zinc-50 cursor-pointer"
                      >
                        ⚡ 2da Quincena
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Ajuste de Roster por Día y Liquidación Consolidada */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 3. Ajuste de Personal por Día */}
                <div className="bg-white border-2 border-brand-ink p-5 shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
                  <div className="flex items-center space-x-2 border-b border-brand-ink/10 pb-2">
                    <Users className="w-4 h-4 text-brand-ink" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-brand-ink">
                      3. Ajustar Personas y Ver Reparto por Día
                    </h3>
                  </div>

                  <p className="text-[11px] text-brand-ink/60 font-semibold leading-relaxed">
                    Las personas por día se pre-pueblan con el Líder y los Auxiliares del cierre de caja (o se sobrescriben al cargar el PDF de turnos del POS). Puedes agregar o quitar colaboradores para cada día. Las propinas de cada día se reparten <strong className="text-brand-ink font-bold">equitativamente</strong> entre los que trabajaron ese día.
                  </p>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {(() => {
                      const selectedCierres = cierres.filter(c => selectedCierreIdsForPropinas.includes(c.id))
                        .sort((a, b) => b.fecha.localeCompare(a.fecha));

                      if (selectedCierres.length === 0) {
                        return (
                          <div className="text-center py-10 bg-brand-bg border border-dashed border-brand-ink/20 text-xs text-brand-ink/40 font-bold italic">
                            No has seleccionado ningún día a liquidar en la columna izquierda.
                          </div>
                        );
                      }

                      return selectedCierres.map(c => {
                        const team = propinasDaysTeam[c.id] || [];
                        const dayTips = c.propinas || 0;
                        const sharePerPerson = team.length > 0 ? Math.round(dayTips / team.length) : 0;
                        const totalPointsOnDay = team.reduce((sum, n) => sum + getMemberConfig(n, c.id).puntos, 0);

                        return (
                          <div key={c.id} className="border border-brand-ink p-3 bg-brand-bg/40 space-y-2.5">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 border-b border-brand-ink/10 pb-2">
                              <div>
                                <span className="text-xs font-black font-mono text-brand-ink mr-2">{c.fecha}</span>
                                <span className="text-[9px] bg-brand-ink text-white px-1.5 py-0.5 font-mono font-bold uppercase tracking-wider">
                                  Propinas: {formatCOP(dayTips)}
                                </span>
                              </div>
                              <div className="text-left sm:text-right">
                                <span className="text-[11px] font-bold text-brand-ink/60">
                                  {team.length > 0 
                                    ? (tipDistributionMode === "puntos" 
                                        ? `Reparto por Puntos: ${totalPointsOnDay.toFixed(1)} pts totales` 
                                        : `Reparto Equitativo: ${formatCOP(sharePerPerson)} c/u`) 
                                    : "Sin equipo asignado (Repartido: $0)"}
                                </span>
                              </div>
                            </div>

                            {/* Team list for this day */}
                            <div className="flex flex-wrap gap-1.5">
                              {team.map((name, nameIdx) => {
                                const config = getMemberConfig(name, c.id);
                                const isAsistente = config.role.toLowerCase().includes("asistente de servicio") || config.role.toLowerCase().includes("aux de venta");
                                const memberShare = tipDistributionMode === "puntos"
                                  ? (totalPointsOnDay > 0 ? Math.round(dayTips * (config.puntos / totalPointsOnDay)) : 0)
                                  : sharePerPerson;
                                return (
                                  <span
                                    key={nameIdx}
                                    className="inline-flex items-center space-x-1.5 bg-white border border-brand-ink px-2 py-1 text-xs font-bold text-brand-ink shadow-sm"
                                  >
                                    <span className="flex flex-col text-left">
                                      <span className="font-black">{name}</span>
                                      <span className="text-[9px] text-[#FF5C35] font-black font-mono flex items-center">
                                        {formatCOP(memberShare)}
                                        {tipDistributionMode === "puntos" && (
                                          isAsistente ? (
                                            <select
                                              value={config.puntos === 1.3 ? "TC" : "MT"}
                                              onChange={(e) => {
                                                const type = e.target.value;
                                                const pts = type === "TC" ? 1.3 : 1.0;
                                                const rName = type === "TC" ? "Asistente de servicio tiempo completo (TC)" : "Asistente de servicio medio tiempo (MT)";
                                                saveDailyPointsConfig({
                                                  ...propinasDaysMemberConfig,
                                                  [c.id]: {
                                                    ...(propinasDaysMemberConfig[c.id] || {}),
                                                    [name]: { points: pts, roleName: rName }
                                                  }
                                                });
                                              }}
                                              className="ml-1 text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-black rounded px-1 py-0.5 outline-none cursor-pointer"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <option value="TC">TC (1.3 pts)</option>
                                              <option value="MT">MT (1.0 pts)</option>
                                            </select>
                                          ) : (
                                            <span className="text-[9px] bg-zinc-100 text-zinc-700 border border-zinc-300 ml-1 px-1 font-mono font-black uppercase rounded">
                                              {config.puntos} pts
                                            </span>
                                          )
                                        )}
                                      </span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPropinasDaysTeam(prev => ({
                                          ...prev,
                                          [c.id]: (prev[c.id] || []).filter((_, idx) => idx !== nameIdx)
                                        }));
                                      }}
                                      className="text-brand-ink hover:text-red-600 focus:outline-none cursor-pointer p-0.5"
                                      title="Quitar"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })}

                              {addingPersonToDayId === c.id ? (
                                <div className="p-3 bg-white border border-brand-ink space-y-2.5 max-w-xs animate-[scale_0.15s_ease-out]" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-between items-center border-b border-brand-ink/10 pb-1">
                                    <span className="text-[9px] font-black uppercase text-brand-ink/60">Seleccionar del Equipo:</span>
                                    <button 
                                      type="button" 
                                      onClick={() => { setAddingPersonToDayId(null); setNewPersonNameForDay(""); }}
                                      className="text-brand-ink hover:text-red-600 font-bold text-[9px] uppercase cursor-pointer"
                                    >
                                      Cerrar
                                    </button>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                    {teamMembers
                                      .filter(m => m.activo && m.aptoPropinas && !(team.includes(m.nombre)))
                                      .map(m => (
                                        <button
                                          key={m.nombre}
                                          type="button"
                                          onClick={() => {
                                            setPropinasDaysTeam(prev => ({
                                              ...prev,
                                              [c.id]: [...(prev[c.id] || []), m.nombre]
                                            }));
                                            setAddingPersonToDayId(null);
                                          }}
                                          className="text-[10px] font-bold bg-[#F5F2EB] hover:bg-brand-ink hover:text-white border border-brand-ink px-1.5 py-0.5 cursor-pointer transition-all rounded"
                                        >
                                          + {m.nombre} ({m.puntosPropinas} pts)
                                        </button>
                                      ))}
                                    {teamMembers.filter(m => m.activo && m.aptoPropinas && !(team.includes(m.nombre))).length === 0 && (
                                      <span className="text-[10px] text-zinc-400 italic">Todo el equipo apto asignado.</span>
                                    )}
                                  </div>
                                  
                                  <div className="border-t border-brand-ink/10 pt-2 space-y-1">
                                    <span className="text-[9px] font-black uppercase text-brand-ink/60 block">O ingresar nombre manual:</span>
                                    <div className="flex items-center space-x-1">
                                      <input
                                        type="text"
                                        placeholder="Nombre..."
                                        value={newPersonNameForDay}
                                        onChange={(e) => setNewPersonNameForDay(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && newPersonNameForDay.trim()) {
                                            setPropinasDaysTeam(prev => ({
                                              ...prev,
                                              [c.id]: [...(prev[c.id] || []), newPersonNameForDay.trim()]
                                            }));
                                            setNewPersonNameForDay("");
                                            setAddingPersonToDayId(null);
                                          }
                                        }}
                                        className="bg-white border border-brand-ink text-xs font-bold px-1.5 py-1 outline-none w-28 h-7"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (newPersonNameForDay.trim()) {
                                            setPropinasDaysTeam(prev => ({
                                              ...prev,
                                              [c.id]: [...(prev[c.id] || []), newPersonNameForDay.trim()]
                                            }));
                                            setNewPersonNameForDay("");
                                            setAddingPersonToDayId(null);
                                          }
                                        }}
                                        className="bg-brand-ink text-white text-[10px] font-black px-2 py-1 uppercase h-7 cursor-pointer"
                                      >
                                        OK
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddingPersonToDayId(c.id);
                                    setNewPersonNameForDay("");
                                  }}
                                  className="inline-flex items-center space-x-1 bg-white hover:bg-zinc-50 border border-brand-ink border-dashed px-2 py-0.5 text-xs font-bold text-brand-ink/60 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Agregar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>



                {/* 4. Resumen Consolidado y Descarga de Reporte */}
                <div className="bg-white border-2 border-brand-ink p-5 shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
                  <div className="flex items-center space-x-2 border-b border-brand-ink/10 pb-2">
                    <TrendingUp className="w-4 h-4 text-brand-ink" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-brand-ink">
                      4. Cuadro Consolidado de Liquidación
                    </h3>
                  </div>

                  {(() => {
                    const selectedCierres = cierres.filter(c => selectedCierreIdsForPropinas.includes(c.id));
                    
                    if (selectedCierres.length === 0) {
                      return (
                        <div className="text-center py-6 text-xs text-brand-ink/40 font-bold italic bg-brand-bg border border-dashed border-brand-ink/10">
                          Selecciona al menos un día con propinas para visualizar el consolidado final.
                        </div>
                      );
                    }

                    // Calculate total tips
                    const totalPeriodTips = selectedCierres.reduce((acc, c) => acc + (c.propinas || 0), 0);

                    // Calculate earnings per person
                    const personEarnings: Record<string, { days: string[]; amount: number; totalPointsAssigned: number }> = {};
                    
                    selectedCierres.forEach(c => {
                      const team = propinasDaysTeam[c.id] || [];
                      const dayTips = c.propinas || 0;
                      
                      if (tipDistributionMode === "puntos") {
                        const teamPoints = team.map(name => ({
                          name,
                          puntos: getMemberConfig(name).puntos
                        }));
                        const totalPoints = teamPoints.reduce((acc, p) => acc + p.puntos, 0);
                        
                        teamPoints.forEach(tp => {
                          const share = totalPoints > 0 ? Math.round(dayTips * (tp.puntos / totalPoints)) : 0;
                          if (!personEarnings[tp.name]) {
                            personEarnings[tp.name] = { days: [], amount: 0, totalPointsAssigned: tp.puntos };
                          }
                          personEarnings[tp.name].days.push(c.fecha);
                          personEarnings[tp.name].amount += share;
                        });
                      } else {
                        // Equitativo
                        const share = team.length > 0 ? Math.round(dayTips / team.length) : 0;
                        team.forEach(name => {
                          if (!personEarnings[name]) {
                            personEarnings[name] = { days: [], amount: 0, totalPointsAssigned: 1 };
                          }
                          personEarnings[name].days.push(c.fecha);
                          personEarnings[name].amount += share;
                        });
                      }
                    });

                    const resultsCount = Object.keys(personEarnings).length;

                    const results = Object.entries(personEarnings).map(([name, data]) => ({
                      name,
                      days: data.days,
                      amount: data.amount
                    })).sort((a, b) => b.amount - a.amount);

                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-zinc-100 p-3.5 border-2 border-brand-ink">
                          <div>
                            <span className="text-[10px] text-brand-ink/50 uppercase font-black tracking-wider block">Total Propinas Recaudadas</span>
                            <span className="text-lg font-black font-mono text-brand-ink">
                              {formatCOP(totalPeriodTips)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-brand-ink/50 uppercase font-black tracking-wider block">Personas Activas</span>
                            <span className="text-lg font-black font-mono text-brand-ink">{results.length}</span>
                          </div>
                        </div>

                        {/* Results Table */}
                        <div className="border-2 border-brand-ink overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-brand-bg border-b-2 border-brand-ink">
                                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-wider text-brand-ink w-1/3">Colaborador</th>
                                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-wider text-brand-ink text-center">Días Trabajados</th>
                                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-wider text-brand-ink text-right">Total a Pagar</th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="py-4 px-3 text-center text-xs font-bold text-zinc-400 italic">
                                    No se registraron colaboradores en los días seleccionados. Agregue personas en el Paso 3.
                                  </td>
                                </tr>
                              ) : (
                                results.map((r, idx) => (
                                  <tr key={idx} className="border-b border-brand-ink/10 hover:bg-zinc-50/50">
                                    <td className="py-2.5 px-3 font-sans font-bold text-brand-ink text-xs flex items-center">
                                      <span>{r.name}</span>
                                      {tipDistributionMode === "puntos" && (
                                        <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-300 ml-2 px-1 font-mono font-black uppercase rounded" title="Puntos del Rol">
                                          {getMemberConfig(r.name).puntos} Pts
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-zinc-600 font-semibold">
                                      {r.days.length} {r.days.length === 1 ? "día" : "días"}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-xs font-black text-brand-success">
                                      {formatCOP(r.amount)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => handleExportPropinasPDF(selectedCierres, results, totalPeriodTips)}
                            className="px-5 py-3 bg-brand-ink text-white hover:bg-black font-black uppercase tracking-wider flex items-center space-x-2 shadow-[4px_4px_0px_0px_#D4D4D8] border-2 border-brand-ink cursor-pointer hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
                          >
                            <FileDown className="w-4.5 h-4.5" />
                            <span>Generar PDF de Liquidación</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>

            </div>

          </div>
        )}

        {activeTab === "team" && (
          <EmployeeProfilesManager
            teamMembers={teamMembers}
            currentUsername={username}
            localName={local}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            onRefreshTeamMembers={loadTeamMembers}
          />
        )}

        {activeTab === "indicadores" && (
          <IndicadoresDashboard
            cierres={cierres}
            teamMembers={teamMembers}
            localName={local}
            metaVentas={metaVentas}
          />
        )}

        {activeTab === "inventory" && (
          <InventoryClosure
            username={username}
            userRole="Gerente"
            localName={local}
            isManagerView={true}
          />
        )}

        {activeTab === "checklist" && (
          <OperationalChecklist
            username={username}
            userRole="Gerente"
            localName={local}
            isManagerView={true}
          />
        )}

        {activeTab === "salarios" && (
          <SalariesManager teamMembers={teamMembers} />
        )}

        {activeTab === "security" && (
          <SecurityAndRoles
            teamMembers={teamMembers}
            currentUsername={username}
            localName={local}
            onUpdateMember={async (memberId, updates) => {
              const member = teamMembers.find(m => m.id === memberId);
              if (member) {
                const merged = { ...member, ...updates };
                await dbAdapter.saveTeamMember(merged, local);
                await loadTeamMembers();
              }
            }}
            onDeleteMember={async (memberName) => {
              await handleDeleteTeamMember(memberName);
            }}
            onAddMember={async (memberData) => {
              const calculatedPoints = getRolePoints(memberData.role);
              const isPasteleria = memberData.role.toLowerCase().includes("pasteler") || memberData.role.toLowerCase().includes("cocina");
              const saved = await dbAdapter.saveTeamMember({
                nombre: memberData.nombre,
                cedula: memberData.cedula,
                role: memberData.role as any,
                cargo: memberData.role as any,
                local: local,
                puntosPropinas: calculatedPoints,
                aptoPropinas: true,
                activo: memberData.activo
              }, local);

              if (saved?.id) {
                await dbAdapter.saveNominaConfig(saved.id, {
                  nombre: memberData.nombre,
                  cedula: memberData.cedula,
                  role: memberData.role,
                  area: isPasteleria ? "Pastelería" : "Ventas",
                  salarioBaseMensual: smmlvBase,
                  tipoContrato: "Indefinido",
                  auxilioTransporteAplica: true,
                  informacionParticular: "",
                  bonoFijoQuincenal: 0,
                  descuentoFijoQuincenal: 0,
                  puntajePropinas: calculatedPoints,
                  bonosConfigurados: [],
                  diaDescansoContractual: "Domingo",
                  horarioSemanal: [
                    { dia: "Lunes", horaEntrada: isPasteleria ? "07:00" : "12:00", horaSalida: isPasteleria ? "15:00" : "19:30", activo: true, horasCalculadas: 7 },
                    { dia: "Martes", horaEntrada: isPasteleria ? "07:00" : "12:00", horaSalida: isPasteleria ? "15:00" : "19:30", activo: true, horasCalculadas: 7 },
                    { dia: "Miércoles", horaEntrada: isPasteleria ? "07:00" : "12:00", horaSalida: isPasteleria ? "15:00" : "19:30", activo: true, horasCalculadas: 7 },
                    { dia: "Jueves", horaEntrada: isPasteleria ? "07:00" : "12:00", horaSalida: isPasteleria ? "15:00" : "19:30", activo: true, horasCalculadas: 7 },
                    { dia: "Viernes", horaEntrada: isPasteleria ? "07:00" : "12:00", horaSalida: isPasteleria ? "15:00" : "19:30", activo: true, horasCalculadas: 7 },
                    { dia: "Sábado", horaEntrada: isPasteleria ? "07:00" : "12:00", horaSalida: isPasteleria ? "15:00" : "19:30", activo: true, horasCalculadas: 7 },
                    { dia: "Domingo", horaEntrada: "00:00", horaSalida: "00:00", activo: false, horasCalculadas: 0 }
                  ]
                });
              }
              await loadTeamMembers();
              return saved;
            }}
            onReload={loadTeamMembers}
          />
        )}

      </main>
      </div>
    </div>
  );
}
