import { Router } from "express";
import { supabaseAdmin } from "../supabase";
import { requireGerencia } from "../auth";
import { todayBogota } from "../../src/lib/dates";

export const canalesRouter = Router();
canalesRouter.use(requireGerencia);

// ---- INTEGRACIÓN CANALES: JUSTO V3 (/ecommerce/orders) ----
// Corte horario oficial: 4:00am a 4:00am Bogotá (09:00 UTC a 09:00 UTC día siguiente)
canalesRouter.get("/justo/ventas", async (req, res) => {
  try {
    const localId = (req.query.localId || req.query.local_id) as string;
    const fecha = (req.query.fecha as string) || todayBogota();

    if (!localId || !fecha) {
      return res.status(400).json({ success: false, error: "localId y fecha son requeridos" });
    }

    const { data: local, error: localError } = await supabaseAdmin
      .from("locales")
      .select("justo_store_id")
      .eq("id", localId)
      .single();

    if (localError || !local?.justo_store_id) {
      return res.json({ configurado: false });
    }

    const storeId = local.justo_store_id;
    const justoToken = process.env.JUSTO_API_TOKEN;
    if (!justoToken) {
      return res.json({ configurado: false });
    }

    // Regla de corte 4:00am a 4:00am hora Bogotá = 09:00:00Z a 09:00:00Z (UTC-5 sin DST)
    const dia = new Date(`${fecha}T00:00:00.000Z`);
    const diaSiguiente = new Date(dia);
    diaSiguiente.setUTCDate(dia.getUTCDate() + 1);

    const fromDate = `${dia.toISOString().slice(0, 10)}T09:00:00.000Z`;
    const toDate = `${diaSiguiente.toISOString().slice(0, 10)}T09:00:00.000Z`;

    let totalVentas = 0;
    let cantidadOrdenes = 0;
    let sobranteEfectivoDespacho = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 25) {
      const url = new URL("https://api.service.getjusto.com/v3/ecommerce/orders");
      url.searchParams.set("storeId", storeId);
      url.searchParams.set("fromDate", fromDate);
      url.searchParams.set("toDate", toDate);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", "50");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${justoToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (page === 1) {
          const errText = await response.text();
          console.warn(`[Justo API] Error (${response.status}):`, errText);
          return res.status(response.status).json({ success: false, error: errText });
        }
        break;
      }

      const data = await response.json();
      const orders: any[] = Array.isArray(data.orders)
        ? data.orders
        : (Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []));

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      for (const order of orders) {
        cantidadOrdenes += 1;
        const orderTotal = Number(
          order.itemsPriceBeforeDiscountsAfterProductDiscount ??
          order.totalVentas ??
          order.total ??
          0
        );
        totalVentas += orderTotal;

        const isCash = order.paymentType === "cash" || order.payment_method === "cash" || order.metodo_pago === "efectivo";
        if (isCash) {
          sobranteEfectivoDespacho += Number(order.deliveryFee ?? order.delivery_cash ?? order.sobranteEfectivoDespacho ?? 0);
        }
      }

      if (data.totalCount && cantidadOrdenes >= data.totalCount) {
        hasMore = false;
      } else if (data.pagination && page >= (data.pagination.totalPages || data.pagination.pages || 1)) {
        hasMore = false;
      } else if (orders.length < 50) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return res.json({
      configurado: true,
      totalVentas,
      cantidadOrdenes,
      sobranteEfectivoDespacho,
    });
  } catch (error: any) {
    console.error("Error en /api/canales/justo/ventas:", error);
    return res.status(500).json({ success: false, error: error?.message || "Error interno de Justo" });
  }
});

// ---- INTEGRACIÓN CANALES: INTUIPOS (GetTransactionsByPayment) ----
// GET /api/canales/intuipos/ventas?localId=<uuid>&fecha=YYYY-MM-DD
canalesRouter.get("/intuipos/ventas", async (req, res) => {
  try {
    const localId = (req.query.localId || req.query.local_id) as string;
    const fecha = req.query.fecha as string;
    if (!localId || !fecha) {
      return res.status(400).json({ success: false, error: "localId y fecha son requeridos" });
    }

    const { data: local } = await supabaseAdmin
      .from("locales")
      .select("intuipos_store_id")
      .eq("id", localId)
      .single();

    // Sin fallback fijo: usar el POS de otro local daría comparaciones falsas.
    const storeId = local?.intuipos_store_id || process.env.INTUIPOS_STORE_ID;
    if (!storeId) {
      return res.json({ configurado: false, razon: "El local no tiene intuipos_store_id configurado" });
    }
    const apiKey = process.env.INTUIPOS_TOKEN || process.env.INTUIPOS_API_KEY;
    if (!apiKey) {
      return res.json({ configurado: false, razon: "Falta INTUIPOS_TOKEN en variables de entorno" });
    }

    const dtFechaInicial = `${fecha}T04:00:00`;
    const diaSiguiente = new Date(`${fecha}T00:00:00.000Z`);
    diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);
    const dtFechaFinal = `${diaSiguiente.toISOString().slice(0, 10)}T04:00:00`;

    const url = new URL(`https://webapi.intuipos.net/api/v1/Reports/GetTransactionsByPayment`);
    url.searchParams.set("iPuntoDeVentaID", String(storeId));
    url.searchParams.set("dtFechaInicial", dtFechaInicial);
    url.searchParams.set("dtFechaFinal", dtFechaFinal);

    const resp = await fetch(url.toString(), {
      headers: {
        ApiKey: apiKey,
        StoreId: String(storeId),
      },
    });

    if (!resp.ok) {
      console.warn(`IntuiPOS API respondió con estado ${resp.status}`);
      return res.status(resp.status).json({ success: false, error: `IntuiPOS error HTTP ${resp.status}` });
    }

    const items: any[] = await resp.json();

    if (!Array.isArray(items)) {
      return res.status(502).json({ success: false, error: "Respuesta inesperada de IntuiPOS" });
    }

    let efectivoPOS = 0;
    let justoPOS = 0;          // CUENTAS x COBRAR con DocumentType "CxC JUSTO"
    let rappiPOS = 0;          // CUENTAS x COBRAR con DocumentType "CxC RAPPI"
    let tcreditoCredit = 0;
    let tdebitoCredit = 0;
    let tcreditoDebit = 0;
    let tdebitoDebit = 0;
    let otherTransferCredit = 0;
    let otherTransferDebit = 0;

    for (const row of items) {
      // Excluir movimientos administrativos de caja (apertura de base y cierre de caja)
      const trxType = (row.TransactionType || "").toString().trim().toUpperCase();
      if (trxType === "BASE-INICIO CAJA" || trxType === "CIERRE DE CAJA") continue;

      // Solo procesar registros activos
      if (row.PaymentDetailStatus !== "Activo") continue;

      const credit = Number(row.dCredit) || 0;
      const debit = Number(row.dDebit) || 0;
      const tipo = Number(row.tiPaymentTypeID);
      const paymentTypeStr = (row.PaymentType || "").toString().trim().toUpperCase();
      const docTypeStr = (row.DocumentType || "").toString().trim().toUpperCase();

      // 1. EFECTIVO CAJA
      if (paymentTypeStr === "EFECTIVO CAJA" || tipo === 1) {
        efectivoPOS += (credit - debit);
      }
      // 2. CUENTAS x COBRAR -> CxC JUSTO
      else if (docTypeStr === "CXC JUSTO" || (paymentTypeStr.includes("CUENTAS") && docTypeStr.includes("JUSTO"))) {
        justoPOS += (credit - debit);
      }
      // 3. CUENTAS x COBRAR -> CxC RAPPI
      else if (docTypeStr === "CXC RAPPI" || (paymentTypeStr.includes("CUENTAS") && docTypeStr.includes("RAPPI"))) {
        rappiPOS += (credit - debit);
      }
      // 4. TRANSFERENCIAS POS: (TCREDITO + TDEBITO) - (dDebit facturas debitadas)
      else if (paymentTypeStr === "TCREDITO" || tipo === 2) {
        tcreditoCredit += credit;
        tcreditoDebit += debit;
      } else if (paymentTypeStr === "TDEBITO" || tipo === 3) {
        tdebitoCredit += credit;
        tdebitoDebit += debit;
      } else if (paymentTypeStr === "TRANSFERENCIA" || paymentTypeStr === "NEQUI" || paymentTypeStr === "PSE" || tipo === 13 || tipo === 83) {
        otherTransferCredit += credit;
        otherTransferDebit += debit;
      }
    }

    // Transferencias POS = (TCREDITO + TDEBITO) - (dDebit de facturas debitadas)
    const transferenciasPOS = Math.round(
      (tcreditoCredit + tdebitoCredit + otherTransferCredit) - (tcreditoDebit + tdebitoDebit + otherTransferDebit)
    );

    // Tarjetas / datáfonos: según especificación, no se toma directamente como resultado
    // de conciliación automática sino mediante confirmación manual (vouchers / datáfono físico).
    const tarjetasPOS = 0;

    return res.json({
      configurado: true,
      efectivoPOS: Math.round(efectivoPOS),
      tarjetasPOS,
      justoPOS: Math.round(justoPOS),
      rappiPOS: Math.round(rappiPOS),
      transferenciasPOS,
      totalTcredito: Math.round(tcreditoCredit - tcreditoDebit),
      totalTdebito: Math.round(tdebitoCredit - tdebitoDebit),
    });
  } catch (error: any) {
    console.error("Error en /api/canales/intuipos/ventas:", error);
    return res.status(500).json({ success: false, error: error?.message || "Error interno" });
  }
});
