/**
 * Arma el desprendible que verá el empleado a partir de una liquidación guardada
 * en turnos_nomina. Lista blanca: solo pasan nombre, cargo, contrato, días y
 * conceptos con su valor. Nunca el análisis de IA, las marcaciones crudas ni
 * notas internas de Gerencia.
 */

export interface ConceptoDesprendible {
  concepto: string;
  devengado: number;
  deduccion: number;
}

export interface DatosDesprendible {
  nombre: string;
  cargo: string | null;
  tipoContrato: string | null;
  area: string | null;
  diasLaborados: number | null;
  diasAsistidos: number | null;
  conceptos: ConceptoDesprendible[];
}

export interface Desprendible {
  datos: DatosDesprendible;
  devengado: number;
  deducciones: number;
  neto: number;
}

const pesos = (v: unknown) => Math.round(Number(v) || 0);
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
const entero = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Math.round(Number(v)) : null);

export function construirDesprendible(
  liquidacion: Record<string, unknown> | null | undefined,
  usuario: { nombre: string; cargo?: string | null },
): Desprendible {
  const l = liquidacion || {};
  const totales = [l.devengadoTotal, l.totalDeducciones, l.netoAPagar];
  if (totales.some((v) => v === undefined || v === null || !Number.isFinite(Number(v)))) {
    throw new Error("La liquidación guardada no tiene totales válidos.");
  }

  const tipoContrato = texto(l.tipoContrato);
  const diasLaborados = entero(l.diasLaboradosTotales);
  const diasAsistidos = entero(l.diasAsistidosEfectivos);

  const conceptos: ConceptoDesprendible[] = [];
  const devengo = (concepto: string, valor: unknown) => {
    if (pesos(valor) > 0) conceptos.push({ concepto, devengado: pesos(valor), deduccion: 0 });
  };
  const descuento = (concepto: string, valor: unknown) => {
    if (pesos(valor) > 0) conceptos.push({ concepto, devengado: 0, deduccion: pesos(valor) });
  };

  devengo(
    tipoContrato === "Por días"
      ? `Horas ordinarias por días${diasAsistidos !== null ? ` (${diasAsistidos} turnos)` : ""}`
      : `Salario básico quincenal${diasLaborados !== null ? ` (${diasLaborados} días)` : ""}`,
    l.salarioQuincenal,
  );
  devengo(`Auxilio de transporte${diasAsistidos !== null ? ` (${diasAsistidos} días)` : ""}`, l.auxTransporte);
  devengo("Horas extra diurnas", l.valHED);
  devengo("Horas extra nocturnas", l.valHEN);
  devengo("Recargo dominical / festivo", l.valRecargosDominicales);
  devengo("Recargo nocturno", l.valRecargoNocturnoMinutos);
  const bonosSalariales =
    pesos(l.totalIngresosSalariales) -
    pesos(l.salarioQuincenal) -
    pesos(l.valHED) -
    pesos(l.valHEN) -
    pesos(l.valRecargosDominicales) -
    pesos(l.valRecargoNocturnoMinutos);
  // Redondeos de cada concepto pueden dejar ±$5; no es un bono real.
  if (bonosSalariales > 5) devengo("Bonos salariales", bonosSalariales);
  devengo("Bonos no salariales / auxilios", l.totalIngresosNoSalariales);

  descuento("Aporte salud (4%)", l.deduccionSalud);
  descuento("Aporte pensión (4%)", l.deduccionPension);
  descuento("Otras deducciones (anticipos, consumos)", l.totalDeduccionesOtros);

  return {
    datos: {
      nombre: usuario.nombre,
      cargo: usuario.cargo ?? null,
      tipoContrato,
      area: texto(l.area),
      diasLaborados,
      diasAsistidos,
      conceptos,
    },
    devengado: pesos(l.devengadoTotal),
    deducciones: pesos(l.totalDeducciones),
    neto: pesos(l.netoAPagar),
  };
}
