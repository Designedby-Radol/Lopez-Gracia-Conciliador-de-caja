/**
 * Agrupa el reporte GetTransactionsByPayment de IntuiPOS por canal de pago.
 *
 * TCREDITO / TDEBITO son pagos con tarjeta (datáfono), no transferencias:
 * van a `tarjetasPOS`, igual que en la lectura del PDF del POS. En
 * `transferenciasPOS` solo entran TRANSFERENCIA / NEQUI / PSE.
 */

export interface TotalesIntuipos {
  efectivoPOS: number;
  tarjetasPOS: number;
  justoPOS: number;
  rappiPOS: number;
  transferenciasPOS: number;
  totalTcredito: number;
  totalTdebito: number;
}

export function agruparPagosIntuipos(items: any[]): TotalesIntuipos {
  let efectivo = 0;
  let justo = 0;
  let rappi = 0;
  let tcredito = 0;
  let tdebito = 0;
  let transferencias = 0;

  for (const row of items) {
    // Excluir movimientos administrativos de caja (apertura de base y cierre de caja)
    const trxType = (row.TransactionType || "").toString().trim().toUpperCase();
    if (trxType === "BASE-INICIO CAJA" || trxType === "CIERRE DE CAJA") continue;

    // Solo procesar registros activos
    if (row.PaymentDetailStatus !== "Activo") continue;

    const neto = (Number(row.dCredit) || 0) - (Number(row.dDebit) || 0);
    const tipo = Number(row.tiPaymentTypeID);
    const paymentTypeStr = (row.PaymentType || "").toString().trim().toUpperCase();
    const docTypeStr = (row.DocumentType || "").toString().trim().toUpperCase();

    if (paymentTypeStr === "EFECTIVO CAJA" || tipo === 1) {
      efectivo += neto;
    } else if (docTypeStr === "CXC JUSTO" || (paymentTypeStr.includes("CUENTAS") && docTypeStr.includes("JUSTO"))) {
      justo += neto;
    } else if (docTypeStr === "CXC RAPPI" || (paymentTypeStr.includes("CUENTAS") && docTypeStr.includes("RAPPI"))) {
      rappi += neto;
    } else if (paymentTypeStr === "TCREDITO" || tipo === 2) {
      tcredito += neto;
    } else if (paymentTypeStr === "TDEBITO" || tipo === 3) {
      tdebito += neto;
    } else if (paymentTypeStr === "TRANSFERENCIA" || paymentTypeStr === "NEQUI" || paymentTypeStr === "PSE" || tipo === 13 || tipo === 83) {
      transferencias += neto;
    }
  }

  return {
    efectivoPOS: Math.round(efectivo),
    tarjetasPOS: Math.round(tcredito + tdebito),
    justoPOS: Math.round(justo),
    rappiPOS: Math.round(rappi),
    transferenciasPOS: Math.round(transferencias),
    totalTcredito: Math.round(tcredito),
    totalTdebito: Math.round(tdebito),
  };
}
