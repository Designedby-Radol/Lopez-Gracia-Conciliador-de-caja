import React, { useId, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, Download, Info, Loader2, Receipt, RefreshCw, Search } from "lucide-react";
import { inventarioPosAdapter, type CostoVentasPOSResp } from "../../db/inventarioPosAdapter";
import { margenBruto, normalizarNombre, type CostoVentaPOS } from "../../lib/inventarioPos";
import { startOfMonthIso, todayBogota } from "../../lib/dates";
import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_ETIQUETA,
  CLASE_INPUT,
  CLASE_TARJETA,
  CLASE_TD_FIJA,
  CLASE_TH_FIJA,
  exportarExcel,
  formatoCantidad,
  formatoCostoUnitario,
  formatoFecha,
  formatoMoneda,
  formatoPorcentaje,
  mensajeError,
  nombreArchivoExcel,
  useBodegasPOS,
  useConsultaPOS,
  validarRango,
} from "./formatos";

type Columna = "nombre" | "cantidad" | "ventaNeta" | "costoUnitario" | "costoTotal" | "margen";

const COLUMNAS: { col: Columna; titulo: string; derecha: boolean }[] = [
  { col: "nombre", titulo: "Producto", derecha: false },
  { col: "cantidad", titulo: "Cantidad", derecha: true },
  { col: "ventaNeta", titulo: "Venta neta", derecha: true },
  { col: "costoUnitario", titulo: "Costo unit.", derecha: true },
  { col: "costoTotal", titulo: "Costo total", derecha: true },
  { col: "margen", titulo: "Margen %", derecha: true },
];

/** Ordena por la columna elegida; los márgenes vacíos (venta $0) siempre al final. */
function ordenar(items: CostoVentaPOS[], col: Columna, asc: boolean): CostoVentaPOS[] {
  const dir = asc ? 1 : -1;
  return [...items].sort((a, b) => {
    if (col === "nombre") return dir * a.nombre.localeCompare(b.nombre, "es");
    if (col === "margen") {
      if (a.margen === null || b.margen === null) return a.margen === b.margen ? 0 : a.margen === null ? 1 : -1;
      return dir * (a.margen - b.margen);
    }
    return dir * (a[col] - b[col]) || a.nombre.localeCompare(b.nombre, "es");
  });
}

export default function CostoVentasPOS({ localName }: { localName: string }) {
  const hoy = todayBogota();
  const id = useId();
  const [desde, setDesde] = useState<string>(() => startOfMonthIso(todayBogota()));
  const [hasta, setHasta] = useState<string>(() => todayBogota());
  const [bodegaSel, setBodegaSel] = useState<{ local: string; id: number | null }>({ local: localName, id: null });
  const bodegaId = bodegaSel.local === localName ? bodegaSel.id : null;
  const bodegas = useBodegasPOS(localName);

  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState("todos");
  // Las filas con venta $0 son componentes ya incluidos en el costo del producto vendido.
  const [incluirSinVenta, setIncluirSinVenta] = useState(false);
  const [orden, setOrden] = useState<{ col: Columna; asc: boolean }>({ col: "costoTotal", asc: false });
  const [exportando, setExportando] = useState(false);

  const errorRango = validarRango(desde, hasta, hoy);
  const { datos, cargando, error, recargar } = useConsultaPOS<CostoVentasPOSResp>(
    errorRango ? null : () => inventarioPosAdapter.getCostoVentas(localName, { desde, hasta, bodegaId }),
    [localName, desde, hasta, bodegaId, errorRango],
    400,
  );
  const listo = datos && datos.configurado ? datos : null;
  const listaAdvertencias = listo?.advertencias ?? [];
  const costoDeInventario = listo?.fuenteCosto === "inventario";

  const grupos = useMemo(
    () => [...new Set<string>((listo?.items ?? []).map((i) => i.grupo))].sort((a, b) => a.localeCompare(b, "es")),
    [listo],
  );
  // Si el grupo elegido no existe en los datos nuevos (otro rango o bodega), se vuelve a "todos".
  const grupoActivo = grupo === "todos" || grupos.includes(grupo) ? grupo : "todos";

  const filtrados = useMemo(() => {
    const q = normalizarNombre(busqueda);
    const visibles = (listo?.items ?? []).filter(
      (i) =>
        (grupoActivo === "todos" || i.grupo === grupoActivo) &&
        (incluirSinVenta || i.ventaNeta !== 0) &&
        (!q || normalizarNombre(`${i.nombre} ${i.grupo} ${i.subgrupo}`).includes(q)),
    );
    return ordenar(visibles, orden.col, orden.asc);
  }, [listo, busqueda, grupoActivo, incluirSinVenta, orden]);

  // El pie suma solo productos con venta: el costo de los componentes ya está en el de su producto.
  const totalMostrado = useMemo(() => {
    const vendidos = filtrados.filter((i) => i.ventaNeta !== 0);
    const venta = vendidos.reduce((acc, i) => acc + i.ventaNeta, 0);
    const costo = vendidos.reduce((acc, i) => acc + i.costoTotal, 0);
    return { productos: vendidos.length, cantidad: vendidos.reduce((acc, i) => acc + i.cantidad, 0), venta, costo, margen: margenBruto(venta, costo) };
  }, [filtrados]);

  const sinVenta = (listo?.items ?? []).filter((i) => i.ventaNeta === 0).length;
  const foodCost = listo && listo.totales.ventaNeta > 0 ? listo.totales.costoTotal / listo.totales.ventaNeta : null;

  const cambiarOrden = (col: Columna) =>
    setOrden((prev) => (prev.col === col ? { col, asc: !prev.asc } : { col, asc: col === "nombre" }));

  const exportar = async () => {
    if (!listo || exportando) return;
    setExportando(true);
    try {
      const filas = filtrados.map((i) => ({
        Producto: i.nombre,
        Grupo: i.grupo,
        Subgrupo: i.subgrupo,
        Cantidad: i.cantidad,
        "Venta neta": i.ventaNeta,
        "Costo unitario": i.costoUnitario,
        "Costo total": i.costoTotal,
        "Margen %": i.margen === null ? null : Math.round(i.margen * 1000) / 10,
      }));
      const resumen = [
        { Campo: "Local", Valor: localName },
        { Campo: "Bodega", Valor: listo.bodega.nombre },
        { Campo: "Desde", Valor: listo.desde },
        { Campo: "Hasta", Valor: listo.hasta },
        { Campo: "Venta neta", Valor: listo.totales.ventaNeta },
        { Campo: "Costo total", Valor: listo.totales.costoTotal },
        {
          Campo: "Fuente del costo",
          Valor: costoDeInventario ? "Consumo de inventario por ventas (kardex)" : "Reporte de IntuiPOS (productos con venta)",
        },
        { Campo: "Costo de receta (reporte)", Valor: listo.costoReporte },
        { Campo: "Margen bruto %", Valor: listo.totales.margen === null ? null : Math.round(listo.totales.margen * 1000) / 10 },
        { Campo: "Food cost %", Valor: foodCost === null ? null : Math.round(foodCost * 1000) / 10 },
      ];
      await exportarExcel(nombreArchivoExcel("costo_ventas", listo.bodega.nombre, listo.desde, listo.hasta), [
        { nombre: "Costo de ventas", filas },
        { nombre: "Resumen", filas: resumen },
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
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Costo de ventas (IntuiPOS)</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Venta neta frente al costo de receta de cada producto vendido, por día comercial (de 4:00 a. m. a 4:00 a. m.).
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
            disabled={!listo || filtrados.length === 0 || exportando}
            title="Exporta las filas visibles con los filtros aplicados"
            className={CLASE_BOTON_PRIMARIO}
          >
            {exportando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className={`${CLASE_TARJETA} p-5 space-y-4`}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
              onChange={(e) => {
                const valor = Number(e.target.value);
                setBodegaSel({ local: localName, id: !valor || valor === bodegas.bodegaLocal?.id ? null : valor });
              }}
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
            <label htmlFor={`${id}-buscar`} className={CLASE_ETIQUETA}>Buscar producto</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id={`${id}-buscar`}
                type="search"
                placeholder="Producto, grupo o subgrupo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className={`${CLASE_INPUT} pl-8 font-medium`}
              />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 min-w-0">
            <label htmlFor={`${id}-grupo`} className={CLASE_ETIQUETA}>Grupo</label>
            <select id={`${id}-grupo`} value={grupoActivo} onChange={(e) => setGrupo(e.target.value)} className={`${CLASE_INPUT} cursor-pointer`}>
              <option value="todos">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g} value={g}>{g || "Sin grupo"}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer pt-3 border-t border-slate-100 w-full">
          <input
            type="checkbox"
            checked={incluirSinVenta}
            onChange={(e) => setIncluirSinVenta(e.target.checked)}
            className="w-4 h-4 rounded accent-[#1E3E30] cursor-pointer"
          />
          <span>Mostrar componentes de combos (venta $0){listo ? ` · ${sinVenta}` : ""}</span>
        </label>
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
            <span>No se pudo consultar el costo de ventas: {error}</span>
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
        <div aria-busy="true" className={`${CLASE_TARJETA} p-10 flex flex-col items-center justify-center gap-2 text-xs font-bold text-slate-500`}>
          <Loader2 className="w-6 h-6 animate-spin text-[#1E3E30]" />
          <span>Consultando el costo de ventas en IntuiPOS...</span>
        </div>
      )}

      {listo && (
        <div className={`space-y-6 transition-opacity ${cargando ? "opacity-60" : ""}`}>
          {listaAdvertencias.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <ul className="space-y-1 text-xs font-bold min-w-0 break-words">
                {listaAdvertencias.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { titulo: "Venta neta", valor: formatoMoneda(listo.totales.ventaNeta), detalle: "Sin impuestos", tono: "text-slate-900" },
              {
                titulo: "Costo",
                valor: formatoMoneda(listo.totales.costoTotal),
                detalle: costoDeInventario ? "Consumo de inventario por ventas" : "Reporte: productos con venta",
                tono: "text-slate-900",
              },
              {
                titulo: "Margen bruto",
                valor: formatoPorcentaje(listo.totales.margen),
                detalle: "(Venta − costo) / venta",
                tono: (listo.totales.margen ?? 0) < 0 ? "text-red-600" : "text-emerald-700",
              },
              { titulo: "Food cost", valor: formatoPorcentaje(foodCost), detalle: "Costo / venta", tono: "text-slate-900" },
            ].map((t) => (
              <div key={t.titulo} className={`${CLASE_TARJETA} p-4 min-w-0`}>
                <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">{t.titulo}</span>
                <span className={`text-lg font-extrabold font-numeric block mt-1 break-words ${t.tono}`}>{t.valor}</span>
                <span className="text-[11px] text-slate-400 font-medium block">{t.detalle}</span>
              </div>
            ))}
          </div>

          <div className={`${CLASE_TARJETA} p-5 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 break-words min-w-0">{listo.bodega.nombre}</h3>
              <span className="text-xs text-slate-500 font-medium font-numeric">
                Del {formatoFecha(listo.desde)} al {formatoFecha(listo.hasta)} · {listo.items.length} productos
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 font-medium flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="min-w-0">
                Los componentes de combos y subrecetas aparecen con venta $0: su costo ya está incluido en el del producto vendido, por
                eso no se suman.{" "}
                {costoDeInventario
                  ? "El costo total es el consumo de inventario por ventas de la bodega (kardex), que también cuenta los empaques entregados sin precio."
                  : "El costo total suma el costo de receta de los productos con venta."}
              </p>
            </div>

            {filtrados.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                {listo.items.length === 0 ? "IntuiPOS no registra ventas en este rango." : "Ningún producto coincide con los filtros."}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500">
                      {COLUMNAS.map(({ col, titulo, derecha }) => {
                        const activa = orden.col === col;
                        const Icono = !activa ? ChevronsUpDown : orden.asc ? ArrowUp : ArrowDown;
                        return (
                          <th
                            key={col}
                            className={`p-0 ${derecha ? "text-right" : CLASE_TH_FIJA}`}
                            aria-sort={activa ? (orden.asc ? "ascending" : "descending") : "none"}
                          >
                            <button
                              type="button"
                              onClick={() => cambiarOrden(col)}
                              className={`w-full p-3 inline-flex items-center gap-1 font-bold cursor-pointer hover:text-slate-900 ${
                                derecha ? "justify-end" : ""
                              } ${activa ? "text-slate-900" : ""}`}
                            >
                              <span>{titulo}</span>
                              <Icono className={`w-3 h-3 shrink-0 ${activa ? "" : "text-slate-300"}`} />
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((i) => (
                      <tr key={i.posItemId} className="group border-b border-slate-100 hover:bg-slate-50/60">
                        <td className={`p-3 ${CLASE_TD_FIJA}`}>
                          <span className="font-bold text-slate-900 block min-w-[140px]">{i.nombre}</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {i.grupo}
                            {i.subgrupo ? ` · ${i.subgrupo}` : ""}
                          </span>
                        </td>
                        <td className="p-3 text-right font-numeric font-bold text-slate-700 whitespace-nowrap">{formatoCantidad(i.cantidad)}</td>
                        <td className={`p-3 text-right font-numeric font-bold whitespace-nowrap ${i.ventaNeta === 0 ? "text-slate-400" : "text-slate-900"}`}>
                          {formatoMoneda(i.ventaNeta)}
                        </td>
                        <td className="p-3 text-right font-numeric text-slate-600 whitespace-nowrap">{formatoCostoUnitario(i.costoUnitario)}</td>
                        <td className="p-3 text-right font-numeric font-bold text-slate-900 whitespace-nowrap">{formatoMoneda(i.costoTotal)}</td>
                        <td
                          title={i.margen === null ? "Sin venta (componente de combo)" : undefined}
                          className={`p-3 text-right font-numeric font-bold whitespace-nowrap ${
                            i.margen === null ? "text-slate-300" : i.margen < 0 ? "text-red-600" : "text-slate-900"
                          }`}
                        >
                          {formatoPorcentaje(i.margen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                      <td
                        className={`p-3 ${CLASE_TH_FIJA}`}
                        title="Solo productos con venta: el costo de las filas con venta $0 ya está en el de su producto"
                      >
                        Total productos vendidos ({totalMostrado.productos})
                      </td>
                      <td className="p-3 text-right font-numeric whitespace-nowrap">{formatoCantidad(totalMostrado.cantidad)}</td>
                      <td className="p-3 text-right font-numeric whitespace-nowrap">{formatoMoneda(totalMostrado.venta)}</td>
                      <td className="p-3" />
                      <td className="p-3 text-right font-numeric whitespace-nowrap">{formatoMoneda(totalMostrado.costo)}</td>
                      <td className={`p-3 text-right font-numeric whitespace-nowrap ${(totalMostrado.margen ?? 0) < 0 ? "text-red-600" : ""}`}>
                        {formatoPorcentaje(totalMostrado.margen)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
