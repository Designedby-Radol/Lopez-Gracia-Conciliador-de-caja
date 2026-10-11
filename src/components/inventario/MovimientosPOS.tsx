import React, { useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  ListOrdered,
  Loader2,
  RefreshCw,
  Search,
  TableProperties,
} from "lucide-react";
import { inventarioPosAdapter, type MovimientosPOSResp } from "../../db/inventarioPosAdapter";
import {
  ETIQUETA_CATEGORIA,
  normalizarNombre,
  type CategoriaMovimiento,
  type KardexItemPOS,
  type MovimientoPOS,
} from "../../lib/inventarioPos";
import { addDaysIso, todayBogota } from "../../lib/dates";
import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_ETIQUETA,
  CLASE_INPUT,
  CLASE_TARJETA,
  CLASE_TD_FIJA,
  CLASE_TH_FIJA,
  TONO_CATEGORIA,
  claseChip,
  exportarExcel,
  formatoCantidad,
  formatoCantidadConSigno,
  formatoCostoUnitario,
  formatoFecha,
  formatoFechaHora,
  formatoMoneda,
  mensajeError,
  nombreArchivoExcel,
  useBodegasPOS,
  useConsultaPOS,
  validarRango,
} from "./formatos";

const ORDEN_CATEGORIAS = Object.keys(ETIQUETA_CATEGORIA) as CategoriaMovimiento[];

/** "Compras: +1.000 · Traslados recibidos: +500" para el detalle de entradas/salidas del kardex. */
function desglose(k: KardexItemPOS, signo: 1 | -1): string {
  return ORDEN_CATEGORIAS.filter((c) => c !== "ajuste" && (k.porCategoria[c] ?? 0) * signo > 0)
    .map((c) => `${ETIQUETA_CATEGORIA[c]}: ${formatoCantidadConSigno(k.porCategoria[c], k.unidad)}`)
    .join(" · ");
}

function resumenMovimiento(m: MovimientoPOS): string {
  const partes = [
    m.proveedor && `Proveedor: ${m.proveedor}`,
    m.origen && `Origen: ${m.origen}`,
    m.documentoExterno && `Doc. ${m.documentoExterno}`,
    m.observaciones,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sin observaciones";
}

/** Cantidad con color: verde si suma, rojo si resta, gris tenue si es cero. */
function CeldaCantidad({ valor, unidad, titulo }: { valor: number | null; unidad?: string; titulo?: string }) {
  const color = valor === null || Math.abs(valor) < 0.005 ? "text-slate-300" : valor > 0 ? "text-emerald-700" : "text-red-600";
  return (
    <td title={titulo || undefined} className={`p-3 text-right font-numeric font-bold whitespace-nowrap ${color}`}>
      {formatoCantidadConSigno(valor, unidad)}
    </td>
  );
}

export default function MovimientosPOS({ localName }: { localName: string }) {
  const hoy = todayBogota();
  const id = useId();
  const [desde, setDesde] = useState<string>(() => addDaysIso(todayBogota(), -6));
  const [hasta, setHasta] = useState<string>(() => todayBogota());
  const [bodegaSel, setBodegaSel] = useState<{ local: string; id: number | null }>({ local: localName, id: null });
  const bodegaId = bodegaSel.local === localName ? bodegaSel.id : null;
  const bodegas = useBodegasPOS(localName);

  const [vista, setVista] = useState<"movimientos" | "kardex">("movimientos");
  const [categoria, setCategoria] = useState<CategoriaMovimiento | "todas">("todas");
  const [busqueda, setBusqueda] = useState("");
  const [soloConMovimiento, setSoloConMovimiento] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<number>>(() => new Set());
  const [exportando, setExportando] = useState(false);

  const errorRango = validarRango(desde, hasta, hoy);
  const { datos, cargando, error, recargar } = useConsultaPOS<MovimientosPOSResp>(
    errorRango ? null : () => inventarioPosAdapter.getMovimientos(localName, { desde, hasta, bodegaId }),
    [localName, desde, hasta, bodegaId, errorRango],
    400,
  );
  const listo = datos && datos.configurado ? datos : null;

  const q = normalizarNombre(busqueda);

  const conteoPorCategoria = useMemo(() => {
    const conteo: Partial<Record<CategoriaMovimiento, number>> = {};
    for (const m of listo?.movimientos ?? []) conteo[m.categoria] = (conteo[m.categoria] ?? 0) + 1;
    return conteo;
  }, [listo]);
  const categoriasPresentes = ORDEN_CATEGORIAS.filter((c) => conteoPorCategoria[c]);
  // Si la categoría elegida no tiene movimientos en el rango nuevo, se vuelve a "todas".
  const categoriaActiva = categoria === "todas" || conteoPorCategoria[categoria] ? categoria : "todas";
  const categoriasConTotales = ORDEN_CATEGORIAS.filter((c) => listo?.totalesPorCategoria[c]);

  const movimientosFiltrados = useMemo(
    () =>
      (listo?.movimientos ?? []).filter(
        (m) =>
          (categoriaActiva === "todas" || m.categoria === categoriaActiva) &&
          (!q ||
            normalizarNombre(
              [m.tipo, m.observaciones, m.proveedor, m.origen, m.documentoExterno, m.terminal, String(m.id), ...m.lineas.map((l) => l.nombre)].join(" "),
            ).includes(q)),
      ),
    [listo, categoriaActiva, q],
  );

  const kardexFiltrado = useMemo(
    () =>
      (listo?.kardex ?? []).filter(
        (k) =>
          (!q || normalizarNombre(`${k.nombre} ${k.grupo}`).includes(q)) &&
          (!soloConMovimiento || Object.values(k.porCategoria).some((v) => v !== 0) || (k.ventasCalculadas ?? 0) !== 0),
      ),
    [listo, q, soloConMovimiento],
  );

  const alternar = (movId: number) =>
    setExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(movId)) nuevo.delete(movId);
      else nuevo.add(movId);
      return nuevo;
    });

  const cambiarBodega = (valor: number) =>
    setBodegaSel({ local: localName, id: !valor || valor === bodegas.bodegaLocal?.id ? null : valor });

  const exportar = async () => {
    if (!listo || exportando) return;
    setExportando(true);
    try {
      const categoriasKardex = ORDEN_CATEGORIAS.filter((c) => kardexFiltrado.some((k) => k.porCategoria[c] !== undefined));
      const kardex = kardexFiltrado.map((k) => {
        const fila: Record<string, string | number | null> = {
          Insumo: k.nombre,
          Grupo: k.grupo,
          Unidad: k.unidad,
          Inicial: k.inicial,
          Entradas: k.entradas,
          Salidas: k.salidas,
          Ajustes: k.ajustes,
          "Ventas (calc.)": k.ventasCalculadas,
          Final: k.final,
          "Costo unitario": k.costoUnitario,
          "Valor final": k.valorFinal,
        };
        for (const c of categoriasKardex) fila[ETIQUETA_CATEGORIA[c]] = k.porCategoria[c] ?? 0;
        return fila;
      });
      const lineas = movimientosFiltrados.flatMap((m) =>
        (m.lineas.length ? m.lineas : [null]).map((l) => ({
          Fecha: m.fecha.slice(0, 19).replace("T", " "),
          Movimiento: m.id,
          Tipo: m.tipo,
          Anulado: m.anulado ? "Sí" : "No",
          Proveedor: m.proveedor,
          Origen: m.origen,
          Documento: m.documentoExterno,
          Observaciones: m.observaciones,
          Insumo: l?.nombre ?? "",
          Cantidad: l?.cantidad ?? null,
          Unidad: l?.unidad ?? "",
          "Costo unitario": l?.costoUnitario ?? null,
          Valor: l?.valor ?? null,
          "Observación línea": l?.observacion ?? "",
        })),
      );
      await exportarExcel(nombreArchivoExcel("movimientos", listo.bodega.nombre, listo.desde, listo.hasta), [
        { nombre: "Kardex", filas: kardex },
        { nombre: "Movimientos", filas: lineas },
      ]);
    } catch (e) {
      alert(`No se pudo exportar el Excel: ${mensajeError(e)}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0" aria-busy={cargando}>
      {/* Encabezado */}
      <div className={`${CLASE_TARJETA} p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="min-w-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1E3E30] flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Movimientos de inventario (IntuiPOS)</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Compras, traslados, producción, bajas y ajustes por día comercial (de 4:00 a. m. a 4:00 a. m.).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={recargar} disabled={!!errorRango || cargando} className={CLASE_BOTON_SECUNDARIO}>
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={!listo || exportando || (kardexFiltrado.length === 0 && movimientosFiltrados.length === 0)}
            title="Exporta el kardex y los movimientos visibles con los filtros aplicados"
            className={CLASE_BOTON_PRIMARIO}
          >
            {exportando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className={`${CLASE_TARJETA} p-5`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="min-w-0">
            <label htmlFor={`${id}-desde`} className={CLASE_ETIQUETA}>Desde</label>
            <input
              id={`${id}-desde`}
              type="date"
              required
              max={hasta && hasta < hoy ? hasta : hoy}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={`${CLASE_INPUT} font-numeric`}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor={`${id}-hasta`} className={CLASE_ETIQUETA}>Hasta</label>
            <input
              id={`${id}-hasta`}
              type="date"
              required
              min={desde || undefined}
              max={hoy}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={`${CLASE_INPUT} font-numeric`}
            />
          </div>
          <div className="col-span-2 sm:col-span-1 min-w-0">
            <label htmlFor={`${id}-bodega`} className={CLASE_ETIQUETA}>Bodega</label>
            <select
              id={`${id}-bodega`}
              value={bodegaId ?? bodegas.bodegaLocal?.id ?? ""}
              disabled={!bodegas.bodegaLocal}
              onChange={(e) => cambiarBodega(Number(e.target.value))}
              className={`${CLASE_INPUT} cursor-pointer`}
            >
              {!bodegas.bodegaLocal && <option value="">Bodega del local</option>}
              {bodegas.opciones.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id === bodegas.bodegaLocal?.id ? `${b.nombre} (local)` : `${b.nombre}${b.puntoDeVentaNombre ? ` · ${b.puntoDeVentaNombre}` : ""}`}
                </option>
              ))}
            </select>
            {bodegas.error && (
              <span className="text-[11px] text-red-600 font-medium block mt-1">No se pudo cargar la lista de bodegas.</span>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1 min-w-0">
            <label htmlFor={`${id}-buscar`} className={CLASE_ETIQUETA}>Buscar</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id={`${id}-buscar`}
                type="search"
                placeholder="Insumo, proveedor, observación..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className={`${CLASE_INPUT} pl-8 font-medium`}
              />
            </div>
          </div>
        </div>
      </div>

      {errorRango && (
        <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold p-3 rounded-xl">
          {errorRango}
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm font-bold p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="flex items-start gap-2 min-w-0 break-words">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>No se pudieron consultar los movimientos: {error}</span>
          </span>
          <button type="button" onClick={recargar} className="text-xs font-bold underline cursor-pointer shrink-0 self-start sm:self-auto">
            Reintentar
          </button>
        </div>
      )}

      {datos && !datos.configurado && (
        <div className={`${CLASE_TARJETA} p-5 flex items-start gap-3`}>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900">IntuiPOS no está configurado para {localName}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1 break-words">{datos.razon}</p>
          </div>
        </div>
      )}

      {cargando && !datos && (
        <div aria-busy="true" className={`${CLASE_TARJETA} p-10 flex flex-col items-center justify-center gap-2 text-xs font-bold text-slate-500 text-center`}>
          <Loader2 className="w-6 h-6 animate-spin text-[#1E3E30]" />
          <span>Consultando movimientos en IntuiPOS...</span>
          <span className="font-medium text-slate-400">Puede tardar unos segundos: se descarga el detalle de cada documento.</span>
        </div>
      )}

      {listo && (
        <div className={`space-y-6 transition-opacity ${cargando ? "opacity-60" : ""}`}>
          {listo.advertencias.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <ul className="space-y-1 text-xs font-bold min-w-0 break-words">
                {listo.advertencias.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Totales por categoría (sin anulados) */}
          {categoriasConTotales.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {categoriasConTotales.map((c) => {
                const t = listo.totalesPorCategoria[c]!;
                return (
                  <div key={c} className={`${CLASE_TARJETA} p-4 min-w-0`}>
                    <span className={claseChip(TONO_CATEGORIA[c])}>{ETIQUETA_CATEGORIA[c]}</span>
                    <span
                      className={`text-base font-extrabold font-numeric block mt-2 break-words ${
                        t.valor < 0 ? "text-red-600" : t.valor > 0 ? "text-emerald-700" : "text-slate-900"
                      }`}
                    >
                      {formatoMoneda(t.valor)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium block">
                      {t.movimientos} {t.movimientos === 1 ? "movimiento" : "movimientos"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`${CLASE_TARJETA} p-5 space-y-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-slate-900 break-words">{listo.bodega.nombre}</h3>
                <span className="text-xs text-slate-500 font-medium font-numeric">
                  Del {formatoFecha(listo.desde)} al {formatoFecha(listo.hasta)}
                </span>
              </div>
              <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1 self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => setVista("movimientos")}
                  aria-pressed={vista === "movimientos"}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                    vista === "movimientos" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Por movimiento ({listo.movimientos.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVista("kardex")}
                  aria-pressed={vista === "kardex"}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                    vista === "kardex" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <TableProperties className="w-3.5 h-3.5" />
                  <span>Kardex por insumo ({listo.kardex.length})</span>
                </button>
              </div>
            </div>

            {vista === "movimientos" && (
              <div className="space-y-4">
                {categoriasPresentes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoría">
                    <button
                      type="button"
                      onClick={() => setCategoria("todas")}
                      aria-pressed={categoriaActiva === "todas"}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                        categoriaActiva === "todas"
                          ? "bg-[#1E3E30] text-white border-[#1E3E30]"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Todas ({listo.movimientos.length})
                    </button>
                    {categoriasPresentes.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategoria(categoriaActiva === c ? "todas" : c)}
                        aria-pressed={categoriaActiva === c}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          categoriaActiva === c
                            ? "bg-[#1E3E30] text-white border-[#1E3E30]"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {ETIQUETA_CATEGORIA[c]} ({conteoPorCategoria[c]})
                      </button>
                    ))}
                  </div>
                )}

                {movimientosFiltrados.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                    {listo.movimientos.length === 0
                      ? "IntuiPOS no registra movimientos de inventario en este rango (las ventas no se listan: se calculan en el kardex)."
                      : "Ningún movimiento coincide con los filtros."}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {movimientosFiltrados.map((m) => {
                      const abierto = expandidos.has(m.id);
                      return (
                        <div
                          key={m.id}
                          className={`border border-slate-200/80 rounded-xl bg-white overflow-hidden ${m.anulado ? "opacity-70" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => alternar(m.id)}
                            aria-expanded={abierto}
                            className="w-full p-3.5 bg-slate-50/50 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-numeric whitespace-nowrap">
                                  {formatoFechaHora(m.fecha)}
                                </span>
                                <span className={claseChip(TONO_CATEGORIA[m.categoria] ?? "gris")}>{m.tipo}</span>
                                {m.anulado && <span className={claseChip("rojo")}>Anulado</span>}
                                {!m.afectaExistencia && <span className={claseChip("gris")}>Informativo</span>}
                                <span className="text-[11px] text-slate-400 font-numeric">#{m.id}</span>
                              </div>
                              <span className={`text-xs font-medium text-slate-600 block mt-1.5 break-words ${m.anulado ? "line-through" : ""}`}>
                                {resumenMovimiento(m)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <span className="text-[11px] text-slate-500 font-medium">
                                {m.lineas.length} {m.lineas.length === 1 ? "insumo" : "insumos"}
                              </span>
                              <span
                                className={`text-sm font-extrabold font-numeric ${
                                  m.anulado ? "line-through text-slate-400" : m.valorTotal < 0 ? "text-red-600" : "text-slate-900"
                                }`}
                              >
                                {formatoMoneda(m.valorTotal)}
                              </span>
                              {abierto ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </div>
                          </button>

                          {abierto && (
                            <div className="p-4 border-t border-slate-100 bg-white space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                                {[
                                  ["Terminal", m.terminal],
                                  ["Proveedor", m.proveedor],
                                  ["Origen", m.origen],
                                  ["Documento externo", m.documentoExterno],
                                ]
                                  .filter(([, v]) => v)
                                  .map(([k, v]) => (
                                    <div key={k} className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 min-w-0">
                                      <span className="text-[11px] font-bold text-slate-400 block">{k}</span>
                                      <span className="font-bold text-slate-800 break-words">{v}</span>
                                    </div>
                                  ))}
                              </div>
                              {m.observaciones && (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium break-words">
                                  <strong>Observaciones:</strong> {m.observaciones}
                                </div>
                              )}
                              {m.lineas.length === 0 ? (
                                <p className="text-xs text-slate-400 font-medium">IntuiPOS no devolvió líneas para este documento.</p>
                              ) : (
                                <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500">
                                        <th className={`p-3 ${CLASE_TH_FIJA}`}>Insumo</th>
                                        <th className="p-3 text-right">Cantidad</th>
                                        <th className="p-3 text-right">Costo unit.</th>
                                        <th className="p-3 text-right">Valor</th>
                                        <th className="p-3">Observación</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {m.lineas.map((l, i) => (
                                        <tr key={`${l.posItemId}-${i}`} className="group border-b border-slate-100 hover:bg-slate-50/60">
                                          <td className={`p-3 ${CLASE_TD_FIJA}`}>
                                            <span className="font-bold text-slate-900 block min-w-[140px]">{l.nombre}</span>
                                            {l.grupo && <span className="text-[11px] text-slate-500 font-medium">{l.grupo}</span>}
                                          </td>
                                          <CeldaCantidad valor={l.cantidad} unidad={l.unidad} />
                                          <td className="p-3 text-right font-numeric text-slate-600 whitespace-nowrap">
                                            {formatoCostoUnitario(l.costoUnitario)}
                                          </td>
                                          <td className={`p-3 text-right font-numeric font-bold whitespace-nowrap ${l.valor < 0 ? "text-red-600" : "text-slate-900"}`}>
                                            {formatoMoneda(l.valor)}
                                          </td>
                                          <td className="p-3 text-slate-600 font-medium break-words">{l.observacion || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
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
            )}

            {vista === "kardex" && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 font-medium flex items-start gap-2">
                  <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="min-w-0">
                    <strong className="text-slate-800">Ventas (calc.)</strong> = Final − Inicial − movimientos registrados (entradas, salidas y
                    ajustes). Incluye el consumo por recetas de lo vendido, que IntuiPOS descuenta en cientos de documentos al día y por eso no
                    se listan uno a uno. Normalmente es negativo; un valor positivo indica entradas sin registrar. Inicial = cierre del{" "}
                    <span className="font-numeric">{formatoFecha(addDaysIso(listo.desde, -1))}</span>; Final = cierre del{" "}
                    <span className="font-numeric">{formatoFecha(listo.hasta)}</span>.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soloConMovimiento}
                    onChange={(e) => setSoloConMovimiento(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#1E3E30] cursor-pointer"
                  />
                  <span>Solo insumos con movimiento</span>
                </label>

                {kardexFiltrado.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                    {listo.kardex.length === 0 ? "No hay insumos en el kardex de este rango." : "Ningún insumo coincide con los filtros."}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500">
                          <th className={`p-3 ${CLASE_TH_FIJA}`}>Insumo</th>
                          <th className="p-3 text-right">Inicial</th>
                          <th className="p-3 text-right">Entradas</th>
                          <th className="p-3 text-right">Salidas</th>
                          <th className="p-3 text-right">Ajustes</th>
                          <th className="p-3 text-right">Ventas (calc.)</th>
                          <th className="p-3 text-right">Final</th>
                          <th className="p-3 text-right">Valor final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kardexFiltrado.map((k) => (
                          <tr key={k.posItemId} className="group border-b border-slate-100 hover:bg-slate-50/60">
                            <td className={`p-3 ${CLASE_TD_FIJA}`}>
                              <span className="font-bold text-slate-900 block min-w-[140px]">{k.nombre}</span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {k.grupo}
                                {k.unidad ? ` · ${k.unidad}` : ""}
                              </span>
                            </td>
                            <td className="p-3 text-right font-numeric font-bold text-slate-700 whitespace-nowrap">{formatoCantidad(k.inicial)}</td>
                            <CeldaCantidad valor={k.entradas} titulo={desglose(k, 1)} />
                            <CeldaCantidad valor={k.salidas} titulo={desglose(k, -1)} />
                            <CeldaCantidad valor={k.ajustes} />
                            <CeldaCantidad valor={k.ventasCalculadas} />
                            <td className={`p-3 text-right font-numeric font-bold whitespace-nowrap ${(k.final ?? 0) < 0 ? "text-red-600" : "text-slate-900"}`}>
                              {formatoCantidad(k.final)}
                            </td>
                            <td className="p-3 text-right font-numeric font-bold text-slate-900 whitespace-nowrap">{formatoMoneda(k.valorFinal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
