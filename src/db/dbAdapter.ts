import { supabase } from "./supabaseConfig";
import { CierreCaja, Cargo, AccessRole } from "../types";

let cachedLocalMap: Record<string, string> = {};

export async function resolveLocalId(localNameOrId?: string): Promise<string> {
  if (!localNameOrId) localNameOrId = "Chapinero";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localNameOrId)) {
    return localNameOrId;
  }
  const clean = localNameOrId.trim();
  if (cachedLocalMap[clean.toLowerCase()]) {
    return cachedLocalMap[clean.toLowerCase()];
  }

  try {
    const { data, error } = await supabase
      .from("locales")
      .select("id, nombre")
      .ilike("nombre", clean)
      .maybeSingle();

    if (!error && data?.id) {
      cachedLocalMap[clean.toLowerCase()] = data.id;
      return data.id;
    }
  } catch (e) {
    console.warn("No fue posible resolver el ID del local desde Supabase directo:", e);
  }

  // Fallback a API del servidor (ignora RLS con service_role)
  try {
    const res = await fetch("/api/db/locales");
    if (res.ok) {
      const json = await res.json();
      const list = json.data || [];
      const found = list.find((l: any) => l.nombre?.toLowerCase() === clean.toLowerCase()) || list[0];
      if (found?.id) {
        cachedLocalMap[clean.toLowerCase()] = found.id;
        return found.id;
      }
    }
  } catch (e) {
    console.warn("Fallback /api/db/locales falló:", e);
  }

  return clean;
}

function fromDbRow(row: any): CierreCaja {
  return {
    id: row.id,
    fecha: row.fecha,
    localId: row.local_id,
    local_id: row.local_id,
    colaboradorId: row.colaborador_id,
    colaborador_id: row.colaborador_id,
    colaboradorNombre: row.colaborador?.nombre || row.colaboradorNombre,
    efectivoCierre: Number(row.efectivo_cierre ?? 0),
    datafonoCierre: Number(row.datafono_cierre ?? 0),
    justoCierre: Number(row.justo_cierre ?? 0),
    rappiCierre: Number(row.rappi_cierre ?? 0),
    transferenciasCierre: Number(row.transferencias_cierre ?? 0),
    propinas: Number(row.propinas ?? 0),
    novedades: row.novedades || "",
    estado: row.estado,
    createdAt: row.created_at || new Date().toISOString(),
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
    efectivoPOS: row.efectivo_pos !== null && row.efectivo_pos !== undefined ? Number(row.efectivo_pos) : undefined,
    tarjetasPOS: row.tarjetas_pos !== null && row.tarjetas_pos !== undefined ? Number(row.tarjetas_pos) : undefined,
    justoPOS: row.justo_pos !== null && row.justo_pos !== undefined ? Number(row.justo_pos) : undefined,
    rappiPOS: row.rappi_pos !== null && row.rappi_pos !== undefined ? Number(row.rappi_pos) : undefined,
    transferenciasPOS: row.transferencias_pos !== null && row.transferencias_pos !== undefined ? Number(row.transferencias_pos) : undefined,
    posFileName: row.pos_file_name || undefined,
    difEfectivo: row.dif_efectivo !== null && row.dif_efectivo !== undefined ? Number(row.dif_efectivo) : undefined,
    difTarjetas: row.dif_tarjetas !== null && row.dif_tarjetas !== undefined ? Number(row.dif_tarjetas) : undefined,
    difJusto: row.dif_justo !== null && row.dif_justo !== undefined ? Number(row.dif_justo) : undefined,
    difRappi: row.dif_rappi !== null && row.dif_rappi !== undefined ? Number(row.dif_rappi) : undefined,
    difTransferencias: row.dif_transferencias !== null && row.dif_transferencias !== undefined ? Number(row.dif_transferencias) : undefined,
    liderId: row.lider_id || undefined,
    lider_id: row.lider_id || undefined,
    descuadreLider: row.descuadre_lider !== null && row.descuadre_lider !== undefined ? Number(row.descuadre_lider) : undefined,
    descuadreAuxiliar: row.descuadre_auxiliar !== null && row.descuadre_auxiliar !== undefined ? Number(row.descuadre_auxiliar) : undefined,
    auditadoPor: row.auditado_por || undefined,
    auditado_por: row.auditado_por || undefined,
    auditadoAt: row.auditado_at || undefined,
    auditado_at: row.auditado_at || undefined,
    justoPedidosPOS: row.justo_pedidos_pos !== null && row.justo_pedidos_pos !== undefined ? Number(row.justo_pedidos_pos) : undefined,
    justoSobranteEfectivoDespacho: row.justo_sobrante_efectivo_despacho !== null && row.justo_sobrante_efectivo_despacho !== undefined ? Number(row.justo_sobrante_efectivo_despacho) : undefined,
  };
}

function toDbRow(cierre: any, localId: string) {
  const row: any = {
    fecha: cierre.fecha,
    local_id: localId,
    colaborador_id: cierre.colaboradorId || cierre.colaborador_id || null,
    efectivo_cierre: cierre.efectivoCierre ?? 0,
    datafono_cierre: cierre.datafonoCierre ?? 0,
    justo_cierre: cierre.justoCierre ?? 0,
    rappi_cierre: cierre.rappiCierre ?? 0,
    transferencias_cierre: cierre.transferenciasCierre ?? 0,
    propinas: cierre.propinas ?? 0,
    novedades: cierre.novedades ?? null,
    estado: cierre.estado || "Pendiente por Cuadrar",
  };

  if (cierre.efectivoPOS !== undefined) row.efectivo_pos = cierre.efectivoPOS;
  if (cierre.tarjetasPOS !== undefined) row.tarjetas_pos = cierre.tarjetasPOS;
  if (cierre.justoPOS !== undefined) row.justo_pos = cierre.justoPOS;
  if (cierre.rappiPOS !== undefined) row.rappi_pos = cierre.rappiPOS;
  if (cierre.transferenciasPOS !== undefined) row.transferencias_pos = cierre.transferenciasPOS;
  if (cierre.posFileName !== undefined) row.pos_file_name = cierre.posFileName;

  if (cierre.difEfectivo !== undefined) row.dif_efectivo = cierre.difEfectivo;
  if (cierre.difTarjetas !== undefined) row.dif_tarjetas = cierre.difTarjetas;
  if (cierre.difJusto !== undefined) row.dif_justo = cierre.difJusto;
  if (cierre.difRappi !== undefined) row.dif_rappi = cierre.difRappi;
  if (cierre.difTransferencias !== undefined) row.dif_transferencias = cierre.difTransferencias;

  if (cierre.liderId || cierre.lider_id) row.lider_id = cierre.liderId || cierre.lider_id;
  if (cierre.descuadreLider !== undefined) row.descuadre_lider = cierre.descuadreLider;
  if (cierre.descuadreAuxiliar !== undefined) row.descuadre_auxiliar = cierre.descuadreAuxiliar;

  if (cierre.auditadoPor || cierre.auditado_por) row.auditado_por = cierre.auditadoPor || cierre.auditado_por;
  if (cierre.auditadoAt || cierre.auditado_at) row.auditado_at = cierre.auditadoAt || cierre.auditado_at;

  if (cierre.justoPedidosPOS !== undefined) row.justo_pedidos_pos = cierre.justoPedidosPOS;
  if (cierre.justoSobranteEfectivoDespacho !== undefined) row.justo_sobrante_efectivo_despacho = cierre.justoSobranteEfectivoDespacho;

  return row;
}

export const dbAdapter = {
  // ---- Cierres de caja ----
  async getCierres(localNameOrId: string = "Chapinero"): Promise<CierreCaja[]> {
    const localId = await resolveLocalId(localNameOrId);
    let rows: any[] = [];
    try {
      const { data, error } = await supabase
        .from("cierres_caja")
        .select("*")
        .eq("local_id", localId)
        .neq("estado", "Anulado")
        .order("fecha", { ascending: false });

      if (!error && data && data.length > 0) {
        rows = data;
      }
    } catch (error) {
      console.warn("Error al consultar cierres con cliente Supabase directo:", error);
    }

    // Si RLS devolvió lista vacía o error, consultar a través del servidor Node.js
    if (rows.length === 0) {
      try {
        const res = await fetch(`/api/db/cierres?local_id=${encodeURIComponent(localId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            rows = json.data;
          }
        }
      } catch (err) {
        console.warn("Fallback servidor /api/db/cierres falló:", err);
      }
    }

    return rows.map(fromDbRow);
  },

  async saveCierre(cierre: Omit<CierreCaja, "id" | "createdAt">, localNameOrId: string = "Chapinero"): Promise<CierreCaja> {
    const localId = await resolveLocalId(localNameOrId);
    const dbPayload = toDbRow(cierre, localId);

    try {
      const { data, error } = await supabase
        .from("cierres_caja")
        .insert(dbPayload)
        .select()
        .single();

      if (!error && data) {
        return fromDbRow(data);
      }
    } catch (e) {
      console.warn("Intento de guardar cierre directo en Supabase falló por RLS, usando API de servidor...", e);
    }

    // Fallback a API del servidor
    const res = await fetch("/api/db/cierres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dbPayload)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Error al guardar cierre en el servidor");
    }
    const json = await res.json();
    return fromDbRow(json.data);
  },

  async updateCierre(id: string, updates: Partial<CierreCaja>): Promise<void> {
    const rowUpdates: any = {};
    if (updates.fecha !== undefined) rowUpdates.fecha = updates.fecha;
    if (updates.efectivoCierre !== undefined) rowUpdates.efectivo_cierre = updates.efectivoCierre;
    if (updates.datafonoCierre !== undefined) rowUpdates.datafono_cierre = updates.datafonoCierre;
    if (updates.justoCierre !== undefined) rowUpdates.justo_cierre = updates.justoCierre;
    if (updates.rappiCierre !== undefined) rowUpdates.rappi_cierre = updates.rappiCierre;
    if (updates.transferenciasCierre !== undefined) rowUpdates.transferencias_cierre = updates.transferenciasCierre;
    if (updates.propinas !== undefined) rowUpdates.propinas = updates.propinas;
    if (updates.novedades !== undefined) rowUpdates.novedades = updates.novedades;
    if (updates.estado !== undefined) rowUpdates.estado = updates.estado;

    if (updates.efectivoPOS !== undefined) rowUpdates.efectivo_pos = updates.efectivoPOS;
    if (updates.tarjetasPOS !== undefined) rowUpdates.tarjetas_pos = updates.tarjetasPOS;
    if (updates.justoPOS !== undefined) rowUpdates.justo_pos = updates.justoPOS;
    if (updates.rappiPOS !== undefined) rowUpdates.rappi_pos = updates.rappiPOS;
    if (updates.transferenciasPOS !== undefined) rowUpdates.transferencias_pos = updates.transferenciasPOS;
    if (updates.posFileName !== undefined) rowUpdates.pos_file_name = updates.posFileName;

    if (updates.difEfectivo !== undefined) rowUpdates.dif_efectivo = updates.difEfectivo;
    if (updates.difTarjetas !== undefined) rowUpdates.dif_tarjetas = updates.difTarjetas;
    if (updates.difJusto !== undefined) rowUpdates.dif_justo = updates.difJusto;
    if (updates.difRappi !== undefined) rowUpdates.dif_rappi = updates.difRappi;
    if (updates.difTransferencias !== undefined) rowUpdates.dif_transferencias = updates.difTransferencias;

    if (updates.liderId !== undefined || updates.lider_id !== undefined) rowUpdates.lider_id = updates.liderId || updates.lider_id;
    if (updates.descuadreLider !== undefined) rowUpdates.descuadre_lider = updates.descuadreLider;
    if (updates.descuadreAuxiliar !== undefined) rowUpdates.descuadre_auxiliar = updates.descuadreAuxiliar;

    if (updates.auditadoPor !== undefined || updates.auditado_por !== undefined) rowUpdates.auditado_por = updates.auditadoPor || updates.auditado_por;
    if (updates.auditadoAt !== undefined || updates.auditado_at !== undefined) rowUpdates.auditado_at = updates.auditadoAt || updates.auditado_at;

    if (updates.justoPedidosPOS !== undefined) rowUpdates.justo_pedidos_pos = updates.justoPedidosPOS;
    if (updates.justoSobranteEfectivoDespacho !== undefined) rowUpdates.justo_sobrante_efectivo_despacho = updates.justoSobranteEfectivoDespacho;

    try {
      const { error } = await supabase.from("cierres_caja").update(rowUpdates).eq("id", id);
      if (!error) return;
    } catch (e) {
      console.warn("Update directo en Supabase falló por RLS, intentando vía servidor...", e);
    }

    const res = await fetch(`/api/db/cierres/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rowUpdates)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Error al actualizar cierre en el servidor");
    }
  },

  async deleteCierre(id: string): Promise<void> {
    // Anulación en vez de DELETE físico (dato financiero auditable)
    try {
      const { error } = await supabase
        .from("cierres_caja")
        .update({ estado: "Anulado" })
        .eq("id", id);
      if (!error) return;
    } catch (e) {
      console.warn("Anular directo en Supabase falló por RLS, usando servidor...", e);
    }

    const res = await fetch(`/api/db/cierres/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "Anulado" })
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Error al anular cierre en el servidor");
    }
  },

  // ---- Equipo / usuarios ----
  async getTeamMembers(localNameOrId: string = "Chapinero") {
    const localId = await resolveLocalId(localNameOrId);
    let members: any[] = [];
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("local_id", localId)
        .order("nombre", { ascending: true });

      if (!error && data && data.length > 0) {
        members = data;
      }
    } catch (e) {
      console.warn("Supabase directo getTeamMembers falló:", e);
    }

    if (members.length === 0) {
      try {
        const res = await fetch(`/api/db/usuarios?local_id=${encodeURIComponent(localId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            members = json.data;
          }
        }
      } catch (err) {
        console.warn("Fallback servidor /api/db/usuarios falló:", err);
      }
    }

    return members;
  },

  async saveTeamMember(member: any, localNameOrId: string = "Chapinero") {
    const localId = await resolveLocalId(localNameOrId);
    const cargoMap: Record<string, Cargo> = {
      "gerente": "Gerencia",
      "Gerente": "Gerencia",
      "Líder operador": "Lider Operador",
      "Lider operador": "Lider Operador",
      "Lider de punto": "Lider Operador",
      "Líder de punto": "Lider Operador",
      "Líder de pastelería": "Lider Pasteleria",
      "Lider de pasteleria": "Lider Pasteleria",
      "Auxiliar de pastelería": "Auxiliar Pasteleria",
      "Auxiliar de pasteleria": "Auxiliar Pasteleria",
      "Asistente de pasteleria": "Auxiliar Pasteleria",
      "Asistente de Servicio": "Asistente de servicio",
      "Asistente de servicio": "Asistente de servicio",
      "Aux de Venta": "Asistente de servicio",
      "colaborador": "Asistente de servicio"
    };

    const targetCargo: Cargo = cargoMap[member.role] || cargoMap[member.cargo] || "Asistente de servicio";
    const targetRole: AccessRole = (targetCargo === "Gerencia" || targetCargo === "admin") ? "administrador" : "usuario";

    const payload: any = {
      nombre: member.nombre,
      cedula: member.cedula || null,
      cargo: targetCargo,
      role: targetRole,
      apto_propinas: typeof member.aptoPropinas === "boolean" ? member.aptoPropinas : true,
      activo: typeof member.activo === "boolean" ? member.activo : true,
      local_id: localId
    };

    if (member.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(member.id)) {
      payload.id = member.id;
    }

    try {
      const { data, error } = await supabase
        .from("usuarios")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();

      if (!error && data) return data;
    } catch (e) {
      console.warn("Guardar usuario directo falló por RLS, guardando vía servidor...", e);
    }

    const res = await fetch("/api/db/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Error al guardar usuario en el servidor");
    }
    const json = await res.json();
    return json.data;
  },

  async deleteTeamMember(usuarioId: string) {
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ activo: false })
        .eq("id", usuarioId);
      if (!error) return;
    } catch (e) {
      console.warn("Desactivar usuario directo falló, usando servidor...", e);
    }

    const res = await fetch("/api/db/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: usuarioId, activo: false })
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Error al desactivar usuario en el servidor");
    }
  },

  // ---- Configuración de nómina por colaborador ----
  async getNominaConfig(usuarioId: string) {
    const { data, error } = await supabase
      .from("nomina_config")
      .select("config")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (error) {
      console.error("Error al obtener nómina config de Supabase:", error);
      throw error;
    }
    return data?.config ?? {};
  },

  async getAllNominaConfigs(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from("nomina_config")
      .select("usuario_id, config, usuarios(nombre)");

    if (error) {
      console.error("Error al obtener todas las nómina configs de Supabase:", error);
      throw error;
    }

    const map: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      const nombre = row.usuarios?.nombre || row.usuario_id;
      if (nombre) {
        map[nombre] = row.config;
      }
    });
    return map;
  },

  async saveNominaConfig(usuarioId: string, config: any) {
    const { error } = await supabase
      .from("nomina_config")
      .upsert({ usuario_id: usuarioId, config }, { onConflict: "usuario_id" });

    if (error) {
      console.error("Error al guardar nómina config en Supabase:", error);
      throw error;
    }
  },

  // ---- Historial de liquidaciones ----
  async getTurnosNomina(localNameOrId: string = "Chapinero") {
    const localId = await resolveLocalId(localNameOrId);
    let rows: any[] = [];
    try {
      const { data, error } = await supabase
        .from("turnos_nomina")
        .select("*, usuarios(nombre, cargo)")
        .eq("local_id", localId)
        .order("fecha_fin", { ascending: false });

      if (!error && data && data.length > 0) {
        rows = data;
      }
    } catch (e) {
      console.warn("Error en supabase directo para getTurnosNomina:", e);
    }

    if (rows.length === 0) {
      try {
        const res = await fetch(`/api/db/turnos-nomina?local_id=${encodeURIComponent(localId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            rows = json.data;
          }
        }
      } catch (err) {
        console.warn("Fallback servidor /api/db/turnos-nomina falló:", err);
      }
    }

    return rows.map((row: any) => ({
      id: row.id,
      usuarioId: row.usuario_id,
      nombre: row.usuarios?.nombre || "Colaborador",
      cargo: row.usuarios?.cargo || "Asistente de servicio",
      fechaInicio: row.fecha_inicio,
      fechaFin: row.fecha_fin,
      quincenaNombre: row.quincena_nombre,
      liquidacion: row.liquidacion,
      aiAnalysis: row.ai_analysis,
      createdAt: row.created_at
    }));
  },

  async saveTurnoNomina(turno: {
    usuarioId: string;
    localNameOrId: string;
    fechaInicio: string;
    fechaFin: string;
    quincenaNombre: string;
    liquidacion: any;
    aiAnalysis?: string;
  }) {
    const localId = await resolveLocalId(turno.localNameOrId);
    const payload = {
      usuario_id: turno.usuarioId,
      local_id: localId,
      fecha_inicio: turno.fechaInicio,
      fecha_fin: turno.fechaFin,
      quincena_nombre: turno.quincenaNombre,
      liquidacion: turno.liquidacion,
      ai_analysis: turno.aiAnalysis || null
    };

    try {
      const { data, error } = await supabase
        .from("turnos_nomina")
        .insert(payload)
        .select()
        .single();

      if (!error && data) return data;
    } catch (e) {
      console.warn("Guardar turno nómina directo falló por RLS, guardando vía servidor...", e);
    }

    const res = await fetch("/api/db/turnos-nomina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Error al guardar turno nómina en el servidor");
    }
    const json = await res.json();
    return json.data;
  },

  async deleteTurnoNomina(id: string) {
    try {
      const { error } = await supabase
        .from("turnos_nomina")
        .delete()
        .eq("id", id);
      if (!error) return;
    } catch (e) {
      console.warn("Eliminar turno directo falló, usando servidor...", e);
    }

    const res = await fetch(`/api/db/turnos-nomina/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Error al eliminar turno nómina en el servidor");
    }
  },

  // ---- Configuración SMMLV / Aux. transporte ----
  async getConfiguracionNomina(localNameOrId: string = "Chapinero") {
    const localId = await resolveLocalId(localNameOrId);
    const { data, error } = await supabase
      .from("configuracion_nomina")
      .select("*")
      .eq("local_id", localId)
      .maybeSingle();

    if (error) {
      console.error("Error al obtener configuración de nómina de Supabase:", error);
      throw error;
    }
    return data || { smmlv_base: 1750905, aux_transporte_base: 249095 };
  },

  async saveConfiguracionNomina(localNameOrId: string = "Chapinero", smmlvBase: number, auxTransporteBase: number) {
    const localId = await resolveLocalId(localNameOrId);
    const { error } = await supabase
      .from("configuracion_nomina")
      .upsert(
        { local_id: localId, smmlv_base: smmlvBase, aux_transporte_base: auxTransporteBase },
        { onConflict: "local_id" }
      );

    if (error) {
      console.error("Error al guardar configuración nómina en Supabase:", error);
      throw error;
    }
  },

  // ---- Puntos por cargo ----
  async getCargoPuntos(): Promise<Record<string, number>> {
    const { data, error } = await supabase.from("cargo_puntos").select("*");
    if (error) {
      console.error("Error al obtener cargo puntos de Supabase:", error);
      throw error;
    }

    const map: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      map[row.cargo] = Number(row.puntos);
    });
    return map;
  }
};
