import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, Scale } from "lucide-react";
import { inventarioPosAdapter, type CuadrePOSResp } from "../../db/inventarioPosAdapter";
import { cruzarConteo, diaComercialActual, resumirCuadre, type ConteoParaCuadre } from "../../lib/inventarioPos";
import {
  CLASE_BOTON_PRIMARIO,
  formatoCantidad,
  formatoCantidadConSigno,
  formatoFecha,
  formatoFechaHora,
  formatoMoneda,
  mensajeError,
} from "./formatos";

interface ItemConteo {
  insumoId: string;
  posItemId?: number;
  nombre: string;
  unidad: string;
  rawExpression: string;
  total: number;
}

interface CuadrePOSProps {
  localName: string;
  record: { fecha: string; items: ItemConteo[] };
}

/** Moneda con "+" en los positivos (sin "+$ 0" por redondeo). */
const monedaConSigno = (n: number) => {
  const texto = formatoMoneda(n);
  return n > 0 && texto !== formatoMoneda(0) ? `+${texto}` : texto;
};

const colorDiferencia = (n: number | null) =>
  n === null || Math.abs(n) <= 0.0005 ? "text-slate-500" : n < 0 ? "text-red-700" : "text-emerald-700";

/** Registros antiguos pueden traer total sin expresión: se toman como contados. */
function conteoDelRegistro(items: ItemConteo[]): ConteoParaCuadre[] {
  return items.map((i) => ({
    insumoId: i.insumoId,
    posItemId: i.posItemId ?? null,
    nombre: i.nombre,
    unidad: i.unidad,
    rawExpression: (i.rawExpression || "").trim() !== "" ? i.rawExpression : i.total ? String(i.total) : "",
    total: Number(i.total) || 0,
  }));
}

export default function CuadrePOS({ localName, record }: CuadrePOSProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resp, setResp] = useState<CuadrePOSResp | null>(null);
  const [ocultarNoContados, setOcultarNoContados] = useState(false);
  const peticion = useRef(0);

  // Otro local u otra fecha: descartar el resultado anterior.
  useEffect(() => {
    peticion.current++;
    setResp(null);
    setError("");
    setCargando(false);
  }, [localName, record.fecha]);

  const comparar = async () => {
    if (cargando) return;
    const id = ++peticion.current;
    setCargando(true);
    setError("");
    try {
      const r = await inventarioPosAdapter.getCuadre(localName, record.fecha);
      if (id === peticion.current) setResp(r);
    } catch (e) {
      if (id === peticion.current) setError(`No se pudo consultar IntuiPOS: ${mensajeError(e)}`);
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  };

  const lineas = useMemo(
    () => (resp?.configurado ? cruzarConteo(conteoDelRegistro(record.items), resp.items) : []),
    [resp, record.items],
  );
  // Las líneas con unidad sin conversión quedan sin diferencia: no entran en faltante, sobrante ni neto.
  const resumen = useMemo(() => resumirCuadre(lineas), [lineas]);
  const sinComparar = lineas.filter((l) => l.unidadIncompatible).length;
  const unidadPOS = useMemo(
    () => new Map((resp?.configurado ? resp.items : []).map((t) => [t.posItemId, t.unidad])),
    [resp],
  );
  const visibles = ocultarNoContados ? lineas.filter((l) => l.contado !== null) : lineas;
  // Día comercial (04:00 a 04:00): a la 01:00 del día siguiente el teórico todavía puede cambiar.
  const diaAbierto = record.fecha >= diaComercialActual();

  const advertencias = resp?.configurado
    ? resp.advertencias.length > 0
      ? resp.advertencias
      : resp.aperturaPendiente
        ? ["IntuiPOS aún no tiene la apertura del periodo; las existencias teóricas no son confiables."]
        : []
    : [];

  return (
    <section
      aria-busy={cargando}
      aria-label="Cuadre vs IntuiPOS"
      className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/40"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-[#1E3E30]" />
            <span>Cuadre vs IntuiPOS</span>
          </h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Compara lo contado con la existencia teórica del POS al cierre del día {formatoFecha(record.fecha)}, antes de los ajustes que
            se registraron ese día en el POS.
          </p>
        </div>
        <button
          type="button"
          onClick={comparar}
          disabled={cargando}
          className={`${CLASE_BOTON_PRIMARIO} justify-center shrink-0`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} />
          <span>{cargando ? "Consultando IntuiPOS…" : resp ? "Volver a comparar" : "Comparar con POS"}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-xs font-bold p-3 rounded-xl">
          {error}
        </div>
      )}

      {resp && !resp.configurado && (
        <div className="bg-white border border-dashed border-slate-300 text-slate-600 text-xs font-medium p-3 rounded-xl">
          IntuiPOS no está configurado para este local: {resp.razon}
        </div>
      )}

      {resp?.configurado && (
        <>
          <p className="text-[11px] text-slate-500 font-medium">
            Bodega: <strong className="text-slate-700">{resp.bodega.nombre}</strong> · Corte:{" "}
            <span className="font-numeric">{formatoFechaHora(resp.corte)}</span>
          </p>

          {(advertencias.length > 0 || diaAbierto) && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold p-3 rounded-xl space-y-1">
              {advertencias.map((a, i) => (
                <p key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{a}</span>
                </p>
              ))}
              {diaAbierto && (
                <p className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>El día comercial aún no termina (cierra a las 4:00 a. m.): el teórico puede cambiar.</span>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="bg-white border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-bold text-slate-500 block">Faltante</span>
              <span className="text-sm font-extrabold font-numeric text-red-700">{formatoMoneda(resumen.valorFaltante)}</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-bold text-slate-500 block">Sobrante</span>
              <span className="text-sm font-extrabold font-numeric text-emerald-700">{monedaConSigno(resumen.valorSobrante)}</span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-bold text-slate-500 block">Neto</span>
              <span className={`text-sm font-extrabold font-numeric ${colorDiferencia(resumen.valorNeto)}`}>
                {monedaConSigno(resumen.valorNeto)}
              </span>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-bold text-slate-500 block">Con diferencia</span>
              <span className="text-sm font-extrabold font-numeric text-slate-900">
                {resumen.conDiferencia} <span className="text-[11px] font-bold text-slate-400">de {resumen.contados}</span>
              </span>
              {sinComparar > 0 && (
                <span className="text-[11px] font-bold text-amber-700 block">{sinComparar} con unidad distinta (sin comparar)</span>
              )}
            </div>
            <div className="bg-white border border-slate-200/80 rounded-xl p-3 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-500 block">No contados</span>
              <span className="text-sm font-extrabold font-numeric text-slate-900">{resumen.noContados}</span>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={ocultarNoContados}
              onChange={(e) => setOcultarNoContados(e.target.checked)}
              className="w-4 h-4 accent-[#1E3E30] cursor-pointer"
            />
            <span>Ocultar insumos no contados</span>
          </label>

          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500">
                  <th className="p-3">Insumo</th>
                  <th className="p-3 text-right">Contado</th>
                  <th className="p-3 text-right">Teórico POS</th>
                  <th className="p-3 text-right">Diferencia</th>
                  <th className="p-3 text-right">Valor dif.</th>
                  <th className="p-3 text-right">Ajuste registrado en POS</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 font-medium">
                      No hay insumos para mostrar.
                    </td>
                  </tr>
                ) : (
                  visibles.map((l, i) => {
                    const unidadEnPOS = l.posItemId !== null ? unidadPOS.get(l.posItemId) : undefined;
                    return (
                      <tr
                        key={`${l.insumoId}-${i}`}
                        className={`border-b border-slate-100 hover:bg-slate-50/60 ${l.contado === null ? "text-slate-400" : ""}`}
                      >
                        <td className="p-3 font-bold text-slate-900">
                          {l.nombre}
                          <span className="block text-[11px] font-medium text-slate-400">{l.unidad}</span>
                          {l.unidadIncompatible ? (
                            <span className="block text-[11px] font-bold text-amber-700">
                              Contado en {l.unidadContada}; IntuiPOS usa {unidadEnPOS}: no se compara
                            </span>
                          ) : (
                            l.unidadContada && (
                              <span className="block text-[11px] font-bold text-amber-700">
                                Contado en {l.unidadContada}; convertido a {l.unidad}
                              </span>
                            )
                          )}
                        </td>
                        <td className="p-3 text-right font-numeric font-bold">
                          {l.contado === null ? <span className="italic font-medium">Sin conteo</span> : formatoCantidad(l.contado)}
                        </td>
                        <td className="p-3 text-right font-numeric">
                          {l.teorico === null ? (
                            <span className="italic text-amber-700 font-medium">No está en IntuiPOS</span>
                          ) : (
                            formatoCantidad(l.teorico)
                          )}
                        </td>
                        <td className={`p-3 text-right font-numeric font-bold ${colorDiferencia(l.diferencia)}`}>
                          {formatoCantidadConSigno(l.diferencia)}
                        </td>
                        <td className={`p-3 text-right font-numeric font-bold ${colorDiferencia(l.valorDiferencia)}`}>
                          {l.valorDiferencia === null ? "—" : monedaConSigno(l.valorDiferencia)}
                        </td>
                        <td className="p-3 text-right font-numeric text-slate-600">
                          {l.ajustePOS === null || Math.abs(l.ajustePOS) <= 0.0005 ? "—" : formatoCantidadConSigno(l.ajustePOS)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Diferencia = contado − teórico, en la unidad de IntuiPOS. El valor usa el costo promedio del POS; negativo es faltante.
          </p>
        </>
      )}
    </section>
  );
}
