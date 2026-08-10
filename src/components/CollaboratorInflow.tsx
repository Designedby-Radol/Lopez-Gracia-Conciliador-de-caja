import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Calendar, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  RotateCcw, 
  Landmark, 
  CreditCard, 
  Send, 
  User,
  Users,
  History,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Check,
  Clock,
  UploadCloud,
  Sparkles,
  FileCheck2,
  Lock,
  Key,
  Eye,
  EyeOff
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { dbAdapter } from "../db/dbAdapter";
import { CierreCaja } from "../types";
import Logo from "./Logo";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface CollaboratorInflowProps {
  onLogout: () => void;
  username: string;
  role?: string;
  local?: string;
}

export default function CollaboratorInflow({ onLogout, username, role = "colaborador", local = "Chapinero" }: CollaboratorInflowProps) {
  // Configurar la fecha predeterminada como el día actual en formato YYYY-MM-DD (hora de Bogotá)
  const getTodayString = () => {
    const d = new Date();
    // Ajuste de zona horaria de Bogotá (UTC-5) si es necesario
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [fecha, setFecha] = useState(getTodayString());
  const [colaboradorNombre, setColaboradorNombre] = useState(username || "");
  const [efectivo, setEfectivo] = useState("");
  const [datafono, setDatafono] = useState("");
  const [justo, setJusto] = useState("0");
  const [rappi, setRappi] = useState("0");
  const [transferencias, setTransferencias] = useState("0");
  const [propinas, setPropinas] = useState("");
  const [novedades, setNovedades] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<CierreCaja | null>(null);









  const parseCOPValue = (str: string) => 0;
  const extractAmountFromLine = (line: string) => 0;
  const startProcessing = (data: any) => {};

  const processExtractedText = (text: string, fileName: string) => {
    const lines = text.split("\n");
    
    interface ParsedRow {
      name: string;
      credito: number;
      debito: number;
      total: number;
      line: string;
    }

    const parsedRows: ParsedRow[] = [];
    const anulaciones: { reason: string; amount: number }[] = [];

    for (const line of lines) {
      const normalized = line.toLowerCase().trim();
      if (!normalized) continue;

      const isHeaderOrTotalSummary = 
        normalized.includes("medio de pago") || 
        normalized.includes("credito (") || 
        normalized.includes("debito (") ||
        normalized.includes("caja / lópez & gracia") ||
        normalized.includes("total");

      if (isHeaderOrTotalSummary) continue;

      const moneyMatches = line.match(/\$?\s*\d+(?:[.,]\d{3})*(?:[.,]\d{2})?/g);
      if (!moneyMatches || moneyMatches.length === 0) continue;

      const values = moneyMatches.map(m => parseCOPValue(m));
      if (values.every(v => v === 0)) continue;

      let credito = 0;
      let debito = 0;
      let total = 0;

      if (values.length >= 3) {
        credito = values[values.length - 3];
        debito = values[values.length - 2];
        total = values[values.length - 1];
      } else if (values.length === 2) {
        credito = values[0];
        total = values[1];
        debito = (credito - total > 0) ? (credito - total) : 0;
      } else if (values.length === 1) {
        total = values[0];
        credito = values[0];
        debito = 0;
      }

      let matchedMethod = "";
      let customMethodName = "";

      if (normalized.includes("efectivo caja")) {
        matchedMethod = "efectivo";
        customMethodName = "EFECTIVO CAJA";
      } else if (normalized.includes("tcredito")) {
        matchedMethod = "tarjetas";
        customMethodName = "TCREDITO";
      } else if (normalized.includes("tdebito")) {
        matchedMethod = "tarjetas";
        customMethodName = "TDEBITO";
      } else if (normalized.includes("cxc justo")) {
        matchedMethod = "justo";
        customMethodName = "CXC JUSTO";
      } else if (normalized.includes("cxc rappi")) {
        matchedMethod = "rappi";
        customMethodName = "CXC RAPPI";
      } else if (normalized.includes("pse / transf") || normalized.includes("pse/transf") || normalized.includes("transf. bancaria") || normalized.includes("transferencia")) {
        matchedMethod = "transferencias";
        customMethodName = "PSE / TRANSF. BANCARIA";
      } else if (normalized.includes("efectivo") || normalized.includes("efec") || normalized.includes("cash")) {
        matchedMethod = "efectivo";
        customMethodName = "EFECTIVO CAJA";
      } else if (normalized.includes("tarjeta") || normalized.includes("datafono") || normalized.includes("datáfono") || normalized.includes("visa") || normalized.includes("master") || normalized.includes("debito") || normalized.includes("débito") || normalized.includes("credito") || normalized.includes("crédito")) {
        matchedMethod = "tarjetas";
        customMethodName = "Tarjeta/Datáfono";
      } else if (normalized.includes("justo")) {
        matchedMethod = "justo";
        customMethodName = "CXC JUSTO";
      } else if (normalized.includes("rappi")) {
        matchedMethod = "rappi";
        customMethodName = "CXC RAPPI";
      } else if (normalized.includes("nequi") || normalized.includes("daviplata") || normalized.includes("bancolombia") || normalized.includes("banco") || normalized.includes("transf") || normalized.includes("pse") || normalized.includes("consignacion")) {
        matchedMethod = "transferencias";
        customMethodName = "PSE / TRANSF. BANCARIA";
      }

      if (matchedMethod) {
        parsedRows.push({
          name: matchedMethod,
          credito,
          debito,
          total,
          line: line.trim()
        });

        const absDebito = Math.abs(debito);
        if (absDebito > 0) {
          anulaciones.push({
            reason: `Débito por anulación de $${absDebito.toLocaleString("es-CO")} en ${customMethodName}`,
            amount: absDebito
          });
        }
      }
    }

    let efectivoPOS = 0;
    let tarjetasPOS = 0;
    let justoPOS = 0;
    let rappiPOS = 0;
    let transferenciasPOS = 0;

    for (const row of parsedRows) {
      if (row.name === "efectivo") {
        efectivoPOS += row.total;
      } else if (row.name === "tarjetas") {
        tarjetasPOS += row.total;
      } else if (row.name === "justo") {
        justoPOS += row.total;
      } else if (row.name === "rappi") {
        rappiPOS += row.total;
      } else if (row.name === "transferencias") {
        transferenciasPOS += row.total;
      }
    }

    if (parsedRows.length === 0) {
      const fallbackMatches = {
        efectivo: [] as { line: string; amount: number; isTotal: boolean }[],
        tarjetas: [] as { line: string; amount: number; isTotal: boolean }[],
        justo: [] as { line: string; amount: number; isTotal: boolean }[],
        rappi: [] as { line: string; amount: number; isTotal: boolean }[],
        transferencias: [] as { line: string; amount: number; isTotal: boolean }[]
      };

      for (const line of lines) {
        const normalized = line.toLowerCase().trim();
        if (!normalized) continue;

        const amount = extractAmountFromLine(line);
        if (amount === 0) continue;

        const isTotal = normalized.includes("total") || 
                        normalized.includes("acumulado") || 
                        normalized.includes("resumen") || 
                        normalized.includes("subtotal") ||
                        normalized.includes("neto");

        const isAnulacion = normalized.includes("anulacion") || 
                            normalized.includes("anulación") || 
                            normalized.includes("anulaciones") ||
                            normalized.includes("cancelacion") || 
                            normalized.includes("cancelación") ||
                            normalized.includes("devolucion") || 
                            normalized.includes("devolución") ||
                            normalized.includes("void") || 
                            normalized.includes("reversado") ||
                            normalized.includes("descuento") ||
                            normalized.includes("debito anulación") ||
                            normalized.includes("débito anulación");

        if (isAnulacion) {
          anulaciones.push({ reason: `Anulación: "${line.trim()}"`, amount });
        }

        const hasEfectivo = normalized.includes("efectivo") || normalized.includes("efec") || normalized.includes("cash");
        const hasTarjeta = normalized.includes("tarjeta") || normalized.includes("datafono") || normalized.includes("datáfono") || normalized.includes("visa") || normalized.includes("master") || normalized.includes("debito") || normalized.includes("débito") || normalized.includes("credito") || normalized.includes("crédito");
        const hasJusto = normalized.includes("justo");
        const hasRappi = normalized.includes("rappi");
        const hasTransferencia = normalized.includes("transferencia") || normalized.includes("transferencias") || normalized.includes("nequi") || normalized.includes("daviplata") || normalized.includes("bancolombia") || normalized.includes("banco") || normalized.includes("transf") || normalized.includes("consignacion");

        if (hasEfectivo && !isAnulacion) {
          fallbackMatches.efectivo.push({ line, amount, isTotal });
        }
        if (hasTarjeta && !isAnulacion) {
          fallbackMatches.tarjetas.push({ line, amount, isTotal });
        }
        if (hasJusto && !isAnulacion) {
          fallbackMatches.justo.push({ line, amount, isTotal });
        }
        if (hasRappi && !isAnulacion) {
          fallbackMatches.rappi.push({ line, amount, isTotal });
        }
        if (hasTransferencia && !isAnulacion) {
          fallbackMatches.transferencias.push({ line, amount, isTotal });
        }
      }

      const aggregateCategory = (catMatches: typeof fallbackMatches.efectivo): number => {
        if (catMatches.length === 0) return 0;
        const totalLine = catMatches.find(m => m.isTotal);
        if (totalLine) return totalLine.amount;

        const descriptions = catMatches.map(m => m.line.toLowerCase());
        const hasDistinctSubmethods = (
          descriptions.some(d => d.includes("visa")) && descriptions.some(d => d.includes("master")) ||
          descriptions.some(d => d.includes("nequi")) && descriptions.some(d => d.includes("daviplata")) ||
          descriptions.some(d => d.includes("debito") || d.includes("débito")) && descriptions.some(d => d.includes("credito") || d.includes("crédito"))
        );

        if (hasDistinctSubmethods) {
          return catMatches.reduce((sum, m) => sum + m.amount, 0);
        }

        return Math.max(...catMatches.map(m => m.amount));
      };

      efectivoPOS = aggregateCategory(fallbackMatches.efectivo);
      tarjetasPOS = aggregateCategory(fallbackMatches.tarjetas);
      justoPOS = aggregateCategory(fallbackMatches.justo);
      rappiPOS = aggregateCategory(fallbackMatches.rappi);
      transferenciasPOS = aggregateCategory(fallbackMatches.transferencias);
    }

    let anulacionesNote = "";
    if (anulaciones.length > 0) {
      anulacionesNote = `⚠️ Novedad detectada: ` + 
        anulaciones.map(a => `${a.reason}`).join(", ") + 
        `.`;
    }

    startProcessing({
      efectivoPOS,
      tarjetasPOS,
      justoPOS,
      rappiPOS,
      transferenciasPOS,
      fileName,
      anulacionesNote: anulacionesNote || undefined
    });
  };



  // States for team selection of the shift
  const [liderNombre, setLiderNombre] = useState(role === "Lider de punto" ? username : "");
  const [selectedAuxiliares, setSelectedAuxiliares] = useState<string[]>([]);

  // Computed registered users from the same local
  const localRegisteredUsers = useMemo(() => {
    const data = localStorage.getItem("lopez_gracia_user_registry");
    let users: any[] = [];
    if (!data) {
      users = [
        { nombre: "Gerente", role: "gerente", local: "Chapinero" },
        { nombre: "Colaborador Lider", role: "Lider de punto", local: "Chapinero" },
        { nombre: "Colaborador Auxiliar", role: "Aux de Venta", local: "Chapinero" }
      ];
    } else {
      try {
        users = JSON.parse(data);
      } catch (e) {
        users = [];
      }
    }
    
    // Filter by the current local
    const sameLocalUsers = users.filter(u => (u.local || "Chapinero").toLowerCase() === (local || "Chapinero").toLowerCase());
    
    const leaders = sameLocalUsers.filter(u => u.role === "Lider de punto");
    const assistants = sameLocalUsers.filter(u => u.role === "Aux de Venta");
    
    return { leaders, assistants };
  }, [local]);

  // Set initial liderNombre based on roles and available leaders
  useEffect(() => {
    if (role === "Lider de punto") {
      setLiderNombre(username);
    } else if (localRegisteredUsers.leaders.length > 0) {
      setLiderNombre(localRegisteredUsers.leaders[0].nombre);
    }
  }, [role, username, localRegisteredUsers.leaders]);

  const [activeTab, setActiveTab] = useState<"register" | "history" | "password">("register");
  const [history, setHistory] = useState<CierreCaja[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<"me" | "all">("me");

  // Estados para cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmNewPass, setShowConfirmNewPass] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Por favor completa todos los campos.");
      return;
    }

    if (newPassword.length < 3) {
      setPasswordError("La nueva contraseña debe tener al menos 3 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setIsUpdatingPassword(true);

    setTimeout(() => {
      const data = localStorage.getItem("lopez_gracia_user_registry");
      let users: any[] = [];
      if (data) {
        try {
          users = JSON.parse(data);
        } catch (e) {
          users = [];
        }
      }

      const userIndex = users.findIndex(u => u.nombre.toLowerCase() === username.toLowerCase());

      if (userIndex === -1) {
        const expectedCurrent = (username.toLowerCase().includes("lider") || username.toLowerCase().includes("colaborador") || username.toLowerCase().includes("auxiliar")) ? "tienda" : "admin";
        
        if (currentPassword !== expectedCurrent) {
          setPasswordError("La contraseña actual es incorrecta.");
          setIsUpdatingPassword(false);
          return;
        }

        const newUser = {
          nombre: username,
          password: newPassword,
          role: role,
          local: local,
          puntosPropinas: 1.0,
          aptoPropinas: true,
          activo: true
        };
        users.push(newUser);
      } else {
        if (users[userIndex].password !== currentPassword) {
          setPasswordError("La contraseña actual es incorrecta.");
          setIsUpdatingPassword(false);
          return;
        }

        users[userIndex].password = newPassword;
      }

      localStorage.setItem("lopez_gracia_user_registry", JSON.stringify(users));
      
      setPasswordSuccess("¡Contraseña actualizada con éxito! Utiliza tu nueva contraseña en tu próximo inicio de sesión.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsUpdatingPassword(false);
    }, 600);
  };

  const canSeeAllTeam = role === "Lider de punto" || role === "colaborador";

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await dbAdapter.getCierres();
      setHistory(data);
    } catch (error) {
      console.error("Error al obtener historial:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    if (!canSeeAllTeam || filterUser === "me") {
      return history.filter(c => 
        (c.colaboradorNombre || "").toLowerCase().trim() === username.toLowerCase().trim()
      );
    }
    return history;
  }, [history, filterUser, username, canSeeAllTeam]);

  // Formateador de moneda colombiana COP
  const formatCOP = (valStr: string) => {
    if (!valStr) return "$0 COP";
    const num = parseInt(valStr.replace(/\D/g, ""), 10);
    if (isNaN(num)) return "$0 COP";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num) + " COP";
  };

  // Filtrar entrada numérica y aplicar separador de miles dinámico
  const handleNumericChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    if (rawVal === "") {
      setter("");
      return;
    }
    const num = parseInt(rawVal, 10);
    if (isNaN(num)) {
      setter("");
      return;
    }
    const formatted = new Intl.NumberFormat("es-CO").format(num);
    setter(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fecha) return;

    // Verificar si ya existe un cierre de caja para esta fecha
    const yaExiste = history.some(c => c.fecha === fecha);
    if (yaExiste) {
      alert(`Ya existe un cierre de caja registrado para el día ${fecha}. Solo está permitido un cierre de caja por fecha.`);
      return;
    }

    setIsSubmitting(true);

    const cleanNum = (valStr: string) => {
      const cleaned = valStr.replace(/\D/g, "");
      return Number(cleaned) || 0;
    };

    try {
      const payload = {
        fecha,
        colaboradorNombre: colaboradorNombre.trim(),
        efectivoCierre: cleanNum(efectivo),
        datafonoCierre: cleanNum(datafono),
        justoCierre: cleanNum(justo),
        rappiCierre: cleanNum(rappi),
        transferenciasCierre: cleanNum(transferencias),
        propinas: cleanNum(propinas),
        novedades: novedades.trim(),
        estado: "Pendiente por Cuadrar" as const,
        liderNombre: liderNombre.trim() || username,
        auxiliaresNombres: selectedAuxiliares,
        // POS values initially 0 (to be loaded by Admin via POS report PDF upload)
        efectivoPOS: 0,
        tarjetasPOS: 0,
        justoPOS: 0,
        rappiPOS: 0,
        transferenciasPOS: 0,
        posFileName: "",
      };

      const result = await dbAdapter.saveCierre(payload);
      setSuccessData(result);
      fetchHistory(); // Actualizar el historial de inmediato
      
      // Limpiar formulario
      setEfectivo("");
      setDatafono("");
      setJusto("0");
      setRappi("0");
      setTransferencias("0");
      setPropinas("");
      setNovedades("");
    } catch (error: any) {
      console.error("Error al guardar cierre de caja:", error);
      alert(error?.message || "Hubo un error al guardar el cierre en la base de datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSuccessData(null);
    setFecha(getTodayString());
    setSelectedAuxiliares([]);
    if (role === "Lider de punto") {
      setLiderNombre(username);
    } else if (localRegisteredUsers.leaders.length > 0) {
      setLiderNombre(localRegisteredUsers.leaders[0].nombre);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink flex flex-col selection:bg-brand-ink/10 relative">
      {/* Dynamic technical clean line pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 pointer-events-none z-0" />

      {/* Barra de Navegación del Colaborador */}
      <header className="bg-white border-b-2 border-brand-ink py-3 px-6 flex items-center justify-between shadow-sm relative z-10">
        <div className="flex items-center space-x-4">
          <div className="bg-white border-2 border-brand-ink p-1.5 shadow-[2px_2px_0px_0px_#1C1917]">
            <Logo size="sm" className="text-brand-ink" />
          </div>
          <div>
            <p className="text-[9px] text-brand-ink/60 uppercase font-black tracking-[0.15em] leading-none mb-1">
              Módulo Colaborador
            </p>
            <h1 className="text-sm font-black tracking-widest uppercase text-brand-ink leading-none">
              SIMULADOR DE INGESTA
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs text-brand-ink font-black uppercase tracking-wide">{username}</span>
            <span className="text-[9px] font-black text-brand-ink/50 uppercase">Rol: Colaborador (Tienda)</span>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-1.5 bg-brand-ink hover:bg-black text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-[2px_2px_0px_0px_#D4D4D8]"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col justify-start relative z-10">
        
        {/* Selector de Pestañas Neo-Brutalistas */}
        <div className="flex flex-col sm:flex-row bg-white border-2 border-brand-ink p-1.5 shadow-[4px_4px_0px_0px_#1C1917] mb-6 relative z-10 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("register");
              setSuccessData(null); // Al volver a registrar, limpiamos el estado de éxito previo si existía
            }}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center space-x-2 ${
              activeTab === "register" ? "bg-brand-ink text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]" : "text-brand-ink hover:bg-zinc-100"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Cierre de Caja</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              fetchHistory();
            }}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center space-x-2 ${
              activeTab === "history" ? "bg-brand-ink text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]" : "text-brand-ink hover:bg-zinc-100"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Cierres</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("password");
            }}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center space-x-2 ${
              activeTab === "password" ? "bg-brand-ink text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]" : "text-brand-ink hover:bg-zinc-100"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Cambiar Contraseña</span>
          </button>
        </div>

        {activeTab === "history" ? (
          /* Vista de Historial */
          <div className="bg-white border-2 border-brand-ink shadow-[6px_6px_0px_0px_#1C1917]">
            {/* Cabecera de Historial con Filtros */}
            <div className="border-b-2 border-brand-ink p-6 bg-brand-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-brand-ink uppercase tracking-tight">Historial de Cierres de Caja</h2>
                <p className="text-xs text-brand-ink/70 mt-1 font-semibold">
                  {canSeeAllTeam 
                    ? "Consulta el registro histórico de los cierres realizados por el equipo y su estado de auditoría."
                    : "Consulta el registro histórico de tus cierres de caja realizados y su estado de auditoría."}
                </p>
              </div>

              {/* Filtro de Usuario */}
              {canSeeAllTeam ? (
                <div className="flex bg-white border-2 border-brand-ink p-1 self-stretch sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFilterUser("me")}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                      filterUser === "me" ? "bg-brand-ink text-white" : "text-brand-ink hover:bg-zinc-100"
                    }`}
                  >
                    Mis Cierres
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterUser("all")}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                      filterUser === "all" ? "bg-brand-ink text-white" : "text-brand-ink hover:bg-zinc-100"
                    }`}
                  >
                    Todo el Equipo
                  </button>
                </div>
              ) : (
                <div className="bg-brand-ink text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-2 border-brand-ink self-start sm:self-auto shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]">
                  Mis Cierres
                </div>
              )}
            </div>

            {/* Contenido de Historial */}
            <div className="p-6">
              {isLoadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-brand-ink/40">
                  <Loader2 className="w-8 h-8 animate-spin stroke-2 mb-2 text-brand-ink" />
                  <span className="text-xs font-black uppercase tracking-widest">Cargando historial...</span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-brand-ink/40 border-2 border-dashed border-zinc-200">
                  <Clock className="w-10 h-10 mb-3 stroke-1.5" />
                  <h3 className="text-sm font-black text-brand-ink uppercase tracking-wider">No se encontraron cierres</h3>
                  <p className="text-xs text-brand-ink/60 mt-1 max-w-sm">
                    {filterUser === "me" 
                      ? "Aún no has registrado ningún cierre de caja con tu usuario." 
                      : "No hay cierres de caja registrados en el sistema para mostrar."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHistory.map((c) => {
                    const isExpanded = expandedId === c.id;
                    const totalCierre = (c.efectivoCierre || 0) + (c.datafonoCierre || 0) + (c.justoCierre || 0) + (c.rappiCierre || 0) + (c.transferenciasCierre || 0);
                    
                    return (
                      <div 
                        key={c.id} 
                        className={`border-2 border-brand-ink bg-white transition-all ${
                          isExpanded ? "shadow-[4px_4px_0px_0px_#1C1917]" : "hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#1C1917]"
                        }`}
                      >
                        {/* Cabecera del Item */}
                        <div 
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-brand-bg transition-colors"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Fecha */}
                            <div className="bg-brand-ink text-white px-2.5 py-1 text-xs font-mono font-black border border-brand-ink">
                              {c.fecha}
                            </div>
                            {/* Responsable */}
                            <div className="text-xs font-bold text-brand-ink flex items-center space-x-1">
                              <span className="text-brand-ink/50 uppercase text-[9px] font-black tracking-wider">Por:</span>
                              <span className="font-black uppercase">{c.colaboradorNombre || "Sin nombre"}</span>
                            </div>
                            {/* Estado Badge */}
                            {c.estado === "Cuadrado" ? (
                              <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-50 border border-emerald-600 text-emerald-800">
                                <Check className="w-3 h-3 mr-1 stroke-[3]" />
                                Cuadrado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-50 border border-amber-500 text-amber-700">
                                <Clock className="w-3 h-3 mr-1 stroke-[3]" />
                                Pendiente por Auditar
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between w-full sm:w-auto sm:space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100">
                            <div className="text-right">
                              <span className="block text-[8px] font-black text-brand-ink/50 uppercase tracking-widest leading-none mb-1">Total Reportado</span>
                              <span className="font-mono font-black text-xs text-brand-ink leading-none">{formatCOP(String(totalCierre))}</span>
                            </div>
                            <div className="text-brand-ink/60">
                              {isExpanded ? <ChevronUp className="w-4 h-4 stroke-[2.5]" /> : <ChevronDown className="w-4 h-4 stroke-[2.5]" />}
                            </div>
                          </div>
                        </div>

                        {/* Detalle Desplegable */}
                        {isExpanded && (
                          <div className="border-t-2 border-brand-ink bg-zinc-50 p-4 sm:p-6 space-y-5">
                            {/* Desglose de Canales */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Lado Reporte Físico */}
                              <div className="bg-white border border-brand-ink p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-ink border-b border-brand-ink pb-1.5 mb-3">
                                  Arqueo Físico Reportado
                                </h4>
                                <div className="space-y-2 text-xs font-medium text-brand-ink">
                                  <div className="flex justify-between">
                                    <span className="text-brand-ink/60 uppercase text-[10px]">Efectivo:</span>
                                    <span className="font-mono font-bold">{formatCOP(String(c.efectivoCierre))}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-brand-ink/60 uppercase text-[10px]">Datáfono / Vouchers:</span>
                                    <span className="font-mono font-bold">{formatCOP(String(c.datafonoCierre))}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-brand-ink/60 uppercase text-[10px]">Justo App:</span>
                                    <span className="font-mono font-bold">{formatCOP(String(c.justoCierre))}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-brand-ink/60 uppercase text-[10px]">Rappi App:</span>
                                    <span className="font-mono font-bold">{formatCOP(String(c.rappiCierre))}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-brand-ink/60 uppercase text-[10px]">Transferencias:</span>
                                    <span className="font-mono font-bold">{formatCOP(String(c.transferenciasCierre))}</span>
                                  </div>
                                  <div className="border-t border-dashed border-zinc-200 pt-1.5 flex justify-between font-black">
                                    <span className="uppercase text-[10px]">Propinas Recibidas:</span>
                                    <span className="font-mono">{formatCOP(String(c.propinas))}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Lado Auditoría / POS */}
                              <div className="bg-white border border-brand-ink p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                                <div>
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-ink border-b border-brand-ink pb-1.5 mb-3 flex justify-between items-center">
                                    <span>Auditoría de Ventas</span>
                                    {c.estado === "Cuadrado" && (
                                      <span className="text-[8px] bg-emerald-100 text-emerald-800 border border-emerald-500 px-1.5 py-0.2">Aprobado</span>
                                    )}
                                  </h4>

                                  {c.estado === "Cuadrado" ? (
                                    <div className="space-y-2 text-xs font-medium text-brand-ink">
                                      {/* Comparaciones con discrepancias */}
                                      <div className="flex justify-between items-center">
                                        <span className="text-brand-ink/60 uppercase text-[10px]">Efectivo POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-mono font-bold block">{formatCOP(String(c.efectivoPOS))}</span>
                                          <span className={`text-[9px] font-black font-mono uppercase ${
                                            (c.difEfectivo || 0) === 0 ? "text-emerald-600" : (c.difEfectivo || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difEfectivo || 0) === 0 ? "Sin dif." : `${(c.difEfectivo || 0) > 0 ? "+" : ""}${formatCOP(String(c.difEfectivo))}`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center">
                                        <span className="text-brand-ink/60 uppercase text-[10px]">Datáfono POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-mono font-bold block">{formatCOP(String(c.tarjetasPOS))}</span>
                                          <span className={`text-[9px] font-black font-mono uppercase ${
                                            (c.difTarjetas || 0) === 0 ? "text-emerald-600" : (c.difTarjetas || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difTarjetas || 0) === 0 ? "Sin dif." : `${(c.difTarjetas || 0) > 0 ? "+" : ""}${formatCOP(String(c.difTarjetas))}`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center">
                                        <span className="text-brand-ink/60 uppercase text-[10px]">Justo POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-mono font-bold block">{formatCOP(String(c.justoPOS))}</span>
                                          <span className={`text-[9px] font-black font-mono uppercase ${
                                            (c.difJusto || 0) === 0 ? "text-emerald-600" : (c.difJusto || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difJusto || 0) === 0 ? "Sin dif." : `${(c.difJusto || 0) > 0 ? "+" : ""}${formatCOP(String(c.difJusto))}`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center">
                                        <span className="text-brand-ink/60 uppercase text-[10px]">Rappi POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-mono font-bold block">{formatCOP(String(c.rappiPOS))}</span>
                                          <span className={`text-[9px] font-black font-mono uppercase ${
                                            (c.difRappi || 0) === 0 ? "text-emerald-600" : (c.difRappi || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difRappi || 0) === 0 ? "Sin dif." : `${(c.difRappi || 0) > 0 ? "+" : ""}${formatCOP(String(c.difRappi))}`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center">
                                        <span className="text-brand-ink/60 uppercase text-[10px]">Transf. POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-mono font-bold block">{formatCOP(String(c.transferenciasPOS))}</span>
                                          <span className={`text-[9px] font-black font-mono uppercase ${
                                            (c.difTransferencias || 0) === 0 ? "text-emerald-600" : (c.difTransferencias || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difTransferencias || 0) === 0 ? "Sin dif." : `${(c.difTransferencias || 0) > 0 ? "+" : ""}${formatCOP(String(c.difTransferencias))}`}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center bg-zinc-50 border border-dashed border-zinc-200">
                                      <AlertTriangle className="w-5 h-5 text-amber-500 mb-2 stroke-2" />
                                      <p className="text-[10px] text-brand-ink font-bold uppercase tracking-wider mb-1">Pendiente de revisión</p>
                                      <p className="text-[9px] text-brand-ink/60 font-semibold leading-relaxed">
                                        El Gerente debe subir el reporte POS correspondiente para auditar y calcular las diferencias de este día.
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {c.estado === "Cuadrado" && (
                                  <div className="mt-4 pt-3 border-t border-dashed border-zinc-200 text-[9px] text-brand-ink/60 font-bold uppercase tracking-wide space-y-0.5">
                                    <div><span className="font-black text-brand-ink">Auditado por:</span> {c.auditadoPor}</div>
                                    {c.auditadoAt && (
                                      <div><span className="font-black text-brand-ink">Fecha:</span> {new Date(c.auditadoAt).toLocaleDateString()} {new Date(c.auditadoAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Novedades reportadas */}
                            {c.novedades && (
                              <div className="bg-white border border-brand-ink p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-ink/50 mb-2">Novedades reportadas del turno</h4>
                                <p className="text-xs font-semibold text-brand-ink italic bg-zinc-50 p-2.5 border border-zinc-100">
                                  "{c.novedades}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "password" ? (
          /* Vista de Cambiar Contraseña */
          <div className="bg-white border-2 border-brand-ink shadow-[6px_6px_0px_0px_#1C1917] max-w-lg mx-auto">
            <div className="border-b-2 border-brand-ink p-6 bg-brand-bg flex items-center space-x-3">
              <Key className="w-6 h-6 text-brand-ink" />
              <div>
                <h2 className="text-xl font-black text-brand-ink uppercase tracking-tight">Cambiar Mi Contraseña</h2>
                <p className="text-xs text-brand-ink/70 font-semibold">
                  Actualiza tu contraseña para mantener la seguridad de tu acceso.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="p-6 space-y-5">
              {passwordError && (
                <div className="bg-red-50 border-2 border-brand-danger p-3 text-brand-danger text-xs font-black flex items-center space-x-2 animate-[shake_0.4s_ease-in-out]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-emerald-50 border-2 border-brand-success p-3 text-brand-success text-xs font-black flex items-center space-x-2 animate-[scale_0.2s_ease-out]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Contraseña Actual */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-ink/75 block">
                  Contraseña Actual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border-2 border-brand-ink px-3 py-2.5 text-xs font-bold text-brand-ink outline-none tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink/50 hover:text-brand-ink cursor-pointer focus:outline-none"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nueva Contraseña */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-ink/75 block">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 3 caracteres"
                    className="w-full bg-white border-2 border-brand-ink px-3 py-2.5 text-xs font-bold text-brand-ink outline-none tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink/50 hover:text-brand-ink cursor-pointer focus:outline-none"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Nueva Contraseña */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-ink/75 block">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirmNewPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita la nueva contraseña"
                    className="w-full bg-white border-2 border-brand-ink px-3 py-2.5 text-xs font-bold text-brand-ink outline-none tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPass(!showConfirmNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink/50 hover:text-brand-ink cursor-pointer focus:outline-none"
                  >
                    {showConfirmNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full bg-brand-ink hover:bg-black text-white text-xs font-black uppercase tracking-wider py-3.5 border-2 border-brand-ink shadow-[3px_3px_0px_0px_#D4D4D8] transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Actualizando...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Actualizar Contraseña</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : successData ? (
          /* Vista de Éxito */
          <div className="bg-white border-2 border-brand-ink p-8 text-center max-w-lg mx-auto shadow-[6px_6px_0px_0px_#1C1917]">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-success/10 border-2 border-brand-success text-brand-success mb-6">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            
            <h2 className="text-2xl font-black text-brand-ink uppercase tracking-tight mb-2">
              ¡Cierre Guardado!
            </h2>
            <p className="text-brand-ink/70 text-sm mb-6 font-medium">
              El cierre de caja del día <strong className="text-brand-ink font-black">{successData.fecha}</strong> ha sido cargado con estado <strong className="text-brand-info font-black">"Pendiente por Cuadrar"</strong> para revisión del Gerente.
            </p>

            {/* Resumen Cargado */}
            <div className="bg-brand-bg rounded-none p-5 border-2 border-brand-ink text-left space-y-3 mb-8">
              <h3 className="text-xs font-black text-brand-ink uppercase tracking-widest border-b-2 border-brand-ink pb-2">
                Resumen del Arqueo Físico
              </h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-brand-ink/60 font-bold uppercase text-[11px] tracking-wider">Responsable:</span>
                <span className="text-right font-black text-brand-ink">{successData.colaboradorNombre || "N/A"}</span>

                <span className="text-brand-ink/60 font-bold uppercase text-[11px] tracking-wider">Líder del Turno:</span>
                <span className="text-right font-black text-brand-ink">{successData.liderNombre || "N/A"}</span>

                {successData.auxiliaresNombres && successData.auxiliaresNombres.length > 0 && (
                  <>
                    <span className="text-brand-ink/60 font-bold uppercase text-[11px] tracking-wider">Auxiliares:</span>
                    <span className="text-right font-black text-brand-ink">{successData.auxiliaresNombres.join(", ")}</span>
                  </>
                )}

                <span className="text-brand-ink/60 font-bold uppercase text-[11px] tracking-wider">Efectivo:</span>
                <span className="text-right font-mono font-black text-brand-ink">{formatCOP(String(successData.efectivoCierre))}</span>
                
                <span className="text-brand-ink/60 font-bold uppercase text-[11px] tracking-wider">Datáfono:</span>
                <span className="text-right font-mono font-black text-brand-ink">{formatCOP(String(successData.datafonoCierre))}</span>
                
                <span className="text-brand-ink/60 font-bold uppercase text-[11px] tracking-wider">Justo App:</span>
                <span className="text-right font-mono font-black text-brand-ink">{formatCOP(String(successData.justoCierre))}</span>
                
                <span className="text-brand-ink/60 font-bold uppercase text-[11px] tracking-wider">Rappi App:</span>
                <span className="text-right font-mono font-black text-brand-ink">{formatCOP(String(successData.rappiCierre))}</span>

                <span className="text-brand-ink/60 font-bold uppercase text-[11px] tracking-wider">Transferencias:</span>
                <span className="text-right font-mono font-black text-brand-ink">{formatCOP(String(successData.transferenciasCierre))}</span>
                
                <div className="col-span-2 border-t border-brand-ink my-1"></div>

                <span className="text-brand-ink font-black uppercase text-[11px] tracking-wider">Propinas (Incr.):</span>
                <span className="text-right font-mono font-black text-brand-ink">{formatCOP(String(successData.propinas))}</span>
                
                <span className="text-brand-success font-black uppercase text-[12px] tracking-wider">Flujo Total Recibido:</span>
                <span className="text-right font-mono font-black text-brand-success">
                  {formatCOP(String(successData.efectivoCierre + successData.datafonoCierre + successData.justoCierre + successData.rappiCierre + successData.transferenciasCierre + successData.propinas))}
                </span>
              </div>
            </div>

            <button
              onClick={handleResetForm}
              className="px-6 py-3 bg-brand-ink hover:bg-black text-white font-black uppercase tracking-wider text-xs inline-flex items-center space-x-2 cursor-pointer border-2 border-brand-ink shadow-[3px_3px_0px_0px_#D4D4D8] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_#D4D4D8] transition-all"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              <span>Registrar Otro Cierre</span>
            </button>
          </div>
        ) : (
          /* Formulario de Ingesta */
          <div className="bg-white border-2 border-brand-ink shadow-[6px_6px_0px_0px_#1C1917]">
            <div className="border-b-2 border-brand-ink p-6 bg-brand-bg">
              <h2 className="text-2xl font-black text-brand-ink uppercase tracking-tight">Formulario de Cierre Diario</h2>
              <p className="text-xs text-brand-ink/70 mt-1 font-semibold">
                Ingrese con precisión todos los arqueos físicos medidos al finalizar el turno.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Fecha */}
                <div className="col-span-1">
                  <label className="block text-xs font-black text-brand-ink uppercase tracking-widest mb-1.5">
                    Fecha del Turno
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-ink/50">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 bg-white border-2 text-brand-ink text-sm font-semibold focus:bg-brand-bg outline-none ${
                        history.some(c => c.fecha === fecha) ? "border-brand-accent" : "border-brand-ink"
                      }`}
                    />
                  </div>
                  {history.some(c => c.fecha === fecha) && (
                    <div className="mt-2 flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-brand-accent" />
                      <span>Ya existe un cierre registrado para este día</span>
                    </div>
                  )}
                </div>

                {/* Persona que realiza el cierre */}
                <div className="col-span-1">
                  <label className="block text-xs font-black text-brand-ink uppercase tracking-widest mb-1.5 flex items-center justify-between">
                    <span>Responsable del Cierre</span>
                    <span className="text-[9px] text-brand-accent font-black uppercase">Obligatorio</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-ink/50">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Nombre de quien cierra"
                      value={colaboradorNombre}
                      onChange={(e) => setColaboradorNombre(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-brand-ink text-brand-ink text-sm font-semibold focus:bg-brand-bg outline-none"
                    />
                  </div>
                </div>

                {/* Equipo del Turno */}
                <div className="col-span-1 md:col-span-2 bg-zinc-50 border-2 border-brand-ink p-4 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-brand-ink/20 pb-2">
                    <Users className="w-5 h-5 text-brand-ink" />
                    <div>
                      <h3 className="text-xs font-black text-brand-ink uppercase tracking-wider">Equipo de Trabajo del Turno</h3>
                      <p className="text-[10px] text-brand-ink/60 font-semibold uppercase">Establece el personal que laboró en {local}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Líder de Punto */}
                    <div>
                      <label className="block text-xs font-black text-brand-ink uppercase tracking-widest mb-1.5 flex items-center justify-between">
                        <span>Líder de Punto a Cargo</span>
                        <span className="text-[9px] text-brand-accent font-black uppercase">Obligatorio</span>
                      </label>
                      <div className="relative">
                        <select
                          value={liderNombre}
                          onChange={(e) => setLiderNombre(e.target.value)}
                          className="w-full pl-3 pr-10 py-2.5 bg-white border-2 border-brand-ink text-brand-ink text-sm font-semibold focus:bg-brand-bg outline-none cursor-pointer appearance-none"
                        >
                          {localRegisteredUsers.leaders.map((leader) => (
                            <option key={leader.nombre} value={leader.nombre}>
                              {leader.nombre}
                            </option>
                          ))}
                          {localRegisteredUsers.leaders.length === 0 && (
                            <option value={username}>{username} (Tú)</option>
                          )}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-ink border-l-2 border-brand-ink bg-zinc-100">
                          <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      </div>
                    </div>

                    {/* Auxiliares de Venta */}
                    <div>
                      <label className="block text-xs font-black text-brand-ink uppercase tracking-widest mb-1.5">
                        Auxiliares del Turno (Seleccionar de la lista)
                      </label>
                      
                      {localRegisteredUsers.assistants.length === 0 ? (
                        <div className="bg-white p-3 border-2 border-dashed border-zinc-200 text-center rounded-none">
                          <p className="text-[10px] text-brand-ink/50 uppercase font-bold italic">
                            No hay auxiliares registrados en el local {local}
                          </p>
                          <p className="text-[9px] text-brand-ink/40 font-semibold mt-1">
                            Registra auxiliares en la pantalla de inicio con local "{local}" para que aparezcan aquí.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-white border-2 border-brand-ink max-h-32 overflow-y-auto p-2 space-y-1.5">
                          {localRegisteredUsers.assistants.map((assistant) => {
                            const isSelected = selectedAuxiliares.includes(assistant.nombre);
                            return (
                              <button
                                type="button"
                                key={assistant.nombre}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedAuxiliares(selectedAuxiliares.filter(name => name !== assistant.nombre));
                                  } else {
                                    setSelectedAuxiliares([...selectedAuxiliares, assistant.nombre]);
                                  }
                                }}
                                className={`w-full flex items-center justify-between p-2 text-xs font-bold uppercase transition-all border ${
                                  isSelected 
                                    ? "bg-brand-accent/20 border-brand-ink text-brand-ink font-black" 
                                    : "bg-white border-zinc-200 text-brand-ink/70 hover:bg-zinc-50"
                                }`}
                              >
                                <span>{assistant.nombre}</span>
                                <div className={`w-4 h-4 border-2 flex items-center justify-center ${
                                  isSelected ? "bg-brand-ink border-brand-ink" : "border-zinc-300"
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Efectivo */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-black text-brand-ink uppercase tracking-widest">
                      Efectivo en Caja (Cierre)
                    </label>
                    <span className="text-[10px] text-brand-ink font-black font-mono bg-brand-bg px-1.5 py-0.5 border border-brand-accent">{formatCOP(efectivo)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-ink/50">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={efectivo}
                      onChange={handleNumericChange(setEfectivo)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-brand-ink text-brand-ink text-sm font-mono focus:bg-brand-bg outline-none"
                    />
                  </div>
                </div>

                {/* Datáfono */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-black text-brand-ink uppercase tracking-widest">
                      Tarjetas / Datáfono (Vouchers)
                    </label>
                    <span className="text-[10px] text-brand-ink font-black font-mono bg-brand-bg px-1.5 py-0.5 border border-brand-accent">{formatCOP(datafono)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-ink/50">
                      <CreditCard className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={datafono}
                      onChange={handleNumericChange(setDatafono)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-brand-ink text-brand-ink text-sm font-mono focus:bg-brand-bg outline-none"
                    />
                  </div>
                </div>

                {/* Justo */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-black text-brand-ink uppercase tracking-widest flex items-center space-x-1">
                      <span>Cierre Justo App</span>
                      <span className="text-[9px] bg-brand-accent/20 text-brand-ink px-1 py-0.5 border border-brand-ink/20 font-black font-sans">POS</span>
                    </label>
                    <span className="text-[10px] text-brand-ink font-black font-mono bg-brand-bg px-1.5 py-0.5 border border-brand-accent">{formatCOP(justo)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-ink/40">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      readOnly
                      placeholder="0"
                      value={justo}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 border-2 border-brand-ink/50 text-brand-ink text-sm font-black font-mono cursor-not-allowed outline-none border-dashed"
                    />
                  </div>
                  <p className="text-[9px] text-brand-ink/50 mt-1 font-bold">
                    * Este espacio se llenará con reporte de POS.
                  </p>
                </div>

                {/* Rappi */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-black text-brand-ink uppercase tracking-widest flex items-center space-x-1">
                      <span>Cierre Rappi App</span>
                      <span className="text-[9px] bg-brand-accent/20 text-brand-ink px-1 py-0.5 border border-brand-ink/20 font-black font-sans">POS</span>
                    </label>
                    <span className="text-[10px] text-brand-ink font-black font-mono bg-brand-bg px-1.5 py-0.5 border border-brand-accent">{formatCOP(rappi)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-ink/40">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      readOnly
                      placeholder="0"
                      value={rappi}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 border-2 border-brand-ink/50 text-brand-ink text-sm font-black font-mono cursor-not-allowed outline-none border-dashed"
                    />
                  </div>
                  <p className="text-[9px] text-brand-ink/50 mt-1 font-bold">
                    * Este espacio se llenará con reporte de POS.
                  </p>
                </div>

                {/* Transferencias */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-black text-brand-ink uppercase tracking-widest flex items-center space-x-1">
                      <span>Transferencias (POS)</span>
                      <span className="text-[9px] bg-brand-accent/20 text-brand-ink px-1 py-0.5 border border-brand-ink/20 font-black font-sans">POS</span>
                    </label>
                    <span className="text-[10px] text-brand-ink font-black font-mono bg-brand-bg px-1.5 py-0.5 border border-brand-accent">{formatCOP(transferencias)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-ink/40">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      readOnly
                      placeholder="0"
                      value={transferencias}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 border-2 border-brand-ink/50 text-brand-ink text-sm font-black font-mono cursor-not-allowed outline-none border-dashed"
                    />
                  </div>
                  <p className="text-[9px] text-brand-ink/50 mt-1 font-bold">
                    * Este espacio se llenará con reporte de POS.
                  </p>
                </div>

                {/* Propinas */}
                <div className="col-span-1 md:col-span-2 bg-brand-bg p-4 border-2 border-brand-ink">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <label className="text-xs font-black text-brand-ink uppercase tracking-widest flex items-center space-x-1.5">
                        <span>Propinas Recibidas del Día</span>
                      </label>
                      <p className="text-[10px] text-brand-ink/60 mt-0.5 font-bold uppercase">
                        Este valor entra al arqueo general pero se audita de manera independiente.
                      </p>
                    </div>
                    <span className="text-xs text-brand-ink font-black font-mono bg-white px-2 py-1 border border-brand-accent">{formatCOP(propinas)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-ink/40">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={propinas}
                      onChange={handleNumericChange(setPropinas)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-brand-ink text-brand-ink text-sm font-mono focus:bg-brand-bg outline-none"
                    />
                  </div>
                </div>

                {/* Novedades */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-black text-brand-ink uppercase tracking-widest mb-1.5">
                    Novedades u Observaciones del Turno
                  </label>
                  <div className="relative">
                    <span className="absolute top-3 left-3 text-brand-ink/50">
                      <FileText className="w-4 h-4" />
                    </span>
                    <textarea
                      required
                      rows={3}
                      placeholder="Escriba los pormenores del turno, novedades en caja, fallas en datáfono o explicaciones de discrepancias si las conoce..."
                      value={novedades}
                      onChange={(e) => setNovedades(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-brand-ink text-brand-ink text-sm font-semibold focus:bg-brand-bg outline-none resize-none"
                    />
                  </div>
                </div>

              </div>

              <div className="border-t-2 border-brand-ink pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-brand-ink hover:bg-black text-white font-black uppercase tracking-widest text-xs cursor-pointer disabled:opacity-50 border-2 border-brand-ink shadow-[3px_3px_0px_0px_#D4D4D8] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_#D4D4D8] transition-all flex items-center space-x-2"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>{isSubmitting ? "Enviando..." : "Guardar Cierre de Caja"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
