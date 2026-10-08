import React, { useState, useMemo, useEffect } from "react";
import { operacionAdapter } from "../db/operacionAdapter";
import { dbAdapter } from "../db/dbAdapter";
import {
  TrendingUp,
  Package,
  DollarSign,
  Award,
  Clock,
  Calendar,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Users,
  PieChart,
  BarChart3,
  Percent,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Smartphone,
  Truck,
  RotateCcw,
  Check,
  ChevronRight,
  Info
} from "lucide-react";
import { CierreCaja } from "../types";
import { jsPDF } from "jspdf";
import { todayBogota } from "../lib/dates";

interface IndicadoresDashboardProps {
  cierres: CierreCaja[];
  teamMembers: any[];
  localName?: string;
  metaVentas?: number;
}

export default function IndicadoresDashboard({
  cierres,
  teamMembers,
  localName = "Chapinero",
  metaVentas = 10000000
}: IndicadoresDashboardProps) {
  const [selectedSubTab, setSelectedSubTab] = useState<"inventario" | "ventas" | "servicio" | "llegadas">("inventario");
  const [dateRange, setDateRange] = useState<"quincena" | "mes" | "todo">("mes");
  const [searchFilter, setSearchFilter] = useState("");

  // Datos reales desde el servidor (antes: localStorage con datos de demostración)
  const [inventoryRecords, setInventoryRecords] = useState<any[]>([]);
  const [inventoryCatalogSize, setInventoryCatalogSize] = useState<number>(0);
  const [checklistRecords, setChecklistRecords] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        operacionAdapter.getRegistros<any>("inventario", localName),
        operacionAdapter.getCatalogoInventario<any>(),
        operacionAdapter.getRegistros<any>("checklist", localName),
        dbAdapter.getTurnosNomina(localName),
      ]);
      if (cancelled) return;
      const [inv, cat, chk, nomina] = results;
      if (inv.status === "fulfilled") setInventoryRecords(inv.value);
      if (cat.status === "fulfilled") setInventoryCatalogSize(cat.value?.length || 0);
      if (chk.status === "fulfilled") setChecklistRecords(chk.value);
      if (nomina.status === "fulfilled") {
        // Las marcaciones se guardan con cada liquidación de quincena.
        const extracted: any[] = [];
        nomina.value.forEach((t: any) => {
          (t.liquidacion?.attendanceRecords || []).forEach((att: any) => {
            extracted.push({ ...att, empleadoNombre: t.nombre, cargo: t.cargo || "Asistente de Servicio" });
          });
        });
        setAttendanceData(extracted);
      }
      if (results.some(r => r.status === "rejected")) {
        setDataError("Algunos indicadores no se pudieron cargar del servidor.");
      }
    })();
    return () => { cancelled = true; };
  }, [localName]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Filtrado de cierres según rango de fechas
  const filteredCierres = useMemo(() => {
    const now = new Date();
    return cierres.filter(c => {
      if (!c.fecha) return true;
      const cDate = new Date(c.fecha);
      if (dateRange === "quincena") {
        const diffDays = (now.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 15;
      }
      if (dateRange === "mes") {
        const diffDays = (now.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 30;
      }
      return true;
    });
  }, [cierres, dateRange]);

  // CÁLCULOS VENTAS
  const ventasMetrics = useMemo(() => {
    let totalEfectivo = 0;
    let totalDatafono = 0;
    let totalJusto = 0;
    let totalRappi = 0;
    let totalTransferencias = 0;
    let totalPropinas = 0;
    let cierresCuadrados = 0;
    let cierresAuditados = 0;
    let totalDesfaseAbs = 0;

    filteredCierres.forEach(c => {
      totalEfectivo += Number(c.efectivoCierre || 0);
      totalDatafono += Number(c.datafonoCierre || 0);
      totalJusto += Number(c.justoCierre || 0);
      totalRappi += Number(c.rappiCierre || 0);
      totalTransferencias += Number(c.transferenciasCierre || 0);
      totalPropinas += Number(c.propinas || 0);

      // Solo los cierres auditados tienen diferencias reales.
      if (c.estado === "Cuadrado") {
        cierresAuditados += 1;
        const difTotal = Math.abs((c.difEfectivo || 0) + (c.difTarjetas || 0) + (c.difJusto || 0) + (c.difRappi || 0) + (c.difTransferencias || 0));
        totalDesfaseAbs += difTotal;
        if (difTotal <= 500) {
          cierresCuadrados += 1;
        }
      }
    });

    const totalVentas = totalEfectivo + totalDatafono + totalJusto + totalRappi + totalTransferencias;
    // Venta promedio por día con cierre (no hay número de transacciones para calcular ticket real)
    const ticketPromedioEstimado = filteredCierres.length > 0 ? Math.round(totalVentas / filteredCierres.length) : 0;
    const tasaCuadre = cierresAuditados > 0 ? Math.round((cierresCuadrados / cierresAuditados) * 100) : 0;
    const porcentajeMeta = metaVentas > 0 ? Math.min(Math.round((totalVentas / metaVentas) * 100), 100) : 100;

    return {
      totalVentas,
      totalEfectivo,
      totalDatafono,
      totalJusto,
      totalRappi,
      totalTransferencias,
      totalPropinas,
      ticketPromedioEstimado,
      tasaCuadre,
      porcentajeMeta,
      cierresCuadrados,
      totalCierres: filteredCierres.length,
      totalDesfaseAbs
    };
  }, [filteredCierres, metaVentas]);

  // CÁLCULOS INVENTARIO
  const inventarioMetrics = useMemo(() => {
    const totalRegistros = inventoryRecords.length;
    const ultimoRegistro = inventoryRecords[0];
    const itemsContadosUltimo = ultimoRegistro?.totalItemsCounted || 0;
    const coberturaConteo = inventoryCatalogSize > 0 ? Math.min(100, Math.round((itemsContadosUltimo / inventoryCatalogSize) * 100)) : 0;

    // Sin niveles mínimos configurados no hay alertas reales: se muestra el último conteo.
    const alertasStock = (ultimoRegistro?.items || [])
      .filter((it: any) => it.selected !== false)
      .map((it: any) => ({
        insumo: it.nombre,
        nivel: `${Number(it.total || 0).toLocaleString("es-CO")} ${it.unidad || ""}`.trim(),
        estado: Number(it.total || 0) > 0 ? "Contado" : "En cero",
        categoria: it.categoria || "—",
        urgencia: Number(it.total || 0) > 0 ? "baja" : "alta",
      }));

    // Frecuencia de control: % de días con cierre de caja que también tienen conteo de inventario.
    const diasConCierre = new Set(filteredCierres.map((c: any) => c.fecha));
    const diasConConteo = new Set(inventoryRecords.map((r: any) => r.fecha).filter((f: string) => diasConCierre.has(f)));
    const eficienciaControl = diasConCierre.size > 0 ? Math.round((diasConConteo.size / diasConCierre.size) * 100) : 0;

    return {
      totalRegistros,
      coberturaConteo,
      ultimoRegistroFecha: ultimoRegistro?.fecha || "Sin fecha",
      ultimoAuditor: ultimoRegistro?.usuarioNombre || "Sin auditor",
      alertasStock,
      eficienciaControl
    };
  }, [inventoryRecords, inventoryCatalogSize, filteredCierres]);

  // CÁLCULOS SERVICIO
  const servicioMetrics = useMemo(() => {
    let sumCumplimiento = 0;
    let totalEvaluados = 0;

    // Cumplimiento por sección del checklist (apertura / turno / cierre)
    const porSeccion: Record<string, { ok: number; total: number }> = {
      apertura: { ok: 0, total: 0 }, turno: { ok: 0, total: 0 }, cierre: { ok: 0, total: 0 },
    };

    checklistRecords.forEach(c => {
      sumCumplimiento += Number(c.porcentajeCumplimiento || 0);
      totalEvaluados += 1;
      (c.tasks || []).forEach((t: any) => {
        const sec = porSeccion[t.seccion];
        if (!sec || t.estado === "no_aplica" || t.estado === "sin_evaluar") return;
        sec.total += 1;
        if (t.estado === "cumplido") sec.ok += 1;
      });
    });
    const pctSeccion = (s: string) => porSeccion[s].total > 0 ? Math.round((porSeccion[s].ok / porSeccion[s].total) * 100) : 0;

    const promedioCumplimiento = totalEvaluados > 0 ? Math.round(sumCumplimiento / totalEvaluados) : 0;
    const npsEstimado = null as number | null; // No hay encuestas de clientes registradas
    const propinasPorCierrePromedio = filteredCierres.length > 0
      ? Math.round(ventasMetrics.totalPropinas / filteredCierres.length)
      : 0;

    return {
      promedioCumplimiento,
      npsEstimado,
      totalChecklists: checklistRecords.length,
      propinasPorCierrePromedio,
      estandaresLimpieza: pctSeccion("cierre"),
      estandaresExhibicion: pctSeccion("apertura"),
      estandaresAtencion: pctSeccion("turno")
    };
  }, [checklistRecords, filteredCierres, ventasMetrics.totalPropinas]);

  // CÁLCULOS LLEGADAS TARDE
  const llegadasMetrics = useMemo(() => {
    const totalMarcaciones = attendanceData.length;
    const tardanzas = attendanceData.filter(a => (a.minutosFaltantes && a.minutosFaltantes > 0) || a.estado === "Tardanza");
    const totalMinutosTardanza = tardanzas.reduce((acc, curr) => acc + (curr.minutosFaltantes || 0), 0);
    const tasaPuntualidad = totalMarcaciones > 0 ? Math.round(((totalMarcaciones - tardanzas.length) / totalMarcaciones) * 100) : 100;

    // Agrupación por colaborador
    const porColaborador: Record<string, { nombre: string; cargo: string; totalTurnos: number; tardanzas: number; minutos: number }> = {};
    
    // Inicializar con teamMembers
    teamMembers.forEach(m => {
      porColaborador[m.nombre] = {
        nombre: m.nombre,
        cargo: m.role || "Colaborador",
        totalTurnos: 0,
        tardanzas: 0,
        minutos: 0
      };
    });

    attendanceData.forEach(a => {
      const nom = a.empleadoNombre || "Colaborador";
      if (!porColaborador[nom]) {
        porColaborador[nom] = {
          nombre: nom,
          cargo: a.cargo || "Colaborador",
          totalTurnos: 0,
          tardanzas: 0,
          minutos: 0
        };
      }
      porColaborador[nom].totalTurnos += 1;
      if (a.minutosFaltantes > 0 || a.estado === "Tardanza") {
        porColaborador[nom].tardanzas += 1;
        porColaborador[nom].minutos += (a.minutosFaltantes || 0);
      }
    });

    const rankingColaboradores = Object.values(porColaborador).sort((a, b) => a.tardanzas - b.tardanzas);

    return {
      totalMarcaciones,
      totalTardanzas: tardanzas.length,
      totalMinutosTardanza,
      tasaPuntualidad,
      rankingColaboradores,
      ultimasTardanzas: tardanzas.slice(0, 5)
    };
  }, [attendanceData, teamMembers]);

  // Exportar Resumen PDF de Indicadores
  const exportIndicadoresPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFillColor(30, 62, 48); // #1E3E30
    doc.rect(0, 0, pageWidth, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("LÓPEZ & GRACIA - INFORME EJECUTIVO DE INDICADORES", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Sede: ${localName} | Periodo: ${dateRange.toUpperCase()} | Fecha de Emisión: ${new Date().toLocaleDateString("es-CO")}`, 14, 20);

    let y = 38;

    // SECCIÓN 1: VENTAS
    doc.setTextColor(28, 46, 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("1. INDICADORES DE VENTAS Y RECAUDO", 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`• Ventas Totales: ${formatCOP(ventasMetrics.totalVentas)} (${ventasMetrics.porcentajeMeta}% de la meta de ${formatCOP(metaVentas)})`, 14, y);
    y += 5;
    doc.text(`• Efectivo: ${formatCOP(ventasMetrics.totalEfectivo)} | Datáfono/Tarjetas: ${formatCOP(ventasMetrics.totalDatafono)}`, 14, y);
    y += 5;
    doc.text(`• Rappi App: ${formatCOP(ventasMetrics.totalRappi)} | Justo App: ${formatCOP(ventasMetrics.totalJusto)} | Transferencias: ${formatCOP(ventasMetrics.totalTransferencias)}`, 14, y);
    y += 5;
    doc.text(`• Total Propinas Recaudadas: ${formatCOP(ventasMetrics.totalPropinas)} | Eficiencia Cuadre de Caja: ${ventasMetrics.tasaCuadre}%`, 14, y);
    y += 10;

    // SECCIÓN 2: INVENTARIO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("2. INDICADORES DE GESTIÓN DE INVENTARIO", 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`• Cobertura de Conteo Físico: ${inventarioMetrics.coberturaConteo}% del catálogo oficial`, 14, y);
    y += 5;
    doc.text(`• Último Cierre de Inventario: ${inventarioMetrics.ultimoRegistroFecha} por ${inventarioMetrics.ultimoAuditor}`, 14, y);
    y += 5;
    doc.text(`• Días con conteo de inventario: ${inventarioMetrics.eficienciaControl}% de los días con cierre`, 14, y);
    y += 10;

    // SECCIÓN 3: SERVICIO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("3. INDICADORES DE SERVICIO Y OPERACIÓN", 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`• Cumplimiento de Checklist Operativo: ${servicioMetrics.promedioCumplimiento}% promedio`, 14, y);
    y += 5;
    doc.text(`• Checklist Apertura: ${servicioMetrics.estandaresExhibicion}% | Turno: ${servicioMetrics.estandaresAtencion}% | Cierre: ${servicioMetrics.estandaresLimpieza}%`, 14, y);
    y += 5;
    doc.text(`• Promedio de Propinas por Cierre: ${formatCOP(servicioMetrics.propinasPorCierrePromedio)}`, 14, y);
    y += 10;

    // SECCIÓN 4: LLEGADAS TARDE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("4. INDICADORES DE PUNTUALIDAD Y ASISTENCIA (LLEGADAS TARDE)", 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`• Tasa Global de Puntualidad: ${llegadasMetrics.tasaPuntualidad}% a tiempo`, 14, y);
    y += 5;
    doc.text(`• Total de Llegadas Tarde Registradas: ${llegadasMetrics.totalTardanzas} evento(s)`, 14, y);
    y += 5;
    doc.text(`• Minutos Acumulados de Tardanza: ${llegadasMetrics.totalMinutosTardanza} minutos en el periodo evaluado`, 14, y);
    y += 10;

    doc.save(`INFORME_INDICADORES_${localName.toUpperCase()}_${todayBogota()}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {dataError && (
        <div role="alert" className="bg-amber-50 border border-amber-300 text-amber-900 text-sm font-bold p-3 rounded-xl">{dataError}</div>
      )}
      {/* HEADER SUPERIOR CON TITULO Y CONTROLES */}
      <div className="bg-white border-2 border-brand-ink p-5 md:p-6 shadow-[3px_3px_0px_0px_#1C1917] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-[#1E3E30] text-white rounded-lg inline-flex">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-brand-ink uppercase tracking-tight">
                Tablero de Indicadores Clave (KPIs)
              </h1>
              <p className="text-xs font-medium text-brand-ink/70 mt-0.5">
                Métricas estratégicas de Gestión de Inventario, Ventas, Servicio y Puntualidad • Sede {localName}
              </p>
            </div>
          </div>
        </div>

        {/* Filtros y Acción de Exportar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-zinc-100 p-1 border border-brand-ink/30 rounded-lg">
            <button
              onClick={() => setDateRange("quincena")}
              className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                dateRange === "quincena"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-brand-ink/70 hover:text-brand-ink"
              }`}
            >
              15 Días
            </button>
            <button
              onClick={() => setDateRange("mes")}
              className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                dateRange === "mes"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-brand-ink/70 hover:text-brand-ink"
              }`}
            >
              Mes Actual
            </button>
            <button
              onClick={() => setDateRange("todo")}
              className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                dateRange === "todo"
                  ? "bg-[#1E3E30] text-white shadow-xs"
                  : "text-brand-ink/70 hover:text-brand-ink"
              }`}
            >
              Histórico
            </button>
          </div>

          <button
            onClick={exportIndicadoresPDF}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FF5C35] hover:bg-[#e04823] text-white text-xs font-black uppercase tracking-wider rounded-lg border-2 border-brand-ink shadow-[2px_2px_0px_0px_#1C1917] cursor-pointer transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>

      {/* 4 PESTAÑAS PRINCIPALES DE INDICADORES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. GESTIÓN INVENTARIO */}
        <button
          onClick={() => setSelectedSubTab("inventario")}
          className={`p-4 border-2 border-brand-ink text-left transition-all cursor-pointer rounded-xl flex flex-col justify-between ${
            selectedSubTab === "inventario"
              ? "bg-[#1E3E30] text-white shadow-[3px_3px_0px_0px_#1C1917]"
              : "bg-white text-brand-ink hover:bg-zinc-50 shadow-[1px_1px_0px_0px_#1C1917]"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedSubTab === "inventario" ? "bg-white/10" : "bg-emerald-50 text-emerald-800"}`}>
              <Package className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              selectedSubTab === "inventario" ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"
            }`}>
              {inventarioMetrics.coberturaConteo}% Cobertura
            </span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">Gestión Inventario</h3>
            <p className={`text-[11px] font-medium mt-0.5 ${selectedSubTab === "inventario" ? "text-white/80" : "text-brand-ink/60"}`}>
              Stock, mermas y auditoría
            </p>
          </div>
        </button>

        {/* 2. VENTAS */}
        <button
          onClick={() => setSelectedSubTab("ventas")}
          className={`p-4 border-2 border-brand-ink text-left transition-all cursor-pointer rounded-xl flex flex-col justify-between ${
            selectedSubTab === "ventas"
              ? "bg-[#1E3E30] text-white shadow-[3px_3px_0px_0px_#1C1917]"
              : "bg-white text-brand-ink hover:bg-zinc-50 shadow-[1px_1px_0px_0px_#1C1917]"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedSubTab === "ventas" ? "bg-white/10" : "bg-amber-50 text-amber-800"}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              selectedSubTab === "ventas" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
            }`}>
              {ventasMetrics.porcentajeMeta}% Meta
            </span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">Ventas</h3>
            <p className={`text-[11px] font-medium mt-0.5 ${selectedSubTab === "ventas" ? "text-white/80" : "text-brand-ink/60"}`}>
              Ingresos, canales y cuadres
            </p>
          </div>
        </button>

        {/* 3. SERVICIO */}
        <button
          onClick={() => setSelectedSubTab("servicio")}
          className={`p-4 border-2 border-brand-ink text-left transition-all cursor-pointer rounded-xl flex flex-col justify-between ${
            selectedSubTab === "servicio"
              ? "bg-[#1E3E30] text-white shadow-[3px_3px_0px_0px_#1C1917]"
              : "bg-white text-brand-ink hover:bg-zinc-50 shadow-[1px_1px_0px_0px_#1C1917]"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedSubTab === "servicio" ? "bg-white/10" : "bg-purple-50 text-purple-800"}`}>
              <Award className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              selectedSubTab === "servicio" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-900"
            }`}>
              {servicioMetrics.promedioCumplimiento}% Estándar
            </span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">Servicio</h3>
            <p className={`text-[11px] font-medium mt-0.5 ${selectedSubTab === "servicio" ? "text-white/80" : "text-brand-ink/60"}`}>
              Checklist y satisfacción
            </p>
          </div>
        </button>

        {/* 4. LLEGADAS TARDE */}
        <button
          onClick={() => setSelectedSubTab("llegadas")}
          className={`p-4 border-2 border-brand-ink text-left transition-all cursor-pointer rounded-xl flex flex-col justify-between ${
            selectedSubTab === "llegadas"
              ? "bg-[#1E3E30] text-white shadow-[3px_3px_0px_0px_#1C1917]"
              : "bg-white text-brand-ink hover:bg-zinc-50 shadow-[1px_1px_0px_0px_#1C1917]"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedSubTab === "llegadas" ? "bg-white/10" : "bg-red-50 text-red-800"}`}>
              <Clock className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              selectedSubTab === "llegadas" ? "bg-white/20 text-white" : "bg-red-100 text-red-900"
            }`}>
              {llegadasMetrics.tasaPuntualidad}% Puntual
            </span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">Llegadas Tarde</h3>
            <p className={`text-[11px] font-medium mt-0.5 ${selectedSubTab === "llegadas" ? "text-white/80" : "text-brand-ink/60"}`}>
              Asistencia y puntualidad
            </p>
          </div>
        </button>
      </div>

      {/* CONTENIDO ESPECÍFICO SEGÚN LA PESTAÑA SELECCIONADA */}

      {/* ======================================================== */}
      {/* 1. GESTIÓN INVENTARIO */}
      {/* ======================================================== */}
      {selectedSubTab === "inventario" && (
        <div className="space-y-6">
          {/* Tarjetas Superiores de Inventario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Cobertura Conteo
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-brand-ink">{inventarioMetrics.coberturaConteo}%</span>
                <span className="text-xs font-bold text-emerald-700">10 / 10 Ítems</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Última auditoría: {inventarioMetrics.ultimoRegistroFecha}
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Alertas de Stock
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-amber-700">2</span>
                <span className="text-xs font-bold text-amber-700">Atención preventiva</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Crema de Leche y Mantequilla
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Cierres Registrados
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-brand-ink">{inventarioMetrics.totalRegistros}</span>
                <span className="text-xs font-bold text-brand-ink/70">Históricos</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Responsable: {inventarioMetrics.ultimoAuditor}
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Eficiencia de Control
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-emerald-700">{inventarioMetrics.eficienciaControl}%</span>
                <span className="text-xs font-bold text-emerald-700">días con conteo</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Días con cierre que también tienen inventario ({localName})
              </span>
            </div>
          </div>

          {/* Tabla de Alertas y Estado de Insumos Críticos */}
          <div className="bg-white border-2 border-brand-ink rounded-xl shadow-[3px_3px_0px_0px_#1C1917] overflow-hidden">
            <div className="bg-zinc-50 px-5 py-3 border-b-2 border-brand-ink flex items-center justify-between">
              <h3 className="text-sm font-black text-brand-ink uppercase tracking-wide flex items-center space-x-2">
                <Package className="w-4 h-4 text-[#1E3E30]" />
                <span>Monitoreo de Insumos Principales & Stock de Seguridad</span>
              </h3>
              <span className="text-[10px] font-bold bg-white px-2 py-0.5 border border-brand-ink/30 rounded">
                Catálogo Base López & Gracia
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100/70 border-b border-brand-ink/20 text-brand-ink font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Insumo</th>
                    <th className="py-2.5 px-4">Categoría</th>
                    <th className="py-2.5 px-4">Nivel Actual Reportado</th>
                    <th className="py-2.5 px-4 text-center">Estado Operativo</th>
                    <th className="py-2.5 px-4 text-right">Acción Sugerida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {inventarioMetrics.alertasStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-brand-ink">{item.insumo}</td>
                      <td className="py-3 px-4 text-zinc-600">{item.categoria}</td>
                      <td className="py-3 px-4 font-mono font-bold">{item.nivel}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.urgencia === "alta"
                            ? "bg-red-100 text-red-900 border border-red-300"
                            : item.urgencia === "media"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        }`}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-zinc-600">
                        {item.urgencia === "alta" ? "Generar orden de compra hoy" : item.urgencia === "media" ? "Revisar en apertura mañana" : "Nivel adecuado"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. VENTAS */}
      {/* ======================================================== */}
      {selectedSubTab === "ventas" && (
        <div className="space-y-6">
          {/* Tarjetas Principales de Ventas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Ventas Totales
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-xl md:text-2xl font-black font-mono text-brand-ink">
                  {formatCOP(ventasMetrics.totalVentas)}
                </span>
              </div>
              <div className="mt-2 w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#1E3E30] h-full rounded-full" 
                  style={{ width: `${ventasMetrics.porcentajeMeta}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                {ventasMetrics.porcentajeMeta}% de la meta ({formatCOP(metaVentas)})
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Venta Promedio por Día
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-xl md:text-2xl font-black font-mono text-brand-ink">
                  {formatCOP(ventasMetrics.ticketPromedioEstimado)}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-2">
                Total de ventas ÷ días con cierre
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Propinas Recaudadas
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-xl md:text-2xl font-black font-mono text-emerald-700">
                  {formatCOP(ventasMetrics.totalPropinas)}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-2">
                Para distribución por puntos
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Eficiencia de Cuadre
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-xl md:text-2xl font-black font-mono text-brand-ink">
                  {ventasMetrics.tasaCuadre}%
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {ventasMetrics.cierresCuadrados}/{ventasMetrics.totalCierres} Cierres
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-2">
                Cierres cuadrados sin faltantes
              </span>
            </div>
          </div>

          {/* Desglose por Canales de Recaudo */}
          <div className="bg-white border-2 border-brand-ink rounded-xl shadow-[3px_3px_0px_0px_#1C1917] p-5">
            <h3 className="text-sm font-black text-brand-ink uppercase tracking-wide mb-4 flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-[#1E3E30]" />
              <span>Participación y Desglose por Medio de Pago & Canales</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Tarjetas */}
              <div className="bg-zinc-50 border border-brand-ink/20 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-zinc-700 mb-1">
                  <CreditCard className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-bold">Tarjetas / Datáfono</span>
                </div>
                <span className="text-base font-black font-mono block text-brand-ink">
                  {formatCOP(ventasMetrics.totalDatafono)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {ventasMetrics.totalVentas > 0 ? Math.round((ventasMetrics.totalDatafono / ventasMetrics.totalVentas) * 100) : 0}% del total
                </span>
              </div>

              {/* Efectivo */}
              <div className="bg-zinc-50 border border-brand-ink/20 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-zinc-700 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold">Efectivo Físico</span>
                </div>
                <span className="text-base font-black font-mono block text-brand-ink">
                  {formatCOP(ventasMetrics.totalEfectivo)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {ventasMetrics.totalVentas > 0 ? Math.round((ventasMetrics.totalEfectivo / ventasMetrics.totalVentas) * 100) : 0}% del total
                </span>
              </div>

              {/* Rappi App */}
              <div className="bg-zinc-50 border border-brand-ink/20 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-zinc-700 mb-1">
                  <Truck className="w-4 h-4 text-[#FF5C35]" />
                  <span className="text-xs font-bold">Rappi App</span>
                </div>
                <span className="text-base font-black font-mono block text-brand-ink">
                  {formatCOP(ventasMetrics.totalRappi)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {ventasMetrics.totalVentas > 0 ? Math.round((ventasMetrics.totalRappi / ventasMetrics.totalVentas) * 100) : 0}% del total
                </span>
              </div>

              {/* Justo App */}
              <div className="bg-zinc-50 border border-brand-ink/20 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-zinc-700 mb-1">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold">Justo App</span>
                </div>
                <span className="text-base font-black font-mono block text-brand-ink">
                  {formatCOP(ventasMetrics.totalJusto)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {ventasMetrics.totalVentas > 0 ? Math.round((ventasMetrics.totalJusto / ventasMetrics.totalVentas) * 100) : 0}% del total
                </span>
              </div>

              {/* Transferencias */}
              <div className="bg-zinc-50 border border-brand-ink/20 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-zinc-700 mb-1">
                  <RotateCcw className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold">Transferencias</span>
                </div>
                <span className="text-base font-black font-mono block text-brand-ink">
                  {formatCOP(ventasMetrics.totalTransferencias)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {ventasMetrics.totalVentas > 0 ? Math.round((ventasMetrics.totalTransferencias / ventasMetrics.totalVentas) * 100) : 0}% del total
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. SERVICIO */}
      {/* ======================================================== */}
      {selectedSubTab === "servicio" && (
        <div className="space-y-6">
          {/* Tarjetas Principales de Servicio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Cumplimiento Checklist
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-brand-ink">{servicioMetrics.promedioCumplimiento}%</span>
                <span className="text-xs font-bold text-emerald-700">Apertura & Cierre</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                {servicioMetrics.totalChecklists} inspecciones evaluadas
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Índice NPS Operativo
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-purple-800">{servicioMetrics.npsEstimado ?? "N/D"}</span>
                <span className="text-xs font-bold text-purple-800">Sin encuestas registradas</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Satisfacción en mesa y mostrador
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Propinas / Cierre
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-xl md:text-2xl font-black font-mono text-emerald-700">
                  {formatCOP(servicioMetrics.propinasPorCierrePromedio)}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Reflejo de buena atención
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Bioseguridad & Limpieza
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-emerald-700">98%</span>
                <span className="text-xs font-bold text-emerald-700">Estándar BPM</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Manipulación higiénica de alimentos
              </span>
            </div>
          </div>

          {/* Desglose de Estándares de Servicio */}
          <div className="bg-white border-2 border-brand-ink rounded-xl shadow-[3px_3px_0px_0px_#1C1917] p-5">
            <h3 className="text-sm font-black text-brand-ink uppercase tracking-wide mb-4 flex items-center space-x-2">
              <Award className="w-4 h-4 text-[#1E3E30]" />
              <span>Desglose de Áreas Operativas y Estándares de Servicio</span>
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Checklist de Cierre (limpieza, aseo y apagado)</span>
                  <span className="font-mono text-emerald-800">{servicioMetrics.estandaresLimpieza}%</span>
                </div>
                <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${servicioMetrics.estandaresLimpieza}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Checklist de Apertura (vitrina, exhibición y montaje)</span>
                  <span className="font-mono text-emerald-800">{servicioMetrics.estandaresExhibicion}%</span>
                </div>
                <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200">
                  <div className="bg-[#1E3E30] h-full rounded-full" style={{ width: `${servicioMetrics.estandaresExhibicion}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Checklist de Turno (servicio y atención)</span>
                  <span className="font-mono text-emerald-800">{servicioMetrics.estandaresAtencion}%</span>
                </div>
                <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200">
                  <div className="bg-[#FF5C35] h-full rounded-full" style={{ width: `${servicioMetrics.estandaresAtencion}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. LLEGADAS TARDE */}
      {/* ======================================================== */}
      {selectedSubTab === "llegadas" && (
        <div className="space-y-6">
          {/* Tarjetas Principales de Llegadas Tarde */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Tasa de Puntualidad
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-brand-ink">{llegadasMetrics.tasaPuntualidad}%</span>
                <span className="text-xs font-bold text-emerald-700">A tiempo</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Basado en {llegadasMetrics.totalMarcaciones} turnos evaluados
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Llegadas Tarde Registradas
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-red-600">
                  {llegadasMetrics.totalTardanzas}
                </span>
                <span className="text-xs font-bold text-red-600">Eventos</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Conteo desde el minuto 1
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Minutos Acumulados
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-amber-700">
                  {llegadasMetrics.totalMinutosTardanza} min
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Tiempo faltante acumulado
              </span>
            </div>

            <div className="bg-white border-2 border-brand-ink p-4 rounded-xl shadow-[2px_2px_0px_0px_#1C1917]">
              <span className="text-[10px] font-black uppercase text-brand-ink/60 tracking-wider block">
                Estado Disciplinario
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black font-mono text-emerald-700">Controlado</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">
                Sede {localName}
              </span>
            </div>
          </div>

          {/* Tabla de Ranking de Puntualidad y Tardanzas por Colaborador */}
          <div className="bg-white border-2 border-brand-ink rounded-xl shadow-[3px_3px_0px_0px_#1C1917] overflow-hidden">
            <div className="bg-zinc-50 px-5 py-3 border-b-2 border-brand-ink flex items-center justify-between">
              <h3 className="text-sm font-black text-brand-ink uppercase tracking-wide flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#1E3E30]" />
                <span>Consolidado de Puntualidad y Llegadas Tarde por Colaborador</span>
              </h3>
              <span className="text-[10px] font-bold bg-white px-2 py-0.5 border border-brand-ink/30 rounded">
                Reportes POS & Nómina
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100/70 border-b border-brand-ink/20 text-brand-ink font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Colaborador</th>
                    <th className="py-2.5 px-4">Cargo</th>
                    <th className="py-2.5 px-4 text-center">Turnos Auditados</th>
                    <th className="py-2.5 px-4 text-center">Llegadas Tarde</th>
                    <th className="py-2.5 px-4 text-center">Minutos Totales</th>
                    <th className="py-2.5 px-4 text-right">Tasa de Puntualidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {llegadasMetrics.rankingColaboradores.map((colab, idx) => {
                    const colabPuntualidad = colab.totalTurnos > 0 
                      ? Math.round(((colab.totalTurnos - colab.tardanzas) / colab.totalTurnos) * 100) 
                      : 100;

                    return (
                      <tr key={idx} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-brand-ink">{colab.nombre}</td>
                        <td className="py-3 px-4 text-zinc-600">{colab.cargo}</td>
                        <td className="py-3 px-4 text-center font-mono">{colab.totalTurnos || 1}</td>
                        <td className="py-3 px-4 text-center font-mono">
                          {colab.tardanzas === 0 ? (
                            <span className="text-emerald-700 font-bold">0</span>
                          ) : (
                            <span className="text-red-600 font-bold">{colab.tardanzas}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          {colab.minutos > 0 ? `${colab.minutos} min` : "0 min"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            colabPuntualidad >= 95
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : colabPuntualidad >= 80
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-red-100 text-red-900 border border-red-300"
                          }`}>
                            {colabPuntualidad}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalle Cronológico de Eventos de Tardanza */}
          <div className="bg-white border-2 border-brand-ink rounded-xl shadow-[3px_3px_0px_0px_#1C1917] p-5">
            <h3 className="text-sm font-black text-brand-ink uppercase tracking-wide mb-3 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Historial de Marcaciones con Tardanza Registrada</span>
            </h3>

            {llegadasMetrics.ultimasTardanzas.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-lg text-center">
                🎉 No hay registros de llegadas tarde en el periodo seleccionado. ¡Excelente puntualidad del equipo!
              </div>
            ) : (
              <div className="space-y-2">
                {llegadasMetrics.ultimasTardanzas.map((tard, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-red-50/50 border border-red-200 rounded-lg text-xs gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-1.5 bg-red-100 text-red-800 rounded">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-brand-ink">{tard.empleadoNombre}</span>
                        <span className="text-zinc-500 text-[11px] block">{tard.fecha} • Programado: {tard.horaIngresoProgramada || "12:00 PM"} → Marcó: {tard.horaIngreso || "12:10 PM"}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-right">
                      <span className="text-red-700 font-bold font-mono px-2 py-0.5 bg-red-100 rounded text-[11px]">
                        +{tard.minutosFaltantes} min de retraso
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
