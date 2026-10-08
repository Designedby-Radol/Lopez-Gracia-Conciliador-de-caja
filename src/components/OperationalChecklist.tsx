import React, { useState, useEffect, useMemo } from "react";
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Save, 
  History, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Sun, 
  Moon, 
  Sunrise,
  AlertTriangle,
  Lock,
  Unlock,
  ArrowRight,
  ArrowLeft,
  Check,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  AlertCircle,
  Calendar,
  Sparkle,
  Droplets,
  Trash2,
  Brush
} from "lucide-react";
import { getScheduledTasksForDate, isColombianHoliday, weekHasMondayHoliday } from "../utils/colombiaHolidays";
import { todayBogota } from "../lib/dates";

export interface ChecklistTask {
  id: string;
  seccion: "apertura" | "turno" | "cierre";
  titulo: string;
  descripcion: string;
  estado: "sin_evaluar" | "cumplido" | "pendiente" | "no_aplica";
  observacion?: string;
  esProgramada?: boolean;
  motivoProgramacion?: string;
}

export interface OperationalChecklistRecord {
  id: string;
  fecha: string;
  turno: "mañana" | "tarde" | "completo";
  createdAt: string;
  usuarioNombre: string;
  usuarioRole: string;
  local: string;
  porcentajeCumplimiento: number;
  totalCumplidos: number;
  totalPendientes: number;
  totalNoAplica: number;
  observacionesGenerales: string;
  tasks: ChecklistTask[];
}

const DEFAULT_CHECKLIST_TASKS: Omit<ChecklistTask, "estado" | "observacion">[] = [
  // APERTURA DEL LOCAL
  {
    id: "chk-ap-1",
    seccion: "apertura",
    titulo: "Ponerse el uniforme y lavarse las manos",
    descripcion: "Presentación personal reglamentaria y lavado riguroso de manos antes de iniciar."
  },
  {
    id: "chk-ap-2",
    seccion: "apertura",
    titulo: "Ingresar al sistema para registrar llegada",
    descripcion: "Registro obligatorio de ingreso y marcación de asistencia en el sistema."
  },
  {
    id: "chk-ap-3",
    seccion: "apertura",
    titulo: "Revisar entorno del local: estado de limpieza general y baño",
    descripcion: "Inspeccionar aseo y orden general de la entrada, salón, mesas y baño."
  },
  {
    id: "chk-ap-4",
    seccion: "apertura",
    titulo: "Llenar formatos de temperatura de neveras",
    descripcion: "Registrar temperaturas de las neveras en el formato correspondiente de control de frío."
  },
  {
    id: "chk-ap-5",
    seccion: "apertura",
    titulo: "Llenar formato de baño AM",
    descripcion: "Diligenciar formato de control matutino y verificación de aseo del baño."
  },
  {
    id: "chk-ap-6",
    seccion: "apertura",
    titulo: "Montar vitrina de postres, salsas y toppings verificando que estén en buen estado (textura, sabor y olor) y cumplan con el estándar de calidad",
    descripcion: "Exhibición impecable, rotación y validación organoléptica de calidad."
  },
  {
    id: "chk-ap-7",
    seccion: "apertura",
    titulo: "Prender máquina del café (surtido y funcionamiento)",
    descripcion: "Encendido, purga y verificación de insumos/surtido para servicio de café."
  },
  {
    id: "chk-ap-8",
    seccion: "apertura",
    titulo: "Revisar surtido de bebidas",
    descripcion: "Verificar stock en neveras y estanterías de exhibición de bebidas."
  },
  {
    id: "chk-ap-9",
    seccion: "apertura",
    titulo: "Verificar el funcionamiento del POS, apertura de caja y datáfonos",
    descripcion: "Comprobar sistema de facturación, apertura de turno y señal en datáfonos."
  },
  {
    id: "chk-ap-10",
    seccion: "apertura",
    titulo: "Abrir plataforma de Rappi y tienda Justo",
    descripcion: "Habilitar canales de venta digital y domicilios en plataformas."
  },
  {
    id: "chk-ap-11",
    seccion: "apertura",
    titulo: "Verificar que el ajuste de inventario del día anterior, registrado en el cuaderno, coincida exactamente con el inventario real",
    descripcion: "Cruzar datos del cuaderno de control con el inventario físico presente."
  },
  {
    id: "chk-ap-12",
    seccion: "apertura",
    titulo: "Revisar Inventario para solicitar traslados",
    descripcion: "Identificar necesidades de reposición y enviar solicitud de traslados a tiempo."
  },
  {
    id: "chk-ap-13",
    seccion: "apertura",
    titulo: "Hacer Check list de BPM (al finalizar el día debe estar completo)",
    descripcion: "Seguimiento de Buenas Prácticas de Manufactura e higiene durante la jornada."
  },

  // TARDE
  {
    id: "chk-tr-1",
    seccion: "turno",
    titulo: "Aceptar traslados",
    descripcion: "Recepción, conteo físico y confirmación de traslados recibidos en sistema."
  },
  {
    id: "chk-tr-2",
    seccion: "turno",
    titulo: "Pesar aleatoriamente porciones de los diferentes postres",
    descripcion: "Control de porcionamiento y verificación del estándar de gramaje."
  },
  {
    id: "chk-tr-3",
    seccion: "turno",
    titulo: "Revisar entorno del local: estado de limpieza general",
    descripcion: "Mantenimiento del orden y pulcritud de salón, mostradores y accesos."
  },
  {
    id: "chk-tr-4",
    seccion: "turno",
    titulo: "Ejecución de tareas asignadas conforme cronograma establecido (canecas, plantas, vidrios, estampado de bolsas, armado aisladores etc)",
    descripcion: "Desarrollo de labores periódicas de mantenimiento y preparación operativa."
  },
  {
    id: "chk-tr-5",
    seccion: "turno",
    titulo: "Encender letrero del local (5:30PM)",
    descripcion: "Encendido puntual de iluminación exterior y avisos comerciales del punto."
  },
  {
    id: "chk-tr-6",
    seccion: "turno",
    titulo: "Realizar Inventario preliminar: 1 persona empieza a contar y lava la nevera",
    descripcion: "Inicio del conteo previo de existencias y lavado profundo de nevera de venta."
  },

  // CIERRE DEL TURNO
  {
    id: "chk-cr-1",
    seccion: "cierre",
    titulo: "Revisar que plataforma Rappi y Justo no tengan pendientes",
    descripcion: "Confirmar que no existan pedidos en curso y cerrar la tienda en plataformas."
  },
  {
    id: "chk-cr-2",
    seccion: "cierre",
    titulo: "Cierre del local y apagar letrero de afuera 7:00PM",
    descripcion: "Cierre de puertas al público y corte de iluminación exterior."
  },
  {
    id: "chk-cr-3",
    seccion: "cierre",
    titulo: "Limpieza de cafetera y revisar apagado",
    descripcion: "Lavado de lanzas, purga de grupos, limpieza de bandeja y corte eléctrico."
  },
  {
    id: "chk-cr-4",
    seccion: "cierre",
    titulo: "Realizar inventario final dejando anotaciones en el cuaderno",
    descripcion: "Conteo definitivo de cierre y registro claro de novedades y mermas en cuaderno."
  },
  {
    id: "chk-cr-5",
    seccion: "cierre",
    titulo: "Control de fechas de caducidad de los productos",
    descripcion: "Revisar fechas de vencimiento y aplicar rotación preventiva (FIFO/PEPS)."
  },
  {
    id: "chk-cr-6",
    seccion: "cierre",
    titulo: "Cierre de caja: contar base, contar efectivo y cierre de datafono",
    descripcion: "Cuadre físico de base, arqueo de efectivo y emisión del cierre de datáfonos."
  },
  {
    id: "chk-cr-7",
    seccion: "cierre",
    titulo: "Limpieza de baño y llenar formato (PM)",
    descripcion: "Desinfección de baño y firma del formato de control de turno tarde/noche."
  },
  {
    id: "chk-cr-8",
    seccion: "cierre",
    titulo: "Realizar aseo del salón: pisos, mesas, sillas",
    descripcion: "Barrer, trapear y desinfectar todas las superficies de consumo de clientes."
  },
  {
    id: "chk-cr-9",
    seccion: "cierre",
    titulo: "Limpieza de tapas de teteros y vinipelado de productos",
    descripcion: "Higiene en dispensadores y protección hermética de alimentos con vinipel."
  },
  {
    id: "chk-cr-10",
    seccion: "cierre",
    titulo: "Limpieza de vitrina, nevera (apagarla) y llenar formato PM",
    descripcion: "Desinfección de vitrina/nevera, verificar apagado y diligenciar formato PM."
  },
  {
    id: "chk-cr-11",
    seccion: "cierre",
    titulo: "Revisar orden de desechables y empaques",
    descripcion: "Organización de vasos, bolsas, cajas y servilletas para el día siguiente."
  },
  {
    id: "chk-cr-12",
    seccion: "cierre",
    titulo: "Limpieza de mesones y superficies del área de servicio interna",
    descripcion: "Desinfección profunda de mesones de atención y barras de preparación."
  },
  {
    id: "chk-cr-13",
    seccion: "cierre",
    titulo: "Limpiar mueble de caja registradora",
    descripcion: "Desinfección y limpieza del mueble y estación de caja registradora."
  },
  {
    id: "chk-cr-14",
    seccion: "cierre",
    titulo: "Limpiar mueble debajo de cafetera",
    descripcion: "Aseo profundo de residuos, polvo y superficies debajo de la cafetera."
  },
  {
    id: "chk-cr-15",
    seccion: "cierre",
    titulo: "Limpiar mueble de empaques",
    descripcion: "Limpieza, sacudido y organización del mueble de empaques y suministros."
  },
  {
    id: "chk-cr-16",
    seccion: "cierre",
    titulo: "Limpieza interna del piso y trapos limpios",
    descripcion: "Aseo del suelo de la barra interna y lavado/desinfección de limpiones."
  },
  {
    id: "chk-cr-17",
    seccion: "cierre",
    titulo: "Asegurarse de la correcta disposición de la basura, tapas limpias y sacarla",
    descripcion: "Cambio de bolsas, limpieza de tapas de canecas y traslado de residuos."
  },
  {
    id: "chk-cr-18",
    seccion: "cierre",
    titulo: "Hacer recorrido de cierre: verificar gas cerrado, luces apagadas, apagar TV y apagar letreros",
    descripcion: "Chequeo perimetral de seguridad antes de salir del punto de venta."
  },
  {
    id: "chk-cr-19",
    seccion: "cierre",
    titulo: "Ingresar al sistema para registrar salida",
    descripcion: "Marcación final en sistema al concluir las labores del turno."
  }
];

export function buildInitialTasksForDate(dateStr: string): ChecklistTask[] {
  const base: ChecklistTask[] = DEFAULT_CHECKLIST_TASKS.map(t => ({
    ...t,
    estado: "sin_evaluar",
    observacion: "",
    esProgramada: false,
    motivoProgramacion: undefined
  }));

  const scheduled = getScheduledTasksForDate(dateStr);
  const additional: ChecklistTask[] = [];

  // 1. Limpieza y cepillado profundo de pisos (Apertura)
  if (scheduled.shouldDeepScrubFloors) {
    additional.push({
      id: "chk-prog-floors",
      seccion: "apertura",
      titulo: "Cepillar y limpiado profundo de piso",
      descripcion: "Jornada de limpieza y cepillado profundo de pisos al cierre de la semana laboral.",
      estado: "sin_evaluar",
      observacion: "",
      esProgramada: true,
      motivoProgramacion: scheduled.reasonDeepFloors
    });
  }

  // 2. Regar plantas (Tarde/Turno)
  if (scheduled.shouldWaterPlants) {
    additional.push({
      id: "chk-prog-plants",
      seccion: "turno",
      titulo: "Regar plantas",
      descripcion: "Riego e hidratación de plantas del local según cronograma semanal y calendario de festivos.",
      estado: "sin_evaluar",
      observacion: "",
      esProgramada: true,
      motivoProgramacion: scheduled.reasonWaterPlants
    });
  }

  // 3. Limpieza profunda de canecas (Tarde/Turno)
  if (scheduled.shouldDeepCleanTrash) {
    additional.push({
      id: "chk-prog-trash",
      seccion: "turno",
      titulo: "Limpieza profunda de canecas",
      descripcion: "Lavado minucioso, desinfección y mantenimiento profundo de recipientes de basura.",
      estado: "sin_evaluar",
      observacion: "",
      esProgramada: true,
      motivoProgramacion: scheduled.reasonDeepTrash
    });
  }

  return [...base, ...additional];
}

const LOCAL_STORAGE_CHECKLIST_KEY = "lopez_gracia_checklists_history";

// Sintetizador de audio con Web Audio API para timbre de alarma 1:30 PM
function playAlarmChimeSequence() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    // Secuencia de notas armónicas y claras (F5, A5, C6)
    const notes = [698.46, 880.00, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const startTime = ctx.currentTime + idx * 0.18;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.28, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.7);
    });
  } catch (e) {
    console.warn("No se pudo reproducir el timbre de alarma:", e);
  }
}

// Notificación del sistema si está autorizada en el navegador
function sendBrowserNotification(title: string, body: string) {
  try {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(perm => {
          if (perm === "granted") {
            new Notification(title, { body });
          }
        });
      }
    }
  } catch {
    // Fallback silencioso si el entorno no lo permite
  }
}

interface OperationalChecklistProps {
  username: string;
  userRole: string;
  localName?: string;
  isManagerView?: boolean;
}

export default function OperationalChecklist({
  username,
  userRole,
  localName = "Chapinero",
  isManagerView = false,
}: OperationalChecklistProps) {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [currentPhase, setCurrentPhase] = useState<"apertura" | "turno" | "cierre">("apertura");
  const [viewMode, setViewMode] = useState<"stepped" | "all">("stepped");
  const [fecha, setFecha] = useState<string>(() => todayBogota());
  const [turno, setTurno] = useState<"mañana" | "tarde" | "completo">("completo");
  const [observacionesGenerales, setObservacionesGenerales] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize checklist items state with static tasks and dynamic scheduled tasks for the date
  const [tasks, setTasks] = useState<ChecklistTask[]>(() => buildInitialTasksForDate(fecha));

  // When date changes, update tasks while preserving already evaluated states of existing tasks
  useEffect(() => {
    setTasks(prevTasks => {
      const freshTasks = buildInitialTasksForDate(fecha);
      const prevMap = new Map<string, ChecklistTask>(prevTasks.map(t => [t.id, t]));
      return freshTasks.map(fresh => {
        const existing = prevMap.get(fresh.id);
        if (existing) {
          return {
            ...fresh,
            estado: existing.estado,
            observacion: existing.observacion
          };
        }
        return fresh;
      });
    });
  }, [fecha]);

  // History state
  const [records, setRecords] = useState<OperationalChecklistRecord[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CHECKLIST_KEY);
      if (saved) {
        setRecords(JSON.parse(saved));
      } else {
        setRecords([]);
      }
    } catch (e) {
      console.error("Error loading checklists history:", e);
    }
  };

  const handleTaskStatusChange = (taskId: string, newStatus: "cumplido" | "pendiente" | "no_aplica") => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        // Toggle back to "sin_evaluar" if clicking the active state
        const updatedStatus = t.estado === newStatus ? "sin_evaluar" : newStatus;
        return { ...t, estado: updatedStatus };
      }
      return t;
    }));
  };

  const handleTaskNoteChange = (taskId: string, note: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, observacion: note } : t));
  };

  // Quick action: Mark all tasks in a specific section as cumplidos
  const handleMarkSectionCumplido = (sec: "apertura" | "turno" | "cierre") => {
    setTasks(prev => prev.map(t => t.seccion === sec ? { ...t, estado: "cumplido" } : t));
  };

  // Quick action: Mark all remaining un-evaluated tasks as cumplidos
  const handleMarkAllCumplidos = () => {
    setTasks(prev => prev.map(t => ({ ...t, estado: "cumplido" })));
  };

  // Quick action: Reset form back to 0%
  const handleResetChecklist = () => {
    setTasks(buildInitialTasksForDate(fecha));
    setCurrentPhase("apertura");
  };

  // Section filtered tasks
  const aperturaTasks = useMemo(() => tasks.filter(t => t.seccion === "apertura"), [tasks]);
  const turnoTasks = useMemo(() => tasks.filter(t => t.seccion === "turno"), [tasks]);
  const cierreTasks = useMemo(() => tasks.filter(t => t.seccion === "cierre"), [tasks]);

  const aperturaEvaluadas = useMemo(() => aperturaTasks.filter(t => t.estado !== "sin_evaluar").length, [aperturaTasks]);
  const turnoEvaluadas = useMemo(() => turnoTasks.filter(t => t.estado !== "sin_evaluar").length, [turnoTasks]);
  const cierreEvaluadas = useMemo(() => cierreTasks.filter(t => t.estado !== "sin_evaluar").length, [cierreTasks]);

  const isAperturaComplete = aperturaEvaluadas === aperturaTasks.length && aperturaTasks.length > 0;
  const isTurnoComplete = turnoEvaluadas === turnoTasks.length && turnoTasks.length > 0;
  const isCierreComplete = cierreEvaluadas === cierreTasks.length && cierreTasks.length > 0;

  // Unlocking flags
  const isTurnoUnlocked = isAperturaComplete;
  const isCierreUnlocked = isAperturaComplete && isTurnoComplete;

  // Calculate overall statistics
  const cumplidos = tasks.filter(t => t.estado === "cumplido").length;
  const pendientes = tasks.filter(t => t.estado === "pendiente").length;
  const sinEvaluar = tasks.filter(t => t.estado === "sin_evaluar").length;
  const noAplica = tasks.filter(t => t.estado === "no_aplica").length;
  const evaluables = tasks.length - noAplica;
  const porcentaje = evaluables > 0 ? Math.round((cumplidos / evaluables) * 100) : 0;

  // ESTADO DE ALARMA 1:30 PM (TURNO DE LA TARDE)
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alarmSnoozedUntil, setAlarmSnoozedUntil] = useState<number | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  });
  const [isPastAfternoonHour, setIsPastAfternoonHour] = useState(false);

  // Monitor en tiempo real para la alarma de la 1:30 PM
  useEffect(() => {
    const checkAlarmTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      const timeString = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
      setCurrentTimeStr(timeString);

      // 1:30 PM corresponde a 13:30 (810 minutos desde medianoche) hasta las 6:00 PM (1080 min)
      const past1330 = totalMinutes >= 810 && totalMinutes < 1080;
      setIsPastAfternoonHour(past1330);

      // Si ya pasó la 1:30 PM y la fase de la tarde aún no está completa
      if (past1330 && !isTurnoComplete) {
        const nowMs = Date.now();
        // Si no está pospuesta en los últimos 15 min
        if (!alarmSnoozedUntil || nowMs > alarmSnoozedUntil) {
          setIsAlarmActive(prev => {
            if (!prev) {
              const notifTitle = !isAperturaComplete 
                ? "⚠️ Terminar checklist de apertura y es hora de empezar el de la tarde"
                : "🔔 ¡Hora de iniciar el checklist de la tarde!";
              const notifBody = !isAperturaComplete
                ? "Son más de la 1:30 PM. Completa la apertura para habilitar el turno de la tarde."
                : "Son la 1:30 PM. Inicia la verificación operativa de la tarde.";
              sendBrowserNotification(notifTitle, notifBody);
            }
            return true;
          });
        }
      }
    };

    checkAlarmTime();
    const interval = setInterval(checkAlarmTime, 8000);
    return () => clearInterval(interval);
  }, [isTurnoComplete, isAperturaComplete, alarmSnoozedUntil]);

  // Timbre de sonido periódico mientras la alarma esté activa
  useEffect(() => {
    if (!isAlarmActive || !soundEnabled) return;

    playAlarmChimeSequence();
    const chimeTimer = setInterval(() => {
      playAlarmChimeSequence();
    }, 4200);

    return () => clearInterval(chimeTimer);
  }, [isAlarmActive, soundEnabled]);

  // Acciones de atención a la alarma
  const handleAcknowledgeApertura = () => {
    setIsAlarmActive(false);
    setAlarmSnoozedUntil(Date.now() + 15 * 60 * 1000); // Recordar en 15 min si aún no concluye
    setCurrentPhase("apertura");
    setViewMode("stepped");
    setActiveTab("new");
  };

  const handleAcknowledgeTarde = () => {
    setIsAlarmActive(false);
    setAlarmSnoozedUntil(Date.now() + 30 * 60 * 1000); // Pausa de 30 min durante el turno
    setCurrentPhase("turno");
    setViewMode("stepped");
    setActiveTab("new");
  };

  const handleSnoozeAlarm = () => {
    setIsAlarmActive(false);
    setAlarmSnoozedUntil(Date.now() + 15 * 60 * 1000); // Posponer 15 min
  };

  const handleDismissAlarm = () => {
    setIsAlarmActive(false);
    setAlarmSnoozedUntil(Date.now() + 60 * 60 * 1000); // Silenciar 1 hora
  };

  const handleTestAlarm = () => {
    setAlarmSnoozedUntil(null);
    setIsAlarmActive(true);
    if (soundEnabled) {
      playAlarmChimeSequence();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newRecord: OperationalChecklistRecord = {
      id: `chk-rec-${Date.now()}`,
      fecha,
      turno,
      createdAt: new Date().toISOString(),
      usuarioNombre: username,
      usuarioRole: userRole,
      local: localName,
      porcentajeCumplimiento: porcentaje,
      totalCumplidos: cumplidos,
      totalPendientes: pendientes,
      totalNoAplica: noAplica,
      observacionesGenerales: observacionesGenerales.trim(),
      tasks: tasks.map(t => ({ ...t }))
    };

    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    localStorage.setItem(LOCAL_STORAGE_CHECKLIST_KEY, JSON.stringify(updatedRecords));
    localStorage.setItem("lopez_gracia_checklists", JSON.stringify(updatedRecords));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);

    // Reset notes and tasks back to 0% for the next checklist
    setObservacionesGenerales("");
    setTasks(buildInitialTasksForDate(fecha));
    setCurrentPhase("apertura");
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1E3E30] flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Checklist Operativo - Área de Venta
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Control y verificación de estándares de apertura del local, tarde y cierre del turno en el área de venta.
          </p>
        </div>

        {/* Action Controls & Sub-tab switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón de prueba de alarma */}
          <button
            type="button"
            onClick={handleTestAlarm}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Probar sonido y aviso visual de la alarma de la 1:30 PM"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-600" />
            <span>Probar Alarma (1:30 PM)</span>
          </button>

          {/* Toggle de sonido */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              soundEnabled
                ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
            }`}
            title={soundEnabled ? "Sonido de alarma activo" : "Sonido de alarma silenciado"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-700" /> : <VolumeX className="w-4 h-4 text-rose-600" />}
          </button>

          {/* Sub-tab switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "new" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Nuevo Checklist</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "history" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historial ({records.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* BANNER RECORDATORIO PERSISTENTE 1:30 PM (TURNO DE LA TARDE) */}
      {isPastAfternoonHour && !isTurnoComplete && (
        <div className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          !isAperturaComplete 
            ? "bg-amber-50/90 border-amber-300 text-amber-950" 
            : "bg-emerald-50/90 border-emerald-300 text-emerald-950"
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              !isAperturaComplete ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"
            }`}>
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/80 border border-current/20">
                  1:30 PM • Recordatorio de Turno
                </span>
                <span className="text-xs font-semibold text-slate-600">Hora actual: {currentTimeStr}</span>
              </div>
              <h3 className="font-extrabold text-sm mt-0.5">
                {!isAperturaComplete 
                  ? "Terminar checklist de apertura y es hora de empezar el de la tarde" 
                  : "¡Hora de iniciar el checklist de la tarde!"}
              </h3>
              <p className="text-xs opacity-85 mt-0.5">
                {!isAperturaComplete 
                  ? `Faltan ${aperturaTasks.length - aperturaEvaluadas} tarea(s) por evaluar en la Apertura del Local para habilitar el turno de la tarde.`
                  : "La apertura del local está 100% completada. Inicia ahora la verificación del turno de la tarde."}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto self-end sm:self-center">
            <button
              type="button"
              onClick={!isAperturaComplete ? handleAcknowledgeApertura : handleAcknowledgeTarde}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                !isAperturaComplete
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-[#1E3E30] hover:bg-[#163025] text-white"
              }`}
            >
              <span>{!isAperturaComplete ? "Terminar Apertura" : "Iniciar Tarde"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleTestAlarm}
              title="Abrir ventana de alarma completa"
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition-all cursor-pointer"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE ATENCIÓN DE ALARMA OPERATIVA 1:30 PM */}
      {isAlarmActive && (
        <div className="fixed inset-0 md:left-64 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6 relative animate-in zoom-in-95 duration-200 my-auto">
            {/* Indicador de Tipo y Control de Sonido */}
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide border ${
                !isAperturaComplete
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>1:30 PM • ALERTA OPERATIVA</span>
              </span>

              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    soundEnabled
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                  }`}
                  title={soundEnabled ? "Silenciar timbre" : "Activar timbre"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-700" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                  <span className="hidden sm:inline text-[11px]">{soundEnabled ? "Audio Activo" : "Silenciado"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismissAlarm}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  title="Cerrar ventana"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Ícono de Campana y Título Solicitado */}
            <div className="text-center space-y-3">
              <div className="relative inline-flex items-center justify-center">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg ${
                  !isAperturaComplete 
                    ? "bg-amber-500 text-white shadow-amber-500/30" 
                    : "bg-[#1E3E30] text-white shadow-[#1E3E30]/30"
                }`}>
                  <BellRing className="w-8 h-8 animate-bounce" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
                </span>
              </div>

              <div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {!isAperturaComplete
                    ? "Terminar checklist de apertura y es hora de empezar el de la tarde"
                    : "¡Hora de iniciar el checklist de la tarde!"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed max-w-md mx-auto">
                  {!isAperturaComplete
                    ? `Son las ${currentTimeStr} (hora límite de apertura 1:30 PM). Aún tienes ${aperturaTasks.length - aperturaEvaluadas} tarea(s) pendientes por evaluar en la Apertura del Local. Es indispensable terminarlas para habilitar y dar inicio al checklist de la tarde.`
                    : `Son las ${currentTimeStr} (1:30 PM). La apertura del local ya fue completada exitosamente. Es hora de comenzar la verificación de la tarde para que ninguna tarea operativa se pase por alto.`}
                </p>
              </div>
            </div>

            {/* Cuadro Resumen del Estado de Apertura */}
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
              !isAperturaComplete
                ? "bg-amber-50/80 border-amber-200 text-amber-900"
                : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>Estado de Apertura:</span>
                <span className="font-extrabold font-numeric">
                  {aperturaEvaluadas} de {aperturaTasks.length} evaluadas ({Math.round((aperturaEvaluadas / (aperturaTasks.length || 1)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-current/20">
                <div 
                  className={`h-full transition-all duration-500 ${!isAperturaComplete ? "bg-amber-500" : "bg-emerald-600"}`}
                  style={{ width: `${Math.round((aperturaEvaluadas / (aperturaTasks.length || 1)) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] opacity-80">
                {!isAperturaComplete
                  ? "⚠️ La fase de la tarde permanecerá bloqueada hasta evaluar todas las tareas de apertura."
                  : "✓ La fase de la tarde ya se encuentra desbloqueada y lista para su diligenciamiento."}
              </p>
            </div>

            {/* Botón de Acción Principal */}
            <div className="space-y-2 pt-1">
              {!isAperturaComplete ? (
                <button
                  type="button"
                  onClick={handleAcknowledgeApertura}
                  className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-md shadow-amber-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Terminar Checklist de Apertura</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAcknowledgeTarde}
                  className="w-full py-3.5 px-5 bg-[#1E3E30] hover:bg-[#163025] text-white font-black text-sm rounded-2xl shadow-md shadow-[#1E3E30]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Sun className="w-4 h-4 text-amber-300" />
                  <span>Iniciar Checklist de la Tarde</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Botones Secundarios: Posponer y Cerrar */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={handleSnoozeAlarm}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Posponer 15 min</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismissAlarm}
                  className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <span>Cerrar Alarma</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS BANNER */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 shadow-xs flex items-center space-x-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-bold text-xs">¡Checklist Operativo Registrado!</h4>
            <p className="text-xs text-emerald-700 font-medium">
              El checklist ha sido guardado con una calificación de {porcentaje}% de cumplimiento.
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: FORMULARIO CHECKLIST */}
      {activeTab === "new" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Metadata & Score summary */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Fecha
                </label>
                <input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl px-3 py-2 text-xs font-bold font-numeric text-slate-900 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Jornada / Turno
                </label>
                <select
                  value={turno}
                  onChange={(e) => setTurno(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="completo">Turno Completo</option>
                  <option value="mañana">Apertura / Mañana</option>
                  <option value="tarde">Cierre / Tarde</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Evaluador
                </label>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                  {username} <span className="text-[11px] font-semibold text-slate-400">({userRole})</span>
                </div>
              </div>

              {/* Score indicator */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl text-center shadow-xs">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
                  Cumplimiento Operativo
                </span>
                <span className={`text-2xl font-extrabold font-numeric block ${
                  porcentaje >= 80 ? "text-emerald-400" : porcentaje >= 40 ? "text-amber-400" : "text-slate-300"
                }`}>
                  {porcentaje}%
                </span>
                <span className="text-[10px] block text-slate-400 font-medium mt-0.5">
                  {cumplidos} de {evaluables} cumplidos {sinEvaluar > 0 ? `(${sinEvaluar} sin evaluar)` : ""}
                </span>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-xs">
              <span className="text-xs font-medium text-slate-500">
                Progreso: <strong className="text-slate-800 font-bold">{cumplidos}</strong> Cumplidas | <strong className="text-amber-600 font-bold">{pendientes}</strong> Pendientes | <strong className="text-slate-400 font-bold">{sinEvaluar}</strong> Por evaluar
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleMarkAllCumplidos}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-xs transition-colors cursor-pointer border border-emerald-200"
                >
                  ✓ Marcar Todas Cumplidas
                </button>
                <button
                  type="button"
                  onClick={handleResetChecklist}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer border border-slate-200"
                >
                  ↺ Reiniciar a 0%
                </button>
              </div>
            </div>
          </div>

          {/* View mode toggle & Phase progress guide */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Flujo Secuencial de Verificación por Jornada</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  El checklist se habilita por etapas progresivas: Apertura del Local ➔ Tarde ➔ Cierre del Turno.
                </p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("stepped")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === "stepped" ? "bg-[#1E3E30] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Paso a Paso (Guiado)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("all")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewMode === "all" ? "bg-[#1E3E30] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Ver Todo
                </button>
              </div>
            </div>

            {/* 3 STEPS INTERACTIVE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* PASO 1: APERTURA */}
              <button
                type="button"
                onClick={() => setCurrentPhase("apertura")}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                  currentPhase === "apertura" && viewMode === "stepped"
                    ? "bg-amber-50/50 border-amber-500 shadow-xs"
                    : isAperturaComplete
                    ? "bg-emerald-50/40 border-emerald-300 hover:border-emerald-400"
                    : "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${isAperturaComplete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      <Sunrise className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black uppercase text-slate-800">1. Apertura</span>
                  </div>
                  {isAperturaComplete ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                      <Check className="w-3 h-3" />
                      <span>Listo ({aperturaEvaluadas}/{aperturaTasks.length})</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                      {aperturaEvaluadas}/{aperturaTasks.length} Evaluadas
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isAperturaComplete ? "Completado correctamente. Habilita el turno de la tarde." : "Higiene, neveras, vitrina, POS, apps e inventario."}
                </p>
                {currentPhase === "apertura" && viewMode === "stepped" && (
                  <div className="mt-2 text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center space-x-1">
                    <span>● Editando esta sección</span>
                  </div>
                )}
              </button>

              {/* PASO 2: TARDE */}
              <button
                type="button"
                onClick={() => {
                  if (isTurnoUnlocked) {
                    setCurrentPhase("turno");
                  }
                }}
                disabled={!isTurnoUnlocked}
                className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between relative ${
                  !isTurnoUnlocked
                    ? "bg-slate-100/60 border-slate-200 opacity-60 cursor-not-allowed"
                    : currentPhase === "turno" && viewMode === "stepped"
                    ? "bg-amber-50/50 border-amber-500 shadow-xs cursor-pointer"
                    : isTurnoComplete
                    ? "bg-emerald-50/40 border-emerald-300 hover:border-emerald-400 cursor-pointer"
                    : "bg-slate-50/70 border-slate-200 hover:border-slate-300 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${
                      !isTurnoUnlocked 
                        ? "bg-slate-200 text-slate-500" 
                        : isTurnoComplete 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {!isTurnoUnlocked ? <Lock className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-black uppercase text-slate-800">2. Tarde</span>
                  </div>
                  {!isTurnoUnlocked ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Bloqueado</span>
                    </span>
                  ) : isTurnoComplete ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                      <Check className="w-3 h-3" />
                      <span>Listo ({turnoEvaluadas}/{turnoTasks.length})</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                      {turnoEvaluadas}/{turnoTasks.length} Evaluadas
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {!isTurnoUnlocked 
                    ? "Se habilitará automáticamente al completar la Apertura." 
                    : isTurnoComplete 
                    ? "Completado correctamente. Habilita el Cierre de Turno." 
                    : "Traslados, gramajes, aseo de salón y tareas asignadas."}
                </p>
                {isTurnoUnlocked && currentPhase === "turno" && viewMode === "stepped" && (
                  <div className="mt-2 text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center space-x-1">
                    <span>● Editando esta sección</span>
                  </div>
                )}
              </button>

              {/* PASO 3: CIERRE DEL TURNO */}
              <button
                type="button"
                onClick={() => {
                  if (isCierreUnlocked) {
                    setCurrentPhase("cierre");
                  }
                }}
                disabled={!isCierreUnlocked}
                className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between relative ${
                  !isCierreUnlocked
                    ? "bg-slate-100/60 border-slate-200 opacity-60 cursor-not-allowed"
                    : currentPhase === "cierre" && viewMode === "stepped"
                    ? "bg-indigo-50/50 border-indigo-500 shadow-xs cursor-pointer"
                    : isCierreComplete
                    ? "bg-emerald-50/40 border-emerald-300 hover:border-emerald-400 cursor-pointer"
                    : "bg-slate-50/70 border-slate-200 hover:border-slate-300 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${
                      !isCierreUnlocked 
                        ? "bg-slate-200 text-slate-500" 
                        : isCierreComplete 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-indigo-100 text-indigo-800"
                    }`}>
                      {!isCierreUnlocked ? <Lock className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-black uppercase text-slate-800">3. Cierre del Turno</span>
                  </div>
                  {!isCierreUnlocked ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Bloqueado</span>
                    </span>
                  ) : isCierreComplete ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                      <Check className="w-3 h-3" />
                      <span>Listo ({cierreEvaluadas}/{cierreTasks.length})</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-200">
                      {cierreEvaluadas}/{cierreTasks.length} Evaluadas
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {!isCierreUnlocked 
                    ? "Se habilitará tras completar las etapas de Apertura y Tarde." 
                    : isCierreComplete 
                    ? "Checklist completado en su totalidad." 
                    : "Cierre de apps, cafetera, inventario final, caja y desinfección."}
                </p>
                {isCierreUnlocked && currentPhase === "cierre" && viewMode === "stepped" && (
                  <div className="mt-2 text-[10px] font-black text-indigo-800 uppercase tracking-wider flex items-center space-x-1">
                    <span>● Editando esta sección</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* RENDERIZADO DE SECCIONES (STEPPED O ALL) */}
          {(viewMode === "stepped" ? [currentPhase] : (["apertura", "turno", "cierre"] as const)).map((seccionKey) => {
            const sectionTasks = tasks.filter(t => t.seccion === seccionKey);
            const isUnlocked = seccionKey === "apertura" || (seccionKey === "turno" && isTurnoUnlocked) || (seccionKey === "cierre" && isCierreUnlocked);
            
            const titlesMap = {
              apertura: { 
                stepNum: "1",
                name: "1. Apertura del Local", 
                icon: Sunrise, 
                color: "text-amber-600",
                badgeBg: "bg-amber-100 text-amber-800",
                isComplete: isAperturaComplete,
                countEvaluated: aperturaEvaluadas,
                totalCount: aperturaTasks.length,
                desc: "Realiza la verificación de apertura antes de recibir clientes."
              },
              turno: { 
                stepNum: "2",
                name: "2. Tarde", 
                icon: Sun, 
                color: "text-amber-500",
                badgeBg: "bg-amber-100 text-amber-800",
                isComplete: isTurnoComplete,
                countEvaluated: turnoEvaluadas,
                totalCount: turnoTasks.length,
                desc: "Monitorea la operación intermedia, traslados y mantenimiento preventivo."
              },
              cierre: { 
                stepNum: "3",
                name: "3. Cierre del Turno", 
                icon: Moon, 
                color: "text-indigo-600",
                badgeBg: "bg-indigo-100 text-indigo-800",
                isComplete: isCierreComplete,
                countEvaluated: cierreEvaluadas,
                totalCount: cierreTasks.length,
                desc: "Finalización de jornada, arqueos de caja, inventario final y desinfección."
              },
            };
            const secInfo = titlesMap[seccionKey];
            const SecIcon = secInfo.icon;

            // Si la sección está bloqueada en modo vista completa
            if (!isUnlocked) {
              return (
                <div key={seccionKey} className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-700 uppercase">
                      {secInfo.name} • Bloqueado
                    </h3>
                    <p className="text-xs text-slate-500 font-medium max-w-md mx-auto mt-1">
                      Esta fase se desbloqueará automáticamente en cuanto termines de evaluar la sección previa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPhase(seccionKey === "cierre" ? "turno" : "apertura")}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer shadow-xs inline-flex items-center space-x-2"
                  >
                    <span>← Ir a completar sección previa</span>
                  </button>
                </div>
              );
            }

            return (
              <div key={seccionKey} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
                {/* Header de la Sección */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                      <SecIcon className={`w-5 h-5 ${secInfo.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {secInfo.name}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          secInfo.isComplete 
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                            : secInfo.badgeBg
                        }`}>
                          {secInfo.countEvaluated} / {secInfo.totalCount} evaluadas
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {secInfo.desc}
                      </p>
                    </div>
                  </div>

                  {/* Acciones de la fase */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMarkSectionCumplido(seccionKey)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Marcar esta fase como cumplida</span>
                    </button>
                  </div>
                </div>

                {/* Lista de Tareas de esta sección */}
                <div className="space-y-2.5">
                  {sectionTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`border rounded-xl p-3.5 transition-all ${
                        task.estado === "cumplido"
                          ? "border-emerald-200 bg-emerald-50/40"
                          : task.estado === "pendiente"
                          ? "border-amber-200 bg-amber-50/50"
                          : task.estado === "no_aplica"
                          ? "border-slate-200 bg-slate-100/70 opacity-60"
                          : "border-slate-200/80 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Task title and desc */}
                        <div className="flex-1">
                          <h4 className="font-bold text-xs text-slate-900 flex flex-wrap items-center gap-2">
                            <span>{task.titulo}</span>
                            {task.esProgramada && (
                              <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                <span>Tarea Programada de Hoy</span>
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                            {task.descripcion}
                          </p>
                          {task.esProgramada && task.motivoProgramacion && (
                            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center space-x-1.5 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-200/60 w-fit">
                              <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{task.motivoProgramacion}</span>
                            </p>
                          )}
                        </div>

                        {/* Status buttons */}
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleTaskStatusChange(task.id, "cumplido")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center space-x-1.5 ${
                              task.estado === "cumplido"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Cumplido</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTaskStatusChange(task.id, "pendiente")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center space-x-1.5 ${
                              task.estado === "pendiente"
                                ? "bg-amber-500 text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-700"
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pendiente</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTaskStatusChange(task.id, "no_aplica")}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center space-x-1 ${
                              task.estado === "no_aplica"
                                ? "bg-slate-700 text-white shadow-xs"
                                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>N/A</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional task note if pending */}
                      {task.estado === "pendiente" && (
                        <div className="mt-2.5 pt-2.5 border-t border-amber-200/80">
                          <input
                            type="text"
                            placeholder="Añade un motivo u observación del por qué quedó pendiente..."
                            value={task.observacion || ""}
                            onChange={(e) => handleTaskNoteChange(task.id, e.target.value)}
                            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pie de navegación por etapas (en modo guiado) */}
                {viewMode === "stepped" && (
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      {seccionKey === "apertura" && !isAperturaComplete && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 inline-block">
                          ⏳ Faltan {aperturaTasks.length - aperturaEvaluadas} tarea(s) por evaluar para desbloquear la fase de la Tarde.
                        </span>
                      )}
                      {seccionKey === "apertura" && isAperturaComplete && (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 inline-flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>¡Apertura 100% evaluada! Puedes avanzar a la tarde.</span>
                        </span>
                      )}

                      {seccionKey === "turno" && !isTurnoComplete && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 inline-block">
                          ⏳ Faltan {turnoTasks.length - turnoEvaluadas} tarea(s) por evaluar para desbloquear el Cierre del Turno.
                        </span>
                      )}
                      {seccionKey === "turno" && isTurnoComplete && (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 inline-flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>¡Fase de la Tarde 100% evaluada! Puedes avanzar al cierre.</span>
                        </span>
                      )}

                      {seccionKey === "cierre" && !isCierreComplete && (
                        <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 inline-block">
                          ⏳ Faltan {cierreTasks.length - cierreEvaluadas} tarea(s) por evaluar en el Cierre.
                        </span>
                      )}
                      {seccionKey === "cierre" && isCierreComplete && (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 inline-flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>¡Todas las fases han sido evaluadas con éxito!</span>
                        </span>
                      )}
                    </div>

                    {/* Botones de navegación entre fases */}
                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                      {seccionKey === "turno" && (
                        <button
                          type="button"
                          onClick={() => setCurrentPhase("apertura")}
                          className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-center space-x-1.5"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Volver a Apertura</span>
                        </button>
                      )}

                      {seccionKey === "cierre" && (
                        <button
                          type="button"
                          onClick={() => setCurrentPhase("turno")}
                          className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-center space-x-1.5"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Volver a Tarde</span>
                        </button>
                      )}

                      {seccionKey === "apertura" && (
                        <button
                          type="button"
                          disabled={!isAperturaComplete}
                          onClick={() => setCurrentPhase("turno")}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 ${
                            isAperturaComplete
                              ? "bg-[#1E3E30] text-white hover:bg-[#163025] shadow-xs cursor-pointer"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <span>Avanzar a Fase 2: Tarde</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {seccionKey === "turno" && (
                        <button
                          type="button"
                          disabled={!isTurnoComplete}
                          onClick={() => setCurrentPhase("cierre")}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 ${
                            isTurnoComplete
                              ? "bg-[#1E3E30] text-white hover:bg-[#163025] shadow-xs cursor-pointer"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <span>Avanzar a Fase 3: Cierre</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Observaciones generales */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              Observaciones Finales o Novedades Operativas
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre visitas de inspección, fallas de equipos o sugerencias..."
              value={observacionesGenerales}
              onChange={(e) => setObservacionesGenerales(e.target.value)}
              className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none transition-all"
            />
          </div>

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="text-xs text-slate-600 font-medium">
              Estado general: <strong className="text-slate-900 font-bold">{cumplidos}</strong> de {evaluables} cumplidas ({porcentaje}% cumplimiento).
              {sinEvaluar > 0 && (
                <span className="text-amber-700 ml-1.5 font-bold">
                  ({sinEvaluar} tarea(s) aún sin evaluar)
                </span>
              )}
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-[#1E3E30] text-white hover:bg-[#163025] font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Checklist Operativo ({porcentaje}%)</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: HISTORIAL */}
      {activeTab === "history" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <History className="w-4 h-4 text-slate-500" />
              <span>Historial de Checklists Operativos ({records.length})</span>
            </h3>

            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por fecha o responsable..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#1E3E30]/15"
              />
            </div>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
              No se han registrado checklists operativos aún.
            </div>
          ) : (
            <div className="space-y-3">
              {records
                .filter(rec => 
                  rec.fecha.includes(historySearch) || 
                  rec.usuarioNombre.toLowerCase().includes(historySearch.toLowerCase()) ||
                  rec.local.toLowerCase().includes(historySearch.toLowerCase())
                )
                .map((record) => {
                  const isExpanded = expandedRecordId === record.id;
                  return (
                    <div 
                      key={record.id}
                      className="border border-slate-200/80 rounded-xl bg-white shadow-xs overflow-hidden"
                    >
                      <div 
                        onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                        className="p-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-xs text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-numeric">
                            {record.fecha}
                          </span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">
                              {record.usuarioNombre} <span className="text-[11px] font-normal text-slate-500">({record.usuarioRole})</span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Turno: {record.turno} • Local: {record.local}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-numeric ${
                            record.porcentajeCumplimiento >= 85 
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}>
                            {record.porcentajeCumplimiento}% Cumplimiento
                          </span>
                          <button className="p-1 rounded-lg hover:bg-slate-200 text-slate-500">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-100 bg-white space-y-4">
                          {record.observacionesGenerales && (
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                              <strong>Observaciones Generales:</strong> {record.observacionesGenerales}
                            </div>
                          )}

                          <div className="space-y-2">
                            <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Detalle de Tareas:</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {record.tasks.map((task) => (
                                <div key={task.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center space-x-1.5 flex-wrap">
                                      <span className="font-bold text-slate-800 block">{task.titulo}</span>
                                      {task.esProgramada && (
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                                          Programada
                                        </span>
                                      )}
                                    </div>
                                    {task.observacion && (
                                      <span className="text-[11px] text-amber-700 font-medium block mt-0.5">
                                        Nota: {task.observacion}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                                    task.estado === "cumplido" 
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : task.estado === "pendiente"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-200 text-slate-700 border-slate-300"
                                  }`}>
                                    {task.estado}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
