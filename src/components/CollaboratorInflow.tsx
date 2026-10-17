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
  EyeOff,
  Package,
  ClipboardCheck,
  Pencil,
  Home,
  TrendingUp,
  Store,
  LogOut,
  MoreHorizontal,
  X
} from "lucide-react";
import { dbAdapter } from "../db/dbAdapter";
import { api } from "../lib/api";
import { CierreCaja } from "../types";
import Logo from "./Logo";
import InventoryClosure from "./InventoryClosure";
import OperationalChecklist from "./OperationalChecklist";
import { todayBogota } from "../lib/dates";
import { esLiderOperador, esCargoPasteleria } from "../lib/metricasEquipo";
import type { SeccionColaborador } from "./colaborador/types";
import MiDia from "./colaborador/MiDia";
import MiDesempeno from "./colaborador/MiDesempeno";
import PanelPunto from "./colaborador/PanelPunto";
import MisDesprendibles from "./colaborador/MisDesprendibles";
import Avisos from "./colaborador/Avisos";

// Configure PDF.js worker

interface CollaboratorInflowProps {
  onLogout: () => void;
  username: string;
  role?: string;
  local?: string;
}

export default function CollaboratorInflow({ onLogout, username, role = "colaborador", local = "Chapinero" }: CollaboratorInflowProps) {
  // Configurar la fecha predeterminada como el día actual en formato YYYY-MM-DD (hora de Bogotá)
  const getTodayString = () => todayBogota();

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



  const isLeaderRole = role === "Líder operador" || role === "Lider operador" || role === "Lider de punto" || (role && role.toLowerCase().includes("lider"));

  // States for team selection of the shift
  const [liderNombre, setLiderNombre] = useState(isLeaderRole ? username : "");
  const [selectedAuxiliares, setSelectedAuxiliares] = useState<string[]>([]);

  const [teamMemberList, setTeamMemberList] = useState<any[]>([]);

  useEffect(() => {
    dbAdapter.getTeamMembers(local).then((members) => {
      setTeamMemberList(members);
    }).catch((err) => {
      console.error("Error al cargar equipo en CollaboratorInflow:", err);
    });
  }, [local]);

  // Computed registered users from the same local
  const localRegisteredUsers = useMemo(() => {
    const leaders = teamMemberList.filter(u => {
      const c = (u.cargo || u.role || "").toLowerCase();
      return c.includes("lider operador") || c.includes("líder operador") || (c.includes("lider") && !c.includes("pasteler"));
    });

    const assistants = teamMemberList.filter(u => {
      const c = (u.cargo || u.role || "").toLowerCase();
      return !c.includes("geren") && !c.includes("admin") && !leaders.some(l => l.nombre === u.nombre);
    });

    return { leaders, assistants };
  }, [teamMemberList]);

  // Set initial liderNombre based on roles and available leaders
  useEffect(() => {
    if (isLeaderRole) {
      setLiderNombre(username);
    } else if (localRegisteredUsers.leaders.length > 0) {
      setLiderNombre(localRegisteredUsers.leaders[0].nombre);
    }
  }, [isLeaderRole, username, localRegisteredUsers.leaders]);

  const [activeTab, setActiveTab] = useState<SeccionColaborador>("inicio");
  const [masAbierto, setMasAbierto] = useState(false);
  const esLiderOp = esLiderOperador(role);
  const esPasteleria = esCargoPasteleria(role);

  // Pastelería no maneja caja: su día empieza por checklist e inventario.
  const navItems = useMemo(() => {
    const item = (id: SeccionColaborador, label: string, icon: React.ReactNode) => ({ id, label, icon });
    const inicio = item("inicio", "Inicio", <Home className="w-4 h-4" />);
    const caja = item("register", "Cierre de caja", <PlusCircle className="w-4 h-4" />);
    const checklist = item("checklist", "Checklist", <ClipboardCheck className="w-4 h-4" />);
    const inventario = item("inventory", "Inventario", <Package className="w-4 h-4" />);
    const desempeno = item("desempeno", "Mi desempeño", <TrendingUp className="w-4 h-4" />);
    const punto = item("punto", "Punto", <Store className="w-4 h-4" />);
    const desprendibles = item("desprendibles", "Desprendibles", <FileText className="w-4 h-4" />);
    const seguridad = item("password", "Seguridad", <Lock className="w-4 h-4" />);
    return esPasteleria
      ? [inicio, checklist, inventario, desempeno, caja, desprendibles, seguridad]
      : [inicio, caja, checklist, desempeno, ...(esLiderOp ? [punto] : []), inventario, desprendibles, seguridad];
  }, [esPasteleria, esLiderOp]);
  // Los paneles de métricas usan el ancho de pantallas grandes; los formularios conservan su ancho de lectura.
  const vistaAncha = activeTab === "inicio" || activeTab === "desempeno" || activeTab === "punto";
  const navPrincipal = navItems.slice(0, 4);
  const navMas = navItems.slice(4);
  const [cajaSubTab, setCajaSubTab] = useState<"form" | "history">("form");
  const [history, setHistory] = useState<CierreCaja[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<"me" | "all">("me");
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEditingCierre = (cierre: CierreCaja) => {
    if (cierre.estado === "Cuadrado") {
      alert("Este cierre de caja ya ha sido auditado y conciliado ('Cuadrado'), por lo cual no puede ser modificado.");
      return;
    }
    setEditingId(cierre.id);
    setFecha(cierre.fecha);
    setColaboradorNombre(cierre.colaboradorNombre || username);
    setLiderNombre(cierre.liderNombre || username);
    setSelectedAuxiliares(cierre.auxiliaresNombres || []);
    setEfectivo(cierre.efectivoCierre ? new Intl.NumberFormat("es-CO").format(cierre.efectivoCierre) : "");
    setDatafono(cierre.datafonoCierre ? new Intl.NumberFormat("es-CO").format(cierre.datafonoCierre) : "");
    setJusto(cierre.justoCierre ? new Intl.NumberFormat("es-CO").format(cierre.justoCierre) : "0");
    setRappi(cierre.rappiCierre ? new Intl.NumberFormat("es-CO").format(cierre.rappiCierre) : "0");
    setTransferencias(cierre.transferenciasCierre ? new Intl.NumberFormat("es-CO").format(cierre.transferenciasCierre) : "0");
    setPropinas(cierre.propinas ? new Intl.NumberFormat("es-CO").format(cierre.propinas) : "");
    setNovedades(cierre.novedades || "");
    setSuccessData(null);
    setActiveTab("register");
    setCajaSubTab("form");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFecha(getTodayString());
    setEfectivo("");
    setDatafono("");
    setJusto("0");
    setRappi("0");
    setTransferencias("0");
    setPropinas("");
    setNovedades("");
  };

  const existingClosureForSelectedDate = useMemo(() => {
    return history.find(c => c.fecha === fecha && c.id !== editingId);
  }, [history, fecha, editingId]);

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

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Por favor completa todos los campos.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await api("/api/auth/change-password", {
        method: "POST",
        json: { currentPassword, newPassword },
      });
      setPasswordSuccess("¡Contraseña actualizada! Utiliza tu nueva contraseña en tu próximo inicio de sesión.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err?.message || "Error al actualizar contraseña");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const canSeeAllTeam = isLeaderRole || role === "colaborador";

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await dbAdapter.getCierres(local);
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

    // Verificar si ya existe un cierre de caja para esta fecha (si no estamos editando)
    const closureForDate = history.find(c => c.fecha === fecha);
    if (closureForDate && closureForDate.id !== editingId) {
      alert(`Ya existe un cierre de caja registrado para el día ${fecha}. Si necesita corregirlo, puede editar el cierre existente.`);
      return;
    }

    setIsSubmitting(true);

    const cleanNum = (valStr: string) => {
      const cleaned = valStr.replace(/\D/g, "");
      return Number(cleaned) || 0;
    };

    try {
      // Buscar colaborador en la lista del equipo cargada para proveer colaborador_id
      const cleanNom = colaboradorNombre.trim().toLowerCase();
      const matchedMember = teamMemberList.find((m: any) => {
        const nom = (m.nombre || "").toLowerCase();
        const em = (m.email || "").toLowerCase();
        return nom === cleanNom || (cleanNom.length >= 3 && (nom.includes(cleanNom) || cleanNom.includes(nom) || em.includes(cleanNom)));
      });

      const payload = {
        fecha,
        colaboradorNombre: colaboradorNombre.trim(),
        colaboradorId: matchedMember?.id,
        colaborador_id: matchedMember?.id,
        efectivoCierre: cleanNum(efectivo),
        datafonoCierre: cleanNum(datafono),
        justoCierre: cleanNum(justo),
        rappiCierre: cleanNum(rappi),
        transferenciasCierre: cleanNum(transferencias),
        propinas: cleanNum(propinas),
        novedades: novedades.trim(),
        liderNombre: liderNombre.trim() || username,
        auxiliaresNombres: selectedAuxiliares,
      };

      if (editingId) {
        // Actualizar cierre existente
        await dbAdapter.updateCierre(editingId, payload);
        const updatedItem: CierreCaja = {
          ...(closureForDate || { id: editingId, createdAt: new Date().toISOString(), estado: "Pendiente por Cuadrar" }),
          ...payload,
        };
        setSuccessData(updatedItem);
        setEditingId(null);
      } else {
        // Guardar nuevo cierre
        const result = await dbAdapter.saveCierre({
          ...payload,
          // Los valores POS los registra Gerencia al auditar.
          estado: "Pendiente por Cuadrar" as const,
        }, local);
        setSuccessData(result);
      }

      await fetchHistory(); // Actualizar el historial de inmediato
      
      // Limpiar formulario
      setEfectivo("");
      setDatafono("");
      setJusto("0");
      setRappi("0");
      setTransferencias("0");
      setPropinas("");
      setNovedades("");
    } catch (error) {
      console.error("Error al guardar/actualizar cierre de caja:", error);
      alert(`No se pudo guardar el cierre: ${(error as Error)?.message || "intente nuevamente."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSuccessData(null);
    setEditingId(null);
    setFecha(getTodayString());
    setSelectedAuxiliares([]);
    setEfectivo("");
    setDatafono("");
    setJusto("0");
    setRappi("0");
    setTransferencias("0");
    setPropinas("");
    setNovedades("");
    if (isLeaderRole) {
      setLiderNombre(username);
    } else if (localRegisteredUsers.leaders.length > 0) {
      setLiderNombre(localRegisteredUsers.leaders[0].nombre);
    }
  };

  const go = (s: SeccionColaborador) => {
    if (s === "punto" && !esLiderOp) return;
    if (s === "register") setSuccessData(null);
    setActiveTab(s);
    setMasAbierto(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-dvh bg-[#F8F9FA] text-[#1C2E24] flex flex-col selection:bg-[#1E3E30]/15 relative">
      {/* Cabecera */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-[#1E3E30]/5 p-2 rounded-xl border border-[#1E3E30]/10 flex items-center justify-center shrink-0">
              <Logo size="sm" className="text-[#1E3E30]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-tight text-slate-900 truncate">López & Gracia</p>
              <p className="text-xs text-slate-500 font-medium truncate">Punto {local}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col text-right pr-1">
              <span className="text-xs text-slate-900 font-bold">{username}</span>
              <span className="text-[11px] font-semibold text-slate-500">{role}</span>
            </div>
            <Avisos onNavigate={go} />
            <button
              onClick={onLogout}
              aria-label="Cerrar sesión"
              className="h-10 px-3 inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3E30]"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>

        {/* Pestañas (escritorio y tablet) */}
        <nav aria-label="Secciones" className="hidden lg:block max-w-7xl mx-auto -mb-px">
          <ul className="flex gap-1 overflow-x-auto">
            {navItems.map((it) => {
              const activo = activeTab === it.id;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => go(it.id)}
                    aria-current={activo ? "page" : undefined}
                    className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1E3E30] ${
                      activo ? "border-[#1E3E30] text-[#1E3E30]" : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {it.icon}
                    {it.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* Contenedor Principal */}
      <main className={`flex-1 ${vistaAncha ? "max-w-7xl" : "max-w-5xl"} w-full mx-auto px-4 pt-5 pb-28 sm:px-6 lg:px-8 md:pt-8 lg:pb-12 flex flex-col justify-start relative z-10`}>

        {activeTab === "inicio" ? (
          <MiDia onNavigate={go} />
        ) : activeTab === "desempeno" ? (
          <MiDesempeno />
        ) : activeTab === "punto" && esLiderOp ? (
          <PanelPunto local={local} />
        ) : activeTab === "desprendibles" ? (
          <MisDesprendibles />
        ) : activeTab === "inventory" ? (
          <InventoryClosure
            username={username}
            userRole={role}
            localName={local}
          />
        ) : activeTab === "checklist" ? (
          <OperationalChecklist
            username={username}
            userRole={role}
            localName={local}
          />
        ) : activeTab === "password" ? (
          /* Vista de Cambiar Contraseña */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] max-w-lg mx-auto overflow-hidden">
            <div className="border-b border-slate-100 p-6 bg-slate-50/50 flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Cambiar Mi Contraseña</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Actualiza tu contraseña para mantener la seguridad de tu acceso.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-700 text-xs font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-emerald-700 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Contraseña Actual */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Contraseña Actual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nueva Contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 3 caracteres"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Nueva Contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirmNewPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita la nueva contraseña"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPass(!showConfirmNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                  >
                    {showConfirmNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full mt-2 bg-[#1E3E30] hover:bg-[#163025] text-white text-xs font-bold py-3 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
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
        ) : (
          /* Módulo de Cierre de Caja con Subpestañas */
          <div className="space-y-6">
            {/* Sub-selector de Pestañas: Registrar Cierre vs Historial */}
            <div className="flex bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300/80 gap-1.5 w-full sm:w-auto self-start shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setCajaSubTab("form");
                  setSuccessData(null);
                }}
                className={`flex-1 sm:flex-initial py-2.5 px-4 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center space-x-2 ${
                  cajaSubTab === "form" 
                    ? "bg-white text-[#1E3E30] shadow-sm font-extrabold" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <PlusCircle className={`w-4 h-4 ${cajaSubTab === "form" ? "text-[#1E3E30]" : "text-slate-500"}`} />
                <span>{editingId ? "Editar Cierre" : "Registrar Cierre"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCajaSubTab("history");
                  fetchHistory();
                }}
                className={`flex-1 sm:flex-initial py-2.5 px-4 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center space-x-2 ${
                  cajaSubTab === "history" 
                    ? "bg-white text-[#1E3E30] shadow-sm font-extrabold" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <History className={`w-4 h-4 ${cajaSubTab === "history" ? "text-[#1E3E30]" : "text-slate-500"}`} />
                <span>Historial de Cierres ({history.length})</span>
              </button>
            </div>

            {cajaSubTab === "history" ? (
              /* Vista de Historial */
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] overflow-hidden">
            {/* Cabecera de Historial con Filtros */}
            <div className="border-b border-slate-100 p-6 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Historial de Cierres de Caja</h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {canSeeAllTeam 
                    ? "Consulta el registro histórico de los cierres realizados por el equipo y su estado de auditoría."
                    : "Consulta el registro histórico de tus cierres de caja realizados y su estado de auditoría."}
                </p>
              </div>

              {/* Filtro de Usuario */}
              {canSeeAllTeam ? (
                <div className="flex bg-slate-200/60 p-1 rounded-xl self-stretch sm:self-auto gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterUser("me")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      filterUser === "me" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Mis Cierres
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterUser("all")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      filterUser === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Todo el Equipo
                  </button>
                </div>
              ) : (
                <div className="bg-[#1E3E30] text-white px-3.5 py-1.5 text-xs font-bold rounded-xl self-start sm:self-auto shadow-xs">
                  Mis Cierres
                </div>
              )}
            </div>

            {/* Contenido de Historial */}
            <div className="p-6">
              {isLoadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin stroke-2 mb-2 text-[#1E3E30]" />
                  <span className="text-xs font-bold tracking-wide">Cargando historial...</span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl p-6">
                  <Clock className="w-10 h-10 mb-3 stroke-1.5 text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-800">No se encontraron cierres</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {filterUser === "me" 
                      ? "Aún no has registrado ningún cierre de caja con tu usuario." 
                      : "No hay cierres de caja registrados en el sistema para mostrar."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((c) => {
                    const isExpanded = expandedId === c.id;
                    const totalCierre = (c.efectivoCierre || 0) + (c.datafonoCierre || 0) + (c.justoCierre || 0) + (c.rappiCierre || 0) + (c.transferenciasCierre || 0);
                    
                    return (
                      <div 
                        key={c.id} 
                        className={`border rounded-2xl bg-white transition-all overflow-hidden ${
                          isExpanded 
                            ? "border-slate-300 shadow-md" 
                            : "border-slate-200/80 hover:border-slate-300 hover:shadow-xs"
                        }`}
                      >
                        {/* Cabecera del Item */}
                        <div 
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Fecha */}
                            <div className="bg-slate-900 text-white px-3 py-1 text-xs font-bold rounded-lg font-numeric">
                              {c.fecha}
                            </div>
                            {/* Responsable */}
                            <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                              <span className="text-slate-400 text-[11px] font-medium">Por:</span>
                              <span className="font-bold">{c.colaboradorNombre || "Sin nombre"}</span>
                            </div>
                            {/* Estado Badge */}
                            {c.estado === "Cuadrado" ? (
                              <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                <Check className="w-3.5 h-3.5 mr-1 stroke-[2.5]" />
                                Cuadrado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
                                <Clock className="w-3.5 h-3.5 mr-1 stroke-[2.5]" />
                                Pendiente por Auditar
                              </span>
                            )}

                            {/* Editar Cierre Button (Solo si no está cuadrado) */}
                            {c.estado !== "Cuadrado" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingCierre(c);
                                }}
                                className="px-3 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 font-bold text-xs rounded-lg border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer flex items-center space-x-1.5"
                                title="Editar o corregir datos de este cierre"
                              >
                                <Pencil className="w-3.5 h-3.5 text-amber-600" />
                                <span>Editar</span>
                              </button>
                            ) : (
                              <span
                                className="px-2.5 py-1 bg-slate-100 text-slate-500 font-semibold text-[11px] rounded-lg border border-slate-200 flex items-center space-x-1 cursor-not-allowed opacity-80"
                                title="Este cierre ya fue auditado y conciliado ('Cuadrado'), no es editable"
                              >
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>Conciliado</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between w-full sm:w-auto sm:space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <div className="text-right">
                              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">Total Reportado</span>
                              <span className="font-extrabold text-sm text-slate-900 leading-none font-numeric">{formatCOP(String(totalCierre))}</span>
                            </div>
                            <div className="text-slate-400 p-1 rounded-lg hover:bg-slate-100">
                              {isExpanded ? <ChevronUp className="w-4 h-4 stroke-[2.5]" /> : <ChevronDown className="w-4 h-4 stroke-[2.5]" />}
                            </div>
                          </div>
                        </div>

                        {/* Detalle Desplegable */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 space-y-5">
                            {/* Desglose de Canales */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Lado Reporte Físico */}
                              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">
                                  Arqueo Físico Reportado
                                </h4>
                                <div className="space-y-2 text-xs font-medium text-slate-700">
                                  <div className="flex justify-between py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Efectivo:</span>
                                    <span className="font-bold text-slate-900 font-numeric">{formatCOP(String(c.efectivoCierre))}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Datáfono / Vouchers:</span>
                                    <span className="font-bold text-slate-900 font-numeric">{formatCOP(String(c.datafonoCierre))}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Justo App:</span>
                                    <span className="font-bold text-slate-900 font-numeric">{formatCOP(String(c.justoCierre))}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Rappi App:</span>
                                    <span className="font-bold text-slate-900 font-numeric">{formatCOP(String(c.rappiCierre))}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Transferencias:</span>
                                    <span className="font-bold text-slate-900 font-numeric">{formatCOP(String(c.transferenciasCierre))}</span>
                                  </div>
                                  <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-900">
                                    <span>Propinas Recibidas:</span>
                                    <span className="text-indigo-600 font-numeric">{formatCOP(String(c.propinas))}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Lado Auditoría / POS */}
                              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col justify-between">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3 flex justify-between items-center">
                                    <span>Auditoría de Ventas</span>
                                    {c.estado === "Cuadrado" && (
                                      <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md">Aprobado</span>
                                    )}
                                  </h4>

                                  {c.estado === "Cuadrado" ? (
                                    <div className="space-y-2 text-xs font-medium text-slate-700">
                                      {/* Comparaciones con discrepancias */}
                                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                                        <span className="text-slate-500">Efectivo POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-bold text-slate-900 block font-numeric">{formatCOP(String(c.efectivoPOS))}</span>
                                          <span className={`text-[11px] font-bold font-numeric ${
                                            (c.difEfectivo || 0) === 0 ? "text-emerald-600" : (c.difEfectivo || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difEfectivo || 0) === 0 ? "Sin dif." : `${(c.difEfectivo || 0) > 0 ? "+" : ""}${formatCOP(String(c.difEfectivo))}`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                                        <span className="text-slate-500">Datáfono POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-bold text-slate-900 block font-numeric">{formatCOP(String(c.tarjetasPOS))}</span>
                                          <span className={`text-[11px] font-bold font-numeric ${
                                            (c.difTarjetas || 0) === 0 ? "text-emerald-600" : (c.difTarjetas || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difTarjetas || 0) === 0 ? "Sin dif." : `${(c.difTarjetas || 0) > 0 ? "+" : ""}${formatCOP(String(c.difTarjetas))}`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                                        <span className="text-slate-500">Justo POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-bold text-slate-900 block font-numeric">{formatCOP(String(c.justoPOS))}</span>
                                          <span className={`text-[11px] font-bold font-numeric ${
                                            (c.difJusto || 0) === 0 ? "text-emerald-600" : (c.difJusto || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difJusto || 0) === 0 ? "Sin dif." : `${(c.difJusto || 0) > 0 ? "+" : ""}${formatCOP(String(c.difJusto))}`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                                        <span className="text-slate-500">Rappi POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-bold text-slate-900 block font-numeric">{formatCOP(String(c.rappiPOS))}</span>
                                          <span className={`text-[11px] font-bold font-numeric ${
                                            (c.difRappi || 0) === 0 ? "text-emerald-600" : (c.difRappi || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difRappi || 0) === 0 ? "Sin dif." : `${(c.difRappi || 0) > 0 ? "+" : ""}${formatCOP(String(c.difRappi))}`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                                        <span className="text-slate-500">Transf. POS / Dif:</span>
                                        <div className="text-right">
                                          <span className="font-bold text-slate-900 block font-numeric">{formatCOP(String(c.transferenciasPOS))}</span>
                                          <span className={`text-[11px] font-bold font-numeric ${
                                            (c.difTransferencias || 0) === 0 ? "text-emerald-600" : (c.difTransferencias || 0) < 0 ? "text-rose-600" : "text-blue-600"
                                          }`}>
                                            {(c.difTransferencias || 0) === 0 ? "Sin dif." : `${(c.difTransferencias || 0) > 0 ? "+" : ""}${formatCOP(String(c.difTransferencias))}`}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                      <AlertTriangle className="w-5 h-5 text-amber-500 mb-2 stroke-2" />
                                      <p className="text-xs text-slate-800 font-bold mb-1">Pendiente de revisión</p>
                                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                        El Gerente debe subir el reporte POS correspondiente para auditar y calcular las diferencias de este día.
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {c.estado === "Cuadrado" && (
                                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium space-y-0.5">
                                    <div><span className="font-bold text-slate-700">Auditado por:</span> {c.auditadoPor}</div>
                                    {c.auditadoAt && (
                                      <div><span className="font-bold text-slate-700">Fecha:</span> {new Date(c.auditadoAt).toLocaleDateString()} {new Date(c.auditadoAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Novedades reportadas */}
                            {c.novedades && (
                              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Novedades reportadas del turno</h4>
                                <p className="text-xs font-medium text-slate-700 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
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
        ) : successData ? (
          /* Vista de Éxito */
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-600 mb-5">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">
              ¡Cierre Guardado!
            </h2>
            <p className="text-slate-500 text-xs mb-6 font-medium leading-relaxed">
              El cierre de caja del día <strong className="text-slate-800 font-bold font-numeric">{successData.fecha}</strong> ha sido cargado con estado <strong className="text-blue-600 font-bold">"Pendiente por Cuadrar"</strong> para revisión del Gerente.
            </p>

            {/* Resumen Cargado */}
            <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 text-left space-y-2.5 mb-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200/60 pb-2">
                Resumen del Arqueo Físico
              </h3>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <span className="text-slate-500 font-medium">Responsable:</span>
                <span className="text-right font-bold text-slate-900">{successData.colaboradorNombre || "N/A"}</span>

                <span className="text-slate-500 font-medium">Líder del Turno:</span>
                <span className="text-right font-bold text-slate-900">{successData.liderNombre || "N/A"}</span>

                {successData.auxiliaresNombres && successData.auxiliaresNombres.length > 0 && (
                  <>
                    <span className="text-slate-500 font-medium">Auxiliares:</span>
                    <span className="text-right font-bold text-slate-900">{successData.auxiliaresNombres.join(", ")}</span>
                  </>
                )}

                <span className="text-slate-500 font-medium">Efectivo:</span>
                <span className="text-right font-bold text-slate-900 font-numeric">{formatCOP(String(successData.efectivoCierre))}</span>
                
                <span className="text-slate-500 font-medium">Datáfono:</span>
                <span className="text-right font-bold text-slate-900 font-numeric">{formatCOP(String(successData.datafonoCierre))}</span>
                
                <span className="text-slate-500 font-medium">Justo App:</span>
                <span className="text-right font-bold text-slate-900 font-numeric">{formatCOP(String(successData.justoCierre))}</span>
                
                <span className="text-slate-500 font-medium">Rappi App:</span>
                <span className="text-right font-bold text-slate-900 font-numeric">{formatCOP(String(successData.rappiCierre))}</span>

                <span className="text-slate-500 font-medium">Transferencias:</span>
                <span className="text-right font-bold text-slate-900 font-numeric">{formatCOP(String(successData.transferenciasCierre))}</span>
                
                <div className="col-span-2 border-t border-slate-200 my-1"></div>

                <span className="text-slate-800 font-bold">Propinas (Incr.):</span>
                <span className="text-right font-bold text-indigo-600 font-numeric">{formatCOP(String(successData.propinas))}</span>
                
                <span className="text-emerald-700 font-extrabold text-xs">Flujo Total Recibido:</span>
                <span className="text-right font-extrabold text-emerald-700 text-sm font-numeric">
                  {formatCOP(String(successData.efectivoCierre + successData.datafonoCierre + successData.justoCierre + successData.rappiCierre + successData.transferenciasCierre + successData.propinas))}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  const savedId = successData.id;
                  setSuccessData(null);
                  setCajaSubTab("history");
                  fetchHistory();
                  setExpandedId(savedId);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#1E3E30] hover:bg-[#163025] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center justify-center space-x-2 cursor-pointer transition-all"
              >
                <History className="w-4 h-4" />
                <span>Ir al Historial de Cierres</span>
              </button>

              <button
                onClick={() => {
                  const dataToEdit = successData;
                  setSuccessData(null);
                  startEditingCierre(dataToEdit);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-xs inline-flex items-center justify-center space-x-2 cursor-pointer transition-all"
              >
                <Pencil className="w-4 h-4 text-amber-600" />
                <span>Editar este Cierre</span>
              </button>
            </div>
          </div>
        ) : existingClosureForSelectedDate && !editingId ? (
          /* Bloque de aviso cuando ya existe un cierre de caja para esa fecha */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-6">
            <div className={`border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
              existingClosureForSelectedDate.estado === "Cuadrado"
                ? "bg-emerald-50/60 border-emerald-200"
                : "bg-amber-50/60 border-amber-200"
            }`}>
              <div className="flex items-start space-x-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  existingClosureForSelectedDate.estado === "Cuadrado" ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                }`}>
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {existingClosureForSelectedDate.estado === "Cuadrado"
                      ? `Cierre Conciliado para el Día ${fecha}`
                      : `Cierre Ya Registrado para el Día ${fecha}`}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                    {existingClosureForSelectedDate.estado === "Cuadrado"
                      ? `El cierre de caja para el día ${fecha} ya fue auditado y conciliado ("Cuadrado") por la gerencia. No es posible modificarlo ni registrar un nuevo cierre.`
                      : `Ya existe un cierre de caja guardado para esta fecha por `}
                    {existingClosureForSelectedDate.estado !== "Cuadrado" && (
                      <strong className="font-bold text-slate-800">{existingClosureForSelectedDate.colaboradorNombre || "el equipo"}</strong>
                    )}
                    {existingClosureForSelectedDate.estado !== "Cuadrado" && `. Al estar pendiente por auditar, puedes editar sus valores.`}
                  </p>
                  <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 p-3 rounded-xl border ${
                    existingClosureForSelectedDate.estado === "Cuadrado" ? "bg-white/90 border-emerald-200" : "bg-white/90 border-amber-200"
                  }`}>
                    <span>Efectivo: <strong className="font-numeric text-slate-900">{formatCOP(String(existingClosureForSelectedDate.efectivoCierre))}</strong></span>
                    <span className="text-slate-300">•</span>
                    <span>Datáfono: <strong className="font-numeric text-slate-900">{formatCOP(String(existingClosureForSelectedDate.datafonoCierre))}</strong></span>
                    <span className="text-slate-300">•</span>
                    <span>Propinas: <strong className="font-numeric text-slate-900">{formatCOP(String(existingClosureForSelectedDate.propinas))}</strong></span>
                    <span className="text-slate-300">•</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      existingClosureForSelectedDate.estado === "Cuadrado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      Estado: {existingClosureForSelectedDate.estado}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                {existingClosureForSelectedDate.estado !== "Cuadrado" && (
                  <button
                    type="button"
                    onClick={() => startEditingCierre(existingClosureForSelectedDate)}
                    className="px-4 py-2.5 bg-[#1E3E30] hover:bg-[#163025] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Pencil className="w-4 h-4 text-amber-300" />
                    <span>Editar este Cierre</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCajaSubTab("history");
                    fetchHistory();
                    setExpandedId(existingClosureForSelectedDate.id);
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Ver en Historial</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs font-medium text-slate-600">
                ¿Deseas consultar o ingresar el cierre de otra fecha?
              </span>
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-700">Fecha:</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-[#1E3E30]/20"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Formulario de Ingesta */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="border-b border-slate-100 p-6 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  {editingId ? `Editando Cierre del ${fecha}` : "Formulario de Cierre Diario"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {editingId 
                    ? "Corrija los valores que requiera y guarde los cambios para actualizar la información en el sistema."
                    : "Ingrese con precisión todos los arqueos físicos medidos al finalizar el turno."}
                </p>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
                >
                  Cancelar Edición
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Fecha */}
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Fecha del Turno
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-[#1E3E30]/15 focus:border-[#1E3E30] outline-none transition-all ${
                        history.some(c => c.fecha === fecha) ? "border-amber-400 bg-amber-50/20" : "border-slate-200"
                      }`}
                    />
                  </div>
                  {history.some(c => c.fecha === fecha) && (
                    <div className="mt-2 flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Ya existe un cierre registrado para este día</span>
                    </div>
                  )}
                </div>

                {/* Persona que realiza el cierre */}
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Responsable del Cierre</span>
                    <span className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">Obligatorio</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Nombre de quien cierra"
                      value={colaboradorNombre}
                      onChange={(e) => setColaboradorNombre(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl text-slate-900 text-sm font-semibold outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Equipo del Turno */}
                <div className="col-span-1 md:col-span-2 bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center space-x-2.5 border-b border-slate-200/60 pb-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Equipo de Trabajo del Turno</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Personal que laboró en sede {local}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Líder de Punto */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span>Líder de Punto a Cargo</span>
                        <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">Obligatorio</span>
                      </label>
                      <div className="relative">
                        <select
                          value={liderNombre}
                          onChange={(e) => setLiderNombre(e.target.value)}
                          className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 outline-none cursor-pointer appearance-none shadow-xs"
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
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                          <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      </div>
                    </div>

                    {/* Auxiliares de Venta */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Auxiliares del Turno (Seleccionar de la lista)
                      </label>
                      
                      {localRegisteredUsers.assistants.length === 0 ? (
                        <div className="bg-white p-3 border border-dashed border-slate-200 text-center rounded-xl">
                          <p className="text-[11px] text-slate-400 font-medium italic">
                            No hay auxiliares registrados en la sede {local}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-xl max-h-32 overflow-y-auto p-1.5 space-y-1 shadow-xs">
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
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold transition-all ${
                                  isSelected 
                                    ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-200" 
                                    : "bg-white text-slate-700 hover:bg-slate-50 border border-transparent"
                                }`}
                              >
                                <span>{assistant.nombre}</span>
                                <div className={`w-4 h-4 rounded flex items-center justify-center ${
                                  isSelected ? "bg-[#1E3E30] text-white" : "border border-slate-300"
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
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
                    <label className="text-xs font-bold text-slate-700">
                      Efectivo en Caja (Cierre)
                    </label>
                    <span className="text-xs font-bold text-[#1E3E30] bg-emerald-50 px-2 py-0.5 rounded-lg font-numeric">{formatCOP(efectivo)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={efectivo}
                      onChange={handleNumericChange(setEfectivo)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl text-slate-900 text-sm font-bold font-numeric outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Datáfono */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Tarjetas / Datáfono (Vouchers)
                    </label>
                    <span className="text-xs font-bold text-[#1E3E30] bg-emerald-50 px-2 py-0.5 rounded-lg font-numeric">{formatCOP(datafono)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                      <CreditCard className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={datafono}
                      onChange={handleNumericChange(setDatafono)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl text-slate-900 text-sm font-bold font-numeric outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Justo */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <span>Cierre Justo App</span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">POS</span>
                    </label>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg font-numeric">{formatCOP(justo)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      readOnly
                      placeholder="0"
                      value={justo}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-sm font-bold font-numeric cursor-not-allowed outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    * Se completará automáticamente con el reporte POS.
                  </p>
                </div>

                {/* Rappi */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <span>Cierre Rappi App</span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">POS</span>
                    </label>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg font-numeric">{formatCOP(rappi)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      readOnly
                      placeholder="0"
                      value={rappi}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-sm font-bold font-numeric cursor-not-allowed outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    * Se completará automáticamente con el reporte POS.
                  </p>
                </div>

                {/* Transferencias */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <span>Transferencias (POS)</span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">POS</span>
                    </label>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg font-numeric">{formatCOP(transferencias)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      readOnly
                      placeholder="0"
                      value={transferencias}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-sm font-bold font-numeric cursor-not-allowed outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    * Se completará automáticamente con el reporte POS.
                  </p>
                </div>

                {/* Propinas */}
                <div className="col-span-1 md:col-span-2 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/80">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>Propinas Recibidas del Día</span>
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        Este valor entra al arqueo general pero se audita de manera independiente.
                      </p>
                    </div>
                    <span className="text-xs text-indigo-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-xs font-numeric">{formatCOP(propinas)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={propinas}
                      onChange={handleNumericChange(setPropinas)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 rounded-xl text-slate-900 text-sm font-bold font-numeric outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Novedades */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Novedades u Observaciones del Turno
                  </label>
                  <div className="relative">
                    <span className="absolute top-3.5 left-3.5 text-slate-400 pointer-events-none">
                      <FileText className="w-4 h-4" />
                    </span>
                    <textarea
                      required
                      rows={3}
                      placeholder="Escriba los pormenores del turno, novedades en caja, fallas en datáfono o explicaciones de discrepancias..."
                      value={novedades}
                      onChange={(e) => setNovedades(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl text-slate-900 text-sm font-medium outline-none resize-none transition-all"
                    />
                  </div>
                </div>

              </div>

              <div className="border-t border-slate-100 pt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-[#1E3E30] hover:bg-[#163025] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
                >
                  {editingId ? <Pencil className="w-4 h-4 text-amber-300" /> : <Send className="w-4 h-4" />}
                  <span>{isSubmitting ? "Procesando..." : editingId ? "Guardar Cambios del Cierre" : "Guardar Cierre de Caja"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    )}
  </main>

      {/* Navegación inferior (celular) */}
      <nav
        aria-label="Secciones"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {navPrincipal.map((it) => {
            const activo = activeTab === it.id;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => go(it.id)}
                  aria-current={activo ? "page" : undefined}
                  className={`w-full h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer select-none [-webkit-tap-highlight-color:transparent] ${
                    activo ? "text-[#1E3E30]" : "text-slate-500"
                  }`}
                >
                  <span className={`px-3 py-1 rounded-full transition-colors ${activo ? "bg-[#E8F3EE]" : ""}`}>{it.icon}</span>
                  <span className="truncate max-w-full px-1">{it.id === "register" ? "Caja" : it.id === "desempeno" ? "Desempeño" : it.label}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              aria-haspopup="dialog"
              aria-expanded={masAbierto}
              className={`w-full h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer select-none [-webkit-tap-highlight-color:transparent] ${
                navMas.some((it) => it.id === activeTab) ? "text-[#1E3E30]" : "text-slate-500"
              }`}
            >
              <span className={`px-3 py-1 rounded-full ${navMas.some((it) => it.id === activeTab) ? "bg-[#E8F3EE]" : ""}`}>
                <MoreHorizontal className="w-4 h-4" />
              </span>
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      {masAbierto && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Más secciones">
          <button type="button" aria-label="Cerrar" onClick={() => setMasAbierto(false)} className="absolute inset-0 bg-slate-900/30 cursor-default" />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_-12px_rgba(28,46,36,0.3)] animate-[subir_220ms_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-sm font-extrabold text-slate-900">Más secciones</p>
              <button type="button" onClick={() => setMasAbierto(false)} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="px-3">
              {navMas.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => go(it.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-bold cursor-pointer ${
                      activeTab === it.id ? "bg-[#E8F3EE] text-[#1E3E30]" : "text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {it.icon}
                    {it.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
