import { api } from "../lib/api";
import { CierreCaja, Cargo, AccessRole } from "../types";

let cachedLocalMap: Record<string, string> = {};

export async function resolveLocalId(localNameOrId?: string): Promise<string> {
  if (!localNameOrId) localNameOrId = "Chapinero";
  if (isValidUUID(localNameOrId)) return localNameOrId;
  const clean = localNameOrId.trim().toLowerCase();
  if (cachedLocalMap[clean]) return cachedLocalMap[clean];

  const { data } = await api<{ data: { id: string; nombre: string }[] }>("/api/db/locales");
  for (const l of data) cachedLocalMap[l.nombre.trim().toLowerCase()] = l.id;
  const found = cachedLocalMap[clean];
  if (!found) throw new Error(`No existe el local "${localNameOrId}".`);
  return found;
}

export function isValidUUID(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

export function getFriendlyName(emailOrName?: string | null): string {
  if (!emailOrName) return "";
  if (emailOrName.includes("@")) return emailOrName.split("@")[0];
  return emailOrName;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

/** Resuelve un nombre/cédula a UUID con coincidencia EXACTA (nunca aproximada: atribuir un cierre a otra persona es grave). */
async function resolveUserId(nameOrIdentifier?: string | null): Promise<string | null> {
  if (!nameOrIdentifier || typeof nameOrIdentifier !== "string") return null;
  const clean = nameOrIdentifier.trim();
  if (isValidUUID(clean)) return clean;

  try {
    const members = await dbAdapter.getTeamMembers();
    const target = normalizeName(clean);
    const found = members.filter(m =>
      normalizeName(m.nombre || "") === target ||
      (m.email && normalizeName(m.email) === target) ||
      (m.cedula && String(m.cedula).trim() === clean)
    );
    if (found.length === 1 && isValidUUID(found[0].id)) return found[0].id;
  } catch (e) {
    console.warn("No se pudo resolver usuario desde teamMembers:", e);
  }
  return null;
}

export function fromDbRow(row: any): CierreCaja {
  const colabName = row.colaborador?.nombre 
    ? getFriendlyName(row.colaborador.nombre) 
    : (getFriendlyName(row.colaboradorNombre) || "Colaborador");

  const auditorName = row.auditor?.nombre 
    ? getFriendlyName(row.auditor.nombre) 
    : (row.auditado_por && !isValidUUID(row.auditado_por) ? row.auditado_por : (getFriendlyName(row.auditado_por) || undefined));

  // El servidor devuelve el líder (desde lider_id) y los auxiliares (tabla cierre_auxiliares).
  const liderNombre = row.lider?.nombre ? getFriendlyName(row.lider.nombre) : undefined;
  const auxiliaresNombres = Array.isArray(row.auxiliares)
    ? row.auxiliares.map((a: any) => getFriendlyName(a?.nombre)).filter(Boolean)
    : undefined;

  return {
    id: row.id,
    fecha: row.fecha,
    localId: row.local_id,
    local_id: row.local_id,
    colaboradorId: row.colaborador_id,
    colaborador_id: row.colaborador_id,
    colaboradorNombre: colabName,
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
    liderNombre,
    auxiliaresNombres,
    descuadreLider: row.descuadre_lider !== null && row.descuadre_lider !== undefined ? Number(row.descuadre_lider) : undefined,
    descuadreAuxiliar: row.descuadre_auxiliar !== null && row.descuadre_auxiliar !== undefined ? Number(row.descuadre_auxiliar) : undefined,
    auditadoPor: auditorName,
    auditado_por: row.auditado_por || undefined,
    auditadoAt: row.auditado_at || undefined,
    auditado_at: row.auditado_at || undefined,
    justoPedidosPOS: row.justo_pedidos_pos !== null && row.justo_pedidos_pos !== undefined ? Number(row.justo_pedidos_pos) : undefined,
    justoSobranteEfectivoDespacho: row.justo_sobrante_efectivo_despacho !== null && row.justo_sobrante_efectivo_despacho !== undefined ? Number(row.justo_sobrante_efectivo_despacho) : undefined,
  };
}

export function toDbRow(cierre: any, localId: string) {
  const row: any = {
    fecha: cierre.fecha,
    local_id: localId,
    colaborador_id: isValidUUID(cierre.colaboradorId || cierre.colaborador_id) ? (cierre.colaboradorId || cierre.colaborador_id) : null,
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

  Object.assign(row, equipoPayload(cierre));
  if (cierre.descuadreLider !== undefined) row.descuadre_lider = cierre.descuadreLider;
  if (cierre.descuadreAuxiliar !== undefined) row.descuadre_auxiliar = cierre.descuadreAuxiliar;

  const rawAuditor = cierre.auditadoPor || cierre.auditado_por;
  if (rawAuditor) {
    row.auditado_por = isValidUUID(rawAuditor) ? rawAuditor : null;
  }
  if (cierre.auditadoAt || cierre.auditado_at) row.auditado_at = cierre.auditadoAt || cierre.auditado_at;

  if (cierre.justoPedidosPOS !== undefined) row.justo_pedidos_pos = cierre.justoPedidosPOS;
  if (cierre.justoSobranteEfectivoDespacho !== undefined) row.justo_sobrante_efectivo_despacho = cierre.justoSobranteEfectivoDespacho;

  return row;
}

/**
 * Líder y auxiliares del turno. El servidor resuelve los nombres a usuario_id contra
 * el equipo del local del cierre y guarda los auxiliares en cierre_auxiliares.
 */
export function equipoPayload(cierre: Partial<CierreCaja>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const rawLider = cierre.liderId || cierre.lider_id;
  if (isValidUUID(rawLider)) out.lider_id = rawLider;
  else if (cierre.liderNombre?.trim()) out.lider_nombre = cierre.liderNombre.trim();
  if (Array.isArray(cierre.auxiliaresNombres)) {
    out.auxiliares_nombres = cierre.auxiliaresNombres.map((n) => String(n ?? "").trim()).filter(Boolean);
  }
  return out;
}

export const dbAdapter = {
  // ---- Cierres de caja ----
  async getCierres(localNameOrId: string = "Chapinero"): Promise<CierreCaja[]> {
    const localId = await resolveLocalId(localNameOrId);
    const { data } = await api<{ data: any[] }>(`/api/db/cierres?local_id=${encodeURIComponent(localId)}`);
    return data.map(fromDbRow);
  },

  async saveCierre(cierre: Omit<CierreCaja, "id" | "createdAt">, localNameOrId: string = "Chapinero"): Promise<CierreCaja> {
    const localId = await resolveLocalId(localNameOrId);

    // El servidor asigna colaborador_id a partir de la sesión y resuelve líder y auxiliares.
    const dbPayload = toDbRow(cierre, localId);
    const { data } = await api<{ data: any }>("/api/db/cierres", { method: "POST", json: dbPayload });
    return fromDbRow(data);
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

    if (updates.colaboradorId !== undefined || updates.colaborador_id !== undefined || (updates as any).colaboradorNombre !== undefined) {
      const rawColab = updates.colaboradorId || updates.colaborador_id || (updates as any).colaboradorNombre;
      const resolvedUuid = await resolveUserId(rawColab);
      if (resolvedUuid) rowUpdates.colaborador_id = resolvedUuid;
    }

    Object.assign(rowUpdates, equipoPayload(updates));
    if (updates.descuadreLider !== undefined) rowUpdates.descuadre_lider = updates.descuadreLider;
    if (updates.descuadreAuxiliar !== undefined) rowUpdates.descuadre_auxiliar = updates.descuadreAuxiliar;

    if (updates.auditadoPor !== undefined || updates.auditado_por !== undefined) {
      const rawAuditor = updates.auditadoPor || updates.auditado_por;
      const resolvedUuid = await resolveUserId(rawAuditor);
      rowUpdates.auditado_por = resolvedUuid;
    }
    if (updates.auditadoAt !== undefined || updates.auditado_at !== undefined) rowUpdates.auditado_at = updates.auditadoAt || updates.auditado_at;

    if (updates.justoPedidosPOS !== undefined) rowUpdates.justo_pedidos_pos = updates.justoPedidosPOS;
    if (updates.justoSobranteEfectivoDespacho !== undefined) rowUpdates.justo_sobrante_efectivo_despacho = updates.justoSobranteEfectivoDespacho;

    await api(`/api/db/cierres/${encodeURIComponent(id)}`, { method: "PUT", json: rowUpdates });
  },

  async deleteCierre(id: string): Promise<void> {
    // Anulación en vez de DELETE físico (dato financiero auditable). Solo Gerencia.
    await api(`/api/db/cierres/${encodeURIComponent(id)}`, { method: "PUT", json: { estado: "Anulado" } });
  },

  // ---- Equipo / usuarios ----
  async getTeamMembers(localNameOrId: string = "Chapinero") {
    const localId = await resolveLocalId(localNameOrId);
    const { data } = await api<{ data: any[] }>(`/api/db/usuarios?local_id=${encodeURIComponent(localId)}`);
    return data;
  },

  async saveTeamMember(member: any, localNameOrId: string = "Chapinero") {
    const localId = await resolveLocalId(localNameOrId);
    const cargoMap: Record<string, Cargo> = {
      "Gerencia": "Gerencia",
      "gerencia": "Gerencia",
      "administrador": "Gerencia",
      "gerente": "Gerencia",
      "Gerente": "Gerencia",
      "Líder operador": "Lider Operador",
      "Lider operador": "Lider Operador",
      "Lider Operador": "Lider Operador",
      "Lider Pasteleria": "Lider Pasteleria",
      "Auxiliar Pasteleria": "Auxiliar Pasteleria",
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
      local_id: localId
    };

    if (member.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(member.id)) {
      payload.id = member.id;
    }

    if (member.email !== undefined) payload.email = member.email;

    // La clave y el estado de la cuenta se gestionan aparte (securityStore → /api/admin).
    const { data } = await api<{ data: any }>("/api/db/usuarios", { method: "POST", json: payload });
    return data;
  },

  async deleteTeamMember(usuarioId: string) {
    await api(`/api/db/usuarios/${encodeURIComponent(usuarioId)}`, { method: "DELETE" });
  },

  // ---- Configuración de nómina por colaborador (Persistido en Supabase) ----
  async getNominaConfig(usuarioId: string) {
    try {
      const all = await this.getAllNominaConfigs();
      return all[usuarioId] || {};
    } catch (e) {
      return {};
    }
  },

  async getAllNominaConfigs(): Promise<Record<string, any>> {
    const { data } = await api<{ data: Record<string, any> }>("/api/db/nomina-config");
    return data || {};
  },

  async saveNominaConfig(usuarioId: string, config: any) {
    await api("/api/db/nomina-config", { method: "POST", json: { usuarioId, config } });
  },

  // ---- Historial de liquidaciones ----
  async getTurnosNomina(localNameOrId: string = "Chapinero") {
    const localId = await resolveLocalId(localNameOrId);
    const { data: rows } = await api<{ data: any[] }>(`/api/db/turnos-nomina?local_id=${encodeURIComponent(localId)}`);

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

    const { data } = await api<{ data: any }>("/api/db/turnos-nomina", { method: "POST", json: payload });
    return data;
  },

  async deleteTurnoNomina(id: string) {
    await api(`/api/db/turnos-nomina/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // ---- Configuración SMMLV / Aux. transporte (Persistido en Supabase) ----
  async getConfiguracionNomina(_localNameOrId: string = "Chapinero"): Promise<{ smmlv_base: number; aux_transporte_base: number }> {
    const { data } = await api<{ data: { smmlv_base: number; aux_transporte_base: number } }>("/api/db/configuracion-nomina");
    return data;
  },

  async saveConfiguracionNomina(_localNameOrId: string = "Chapinero", smmlvBase: number, auxTransporteBase: number) {
    await api("/api/db/configuracion-nomina", {
      method: "POST",
      json: { smmlv_base: smmlvBase, aux_transporte_base: auxTransporteBase },
    });
  },

  // ---- Puntos por cargo ----
  async getCargoPuntos(): Promise<Record<string, number>> {
    const { data } = await api<{ data: any[] }>("/api/db/cargo-puntos");
    const map: Record<string, number> = {};
    for (const row of data) map[row.cargo] = Number(row.puntos);
    return map;
  }
};
