import React, { useId, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Download, Info, Loader2, RefreshCw, Search, Warehouse } from "lucide-react";
import { inventarioPosAdapter, type ExistenciasPOSResp } from "../../db/inventarioPosAdapter";
import { esFechaIso, normalizarNombre, type EstadoExistencia, type ExistenciaPOS } from "../../lib/inventarioPos";
import { todayBogota } from "../../lib/dates";
import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_ETIQUETA,
  CLASE_INPUT,
  CLASE_TARJETA,
  CLASE_TD_FIJA,
  CLASE_TH_FIJA,
  ChipEstado,
  ESTADO_EXISTENCIA,
  exportarExcel,
  formatoCantidad,
  formatoCostoUnitario,
  formatoFecha,
  formatoFechaHora,
  formatoMoneda,
  mensajeError,
  nombreArchivoExcel,
  useBodegasPOS,
  useConsultaPOS,
} from "./formatos";

const ESTADOS = Object.keys(ESTADO_EXISTENCIA) as EstadoExistencia[];

function TarjetaResumen({
  titulo,
  valor,
  detalle,
  tono,
  activa,
  onClick,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  tono: string;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`${CLASE_TARJETA} p-4 text-left min-w-0 transition-all cursor-pointer hover:border-slate-300 ${
        activa ? "ring-2 ring-[#1E3E30]/30 border-[#1E3E30]/40" : ""
      }`}
    >
      <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">{titulo}</span>
      <span className={`text-lg font-extrabold font-numeric block mt-1 break-words ${tono}`}>{valor}</span>
      <span className="text-[11px] text-slate-400 font-medium block">{detalle}</span>
    </button>
  );
}

export default function ExistenciasPOS({ localName }: { localName: string }) {
  const hoy = todayBogota();
  const id = useId();
  const [fecha, setFecha] = useState<string>(() => todayBogota());
  const [bodegaSel, setBodegaSel] = useState<{ local: string; id: number | null }>({ local: localName, id: null });
  const bodegaId = bodegaSel.local === localName ? bodegaSel.id : null;
  const bodegas = useBodegasPOS(localName);

  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState("todos");
  const [estado, setEstado] = useState<EstadoExistencia | "todos">("todos");
  const [exportando, setExportando] = useState(false);

  const fechaValida = esFechaIso(fecha) && fecha <= hoy;
  const { datos, cargando, error, recargar } = useConsultaPOS<ExistenciasPOSResp>(
    fechaValida ? () => inventarioPosAdapter.getExistencias(localName, { fecha, bodegaId }) : null,
    [localName, fecha, bodegaId, fechaValida],
  );
  const listo = datos && datos.configurado ? datos : null;

  const items = useMemo(
    () =>
      [...(listo?.items ?? [])].sort(
        (a, b) => a.grupo.localeCompare(b.grupo, "es") || a.nombre.localeCompare(b.nombre, "es"),
      ),
    [listo],
  );
  const grupos = useMemo(() => [...new Set<string>(items.map((i) => i.grupo))].sort((a, b) => a.localeCompare(b, "es")), [items]);
  // Si el grupo elegido no existe en la bodega o fecha nueva, se vuelve a "todos".
  const grupoActivo = grupo === "todos" || grupos.includes(grupo) ? grupo : "todos";

  const filtrados = useMemo(() => {
    const q = normalizarNombre(busqueda);
    return items.filter(
      (i) =>
        (grupoActivo === "todos" || i.grupo === grupoActivo) &&
        (estado === "todos" || i.estado === estado) &&
        (!q || normalizarNombre(`${i.nombre} ${i.grupo} ${i.subgrupo}`).includes(q)),
    );
  }, [items, busqueda, grupoActivo, estado]);
  const valorMostrado = filtrados.reduce((acc, i) => acc + (i.valor > 0 ? i.valor : 0), 0);

  const alternarEstado = (e: EstadoExistencia | "todos") => setEstado((prev) => (prev === e ? "todos" : e));

  const exportar = async () => {
    if (!listo || exportando) return;
    setExportando(true);
    try {
      const filas = filtrados.map((i: ExistenciaPOS) => ({
        Insumo: i.nombre,
        Grupo: i.grupo,
        Subgrupo: i.subgrupo,
        Unidad: i.unidad,
        Existencia: i.cantidad,
        "Costo unitario": i.costoUnitario,
        Valor: i.valor,
        "Mínimo": i.minimo || null,
        "Máximo": i.maximo || null,
        Estado: ESTADO_EXISTENCIA[i.estado]?.etiqueta ?? i.estado,
      }));
      const resumen = [
        { Campo: "Local", Valor: localName },
        { Campo: "Bodega", Valor: listo.bodega.nombre },
        { Campo: "Fecha (cierre del día)", Valor: listo.fecha },
        { Campo: "Corte IntuiPOS", Valor: listo.corte },
        { Campo: "Periodo", Valor: listo.periodo },
        { Campo: "Valor del inventario", Valor: listo.resumen.valorTotal },
        { Campo: "Insumos", Valor: listo.resumen.items },
        { Campo: "Negativos", Valor: listo.resumen.negativos },
        { Campo: "Agotados", Valor: listo.resumen.agotados },
        { Campo: "Bajo mínimo", Valor: listo.resumen.bajoMinimo },
        ...listo.advertencias.map((a) => ({ Campo: "Advertencia", Valor: a })),
      ];
      await exportarExcel(nombreArchivoExcel("existencias", listo.bodega.nombre, listo.fecha), [
        { nombre: "Existencias", filas },
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
              <Boxes className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Existencias en IntuiPOS</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Existencias teóricas y valorizadas al cierre del día comercial (corte a las 4:00 a. m. del día siguiente).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={recargar} disabled={!fechaValida || cargando} className={CLASE_BOTON_SECUNDARIO}>
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
      <div className={`${CLASE_TARJETA} p-5`}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="col-span-2 sm:col-span-1 min-w-0">
            <label htmlFor={`${id}-fecha`} className={CLASE_ETIQUETA}>Fecha (cierre del día)</label>
            <input
              id={`${id}-fecha`}
              type="date"
              required
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
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
            <label htmlFor={`${id}-buscar`} className={CLASE_ETIQUETA}>Buscar insumo</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id={`${id}-buscar`}
                type="search"
                placeholder="Nombre, grupo o subgrupo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className={`${CLASE_INPUT} pl-8 font-medium`}
              />
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor={`${id}-grupo`} className={CLASE_ETIQUETA}>Grupo</label>
            <select id={`${id}-grupo`} value={grupoActivo} onChange={(e) => setGrupo(e.target.value)} className={`${CLASE_INPUT} cursor-pointer`}>
              <option value="todos">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g} value={g}>{g || "Sin grupo"}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor={`${id}-estado`} className={CLASE_ETIQUETA}>Estado</label>
            <select
              id={`${id}-estado`}
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoExistencia | "todos")}
              className={`${CLASE_INPUT} cursor-pointer`}
            >
              <option value="todos">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{ESTADO_EXISTENCIA[e].etiqueta}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!fechaValida && (
        <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold p-3 rounded-xl">
          Selecciona una fecha válida que no sea futura.
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm font-bold p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="flex items-start gap-2 min-w-0 break-words">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>No se pudieron consultar las existencias: {error}</span>
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
          <span>Consultando existencias en IntuiPOS...</span>
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TarjetaResumen
              titulo="Valor del inventario"
              valor={formatoMoneda(listo.resumen.valorTotal)}
              detalle={`${listo.resumen.items} insumos · sin negativos`}
              tono="text-slate-900"
              activa={estado === "todos"}
              onClick={() => setEstado("todos")}
            />
            <TarjetaResumen
              titulo="Negativos"
              valor={String(listo.resumen.negativos)}
              detalle="Existencia menor que cero"
              tono={listo.resumen.negativos > 0 ? "text-red-600" : "text-slate-900"}
              activa={estado === "negativo"}
              onClick={() => alternarEstado("negativo")}
            />
            <TarjetaResumen
              titulo="Agotados"
              valor={String(listo.resumen.agotados)}
              detalle="Existencia en cero"
              tono={listo.resumen.agotados > 0 ? "text-orange-600" : "text-slate-900"}
              activa={estado === "agotado"}
              onClick={() => alternarEstado("agotado")}
            />
            <TarjetaResumen
              titulo="Bajo mínimo"
              valor={String(listo.resumen.bajoMinimo)}
              detalle="Según el mínimo de IntuiPOS"
              tono={listo.resumen.bajoMinimo > 0 ? "text-amber-600" : "text-slate-900"}
              activa={estado === "bajo_minimo"}
              onClick={() => alternarEstado("bajo_minimo")}
            />
          </div>

          <div className={`${CLASE_TARJETA} p-5 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 min-w-0">
                <Warehouse className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="break-words">{listo.bodega.nombre}</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium font-numeric">
                Cierre del {formatoFecha(listo.fecha)} · corte {formatoFechaHora(listo.corte)} · periodo {listo.periodo}
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Mostrando <strong className="text-slate-800">{filtrados.length}</strong> de {items.length} insumos · Valor mostrado{" "}
              <strong className="text-slate-800 font-numeric">{formatoMoneda(valorMostrado)}</strong>
            </p>

            {items.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                IntuiPOS no tiene insumos activos en esta bodega.
              </div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                Ningún insumo coincide con los filtros.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500">
                      <th className={`p-3 ${CLASE_TH_FIJA}`}>Insumo</th>
                      <th className="p-3 text-right">Existencia</th>
                      <th className="p-3 text-right">Costo unit.</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-right">Mín / Máx</th>
                      <th className="p-3">Estado</th>
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
                        <td className={`p-3 text-right font-numeric font-bold whitespace-nowrap ${i.cantidad < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {formatoCantidad(i.cantidad, i.unidad)}
                        </td>
                        <td className="p-3 text-right font-numeric text-slate-600 whitespace-nowrap">{formatoCostoUnitario(i.costoUnitario)}</td>
                        <td className={`p-3 text-right font-numeric font-bold whitespace-nowrap ${i.valor < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {formatoMoneda(i.valor)}
                        </td>
                        <td className="p-3 text-right font-numeric text-slate-500 whitespace-nowrap">
                          {i.minimo > 0 ? formatoCantidad(i.minimo) : "—"} / {i.maximo > 0 ? formatoCantidad(i.maximo) : "—"}
                        </td>
                        <td className="p-3">
                          <ChipEstado estado={i.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
