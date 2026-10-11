import React, { useState, useEffect, useRef } from "react";
import { divisorHorasMes, fechasDelPeriodo } from "../lib/payroll";
import { parseIsoDateLocal } from "../lib/dates";
import { asignarMarcaciones } from "../lib/marcaciones";
import { 
  DollarSign, 
  Sparkles, 
  FileText, 
  User, 
  ShieldAlert, 
  CheckCircle2, 
  HelpCircle, 
  RefreshCw, 
  Save, 
  Send, 
  Calculator, 
  Briefcase, 
  Clock, 
  AlertCircle,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  Bot,
  UploadCloud,
  FileCheck2,
  Download,
  Users,
  Search,
  Filter,
  History,
  Trash2,
  FileSpreadsheet,
  Lock,
  Unlock,
  Plus,
  Award,
  Sliders,
  Copy
} from "lucide-react";
import { 
  checkColombianHolidayOrSunday, 
  parseTimeToMinutes, 
  formatMinutesToTimeStr, 
  evaluateAttendanceDay,
  parsePosPdfFullText,
  parsePosPdfPages,
  parsePosExcelFile,
  generatePayrollTirillaJson
} from "../utils/colombianPayroll";
import { dbAdapter } from "../db/dbAdapter";
import { loadPdfjs, loadJsPDF } from "../lib/lazyLibs";

// Set up PDF worker

export const formatNumberWithDots = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "0";
  const num = Math.round(Number(val));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const parseNumberFromDots = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace(/[^\d]/g, "");
  return clean ? parseInt(clean, 10) : 0;
};

export const MoneyInput = ({
  value,
  onChange,
  placeholder = "0",
  className = "",
  disabled = false,
  prefix = "$"
}: {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  prefix?: string;
}) => {
  const [inputValue, setInputValue] = useState<string>(() => (value ? formatNumberWithDots(value) : ""));

  useEffect(() => {
    const num = parseNumberFromDots(inputValue);
    if (num !== value) {
      setInputValue(value ? formatNumberWithDots(value) : "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawText = e.target.value;
    const num = parseNumberFromDots(rawText);
    const formatted = num ? formatNumberWithDots(num) : "";
    setInputValue(formatted);
    onChange(num);
  };

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-2.5 text-zinc-400 font-bold text-xs pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={inputValue}
        placeholder={placeholder}
        onChange={handleChange}
        className={`${prefix ? "pl-6" : "px-2"} ${className}`}
      />
    </div>
  );
};

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

export interface EmployeeSalaryConfig {
  nombre: string;
  cedula?: string;
  role: string;
  area: "Pastelería" | "Ventas";
  salarioBaseMensual: number;
  tipoContrato: "Indefinido" | "Por días";
  auxilioTransporteAplica: boolean;
  informacionParticular: string; // Campo libre para bonos, descuentos, anotaciones
  // Campos extraídos/estructurados
  bonoFijoQuincenal?: number;
  descuentoFijoQuincenal?: number;

  // Ficha Técnica Ampliada
  puntajePropinas?: number;
  bonosConfigurados?: BonusConfig[];
  diaDescansoContractual?: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo";
  horarioSemanal?: DailySchedule[];
}

export interface AttendanceRecord {
  fecha: string; // YYYY-MM-DD
  diaSemana: string; // "Lunes", "Domingo", etc.
  isDomingoOFestivo: boolean;
  motivoFestivoODomingo?: string;
  horaIngresoProgramada?: string;
  horaSalidaProgramada?: string;
  horaIngreso: string; // "07:02 AM" o "11:55 AM"
  horaSalida: string; // "03:15 PM" o "07:35 PM"
  horasTrabajadasEfectivas: number;
  minutosAdicionales: number; // Salida después de cierre oficial
  minutosFaltantes: number; // Tardanzas + Salidas anticipadas
  llegadaAntesIgnoradaMinutos?: number; // Minutos que llegó antes de la hora pactada y no cuentan
  recargoNocturnoMinutos: number; // Minutos nocturnos
  esEntradaAnticipadaAutorizada?: boolean;
  observacion?: string;
}

export interface QuincenaNovedades {
  // Para Término Indefinido:
  diasLaboradosQuincena: number; // Por defecto 15 días quincenales (incluye día de descanso remunerado)
  diasAsistidosTransporte: number; // Días efectivamente laborados en el sitio (para Auxilio de Transporte)

  // Para Contrato Por Días:
  diasTiempoCompleto: number; // Turno 12:00 PM a 7:30 PM (7.0 hrs efectivas)
  diasMedioTiempo: number; // Turno 2:00 PM a 7:30 PM (5.5 hrs efectivas)

  // Novedades de Horas Extra y Recargos
  horasExtraDiurnas: number;
  horasExtraNocturnas: number;
  recargosDominicales: number; // Horas trabajadas en dominicales/festivos
  minutosRecargoNocturnoTotal: number; // Minutos acumulados entre 7pm y cierre
  
  // Bonos y Deducciones
  bonoNoSalarial: number;
  deduccionesAdicionales: number;
  
  // Asistencia procesada desde PDF
  attendanceRecords?: AttendanceRecord[];
}

export interface SavedSettlementRecord {
  id: string;
  fechaRegistro: string;
  periodoInicio: string;
  periodoFin: string;
  quincenaNombre: string; // "1ra Quincena Julio 2026"
  empleadoNombre: string;
  cargo: string;
  tipoContrato: "Indefinido" | "Por días";
  area: "Pastelería" | "Ventas";
  diasLaborados: number;
  diasAsistidos: number;
  devengadoTotal: number;
  deduccionesTotal: number;
  netoAPagar: number;
  desglose: any;
}

interface SalariesManagerProps {
  teamMembers: any[];
  currentUserRole?: string;
  isAdmin?: boolean;
}

export const getDefaultSchedule = (diaDescanso: string = "Domingo"): DailySchedule[] => {
  const dias: ("Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo")[] = [
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
  ];
  return dias.map(d => ({
    dia: d,
    activo: d !== diaDescanso,
    horaEntrada: "07:00",
    horaSalida: "15:00",
    minutosAlmuerzo: 60,
    horasCalculadas: d !== diaDescanso ? 7.0 : 0
  }));
};

export const calculateHoursFromTimes = (entrada: string, salida: string, minutosAlmuerzo: number = 60): number => {
  if (!entrada || !salida) return 0;
  const [hE, mE] = entrada.split(":").map(Number);
  const [hS, mS] = salida.split(":").map(Number);
  if (isNaN(hE) || isNaN(mE) || isNaN(hS) || isNaN(mS)) return 0;

  let mins = (hS * 60 + mS) - (hE * 60 + mE);
  if (mins < 0) mins += 24 * 60; // Noche
  
  // Descuento explícito del tiempo de almuerzo/descanso en minutos
  const minsEfectivos = Math.max(0, mins - (minutosAlmuerzo || 0));
  
  let hrs = minsEfectivos / 60;
  return Math.max(0, Math.round(hrs * 10) / 10);
};

export const calculateTotalWeeklyHours = (horario?: DailySchedule[]): number => {
  if (!horario || horario.length === 0) return 42;
  return horario.reduce((sum, d) => sum + (d.activo ? d.horasCalculadas : 0), 0);
};

export default function SalariesManager({ teamMembers, currentUserRole = "gerente", isAdmin = true }: SalariesManagerProps) {
  // Pestañas principales
  const [activeSubTab, setActiveSubTab] = useState<"config" | "liquidation" | "history">("liquidation");

  // Configuración de salarios sincronizada con Supabase
  const [salariesConfig, setSalariesConfig] = useState<Record<string, EmployeeSalaryConfig>>({});

  // Historial de liquidaciones guardadas en Supabase
  const [savedHistory, setSavedHistory] = useState<SavedSettlementRecord[]>([]);

  // Novedades temporales para simular/liquidar la quincena
  const [quincenaNovedades, setQuincenaNovedades] = useState<Record<string, QuincenaNovedades>>({});

  // Empleado seleccionado para ver detalles/liquidación
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);

  // Fechas del período a liquidar
  const [fechaInicio, setFechaInicio] = useState<string>("2026-07-01");
  const [fechaFin, setFechaFin] = useState<string>("2026-07-15");
  const [quincenaNombre, setQuincenaNombre] = useState<string>("1ra Quincena (01 al 15 de Julio de 2026)");

  // Estado para consulta con la IA Gemini
  const [aiAnalysisMap, setAiAnalysisMap] = useState<Record<string, string>>({});
  const [aiLoadingMap, setAiLoadingMap] = useState<Record<string, boolean>>({});

  // Mensaje de guardado exitoso
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Mostrar u ocultar tabla de normativa legal
  const [showLegalTable, setShowLegalTable] = useState(false);

  // PDF / Excel Parser State
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfUploadNote, setPdfUploadNote] = useState<string | null>(null);
  // Resultado de la asignación de marcaciones del último reporte cargado
  const [marcacionesFaltantes, setMarcacionesFaltantes] = useState<{ sinMarcaciones: string[]; noAsignados: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Alertas de Auditoría (Fase 1) y Modal Tirilla JSON (Fase 2)
  const [liquidationAlerts, setLiquidationAlerts] = useState<{
    colaborador: string;
    diasMarcacion: number;
    diasEsperados: number;
    fecha: string;
    diaSemana: string;
    pregunta: string;
  }[]>([]);
  const [selectedTirillaJson, setSelectedTirillaJson] = useState<any | null>(null);

  // Filtros de historial
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyFilterMember, setHistoryFilterMember] = useState("TODOS");

  // Salario Mínimo y Aux. Transporte (parametrizables vía Supabase)
  const [smmlvBase, setSmmlvBase] = useState<number>(1750905);
  const [auxTransporteBase, setAuxTransporteBase] = useState<number>(249095);

  // Carga inicial desde Supabase
  useEffect(() => {
    dbAdapter.getAllNominaConfigs().then((configs) => {
      if (configs && Object.keys(configs).length > 0) {
        setSalariesConfig(configs);
      }
    }).catch((e) => console.error("Error al cargar nóminas de Supabase:", e));

    dbAdapter.getConfiguracionNomina("Chapinero").then((cfg) => {
      if (cfg) {
        if (cfg.smmlv_base) setSmmlvBase(Number(cfg.smmlv_base));
        if (cfg.aux_transporte_base) setAuxTransporteBase(Number(cfg.aux_transporte_base));
      }
    }).catch((e) => console.error("Error al cargar configuración de nómina de Supabase:", e));

    dbAdapter.getTurnosNomina("Chapinero").then((turnos) => {
      if (turnos && turnos.length > 0) {
        const records: SavedSettlementRecord[] = turnos.map((t) => ({
          id: t.id,
          fechaRegistro: t.createdAt || new Date().toISOString(),
          periodoInicio: t.fechaInicio || "",
          periodoFin: t.fechaFin || "",
          quincenaNombre: t.quincenaNombre || "Liquidación",
          empleadoNombre: t.nombre || "",
          cargo: t.cargo || "",
          tipoContrato: (t.liquidacion?.tipoContrato as any) || "Indefinido",
          area: (t.liquidacion?.area as any) || "Ventas",
          diasLaborados: t.liquidacion?.diasLaboradosTotales || 0,
          diasAsistidos: t.liquidacion?.diasAsistidosEfectivos || 0,
          devengadoTotal: Number(t.liquidacion?.devengadoTotal || 0),
          deduccionesTotal: Number(t.liquidacion?.totalDeducciones || 0),
          netoAPagar: Number(t.liquidacion?.netoAPagar || 0),
          desglose: t.liquidacion || {}
        }));
        setSavedHistory(records);
      }
    }).catch((e) => console.error("Error al cargar historial de liquidaciones de Supabase:", e));
  }, []);

  // Guardar en Supabase SMMLV y Aux. Transporte
  const handleUpdateSmmlvGlobal = (newSmmlv: number, newAuxTransp: number) => {
    setSmmlvBase(newSmmlv);
    setAuxTransporteBase(newAuxTransp);
    dbAdapter.saveConfiguracionNomina("Chapinero", newSmmlv, newAuxTransp).catch(e => console.error("Error al guardar config nómina:", e));
  };

  // Obtener o inicializar la configuración de un colaborador
  const getEmployeeConfig = (member: any): EmployeeSalaryConfig => {
    const name = typeof member === "string" ? member : member.nombre;
    const roleStr = (typeof member === "object" && member.role) ? member.role : "Asistente de Servicio";
    const memberCedula = (typeof member === "object" && member.cedula) ? member.cedula : "";
    const defaultPoints = typeof member === "object" && member.puntosPropinas !== undefined ? member.puntosPropinas : 1.0;

    if (salariesConfig[name]) {
      const existing = salariesConfig[name];
      return {
        ...existing,
        cedula: existing.cedula || memberCedula || "",
        role: existing.role || roleStr,
        puntajePropinas: existing.puntajePropinas ?? defaultPoints,
        bonosConfigurados: existing.bonosConfigurados ?? [],
        diaDescansoContractual: existing.diaDescansoContractual ?? "Domingo",
        horarioSemanal: existing.horarioSemanal && existing.horarioSemanal.length === 7
          ? existing.horarioSemanal
          : getDefaultSchedule(existing.diaDescansoContractual || "Domingo")
      };
    }

    const isPasteleria = roleStr.toLowerCase().includes("pasteler") || roleStr.toLowerCase().includes("cocina");
    const defaultSalary = smmlvBase;
    const defaultDiaDescanso = "Domingo";

    return {
      nombre: name,
      cedula: memberCedula,
      role: roleStr,
      area: isPasteleria ? "Pastelería" : "Ventas",
      salarioBaseMensual: defaultSalary,
      tipoContrato: "Indefinido",
      auxilioTransporteAplica: defaultSalary <= (smmlvBase * 2),
      informacionParticular: "",
      bonoFijoQuincenal: 0,
      descuentoFijoQuincenal: 0,
      puntajePropinas: defaultPoints,
      bonosConfigurados: [],
      diaDescansoContractual: defaultDiaDescanso,
      horarioSemanal: getDefaultSchedule(defaultDiaDescanso)
    };
  };

  // Obtener novedades de la quincena
  const getNovedades = (name: string): QuincenaNovedades => {
    if (quincenaNovedades[name]) {
      return quincenaNovedades[name];
    }
    const config = getEmployeeConfig({ nombre: name });
    const isPorDias = config.tipoContrato === "Por días";

    return {
      diasLaboradosQuincena: isPorDias ? 4 : 15,
      diasAsistidosTransporte: isPorDias ? 4 : 13,
      diasTiempoCompleto: isPorDias ? 4 : 0,
      diasMedioTiempo: 0,
      horasExtraDiurnas: 0,
      horasExtraNocturnas: 0,
      recargosDominicales: 0,
      minutosRecargoNocturnoTotal: 0,
      bonoNoSalarial: config.bonoFijoQuincenal || 0,
      deduccionesAdicionales: config.descuentoFijoQuincenal || 0,
      attendanceRecords: []
    };
  };

  // Actualizar la configuración de un empleado
  const updateConfig = (name: string, field: keyof EmployeeSalaryConfig, value: any) => {
    setSalariesConfig(prev => {
      const current = prev[name] || getEmployeeConfig({ nombre: name });
      const updated = {
        ...current,
        [field]: value
      };
      
      // Si cambia salario base, recalcular auxilio de transporte
      if (field === "salarioBaseMensual") {
        updated.auxilioTransporteAplica = value <= (smmlvBase * 2);
      }

      const newConfig = {
        ...prev,
        [name]: updated
      };
      
      const member = teamMembers.find(m => m.nombre === name);
      if (member?.id) {
        dbAdapter.saveNominaConfig(member.id, updated).catch(e => console.error("Error guardando nómina config en Supabase:", e));
      }
      return newConfig;
    });
  };

  // Agregar un bono a un empleado
  const handleAddBonus = (employeeName: string) => {
    const current = salariesConfig[employeeName] || getEmployeeConfig({ nombre: employeeName });
    const currentBonuses = current.bonosConfigurados || [];
    const newBonus: BonusConfig = {
      id: "bono_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      concepto: "Bono Especial",
      monto: 50000,
      tipologia: "No Salarial"
    };
    updateConfig(employeeName, "bonosConfigurados", [...currentBonuses, newBonus]);
  };

  // Eliminar un bono
  const handleDeleteBonus = (employeeName: string, bonusId: string) => {
    const current = salariesConfig[employeeName] || getEmployeeConfig({ nombre: employeeName });
    const updatedBonuses = (current.bonosConfigurados || []).filter(b => b.id !== bonusId);
    updateConfig(employeeName, "bonosConfigurados", updatedBonuses);
  };

  // Actualizar un campo de un bono
  const handleUpdateBonus = (employeeName: string, bonusId: string, field: keyof BonusConfig, value: any) => {
    const current = salariesConfig[employeeName] || getEmployeeConfig({ nombre: employeeName });
    const updatedBonuses = (current.bonosConfigurados || []).map(b => {
      if (b.id === bonusId) {
        return { ...b, [field]: value };
      }
      return b;
    });
    updateConfig(employeeName, "bonosConfigurados", updatedBonuses);
  };

  // Actualizar un día del horario semanal
  const handleUpdateScheduleDay = (employeeName: string, diaIndex: number, field: keyof DailySchedule, value: any) => {
    const current = salariesConfig[employeeName] || getEmployeeConfig({ nombre: employeeName });
    const currentSchedule = [...(current.horarioSemanal || getDefaultSchedule(current.diaDescansoContractual))];
    
    const dayObj = { ...currentSchedule[diaIndex], [field]: value };
    if (field === "horaEntrada" || field === "horaSalida" || field === "minutosAlmuerzo") {
      dayObj.horasCalculadas = calculateHoursFromTimes(
        dayObj.horaEntrada, 
        dayObj.horaSalida, 
        dayObj.minutosAlmuerzo ?? 60
      );
    }
    
    currentSchedule[diaIndex] = dayObj;
    updateConfig(employeeName, "horarioSemanal", currentSchedule);
  };

  // Extraer reglas de la 'informacionParticular' con IA o Parser Inteligente
  const parseInformacionParticular = (name: string) => {
    const config = getEmployeeConfig({ nombre: name });
    const text = config.informacionParticular || "";
    
    let extractedBono = 0;
    let extractedDescuento = 0;

    // Buscar patrones de bonos (ej. "bono de $50000", "bono $50.000", "auxilio de 30000")
    const bonoMatch = text.match(/(?:bono|auxilio|extra|incentivo)\w*\s*(?:de)?\s*\$?([\d\.\,]+)/i);
    if (bonoMatch && bonoMatch[1]) {
      extractedBono = parseInt(bonoMatch[1].replace(/[\.\,]/g, ""), 10) || 0;
    }

    // Buscar patrones de descuentos (ej. "descuento de $20000", "deduccion $15.000", "uniforme $25000")
    const descMatch = text.match(/(?:descuento|deducci[oó]n|uniforme|prestamo|cobro)\w*\s*(?:de)?\s*\$?([\d\.\,]+)/i);
    if (descMatch && descMatch[1]) {
      extractedDescuento = parseInt(descMatch[1].replace(/[\.\,]/g, ""), 10) || 0;
    }

    // Actualizar configuración
    updateConfig(name, "bonoFijoQuincenal", extractedBono);
    updateConfig(name, "descuentoFijoQuincenal", extractedDescuento);

    // Actualizar también las novedades si existen
    setQuincenaNovedades(prev => {
      const current = getNovedades(name);
      return {
        ...prev,
        [name]: {
          ...current,
          bonoNoSalarial: extractedBono > 0 ? extractedBono : current.bonoNoSalarial,
          deduccionesAdicionales: extractedDescuento > 0 ? extractedDescuento : current.deduccionesAdicionales
        }
      };
    });

    alert(`🤖 Análisis Inteligente completado para ${name}:\n• Bono No Salarial identificado: $${extractedBono.toLocaleString("es-CO")} COP\n• Deducción/Ajuste identificado: $${extractedDescuento.toLocaleString("es-CO")} COP`);
  };

  // Actualizar Novedades
  const updateNovedades = (name: string, field: keyof QuincenaNovedades, value: any) => {
    setQuincenaNovedades(prev => {
      const current = getNovedades(name);
      return {
        ...prev,
        [name]: {
          ...current,
          [field]: value < 0 ? 0 : value
        }
      };
    });
  };

  // Guardar configuración general en Supabase
  const handleSaveAllConfig = async () => {
    try {
      for (const [name, cfg] of Object.entries(salariesConfig)) {
        const member = teamMembers.find(m => m.nombre === name);
        if (member?.id) {
          await dbAdapter.saveNominaConfig(member.id, cfg);
        }
      }
      await dbAdapter.saveConfiguracionNomina("Chapinero", smmlvBase, auxTransporteBase);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (e) {
      console.error("Error al guardar nómina general en Supabase:", e);
      alert("Hubo un error al guardar la configuración en Supabase.");
    }
  };

  // FORMATEADOR COP
  const formatCOP = (num: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num) + " COP";
  };

  // CÁLCULO MATEMÁTICO EN VIVO DE LA QUINCENA
  const calculateQuincena = (config: EmployeeSalaryConfig, novs: QuincenaNovedades) => {
    const salarioMensual = config.salarioBaseMensual || smmlvBase;
    // Hora ordinaria: divisor según la jornada legal vigente al cierre del período (Ley 2101: 42 h → 210)
    const valorHoraOrdinaria = salarioMensual / divisorHorasMes(fechaFin);
    const auxDiarioTransporte = auxTransporteBase / 30; // Aux. transporte mensual / 30 días

    let salarioQuincenal = 0;
    let auxTransporteTotal = 0;
    let deduccionSalud = 0;
    let deduccionPension = 0;

    let diasAsistidosEfectivos = 0;
    let diasLaboradosTotales = 0;

    // Bonos Salariales y No Salariales desde la Ficha Técnica y Novedades
    // Nota: El monto ingresado en la Ficha Técnica es el valor MENSUAL, por lo tanto en cada quincena se liquida el 50% (mitad en 1ª y mitad en 2ª quincena).
    const bonosList = config.bonosConfigurados || [];
    const bonosSalariales = bonosList
      .filter(b => b.tipologia === "Salarial")
      .reduce((sum, b) => sum + ((b.monto || 0) / 2), 0);

    const bonosNoSalariales = bonosList
      .filter(b => b.tipologia === "No Salarial")
      .reduce((sum, b) => sum + ((b.monto || 0) / 2), 0) + (novs.bonoNoSalarial || 0);

    // Recargos y Horas extra con factores Ley 2026:
    const valHED = (novs.horasExtraDiurnas || 0) * (valorHoraOrdinaria * 1.25);
    const valHEN = (novs.horasExtraNocturnas || 0) * (valorHoraOrdinaria * 1.75);
    
    // Recargo dominical / festivo (+90% sobre hora ordinaria)
    const valRecargosDominicales = (novs.recargosDominicales || 0) * (valorHoraOrdinaria * 0.90);
    
    // Recargo nocturno (7:00 PM a 7:30 PM en Ventas o extensión): +35% sobre minutos
    const horasRecargoNocturnoMinutos = (novs.minutosRecargoNocturnoTotal || 0) / 60;
    const valRecargoNocturnoMinutos = horasRecargoNocturnoMinutos * (valorHoraOrdinaria * 0.35);

    const valTotalRecargos = valRecargosDominicales + valRecargoNocturnoMinutos;

    if (config.tipoContrato === "Por días") {
      // Reglas para Contrato Por Días:
      const tcDays = novs.diasTiempoCompleto !== undefined ? novs.diasTiempoCompleto : 4;
      const mtDays = novs.diasMedioTiempo !== undefined ? novs.diasMedioTiempo : 0;
      diasAsistidosEfectivos = tcDays + mtDays;
      diasLaboradosTotales = diasAsistidosEfectivos;

      // Horas ordinarias efectivas:
      const totalHorasOrdinarias = (tcDays * 7.0) + (mtDays * 5.5);
      salarioQuincenal = totalHorasOrdinarias * valorHoraOrdinaria;

      // Auxilio de transporte únicamente por día laborado
      if (config.auxilioTransporteAplica) {
        auxTransporteTotal = diasAsistidosEfectivos * auxDiarioTransporte;
      }

      // EXONERACIÓN DE DEDUCCIONES: A personal por días NO se le hacen deducciones de Salud ni Pensión
      deduccionSalud = 0;
      deduccionPension = 0;
    } else {
      // Reglas para Contrato a Término Indefinido:
      const diasLaborados = novs.diasLaboradosQuincena !== undefined ? novs.diasLaboradosQuincena : 15;
      const diasAsistidos = novs.diasAsistidosTransporte !== undefined ? novs.diasAsistidosTransporte : (diasLaborados >= 2 ? diasLaborados - 2 : diasLaborados);

      diasLaboradosTotales = diasLaborados;
      diasAsistidosEfectivos = diasAsistidos;

      // Salario quincenal proporcional a días laborados (incluye día de descanso semanal remunerado)
      salarioQuincenal = (salarioMensual / 30) * diasLaborados;

      // Auxilio de transporte pagado ÚNICAMENTE por los días que ASISTIÓ físicamente a trabajar ($8.303,16 COP/día)
      if (config.auxilioTransporteAplica) {
        auxTransporteTotal = diasAsistidos * auxDiarioTransporte;
      }

      // Deducciones de Ley (4% Salud + 4% Pensión sobre IBC que incluye Salario Base Quincenal + Extra + Recargos + Bonos Salariales)
      const ibcQuincenal = salarioQuincenal + valHED + valHEN + valTotalRecargos + bonosSalariales;
      deduccionSalud = ibcQuincenal * 0.04;
      deduccionPension = ibcQuincenal * 0.04;
    }

    const totalIngresosSalariales = salarioQuincenal + valHED + valHEN + valTotalRecargos + bonosSalariales;
    const totalIngresosNoSalariales = bonosNoSalariales;
    const devengadoTotal = totalIngresosSalariales + auxTransporteTotal + totalIngresosNoSalariales;

    const totalDeduccionesLey = deduccionSalud + deduccionPension;
    const totalDeduccionesOtros = novs.deduccionesAdicionales || 0;
    const totalDeducciones = totalDeduccionesLey + totalDeduccionesOtros;

    const netoAPagar = devengadoTotal - totalDeducciones;

    return {
      salarioQuincenal,
      auxTransporte: auxTransporteTotal,
      valorHoraOrdinaria,
      auxDiarioTransporte,
      diasAsistidosEfectivos,
      diasLaboradosTotales,
      valHED,
      valHEN,
      valRecargosDominicales,
      valRecargoNocturnoMinutos,
      valTotalRecargos,
      totalIngresosSalariales,
      totalIngresosNoSalariales,
      devengadoTotal,
      deduccionSalud,
      deduccionPension,
      totalDeduccionesLey,
      totalDeduccionesOtros,
      totalDeducciones,
      netoAPagar
    };
  };

  // PARSER DE REPORTES DE ASISTENCIA (EXCEL .XLSX / .CSV / PDF)
  const handleProcessAttendanceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPdf(true);
    setPdfUploadNote("Cargando y procesando archivo de asistencia POS...");

    try {
      const fileName = file.name.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      let posParsedMap: Record<string, Record<string, any>> = {};

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
        setPdfUploadNote("Interpretando hoja de cálculo POS Excel (filas, columnas A, D, H, N, O y cédula)...");
        posParsedMap = await parsePosExcelFile(arrayBuffer, teamMembers);
      } else {
        setPdfUploadNote("Interpretando documento PDF POS...");
        const pdf = await (await loadPdfjs()).getDocument({ data: arrayBuffer }).promise;
        const pageTexts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const items = textContent.items.map((item: any) => ({
            str: item.str,
            x: item.transform ? item.transform[4] : 0,
            y: item.transform ? item.transform[5] : 0
          }));
          items.sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
          pageTexts.push(items.map(it => it.str).join(" "));
        }
        posParsedMap = parsePosPdfPages(pageTexts, teamMembers);
      }

      const asignacion = asignarMarcaciones(posParsedMap, teamMembers);
      setMarcacionesFaltantes(
        asignacion.sinMarcaciones.length > 0 || asignacion.noAsignados.length > 0
          ? { sinMarcaciones: asignacion.sinMarcaciones, noAsignados: asignacion.noAsignados }
          : null,
      );

      const newNovedades = { ...quincenaNovedades };
      const newAlerts: {
        colaborador: string;
        diasMarcacion: number;
        diasEsperados: number;
        fecha: string;
        diaSemana: string;
        pregunta: string;
      }[] = [];

      teamMembers.forEach(member => {
        const name = member.nombre;
        const config = getEmployeeConfig(member);
        const isPorDias = config.tipoContrato === "Por días";

        // Solo marcaciones identificadas con certeza (cédula o nombre + apellido).
        const memberLogs = asignacion.porEmpleado[name] || {};
        const records: AttendanceRecord[] = [];
        let totalMinutosAFavor = 0;
        let totalMinutosEnContra = 0;
        let totalMinutosRecargoNocturno = 0;
        let totalHorasDominicalesFestivas = 0;
        let diasAsistidosFisicos = 0;

        const schedule = config.horarioSemanal || getDefaultSchedule(config.diaDescansoContractual);

        // Recorre el período seleccionado (antes estaba fijo en 1–15 de julio de 2026).
        for (const fechaStr of fechasDelPeriodo(fechaInicio, fechaFin)) {
          const dateObj = parseIsoDateLocal(fechaStr);

          const dayNames: ("Domingo" | "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado")[] = [
            "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
          ];
          const diaSemanaName = dayNames[dateObj.getDay()];

          const schedDay = schedule.find(s => s.dia === diaSemanaName) || {
            dia: diaSemanaName,
            activo: !isPorDias ? (diaSemanaName !== config.diaDescansoContractual) : (diaSemanaName === "Viernes" || diaSemanaName === "Sábado" || diaSemanaName === "Domingo"),
            horaEntrada: config.area === "Pastelería" ? "07:00" : "12:00",
            horaSalida: config.area === "Pastelería" ? "15:00" : "19:30",
            minutosAlmuerzo: 60,
            horasCalculadas: 7.0
          };

          const isRestDayContractual = !schedDay.activo || diaSemanaName === config.diaDescansoContractual;
          const posLog = memberLogs[fechaStr];

          if (isPorDias && !posLog && !schedDay.activo && dateObj.getDay() !== 0) {
            continue;
          }

          if (!posLog && !schedDay.activo) {
            const holCheck = checkColombianHolidayOrSunday(fechaStr);
            records.push({
              fecha: fechaStr,
              diaSemana: diaSemanaName,
              isDomingoOFestivo: holCheck.isHolidayOrSunday,
              motivoFestivoODomingo: holCheck.reason,
              horaIngresoProgramada: schedDay.horaEntrada || "--:--",
              horaSalidaProgramada: schedDay.horaSalida || "--:--",
              horaIngreso: "--:--",
              horaSalida: "--:--",
              horasTrabajadasEfectivas: 0,
              minutosAdicionales: 0,
              minutosFaltantes: 0,
              llegadaAntesIgnoradaMinutos: 0,
              recargoNocturnoMinutos: 0,
              observacion: `Día de descanso contractual (${diaSemanaName}) - No laborado`
            });
            continue;
          }

          if (!posLog) {
            const holCheck = checkColombianHolidayOrSunday(fechaStr);
            records.push({
              fecha: fechaStr,
              diaSemana: diaSemanaName,
              isDomingoOFestivo: holCheck.isHolidayOrSunday,
              motivoFestivoODomingo: holCheck.reason,
              horaIngresoProgramada: schedDay.horaEntrada || "--:--",
              horaSalidaProgramada: schedDay.horaSalida || "--:--",
              horaIngreso: "--:--",
              horaSalida: "--:--",
              horasTrabajadasEfectivas: 0,
              minutosAdicionales: 0,
              minutosFaltantes: 0,
              llegadaAntesIgnoradaMinutos: 0,
              recargoNocturnoMinutos: 0,
              observacion: "Sin marcación en POS (Inasistencia por Confirmar)"
            });

            if (!isPorDias && !isRestDayContractual) {
              newAlerts.push({
                colaborador: name,
                diasMarcacion: Object.keys(memberLogs).length,
                diasEsperados: 13,
                fecha: fechaStr,
                diaSemana: diaSemanaName,
                pregunta: `¿El día ${fechaStr} (${diaSemanaName}) corresponde a una inasistencia injustificada (para descontar día de salario + aux. transporte) o fue un permiso remunerado / falla de la terminal POS?`
              });
            }
            continue;
          }

          diasAsistidosFisicos++;
          const actualEntry = posLog.timeEntry;
          const actualExit = posLog.timeExit;

          const evalRes = evaluateAttendanceDay(
            fechaStr,
            diaSemanaName,
            actualEntry,
            actualExit,
            schedDay.horaEntrada || "07:00",
            schedDay.horaSalida || "15:00",
            schedDay.minutosAlmuerzo ?? 60
          );

          if (evalRes.isDomingoOFestivo || isRestDayContractual) {
            totalHorasDominicalesFestivas += evalRes.horasTrabajadasEfectivas;
          }

          totalMinutosAFavor += evalRes.tiempoAdicionalSalidaMinutos;
          totalMinutosEnContra += (evalRes.tardanzaEntradaMinutos + evalRes.salidaTempranaMinutos);
          totalMinutosRecargoNocturno += evalRes.recargoNocturnoMinutos;

          records.push({
            fecha: fechaStr,
            diaSemana: diaSemanaName,
            isDomingoOFestivo: evalRes.isDomingoOFestivo,
            motivoFestivoODomingo: evalRes.motivoFestivoODomingo,
            horaIngresoProgramada: evalRes.horaIngresoProgramada,
            horaSalidaProgramada: evalRes.horaSalidaProgramada,
            horaIngreso: evalRes.horaIngresoMarcada,
            horaSalida: evalRes.horaSalidaMarcada,
            horasTrabajadasEfectivas: evalRes.horasTrabajadasEfectivas,
            minutosAdicionales: evalRes.tiempoAdicionalSalidaMinutos,
            minutosFaltantes: evalRes.tardanzaEntradaMinutos + evalRes.salidaTempranaMinutos,
            llegadaAntesIgnoradaMinutos: evalRes.llegadaAntesIgnoradaMinutos,
            recargoNocturnoMinutos: evalRes.recargoNocturnoMinutos,
            observacion: evalRes.observacion
          });
        }

        const minutosNetos = totalMinutosAFavor - totalMinutosEnContra;
        let horasExtraDiurnasNetas = 0;
        let deduccionTiempoFaltante = 0;

        const salarioMensual = config.salarioBaseMensual || smmlvBase;
        const valorHoraOrdinaria = salarioMensual / divisorHorasMes(fechaFin);

        if (minutosNetos > 0) {
          horasExtraDiurnasNetas = Math.round((minutosNetos / 60) * 10) / 10;
        } else if (minutosNetos < 0) {
          const minsFaltantesAbs = Math.abs(minutosNetos);
          deduccionTiempoFaltante = Math.round((minsFaltantesAbs / 60) * valorHoraOrdinaria);
        }

        let diasLaboradosCalculados = 15;
        if (isPorDias) {
          diasLaboradosCalculados = diasAsistidosFisicos;
        }

        newNovedades[name] = {
          diasLaboradosQuincena: diasLaboradosCalculados,
          diasAsistidosTransporte: diasAsistidosFisicos,
          diasTiempoCompleto: isPorDias ? diasAsistidosFisicos : 0,
          diasMedioTiempo: 0,
          horasExtraDiurnas: horasExtraDiurnasNetas,
          horasExtraNocturnas: 0,
          recargosDominicales: totalHorasDominicalesFestivas,
          minutosRecargoNocturnoTotal: totalMinutosRecargoNocturno,
          bonoNoSalarial: config.bonoFijoQuincenal || 0,
          deduccionesAdicionales: (config.descuentoFijoQuincenal || 0) + deduccionTiempoFaltante,
          attendanceRecords: records
        };
      });

      setQuincenaNovedades(newNovedades);
      setLiquidationAlerts(newAlerts);

      if (newAlerts.length > 0) {
        setPdfUploadNote(`⚠️ Se detectaron ${newAlerts.length} inasistencias que requieren confirmación de Gerencia (Fase 1 de Auditoría).`);
      } else {
        setPdfUploadNote("¡Reporte POS de Asistencia procesado con éxito! Se liquidó la quincena conforme a la Ficha Técnica y normas CST 2026.");
      }
      setTimeout(() => setPdfUploadNote(null), 10000);
    } catch (err: any) {
      console.error("Error al procesar archivo de asistencia:", err);
      setPdfUploadNote("⚠️ No se pudo procesar el archivo. Verifica que sea un reporte válido de Excel (.xlsx/.csv) o PDF.");
    } finally {
      setIsParsingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Manejar respuesta del usuario a Alertas de Confirmación (Fase 1)
  const handleConfirmAlertChoice = (alertObj: any, decision: "INJUSTIFICADA" | "PERMISO") => {
    const { colaborador, fecha } = alertObj;

    setQuincenaNovedades(prev => {
      const current = getNovedades(colaborador);
      // El día no pagado se refleja reduciendo diasLaboradosQuincena (salario proporcional).
      // Antes además se sumaba salario/30 a deducciones: se descontaba dos veces.
      // El auxilio de transporte ya excluye el día porque solo cuenta días con marcación.
      const updatedDeducciones = current.deduccionesAdicionales;

      const updatedDiasLaborados = decision === "INJUSTIFICADA"
        ? Math.max(1, (current.diasLaboradosQuincena || 15) - 1)
        : current.diasLaboradosQuincena;

      return {
        ...prev,
        [colaborador]: {
          ...current,
          diasLaboradosQuincena: updatedDiasLaborados,
          deduccionesAdicionales: updatedDeducciones
        }
      };
    });

    setLiquidationAlerts(prev => prev.filter(a => !(a.colaborador === colaborador && a.fecha === fecha)));
  };

  // EXPORTAR COMPROBANTE INDIVIDUAL EN PDF (SIN CAMPO DE FIRMA)
  const handleExportIndividualPdf = async (memberName: string) => {
    const member = teamMembers.find(m => m.nombre === memberName) || { nombre: memberName };
    const config = getEmployeeConfig(member);
    const novs = getNovedades(memberName);
    const calc = calculateQuincena(config, novs);

    const doc = new (await loadJsPDF())({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Colores corporativos
    const colorBg = [255, 255, 255];
    const colorHeader = [28, 25, 23]; // brand-ink
    const colorAccent = [30, 62, 48]; // Emerald dark

    // Encabezado
    doc.setFillColor(30, 62, 48);
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LÓPEZ & GRACIA - PANADERÍA Y PASTELERÍA", 14, 14);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("COMPROBANTE INDIVIDUAL DE LIQUIDACIÓN DE NÓMINA", 14, 21);

    doc.setFontSize(8);
    doc.text(`Periodo: ${quincenaNombre} (${fechaInicio} al ${fechaFin})`, 14, 27);

    // Información del Trabajador
    doc.setFillColor(245, 245, 244);
    doc.rect(14, 38, 182, 28, "F");
    doc.setDrawColor(28, 25, 23);
    doc.rect(14, 38, 182, 28, "S");

    doc.setTextColor(28, 25, 23);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Colaborador: ${config.nombre.toUpperCase()}`, 18, 45);
    doc.text(`Cargo / Rol: ${config.role}`, 18, 52);

    doc.text(`Tipo de Contrato: ${config.tipoContrato}`, 115, 45);
    doc.text(`Área de Trabajo: ${config.area}`, 115, 52);
    doc.text(`Días Asistidos / Laborados: ${calc.diasAsistidosEfectivos} / ${calc.diasLaboradosTotales} días`, 115, 59);

    // Tabla de Devengados y Deducciones
    let startY = 74;

    // Título Devengados
    doc.setFillColor(236, 253, 245);
    doc.rect(14, startY, 182, 7, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(6, 78, 59);
    doc.text("CONCEPTO / CONCEPTS", 18, startY + 5);
    doc.text("DEVENGADO (INGRESOS)", 110, startY + 5);
    doc.text("DEDUCCIÓN (DESCUENTOS)", 150, startY + 5);

    startY += 9;

    const addRow = (concepto: string, devengado: number, deduccion: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(28, 25, 23);
      doc.text(concepto, 18, startY);
      
      doc.text(devengado > 0 ? formatCOP(devengado) : "-", 110, startY);
      doc.text(deduccion > 0 ? formatCOP(deduccion) : "-", 150, startY);
      
      doc.setDrawColor(230, 230, 230);
      doc.line(14, startY + 2, 196, startY + 2);
      startY += 7;
    };

    // Filas
    if (config.tipoContrato === "Por días") {
      addRow(`Horas Ordinarias por Días (${calc.diasAsistidosEfectivos} turnos)`, calc.salarioQuincenal, 0);
    } else {
      addRow(`Salario Básico Quincenal (${calc.diasLaboradosTotales} días)`, calc.salarioQuincenal, 0);
    }

    if (calc.auxTransporte > 0) {
      addRow(`Auxilio de Transporte de Ley ($8.303/día x ${calc.diasAsistidosEfectivos} días)`, calc.auxTransporte, 0);
    }

    if (calc.valHED > 0) addRow(`Horas Extra Diurnas (${novs.horasExtraDiurnas} hrs)`, calc.valHED, 0);
    if (calc.valHEN > 0) addRow(`Horas Extra Nocturnas (${novs.horasExtraNocturnas} hrs)`, calc.valHEN, 0);
    if (calc.valRecargosDominicales > 0) addRow(`Recargo Dominical/Festivo (${novs.recargosDominicales} hrs)`, calc.valRecargosDominicales, 0);
    if (calc.valRecargoNocturnoMinutos > 0) addRow(`Recargo Nocturno Ordinario (7pm - 7:30pm)`, calc.valRecargoNocturnoMinutos, 0);
    if (calc.totalIngresosNoSalariales > 0) addRow(`Bonos No Salariales / Auxilios`, calc.totalIngresosNoSalariales, 0);

    // Deducciones
    if (config.tipoContrato === "Por días") {
      addRow(`Salud EPS (0% - Exonerado Contrato Por Días)`, 0, 0);
      addRow(`Pensión (0% - Exonerado Contrato Por Días)`, 0, 0);
    } else {
      addRow(`Aporte Salud EPS (4% IBC)`, 0, calc.deduccionSalud);
      addRow(`Aporte Pensión (4% IBC)`, 0, calc.deduccionPension);
    }

    if (calc.totalDeduccionesOtros > 0) {
      addRow(`Deducciones / Anticipos / Consumos`, 0, calc.totalDeduccionesOtros);
    }

    startY += 4;

    // Totales
    doc.setFillColor(28, 25, 23);
    doc.rect(14, startY, 182, 14, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTALES:", 18, startY + 6);
    doc.text(`Devengado: ${formatCOP(calc.devengadoTotal)}`, 70, startY + 6);
    doc.text(`Deducciones: ${formatCOP(calc.totalDeducciones)}`, 130, startY + 6);

    doc.setFontSize(11);
    doc.text(`NETO A PAGAR: ${formatCOP(calc.netoAPagar)}`, 18, startY + 11);

    startY += 20;

    // Resumen de Condiciones Especiales
    if (config.informacionParticular) {
      doc.setFillColor(254, 243, 199);
      doc.rect(14, startY, 182, 18, "F");
      doc.setDrawColor(217, 119, 6);
      doc.rect(14, startY, 182, 18, "S");

      doc.setTextColor(146, 64, 14);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("CONDICIONES ESPECIALES / ANOTACIONES DE CONTRATO:", 18, startY + 5);
      doc.setFont("helvetica", "normal");
      
      const splitNotes = doc.splitTextToSize(config.informacionParticular, 172);
      doc.text(splitNotes, 18, startY + 10);

      startY += 24;
    }

    // Pie de página oficial
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text("Documento generado automáticamente por la Consola de Nómina López & Gracia. Conforme al CST de Colombia.", 14, 280);

    // Guardar archivo
    const cleanName = config.nombre.replace(/\s+/g, "_");
    doc.save(`Comprobante_Pago_${cleanName}_${fechaInicio}_a_${fechaFin}.pdf`);
  };

  // EXPORTAR TODOS LOS COMPROBANTES EN LOTE (PDF)
  const handleExportAllPdfBatch = () => {
    teamMembers.forEach(m => {
      handleExportIndividualPdf(m.nombre);
    });
    alert(`📦 Se han generado los comprobantes individuales en PDF para todo el equipo (${teamMembers.length} personas).`);
  };

  // GUARDAR LIQUIDACIÓN EN EL HISTORIAL
  const handleSaveQuincenaToHistory = async () => {
    const newRecords: SavedSettlementRecord[] = teamMembers.map(m => {
      const config = getEmployeeConfig(m);
      const novs = getNovedades(m.nombre);
      const calc = calculateQuincena(config, novs);

      return {
        id: `liq-${m.nombre.replace(/\s+/g, "")}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fechaRegistro: new Date().toISOString(),
        periodoInicio: fechaInicio,
        periodoFin: fechaFin,
        quincenaNombre: quincenaNombre,
        empleadoNombre: config.nombre,
        cargo: config.role,
        tipoContrato: config.tipoContrato,
        area: config.area,
        diasLaborados: calc.diasLaboradosTotales,
        diasAsistidos: calc.diasAsistidosEfectivos,
        devengadoTotal: calc.devengadoTotal,
        deduccionesTotal: calc.totalDeducciones,
        netoAPagar: calc.netoAPagar,
        desglose: calc
      };
    });

    const updatedHistory = [...newRecords, ...savedHistory];
    setSavedHistory(updatedHistory);

    // Guardar en Supabase turnos_nomina (esperando cada resultado para informar fallas reales)
    const fallidos: string[] = [];
    for (const rec of newRecords) {
      const member = teamMembers.find(m => m.nombre === rec.empleadoNombre);
      if (!member?.id) {
        fallidos.push(`${rec.empleadoNombre} (sin ID de usuario)`);
        continue;
      }
      try {
        await dbAdapter.saveTurnoNomina({
          usuarioId: member.id,
          localNameOrId: "Chapinero",
          fechaInicio: rec.periodoInicio,
          fechaFin: rec.periodoFin,
          quincenaNombre: rec.quincenaNombre,
          liquidacion: {
            tipoContrato: rec.tipoContrato,
            area: rec.area,
            diasLaboradosTotales: rec.diasLaborados,
            diasAsistidosEfectivos: rec.diasAsistidos,
            devengadoTotal: rec.devengadoTotal,
            totalDeducciones: rec.deduccionesTotal,
            netoAPagar: rec.netoAPagar,
            ...rec.desglose,
            // Marcaciones del período: alimentan el indicador de puntualidad
            attendanceRecords: getNovedades(rec.empleadoNombre).attendanceRecords || []
          }
        });
      } catch (e: any) {
        console.error("Error al guardar turno de nómina:", e);
        fallidos.push(`${rec.empleadoNombre} (${e?.message || "error"})`);
      }
    }

    if (fallidos.length > 0) {
      alert(`⚠️ La liquidación "${quincenaNombre}" NO se guardó para ${fallidos.length} colaborador(es):\n- ${fallidos.join("\n- ")}`);
    } else {
      alert(`💾 Liquidación de la quincena "${quincenaNombre}" guardada para ${newRecords.length} colaboradores.`);
    }
  };

  // ELIMINAR REGISTRO DE HISTORIAL
  const handleDeleteHistoryRecord = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este registro del historial de pagos?")) {
      try {
        await dbAdapter.deleteTurnoNomina(id);
        setSavedHistory(prev => prev.filter(r => r.id !== id));
      } catch (e: any) {
        console.error("Error al eliminar turno nómina:", e);
        alert(`No se pudo eliminar el registro: ${e?.message || "error desconocido"}`);
      }
    }
  };

  // CONSULTAR CON LA IA GEMINI
  const handleConsultLaboralAI = async (memberName: string, customPromptText?: string) => {
    const member = teamMembers.find(m => m.nombre === memberName) || { nombre: memberName };
    const config = getEmployeeConfig(member);
    const novs = getNovedades(memberName);

    setAiLoadingMap(prev => ({ ...prev, [memberName]: true }));

    try {
      const response = await fetch("/api/gemini/laboral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: customPromptText || `Por favor analiza la liquidación de la quincena para ${memberName}. Revisa el tipo de contrato (${config.tipoContrato}), los recargos nocturnos, dominicales y si existe algún riesgo laboral según el CST en Colombia.`,
          employeeContext: {
            nombre: config.nombre,
            cargo: config.role,
            salarioBase: config.salarioBaseMensual,
            tipoContrato: config.tipoContrato,
            auxilioTransporte: config.auxilioTransporteAplica,
            quincenaPeriodo: quincenaNombre,
            informacionParticular: config.informacionParticular,
            novedadesIngresadas: novs
          }
        })
      });

      const data = await response.json();
      if (data.success && data.text) {
        setAiAnalysisMap(prev => ({ ...prev, [memberName]: data.text }));
      } else {
        setAiAnalysisMap(prev => ({ 
          ...prev, 
          [memberName]: data.error || "No se obtuvo respuesta de la IA. Intenta nuevamente." 
        }));
      }
    } catch (err: any) {
      console.error("Error consultando IA:", err);
      setAiAnalysisMap(prev => ({ 
        ...prev, 
        [memberName]: "Ocurrió un error de conexión con el servicio de IA." 
      }));
    } finally {
      setAiLoadingMap(prev => ({ ...prev, [memberName]: false }));
    }
  };

  // Seleccionar automáticamente el primer miembro
  useEffect(() => {
    if (!selectedMemberName && teamMembers.length > 0) {
      setSelectedMemberName(teamMembers[0].nombre);
    }
  }, [teamMembers]);

  // Historial filtrado
  const filteredHistory = savedHistory.filter(item => {
    const matchesSearch = item.empleadoNombre.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                          item.quincenaNombre.toLowerCase().includes(historySearchTerm.toLowerCase());
    const matchesMember = historyFilterMember === "TODOS" || item.empleadoNombre === historyFilterMember;
    return matchesSearch && matchesMember;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Encabezado Principal */}
      <div className="bg-[#1E3E30] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-black text-emerald-300 uppercase tracking-widest mb-2">
              <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
              <span>Módulo Integrado de Salarios & Liquidación POS</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Gestión de Nómina y Liquidación Automática
            </h1>
            <p className="text-xs md:text-sm text-emerald-100/80 font-medium max-w-2xl mt-1 leading-relaxed">
              Carga reportes de asistencia POS, liquida horas extra, recargos nocturnos/dominicales, gestiona condiciones especiales y exporta comprobantes individuales en PDF.
            </p>

            <div className="mt-2 inline-flex items-center space-x-2 bg-emerald-800/60 px-3 py-1.5 rounded-xl border border-emerald-700 text-[11px] font-bold text-emerald-100">
              <Users className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>Toda la gestión de equipo, salarios base, bonos y horarios semanales se administra centralizadamente en <strong>Gestión de Equipo</strong>.</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleSaveAllConfig}
              className="px-4 py-2.5 bg-[#FF5C35] hover:bg-[#E54B24] text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center space-x-2 shadow-lg shadow-[#FF5C35]/30 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>{saveSuccessMsg ? "¡Guardado!" : "Guardar Cambios"}</span>
            </button>

            <button
              onClick={handleExportAllPdfBatch}
              className="px-4 py-2.5 bg-white text-brand-ink hover:bg-zinc-100 font-black text-xs uppercase tracking-wider rounded-2xl flex items-center space-x-2 shadow-lg transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-800" />
              <span>Descargar PDFs Lote</span>
            </button>
          </div>
        </div>

        {/* Pestañas Secundarias */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-emerald-800/60">
          <button
            onClick={() => setActiveSubTab("liquidation")}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === "liquidation"
                ? "bg-white text-emerald-950 shadow-md"
                : "text-emerald-100/70 hover:bg-emerald-800/50"
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Liquidación de Quincena</span>
          </button>

          <button
            onClick={() => setActiveSubTab("history")}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubTab === "history"
                ? "bg-white text-emerald-950 shadow-md"
                : "text-emerald-100/70 hover:bg-emerald-800/50"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Pagos ({savedHistory.length})</span>
          </button>
        </div>
      </div>

      {/* Bar de Parámetros de Ley SMMLV 2026 */}
      <div className="bg-white border-2 border-brand-ink p-4 rounded-2xl shadow-[4px_4px_0px_0px_#1C1917] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-brand-ink/50 block">Período de Nómina Seleccionado</span>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <input
                type="text"
                value={quincenaNombre}
                onChange={(e) => setQuincenaNombre(e.target.value)}
                className="text-xs font-black text-brand-ink bg-zinc-50 border border-brand-ink/20 rounded-lg px-2.5 py-1 outline-none w-72"
              />
              <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-600">
                <span>Desde:</span>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="bg-zinc-50 border border-zinc-300 rounded px-2 py-0.5 text-xs outline-none"
                />
                <span>Hasta:</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="bg-zinc-50 border border-zinc-300 rounded px-2 py-0.5 text-xs outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowLegalTable(!showLegalTable)}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-black flex items-center space-x-1.5 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-emerald-700" />
            <span>{showLegalTable ? "Ocultar Parámetros de Ley" : "Parámetros SMMLV 2026"}</span>
          </button>
        </div>
      </div>

      {showLegalTable && (
        <div className="bg-emerald-50/70 border-2 border-emerald-400 p-4 rounded-2xl space-y-3">
          <h4 className="text-xs font-black uppercase text-emerald-950 tracking-wider">
            ⚖️ Parámetros de Ley Colombia (Valores Predeterminados Vigentes 2026)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-emerald-900">
            <div className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1">
              <span className="font-bold block text-[11px] text-emerald-700 uppercase">SMMLV 2026 Mensual</span>
              <MoneyInput
                value={smmlvBase}
                onChange={(val) => handleUpdateSmmlvGlobal(val, auxTransporteBase)}
                className="w-full bg-emerald-50/50 border border-emerald-300 p-1 font-mono font-black text-sm rounded outline-none"
              />
              <span className="text-[11px] text-emerald-700 font-bold block">
                $ {formatNumberWithDots(smmlvBase)} COP / mes
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1">
              <span className="font-bold block text-[11px] text-emerald-700 uppercase">Auxilio de Transporte Mensual</span>
              <MoneyInput
                value={auxTransporteBase}
                onChange={(val) => handleUpdateSmmlvGlobal(smmlvBase, val)}
                className="w-full bg-emerald-50/50 border border-emerald-300 p-1 font-mono font-black text-sm rounded outline-none"
              />
              <span className="text-[11px] text-emerald-700 font-bold block">
                $ {formatNumberWithDots(auxTransporteBase)} COP (${formatNumberWithDots(Math.round(auxTransporteBase / 30))}/día)
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1">
              <span className="font-bold block text-[11px] text-emerald-700 uppercase">Jornada Semanal</span>
              <span className="font-black text-sm block pt-1">{divisorHorasMes(fechaFin) / 5} Horas Semanales</span>
              <span className="text-[11px] text-emerald-700 font-bold block">(Divisor {divisorHorasMes(fechaFin)} hrs/mes)</span>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 1: LIQUIDACIÓN DE QUINCENA PERSONA POR PERSONA */}
      {activeSubTab === "liquidation" && (
        <div className="space-y-6">
          {/* Módulo de Carga del Reporte de Asistencia POS (Excel / PDF) */}
          <div className="bg-white border-2 border-brand-ink p-5 rounded-2xl shadow-[4px_4px_0px_0px_#1C1917] space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-brand-ink uppercase tracking-wider flex items-center gap-2">
                    <span>Cargar Reporte de Asistencia POS (Excel .xlsx / .csv)</span>
                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] px-2 py-0.5 rounded font-black">2026 Norma CST</span>
                  </h3>
                  <p className="text-xs text-zinc-600">
                    Sube la hoja de cálculo exportada por el sistema POS. Columnas automáticas: A (Cédula), D (Nombres), H (Apellidos), N (Entrada), O (Salida).
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleProcessAttendanceFile}
                  accept=".xlsx, .xls, .csv, .pdf"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingPdf}
                  className="px-4 py-2.5 bg-brand-ink hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center space-x-2 cursor-pointer shadow-md transition-all"
                >
                  {isParsingPdf ? <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> : <FileText className="w-4 h-4 text-emerald-400" />}
                  <span>{isParsingPdf ? "Analizando Excel POS..." : "Seleccionar Excel (.xlsx / .csv)"}</span>
                </button>

                <button
                  onClick={handleSaveQuincenaToHistory}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center space-x-2 cursor-pointer shadow-md transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar en Historial</span>
                </button>
              </div>
            </div>

            {pdfUploadNote && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{pdfUploadNote}</span>
              </div>
            )}

            {marcacionesFaltantes && (
              <div className="p-3 bg-amber-50 border border-amber-400 text-amber-950 text-xs rounded-xl space-y-1.5">
                <div className="flex items-center space-x-2 font-black">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Revisa las marcaciones antes de liquidar</span>
                </div>
                {marcacionesFaltantes.sinMarcaciones.length > 0 && (
                  <p>
                    <strong>Sin marcaciones encontradas ({marcacionesFaltantes.sinMarcaciones.length}):</strong>{" "}
                    {marcacionesFaltantes.sinMarcaciones.join(", ")}. Verifica que el reporte los incluya y que su
                    cédula o nombre y apellido coincidan con la ficha.
                  </p>
                )}
                {marcacionesFaltantes.noAsignados.length > 0 && (
                  <p>
                    <strong>En el reporte pero sin colaborador asociado:</strong>{" "}
                    {marcacionesFaltantes.noAsignados.join(", ")}.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* FASE 1: AUDITORÍA Y ALERTAS DE CONFIRMACIÓN */}
          {liquidationAlerts.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-400 p-5 rounded-2xl space-y-4 shadow-md">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 text-amber-900 rounded-xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-950 uppercase tracking-wider">
                    ⚠️ FASE 1: ALERTAS DE LIQUIDACIÓN REQUERIDAS DE CONFIRMACIÓN ({liquidationAlerts.length})
                  </h3>
                  <p className="text-xs text-amber-800">
                    El sistema detectó inasistencias sin marcación en el Excel POS. Confirma el tipo de ausencia para cada caso antes de emitir la tirilla final:
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {liquidationAlerts.map((alertItem, idx) => (
                  <div key={idx} className="bg-white border border-amber-300 p-4 rounded-xl space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2">
                      <span className="font-black text-amber-950">
                        * Colaborador: <span className="text-brand-ink underline">{alertItem.colaborador}</span>
                      </span>
                      <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px]">
                        * Días con marcación en Excel: {alertItem.diasMarcacion} de {alertItem.diasEsperados} esperados
                      </span>
                    </div>
                    <div className="text-amber-900 font-semibold">
                      * Novedad Detectada: No se registra marcación en el Excel el día <span className="font-bold text-red-700">{alertItem.fecha} ({alertItem.diaSemana})</span>.
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-950 italic">
                      <strong>* Pregunta para el Usuario:</strong> "{alertItem.pregunta}"
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => handleConfirmAlertChoice(alertItem, "INJUSTIFICADA")}
                        className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                      >
                        Descontar Día Injustificado ($Salario/30$ + Aux. Transporte)
                      </button>
                      <button
                        onClick={() => handleConfirmAlertChoice(alertItem, "PERMISO")}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                      >
                        Permiso Remunerado / Falla POS (Liquidación Completa 15 Días)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navegador Persona por Persona */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Lista Lateral de Integrantes */}
            <div className="lg:col-span-1 bg-white border-2 border-brand-ink rounded-2xl shadow-[4px_4px_0px_0px_#1C1917] p-4 space-y-3">
              <span className="text-[11px] font-black uppercase text-brand-ink/50 block tracking-wider">
                Selecciona Colaborador para Revisar
              </span>

              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {teamMembers.map(member => {
                  const config = getEmployeeConfig(member);
                  const novs = getNovedades(member.nombre);
                  const calc = calculateQuincena(config, novs);
                  const isSelected = selectedMemberName === member.nombre;

                  return (
                    <button
                      key={member.nombre}
                      onClick={() => setSelectedMemberName(member.nombre)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-brand-ink text-white border-brand-ink shadow-sm"
                          : "bg-zinc-50 hover:bg-zinc-100 text-brand-ink border-zinc-200"
                      }`}
                    >
                      <div>
                        <span className="font-black text-xs block leading-tight">{member.nombre}</span>
                        <div className="flex items-center space-x-1.5 mt-1 text-[11px]">
                          <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                            isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {config.area}
                          </span>
                          <span className={`font-semibold ${isSelected ? "text-emerald-200" : "text-zinc-500"}`}>
                            {config.tipoContrato}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono font-black text-xs block ${
                          isSelected ? "text-emerald-300" : "text-brand-ink"
                        }`}>
                          {formatCOP(calc.netoAPagar)}
                        </span>
                        <ChevronRight className={`w-4 h-4 inline-block mt-0.5 ${isSelected ? "text-white" : "text-zinc-400"}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel de Detalle Individual de Liquidación */}
            <div className="lg:col-span-3 space-y-6">
              {selectedMemberName ? (() => {
                const member = teamMembers.find(m => m.nombre === selectedMemberName) || { nombre: selectedMemberName };
                const config = getEmployeeConfig(member);
                const novs = getNovedades(selectedMemberName);
                const calc = calculateQuincena(config, novs);

                return (
                  <div className="bg-white border-2 border-brand-ink rounded-2xl shadow-[4px_4px_0px_0px_#1C1917] p-6 space-y-6">
                    {/* Encabezado del Colaborador */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-brand-ink/10 pb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-xl font-black text-brand-ink">{config.nombre}</h2>
                          {(config.cedula || member.cedula) && (
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-800 border border-zinc-300 font-mono text-[11px] font-bold rounded">
                              C.C. {config.cedula || member.cedula}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-black uppercase rounded">
                            {config.area}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-semibold mt-0.5">
                          {config.role} • Contrato {config.tipoContrato} • Base: {formatCOP(config.salarioBaseMensual)}/mes
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            const jsonObj = generatePayrollTirillaJson(member, config, novs, calc, novs.attendanceRecords);
                            setSelectedTirillaJson(jsonObj);
                          }}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-sm transition-all"
                        >
                          <FileText className="w-4 h-4 text-amber-300" />
                          <span>Ver Tirilla JSON (POS)</span>
                        </button>

                        <button
                          onClick={() => handleExportIndividualPdf(selectedMemberName)}
                          className="px-3.5 py-2 bg-brand-ink hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-sm"
                        >
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span>Exportar PDF Individual</span>
                        </button>

                        <button
                          onClick={() => handleConsultLaboralAI(selectedMemberName)}
                          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-sm"
                        >
                          <Bot className="w-4 h-4 text-emerald-300" />
                          <span>Consultar IA Laboral</span>
                        </button>
                      </div>
                    </div>

                    {/* Desglose Numérico de la Liquidación */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Devengados */}
                      <div className="bg-emerald-50/60 border border-emerald-300 p-4 rounded-xl space-y-2">
                        <span className="text-[11px] font-black uppercase text-emerald-900 tracking-wider block border-b border-emerald-200 pb-1">
                          🟢 Devengados (Ingresos)
                        </span>

                        <div className="space-y-1.5 text-xs text-emerald-950 font-bold">
                          <div className="flex justify-between">
                            <span className="text-zinc-600 font-normal">Salario Base Periodo:</span>
                            <span>{formatCOP(calc.salarioQuincenal)}</span>
                          </div>

                          {calc.auxTransporte > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 font-normal">Aux. Transporte:</span>
                              <span>{formatCOP(calc.auxTransporte)}</span>
                            </div>
                          )}

                          {calc.valHED > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 font-normal">Horas Extra Diurnas:</span>
                              <span>{formatCOP(calc.valHED)}</span>
                            </div>
                          )}

                          {calc.valRecargosDominicales > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 font-normal">Recargo Dominical/Festivo:</span>
                              <span>{formatCOP(calc.valRecargosDominicales)}</span>
                            </div>
                          )}

                          {calc.valRecargoNocturnoMinutos > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 font-normal">Recargo Nocturno (7pm+):</span>
                              <span>{formatCOP(calc.valRecargoNocturnoMinutos)}</span>
                            </div>
                          )}

                          {calc.totalIngresosNoSalariales > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 font-normal">Bono No Salarial:</span>
                              <span>{formatCOP(calc.totalIngresosNoSalariales)}</span>
                            </div>
                          )}

                          <div className="flex justify-between text-sm font-black text-emerald-950 pt-2 border-t border-emerald-300">
                            <span>Total Devengado:</span>
                            <span>{formatCOP(calc.devengadoTotal)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Deducciones */}
                      <div className="bg-red-50/60 border border-red-200 p-4 rounded-xl space-y-2">
                        <span className="text-[11px] font-black uppercase text-red-900 tracking-wider block border-b border-red-200 pb-1">
                          🔴 Deducciones (Descuentos)
                        </span>

                        <div className="space-y-1.5 text-xs text-red-950 font-bold">
                          <div className="flex justify-between">
                            <span className="text-zinc-600 font-normal">Aporte Salud EPS (4%):</span>
                            <span>{formatCOP(calc.deduccionSalud)}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-zinc-600 font-normal">Aporte Pensión (4%):</span>
                            <span>{formatCOP(calc.deduccionPension)}</span>
                          </div>

                          {calc.totalDeduccionesOtros > 0 && (
                            <div className="flex justify-between">
                              <span className="text-zinc-600 font-normal">Ajustes / Consumos:</span>
                              <span>{formatCOP(calc.totalDeduccionesOtros)}</span>
                            </div>
                          )}

                          <div className="flex justify-between text-sm font-black text-red-950 pt-2 border-t border-red-200">
                            <span>Total Deducciones:</span>
                            <span>{formatCOP(calc.totalDeducciones)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Neto a Pagar */}
                      <div className="bg-brand-ink text-white p-4 rounded-xl space-y-3 flex flex-col justify-between shadow-md">
                        <div>
                          <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider block mb-1">
                            💰 Neto a Pagar (Quincena)
                          </span>
                          <span className="text-2xl font-black font-mono block text-white mt-1">
                            {formatCOP(calc.netoAPagar)}
                          </span>
                          <span className="text-[11px] text-zinc-300 font-medium block mt-1">
                            Días efectivamente asistidos: {calc.diasAsistidosEfectivos} de {calc.diasLaboradosTotales} días.
                          </span>
                        </div>

                        <div className="pt-2 border-t border-white/10 text-[11px] text-zinc-400 space-y-0.5">
                          <div>Valor hora ordinaria: ${Math.round(calc.valorHoraOrdinaria).toLocaleString("es-CO")} COP</div>
                          <div>Aux. transp. diario: ${Math.round(calc.auxDiarioTransporte).toLocaleString("es-CO")} COP</div>
                        </div>
                      </div>
                    </div>

                    {/* Editor Rápido de Novedades de la Quincena */}
                    <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-3">
                      <span className="text-xs font-black uppercase text-brand-ink tracking-wider block">
                        ⚙️ Ajustar Novedades de la Quincena para {selectedMemberName}
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        {config.tipoContrato === "Por días" ? (
                          <>
                            <div>
                              <label className="text-[11px] font-bold text-zinc-600 block mb-0.5">Días Tiempo Completo (7h)</label>
                              <input
                                type="number"
                                value={novs.diasTiempoCompleto}
                                onChange={(e) => updateNovedades(selectedMemberName, "diasTiempoCompleto", Number(e.target.value))}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold rounded outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-zinc-600 block mb-0.5">Días Medio Tiempo (5.5h)</label>
                              <input
                                type="number"
                                value={novs.diasMedioTiempo}
                                onChange={(e) => updateNovedades(selectedMemberName, "diasMedioTiempo", Number(e.target.value))}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold rounded outline-none"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="text-[11px] font-bold text-zinc-600 block mb-0.5">Días Laborados Quincena</label>
                              <input
                                type="number"
                                value={novs.diasLaboradosQuincena}
                                onChange={(e) => updateNovedades(selectedMemberName, "diasLaboradosQuincena", Number(e.target.value))}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold rounded outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-zinc-600 block mb-0.5">Días Asistidos Transporte</label>
                              <input
                                type="number"
                                value={novs.diasAsistidosTransporte}
                                onChange={(e) => updateNovedades(selectedMemberName, "diasAsistidosTransporte", Number(e.target.value))}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold rounded outline-none"
                              />
                            </div>
                          </>
                        )}

                        <div>
                          <label className="text-[11px] font-bold text-zinc-600 block mb-0.5">Horas Extra Diurnas</label>
                          <input
                            type="number"
                            value={novs.horasExtraDiurnas}
                            onChange={(e) => updateNovedades(selectedMemberName, "horasExtraDiurnas", Number(e.target.value))}
                            className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold rounded outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-zinc-600 block mb-0.5">Horas Dominicales</label>
                          <input
                            type="number"
                            value={novs.recargosDominicales}
                            onChange={(e) => updateNovedades(selectedMemberName, "recargosDominicales", Number(e.target.value))}
                            className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold rounded outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-zinc-600 block mb-0.5">Bono Adicional Quincenal (COP)</label>
                          <MoneyInput
                            value={novs.bonoNoSalarial || 0}
                            onChange={(val) => updateNovedades(selectedMemberName, "bonoNoSalarial", val)}
                            className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold text-xs rounded outline-none"
                          />
                          <span className="text-[11px] text-zinc-500 font-bold block mt-0.5">
                            $ {formatNumberWithDots(novs.bonoNoSalarial || 0)} COP
                          </span>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-zinc-600 block mb-0.5">Deducción / Descuento (COP)</label>
                          <MoneyInput
                            value={novs.deduccionesAdicionales || 0}
                            onChange={(val) => updateNovedades(selectedMemberName, "deduccionesAdicionales", val)}
                            className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold text-xs rounded outline-none"
                          />
                          <span className="text-[11px] text-zinc-500 font-bold block mt-0.5">
                            $ {formatNumberWithDots(novs.deduccionesAdicionales || 0)} COP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* TABLA DE REGISTROS DE ASISTENCIA Y RELOJ (DETALLE POS) */}
                    {novs.attendanceRecords && novs.attendanceRecords.length > 0 && (
                      <div className="bg-white border-2 border-brand-ink/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-emerald-700" />
                            <h4 className="text-xs font-black uppercase text-brand-ink tracking-wider">
                              Detalle de Marcas de Reloj y Asistencia POS (Quincena)
                            </h4>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            {novs.attendanceRecords.length} Días Evaluados
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-zinc-100 text-zinc-700 font-black uppercase text-[11px] border-b border-zinc-200">
                              <tr>
                                <th className="p-2">Fecha / Día</th>
                                <th className="p-2">Horario Pactado</th>
                                <th className="p-2">Marca Entrada</th>
                                <th className="p-2">Marca Salida</th>
                                <th className="p-2 text-center">Horas Ef.</th>
                                <th className="p-2 text-center">Min. A Favor / En Contra</th>
                                <th className="p-2">Novedad / Observación</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 font-medium">
                              {novs.attendanceRecords.map((rec, idx) => (
                                <tr key={idx} className={rec.isDomingoOFestivo ? "bg-amber-50/60 font-semibold" : "hover:bg-zinc-50"}>
                                  <td className="p-2 whitespace-nowrap">
                                    <div className="font-bold text-zinc-900">{rec.fecha}</div>
                                    <div className="text-[11px] text-zinc-500">{rec.diaSemana}</div>
                                    {rec.isDomingoOFestivo && (
                                      <span className="text-[11px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-black uppercase inline-block mt-0.5">
                                        +90% Dominical/Festivo
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-zinc-600 font-mono whitespace-nowrap">
                                    {rec.horaIngresoProgramada || "--"} - {rec.horaSalidaProgramada || "--"}
                                  </td>
                                  <td className="p-2 font-mono text-zinc-900 whitespace-nowrap">
                                    {rec.horaIngreso}
                                    {rec.llegadaAntesIgnoradaMinutos ? (
                                      <span className="text-[11px] text-zinc-500 block">
                                        ({rec.llegadaAntesIgnoradaMinutos} min antes - no suma)
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="p-2 font-mono text-zinc-900 whitespace-nowrap">
                                    {rec.horaSalida}
                                  </td>
                                  <td className="p-2 text-center font-black font-mono text-emerald-950">
                                    {rec.horasTrabajadasEfectivas} hrs
                                  </td>
                                  <td className="p-2 text-center font-mono">
                                    {rec.minutosAdicionales > 0 && (
                                      <span className="text-emerald-700 font-bold block">+{rec.minutosAdicionales}m a favor</span>
                                    )}
                                    {rec.minutosFaltantes > 0 && (
                                      <span className="text-red-600 font-bold block">-{rec.minutosFaltantes}m en contra</span>
                                    )}
                                    {rec.minutosAdicionales === 0 && rec.minutosFaltantes === 0 && (
                                      <span className="text-zinc-400">0 min</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-zinc-600 text-[11px]">
                                    {rec.observacion}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Respuesta IA Gemini si existe */}
                    {aiLoadingMap[selectedMemberName] && (
                      <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center space-x-3 text-emerald-900 text-xs font-bold">
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-700" />
                        <span>Consultando al Experto Laboralista IA sobre el contrato de {selectedMemberName}...</span>
                      </div>
                    )}

                    {aiAnalysisMap[selectedMemberName] && (
                      <div className="bg-emerald-950 text-emerald-50 p-5 rounded-2xl space-y-2 border border-emerald-800 shadow-inner">
                        <div className="flex items-center space-x-2 text-emerald-400">
                          <Bot className="w-5 h-5" />
                          <h4 className="text-xs font-black uppercase tracking-wider">
                            Dictamen del Experto Laboralista IA (Gemini)
                          </h4>
                        </div>
                        <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap text-emerald-100/90">
                          {aiAnalysisMap[selectedMemberName]}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="bg-white border-2 border-brand-ink border-dashed p-12 text-center rounded-2xl">
                  <User className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
                  <p className="text-xs font-bold text-zinc-500">
                    Selecciona un colaborador de la lista lateral para revisar su desglose de liquidación.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: CONFIGURACIÓN DESACTIVADA - GESTIONADA EN GESTION EQUIPO */}
      {false && (
        <div className="bg-white border-2 border-brand-ink rounded-2xl shadow-[4px_4px_0px_0px_#1C1917] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-200 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black uppercase text-brand-ink tracking-wider">
                  Ficha Técnica y Gestión de Equipo
                </h3>
                {isAdmin ? (
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase rounded-full flex items-center space-x-1">
                    <Unlock className="w-3 h-3" />
                    <span>Modo Edición Admin</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-black uppercase rounded-full flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Solo Administrador (Solo Lectura)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Administra salarios, tipo de contrato, asignación de rol, bonos salariales/no salariales y horarios semanales (42 hrs).
              </p>
            </div>

            <button
              onClick={handleSaveAllConfig}
              className="px-4 py-2 bg-brand-ink text-white hover:bg-black text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Configuración</span>
            </button>
          </div>

          <div className="space-y-8">
            {teamMembers.map(member => {
              const config = getEmployeeConfig(member);
              const weeklyHours = calculateTotalWeeklyHours(config.horarioSemanal);
              const bonosList = config.bonosConfigurados || [];

              return (
                <div
                  key={member.nombre}
                  className="bg-zinc-50 border-2 border-brand-ink/20 hover:border-brand-ink p-6 rounded-2xl space-y-6 transition-all"
                >
                  {/* Encabezado Ficha Empleado */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-ink text-white flex items-center justify-center font-black text-sm">
                        {member.nombre.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-base text-brand-ink flex items-center space-x-2">
                          <span>{member.nombre}</span>
                          {(config.cedula || member.cedula) && (
                            <span className="text-xs font-mono font-bold bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded">
                              C.C. {config.cedula || member.cedula}
                            </span>
                          )}
                          {!isAdmin && (
                            <Lock className="w-3.5 h-3.5 text-amber-600 inline" title="Campos de salario restringidos a Administrador" />
                          )}
                        </h4>
                        <p className="text-xs text-zinc-500 font-bold">{config.role} • {config.area}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-white border border-zinc-300 text-brand-ink text-xs font-black rounded-lg">
                        Contrato: {config.tipoContrato}
                      </span>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-900 text-xs font-black rounded-lg">
                        Salario: {formatCOP(config.salarioBaseMensual)}
                      </span>
                    </div>
                  </div>

                  {/* BLOQUE 1: REQUERIMIENTO 1 & 2 - PARAMETROS TECNICOS & RBAC */}
                  <div className="bg-white border border-zinc-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center space-x-2 text-zinc-700 font-black text-xs uppercase tracking-wider">
                      <Sliders className="w-4 h-4 text-brand-ink" />
                      <span>1. Ficha Técnica y Parámetros Laborales (RBAC)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <div>
                        <label className="text-[11px] font-black uppercase text-zinc-600 block mb-1">
                          Número de Cédula (C.C.)
                        </label>
                        <input
                          type="text"
                          disabled={!isAdmin}
                          value={config.cedula || ""}
                          placeholder="Ej. 1020730746"
                          onChange={(e) => updateConfig(member.nombre, "cedula", e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-300 p-2 font-mono font-bold rounded-lg outline-none focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-black uppercase text-zinc-600 block mb-1">
                          Salario Base Mensual (COP)
                        </label>
                        <div className="flex space-x-1.5">
                          <input
                            type="number"
                            disabled={!isAdmin}
                            value={config.salarioBaseMensual}
                            onChange={(e) => updateConfig(member.nombre, "salarioBaseMensual", Number(e.target.value))}
                            className="w-full bg-zinc-50 border border-zinc-300 p-2 font-mono font-bold rounded-lg outline-none focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                          {isAdmin && (
                            <button
                              onClick={() => updateConfig(member.nombre, "salarioBaseMensual", smmlvBase)}
                              title="Asignar Salario Mínimo Legal Vigente"
                              className="px-2 bg-zinc-200 hover:bg-zinc-300 text-brand-ink text-[11px] font-black uppercase rounded-lg shrink-0 cursor-pointer"
                            >
                              SMMLV
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-black uppercase text-zinc-600 block mb-1">
                          Tipo de Contrato
                        </label>
                        <select
                          disabled={!isAdmin}
                          value={config.tipoContrato}
                          onChange={(e: any) => updateConfig(member.nombre, "tipoContrato", e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <option value="Indefinido">Término Indefinido</option>
                          <option value="Por días">Por días (Ocasional)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-black uppercase text-zinc-600 block mb-1">
                          Asignación de Rol
                        </label>
                        <select
                          disabled={!isAdmin}
                          value={config.role}
                          onChange={(e: any) => updateConfig(member.nombre, "role", e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <option value="Líder operador">Líder operador</option>
                          <option value="Asistente de Servicio">Asistente de Servicio</option>
                          <option value="Líder de pastelería">Líder de pastelería</option>
                          <option value="Auxiliar de pastelería">Auxiliar de pastelería</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-black uppercase text-zinc-600 block mb-1">
                          Puntaje de Propinas
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          disabled={!isAdmin}
                          value={config.puntajePropinas ?? 1.0}
                          onChange={(e) => updateConfig(member.nombre, "puntajePropinas", Number(e.target.value))}
                          className="w-full bg-zinc-50 border border-zinc-300 p-2 font-mono font-bold rounded-lg outline-none focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BLOQUE 2: MAPEO DE BONOS (SALARIAL vs NO SALARIAL) */}
                  <div className="bg-white border border-zinc-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-zinc-700 font-black text-xs uppercase tracking-wider">
                        <Award className="w-4 h-4 text-emerald-700" />
                        <span>2. Mapeo de Bonos (Salariales vs No Salariales)</span>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => handleAddBonus(member.nombre)}
                          className="px-3 py-1 bg-emerald-700 text-white hover:bg-emerald-800 text-[11px] font-black uppercase rounded-lg flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar Bono</span>
                        </button>
                      )}
                    </div>

                    {bonosList.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">No hay bonos configurados para este colaborador. Haz clic en 'Agregar Bono' para añadir uno.</p>
                    ) : (
                      <div className="space-y-2">
                        {bonosList.map((bono) => (
                          <div key={bono.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-xs">
                            <div className="sm:col-span-5">
                              <label className="text-[11px] font-bold text-zinc-500 uppercase block">Concepto / Nombre del Bono</label>
                              <input
                                type="text"
                                disabled={!isAdmin}
                                value={bono.concepto}
                                onChange={(e) => handleUpdateBonus(member.nombre, bono.id, "concepto", e.target.value)}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-semibold rounded outline-none"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <label className="text-[11px] font-bold text-zinc-500 uppercase block">Monto (COP)</label>
                              <input
                                type="number"
                                disabled={!isAdmin}
                                value={bono.monto}
                                onChange={(e) => handleUpdateBonus(member.nombre, bono.id, "monto", Number(e.target.value))}
                                className="w-full bg-white border border-zinc-300 p-1.5 font-mono font-bold rounded outline-none"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <label className="text-[11px] font-bold text-zinc-500 uppercase block">Tipología de Ley</label>
                              <select
                                disabled={!isAdmin}
                                value={bono.tipologia}
                                onChange={(e: any) => handleUpdateBonus(member.nombre, bono.id, "tipologia", e.target.value)}
                                className={`w-full p-1.5 font-bold rounded outline-none cursor-pointer text-xs ${
                                  bono.tipologia === "Salarial"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : "bg-blue-100 text-blue-900 border border-blue-300"
                                }`}
                              >
                                <option value="Salarial">Salarial (Constituye IBC)</option>
                                <option value="No Salarial">No Salarial (Exento Aportes)</option>
                              </select>
                            </div>

                            {isAdmin && (
                              <div className="sm:col-span-1 flex justify-end">
                                <button
                                  onClick={() => handleDeleteBonus(member.nombre, bono.id)}
                                  className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded cursor-pointer"
                                  title="Eliminar Bono"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-[11px] text-emerald-900 space-y-1">
                      <p className="font-bold flex items-center space-x-1">
                        <Info className="w-3.5 h-3.5 text-emerald-700 inline" />
                        <span>Resumen de afectación de Ley para bonos:</span>
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-800">
                        <li><strong>Bonos Salariales:</strong> Incrementan la Base de Cotización (IBC) e incrementan los aportes de Salud (4%) y Pensión (4%).</li>
                        <li><strong>Bonos No Salariales:</strong> Se pagan directamente en el devengado total sin generar retención ni retenciones de aportes de ley.</li>
                      </ul>
                    </div>
                  </div>

                  {/* BLOQUE 3: HORARIO SEMANAL Y DIA DE DESCANSO CONTRACTUAL (LEY 42 HORAS) */}
                  <div className="bg-white border border-zinc-200 p-4 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div className="flex items-center space-x-2 text-zinc-700 font-black text-xs uppercase tracking-wider">
                        <Clock className="w-4 h-4 text-blue-700" />
                        <span>3. Horario Semanal y Día de Descanso (42 Horas)</span>
                      </div>

                      {/* CONTADOR DE HORAS SEMANALES EN TIEMPO REAL */}
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-black uppercase text-zinc-500">Carga Semanal:</span>
                        {weeklyHours <= 42 ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black rounded-lg flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{weeklyHours.toFixed(1)} / 42.0 hrs (En Regla)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-red-100 text-red-900 border border-red-300 text-xs font-black rounded-lg flex items-center space-x-1">
                            <AlertCircle className="w-3.5 h-3.5 text-red-700" />
                            <span>{weeklyHours.toFixed(1)} / 42.0 hrs (Exceso: +{(weeklyHours - 42).toFixed(1)} hrs)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs">
                      <div>
                        <label className="text-[11px] font-black uppercase text-zinc-600 block mb-1">
                          Día de Descanso Estipulado en Contrato
                        </label>
                        <select
                          disabled={!isAdmin}
                          value={config.diaDescansoContractual || "Domingo"}
                          onChange={(e: any) => {
                            const newRest = e.target.value;
                            updateConfig(member.nombre, "diaDescansoContractual", newRest);
                            updateConfig(member.nombre, "horarioSemanal", getDefaultSchedule(newRest));
                          }}
                          className="w-full bg-white border border-zinc-300 p-2 font-bold rounded-lg outline-none cursor-pointer"
                        >
                          <option value="Lunes">Lunes</option>
                          <option value="Martes">Martes</option>
                          <option value="Miércoles">Miércoles</option>
                          <option value="Jueves">Jueves</option>
                          <option value="Viernes">Viernes</option>
                          <option value="Sábado">Sábado</option>
                          <option value="Domingo">Domingo</option>
                        </select>
                      </div>

                      <div className="text-[11px] text-zinc-600 leading-snug">
                        <strong className="text-zinc-800">Lógica de Recargo Dominical:</strong> Si labora un domingo pero su descanso contractual es p. ej. <em>Martes</em>, el domingo se liquida como ordinario (+0%). Si labora en su día de descanso estipulado o festivo, aplica el incremento legal del +90%.
                      </div>
                    </div>

                    {/* Matriz interactiva de Horario Lunes - Domingo */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-zinc-100 border-b border-zinc-200 text-[11px] font-black text-zinc-600 uppercase">
                            <th className="p-2">Día</th>
                            <th className="p-2">Labora</th>
                            <th className="p-2">Hora Entrada</th>
                            <th className="p-2">Hora Salida</th>
                            <th className="p-2 text-right">Horas Efectivas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 font-medium">
                          {(config.horarioSemanal || getDefaultSchedule(config.diaDescansoContractual)).map((day, idx) => {
                            const isRestDay = day.dia === (config.diaDescansoContractual || "Domingo");
                            return (
                              <tr key={day.dia} className={isRestDay ? "bg-amber-50/50" : "hover:bg-zinc-50"}>
                                <td className="p-2 font-bold text-brand-ink flex items-center space-x-1.5">
                                  <span>{day.dia}</span>
                                  {isRestDay && (
                                    <span className="text-[11px] bg-amber-200 text-amber-900 font-black px-1.5 py-0.5 rounded">
                                      Descanso
                                    </span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <input
                                    type="checkbox"
                                    disabled={!isAdmin}
                                    checked={day.activo}
                                    onChange={(e) => handleUpdateScheduleDay(member.nombre, idx, "activo", e.target.checked)}
                                    className="w-4 h-4 cursor-pointer accent-brand-ink"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="time"
                                    disabled={!isAdmin || !day.activo}
                                    value={day.horaEntrada}
                                    onChange={(e) => handleUpdateScheduleDay(member.nombre, idx, "horaEntrada", e.target.value)}
                                    className="bg-white border border-zinc-300 p-1 font-mono font-bold rounded text-xs disabled:opacity-40"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="time"
                                    disabled={!isAdmin || !day.activo}
                                    value={day.horaSalida}
                                    onChange={(e) => handleUpdateScheduleDay(member.nombre, idx, "horaSalida", e.target.value)}
                                    className="bg-white border border-zinc-300 p-1 font-mono font-bold rounded text-xs disabled:opacity-40"
                                  />
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-brand-ink">
                                  {day.activo ? `${day.horasCalculadas.toFixed(1)} hrs` : "0.0 hrs"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* BLOQUE 4: INFORMACION PARTICULAR LIBRE & IA */}
                  <div className="bg-white border border-zinc-200 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-zinc-700 tracking-wider">
                        4. Información Particular / Condiciones Especiales (Texto Libre)
                      </label>

                      <button
                        onClick={() => parseInformacionParticular(member.nombre)}
                        className="text-[11px] font-black text-emerald-700 hover:text-emerald-900 flex items-center space-x-1 cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>🤖 Extraer Reglas con IA</span>
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      disabled={!isAdmin}
                      placeholder="Ej. 'Tiene bono fijo de $50.000 por auxilio de movilización', 'Reunión autorizada a las 10:00 AM el 12 de julio'"
                      value={config.informacionParticular}
                      onChange={(e) => updateConfig(member.nombre, "informacionParticular", e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 p-2 text-xs font-medium text-brand-ink rounded-lg outline-none focus:bg-white disabled:opacity-60"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: HISTORIAL DE PAGOS Y LIQUIDACIONES GUARDADAS */}
      {activeSubTab === "history" && (
        <div className="bg-white border-2 border-brand-ink rounded-2xl shadow-[4px_4px_0px_0px_#1C1917] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-200 pb-4">
            <div>
              <h3 className="text-base font-black uppercase text-brand-ink tracking-wider">
                Historial de Liquidaciones Guardadas
              </h3>
              <p className="text-xs text-zinc-500">
                Consulta los pagos quincenales realizados históricamente a cada integrante del equipo.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por colaborador o quincena..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs border border-zinc-300 rounded-lg outline-none w-64"
                />
              </div>

              <select
                value={historyFilterMember}
                onChange={(e) => setHistoryFilterMember(e.target.value)}
                className="py-1.5 px-3 text-xs font-bold border border-zinc-300 rounded-lg outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los colaboradores</option>
                {teamMembers.map(m => (
                  <option key={m.nombre} value={m.nombre}>{m.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-zinc-200 rounded-2xl">
              <History className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-xs font-bold text-zinc-500">
                No se han registrado liquidaciones guardadas en el historial aún.
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Puedes guardar la quincena actual presionando el botón "Guardar en Historial" en la pestaña de liquidación.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-300 text-[11px] font-black uppercase text-zinc-600">
                    <th className="p-3">Periodo / Quincena</th>
                    <th className="p-3">Colaborador</th>
                    <th className="p-3">Cargo / Área</th>
                    <th className="p-3">Días</th>
                    <th className="p-3 text-right">Devengado</th>
                    <th className="p-3 text-right">Deducciones</th>
                    <th className="p-3 text-right">Neto Pagado</th>
                    <th className="p-3 text-center">Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-semibold">
                  {filteredHistory.map(record => (
                    <tr key={record.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="p-3 font-bold text-brand-ink">
                        {record.quincenaNombre}
                        <span className="block text-[11px] text-zinc-400 font-normal">
                          {new Date(record.fechaRegistro).toLocaleDateString("es-CO")}
                        </span>
                      </td>

                      <td className="p-3 font-black text-brand-ink">
                        {record.empleadoNombre}
                        <span className="block text-[11px] text-zinc-500 font-normal">
                          Contrato: {record.tipoContrato}
                        </span>
                      </td>

                      <td className="p-3">
                        {record.cargo}
                        <span className="inline-block ml-1 px-1.5 py-0.2 bg-zinc-200 text-zinc-800 text-[11px] rounded font-bold uppercase">
                          {record.area}
                        </span>
                      </td>

                      <td className="p-3">{record.diasAsistidos} / {record.diasLaborados}</td>

                      <td className="p-3 text-right text-emerald-800 font-bold">
                        {formatCOP(record.devengadoTotal)}
                      </td>

                      <td className="p-3 text-right text-red-800 font-bold">
                        {formatCOP(record.deduccionesTotal)}
                      </td>

                      <td className="p-3 text-right font-mono font-black text-brand-ink text-sm">
                        {formatCOP(record.netoAPagar)}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleExportIndividualPdf(record.empleadoNombre)}
                            className="p-1.5 bg-brand-ink text-white hover:bg-black rounded-lg text-[11px] font-black uppercase flex items-center space-x-1 cursor-pointer"
                            title="Descargar Comprobante PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>

                          <button
                            onClick={() => handleDeleteHistoryRecord(record.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL TIRILLA DE PAGO JSON (FASE 2) */}
      {selectedTirillaJson && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTirillaJson(null);
          }}
          className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-8 z-50 overflow-y-auto"
        >
          <div className="bg-white border-2 border-brand-ink rounded-2xl shadow-[8px_8px_0px_0px_#1C1917] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  FASE 2: CONSOLIDADO Y TIRILLA DE PAGO (ESTRUCTURA JSON)
                </h3>
              </div>
              <button
                onClick={() => setSelectedTirillaJson(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body JSON Code */}
            <div className="p-4 bg-slate-950 overflow-y-auto font-mono text-xs text-emerald-400 space-y-2 flex-1">
              <p className="text-slate-400 text-[11px] font-sans pb-2 border-b border-slate-800">
                Estructura de datos oficial de liquidación generada desde el insumo POS Excel conforme a las reglas de nómina Colombia 2026:
              </p>
              <pre className="whitespace-pre-wrap leading-relaxed select-all">
                {JSON.stringify(selectedTirillaJson, null, 2)}
              </pre>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-600">
                Colaborador: {selectedTirillaJson.empleado?.nombre} (C.C. {selectedTirillaJson.empleado?.cedula})
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedTirillaJson, null, 2));
                    alert("✅ JSON de la tirilla copiado al portapapeles");
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <span>Copiar JSON</span>
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(selectedTirillaJson, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `tirilla_pos_${selectedTirillaJson.empleado?.cedula || "empleado"}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4 text-emerald-200" />
                  <span>Descargar JSON</span>
                </button>

                <button
                  onClick={() => setSelectedTirillaJson(null)}
                  className="px-3.5 py-2 bg-zinc-300 hover:bg-zinc-400 text-zinc-800 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
