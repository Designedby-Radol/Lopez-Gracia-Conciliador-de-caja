/**
 * Liquidación de una quincena a partir de la ficha del colaborador y sus novedades.
 * Antes vivía dentro de SalariesManager.tsx.
 */
import { divisorHorasMes, factorDominical, FACTOR_HORA_EXTRA_DIURNA, FACTOR_HORA_EXTRA_NOCTURNA } from "./payroll";

export interface ConfigLiquidacion {
  salarioBaseMensual: number;
  tipoContrato: "Indefinido" | "Por días";
  auxilioTransporteAplica: boolean;
  bonosConfigurados?: { tipologia: string; monto: number }[];
}

export interface NovedadesLiquidacion {
  diasLaboradosQuincena?: number;
  diasAsistidosTransporte?: number;
  diasTiempoCompleto?: number;
  diasMedioTiempo?: number;
  horasExtraDiurnas?: number;
  horasExtraNocturnas?: number;
  recargosDominicales?: number;
  minutosRecargoNocturnoTotal?: number;
  bonoNoSalarial?: number;
  deduccionesAdicionales?: number;
}

export interface ParametrosLiquidacion {
  smmlv: number;
  auxTransporteMensual: number;
  /** Fecha de cierre del período: define divisor de horas y recargo dominical vigentes. */
  fechaFin: string;
}

export function liquidarQuincena(config: ConfigLiquidacion, novs: NovedadesLiquidacion, p: ParametrosLiquidacion) {
  const salarioMensual = config.salarioBaseMensual || p.smmlv;
  // Hora ordinaria: divisor según la jornada legal vigente al cierre del período (Ley 2101: 42 h → 210)
  const valorHoraOrdinaria = salarioMensual / divisorHorasMes(p.fechaFin);
  const auxDiarioTransporte = p.auxTransporteMensual / 30; // Aux. transporte mensual / 30 días

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

  // Horas extra (CST art. 168): diurna ×1,25, nocturna ×1,75
  const valHED = (novs.horasExtraDiurnas || 0) * (valorHoraOrdinaria * FACTOR_HORA_EXTRA_DIURNA);
  const valHEN = (novs.horasExtraNocturnas || 0) * (valorHoraOrdinaria * FACTOR_HORA_EXTRA_NOCTURNA);

  // Recargo dominical / festivo según la gradualidad de la Ley 2466 de 2025
  const valRecargosDominicales = (novs.recargosDominicales || 0) * (valorHoraOrdinaria * factorDominical(p.fechaFin));

  // Recargo nocturno ordinario (7:00 p. m. – 6:00 a. m.): +35% sobre minutos
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

    // PENDIENTE (revisión legal): hoy no se descuenta salud ni pensión al personal por días.
    // El Decreto 2616 de 2013 (compilado en el Decreto 1072 de 2015) prevé cotización por semanas
    // para quien labora menos de 30 días al mes y devenga menos de 1 SMMLV; no se implementa aquí
    // porque depende de los días del MES completo, del régimen de salud del trabajador y de si
    // supera el SMMLV mensual. Ver resumen de la sesión de nómina.
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

    // Auxilio de transporte pagado ÚNICAMENTE por los días que ASISTIÓ físicamente a trabajar
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
}
