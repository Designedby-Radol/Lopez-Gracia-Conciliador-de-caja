import { supabase, isSupabaseConfigured } from "./supabaseConfig";
import { CierreCaja } from "../types";

// Datos semilla para el modo de demostración local (LocalStorage)
const SEED_CIERRES: CierreCaja[] = [
  {
    id: "cierre-seed-1",
    fecha: "2026-07-15",
    efectivoCierre: 1250000,
    datafonoCierre: 3400000,
    justoCierre: 450000,
    rappiCierre: 850000,
    transferenciasCierre: 350000,
    propinas: 280000,
    novedades: "Turno tranquilo. Excelente flujo de clientes en la tarde. Propinas repartidas en efectivo.",
    estado: "Cuadrado",
    createdAt: "2026-07-15T21:30:00.000Z",
    colaboradorNombre: "María López",
    localNombre: "Chapinero",
    efectivoPOS: 1250000,
    tarjetasPOS: 3400000,
    justoPOS: 450000,
    rappiPOS: 850000,
    transferenciasPOS: 350000,
    difEfectivo: 0,
    difTarjetas: 0,
    difJusto: 0,
    difRappi: 0,
    difTransferencias: 0,
    auditadoPor: "Gerente Chapinero",
    auditadoAt: "2026-07-15T22:15:00.000Z"
  },
  {
    id: "cierre-seed-2",
    fecha: "2026-07-16",
    efectivoCierre: 980000,
    datafonoCierre: 2150000,
    justoCierre: 320000,
    rappiCierre: 540000,
    transferenciasCierre: 180000,
    propinas: 195000,
    novedades: "Fallas leves en el datáfono durante el mediodía, se reportó a soporte.",
    estado: "Pendiente por Cuadrar",
    createdAt: "2026-07-16T21:45:00.000Z",
    colaboradorNombre: "Carlos Gómez",
    localNombre: "Chapinero"
  }
];

function initializeLocalDB() {
  if (!localStorage.getItem("lopez_gracia_cierres")) {
    localStorage.setItem("lopez_gracia_cierres", JSON.stringify(SEED_CIERRES));
  }
}

// Auxiliar de Mapeo Supabase (snake_case) -> CierreCaja (camelCase)
function mapFromSupabase(row: any): CierreCaja {
  const auxNombres = Array.isArray(row.cierre_auxiliares)
    ? row.cierre_auxiliares.map((a: any) => a.usuarios?.nombre).filter(Boolean)
    : Array.isArray(row.auxiliares_nombres) ? row.auxiliares_nombres : [];

  const auxIds = Array.isArray(row.cierre_auxiliares)
    ? row.cierre_auxiliares.map((a: any) => a.usuario_id).filter(Boolean)
    : [];

  return {
    id: String(row.id),
    fecha: row.fecha,
    colaboradorId: row.colaborador_id,
    colaboradorNombre: row.colaborador?.nombre || row.colaborador_nombre || "Colaborador",
    localId: row.local_id,
    localNombre: row.locales?.nombre || row.local || "Chapinero",
    
    efectivoCierre: Number(row.efectivo_cierre) || 0,
    datafonoCierre: Number(row.datafono_cierre) || 0,
    justoCierre: Number(row.justo_cierre) || 0,
    rappiCierre: Number(row.rappi_cierre) || 0,
    transferenciasCierre: Number(row.transferencias_cierre) || 0,
    propinas: Number(row.propinas) || 0,
    novedades: row.novedades || "",
    estado: row.estado || "Pendiente por Cuadrar",
    createdAt: row.created_at || new Date().toISOString(),

    // POS
    efectivoPOS: row.efectivo_pos != null ? Number(row.efectivo_pos) : undefined,
    tarjetasPOS: row.tarjetas_pos != null ? Number(row.tarjetas_pos) : undefined,
    justoPOS: row.justo_pos != null ? Number(row.justo_pos) : undefined,
    rappiPOS: row.rappi_pos != null ? Number(row.rappi_pos) : undefined,
    transferenciasPOS: row.transferencias_pos != null ? Number(row.transferencias_pos) : undefined,
    posFileName: row.pos_file_name,

    // Diferencias
    difEfectivo: row.dif_efectivo != null ? Number(row.dif_efectivo) : undefined,
    difTarjetas: row.dif_tarjetas != null ? Number(row.dif_tarjetas) : undefined,
    difJusto: row.dif_justo != null ? Number(row.dif_justo) : undefined,
    difRappi: row.dif_rappi != null ? Number(row.dif_rappi) : undefined,
    difTransferencias: row.dif_transferencias != null ? Number(row.dif_transferencias) : undefined,

    // Reparto de Descuadres
    liderId: row.lider_id,
    liderNombre: row.lider?.nombre || row.lider_nombre,
    auxiliaresIds: auxIds,
    auxiliaresNombres: auxNombres,
    descuadreLider: row.descuadre_lider != null ? Number(row.descuadre_lider) : undefined,
    descuadreAuxiliar: row.descuadre_auxiliar != null ? Number(row.descuadre_auxiliar) : undefined,

    // Auditoría
    auditadoPor: row.auditado_por,
    auditadoAt: row.auditado_at,
    anuladoPor: row.anulado_por,
    anuladoAt: row.anulado_at
  };
}

// Auxiliar de Mapeo CierreCaja (camelCase) -> Supabase (snake_case)
function mapToSupabase(cierre: Partial<CierreCaja>): Record<string, any> {
  const row: Record<string, any> = {};

  if (cierre.fecha !== undefined) row.fecha = cierre.fecha;
  if (cierre.colaboradorId !== undefined) row.colaborador_id = cierre.colaboradorId;
  if (cierre.localId !== undefined) row.local_id = cierre.localId;
  if (cierre.efectivoCierre !== undefined) row.efectivo_cierre = cierre.efectivoCierre;
  if (cierre.datafonoCierre !== undefined) row.datafono_cierre = cierre.datafonoCierre;
  if (cierre.justoCierre !== undefined) row.justo_cierre = cierre.justoCierre;
  if (cierre.rappiCierre !== undefined) row.rappi_cierre = cierre.rappiCierre;
  if (cierre.transferenciasCierre !== undefined) row.transferencias_cierre = cierre.transferenciasCierre;
  if (cierre.propinas !== undefined) row.propinas = cierre.propinas;
  if (cierre.novedades !== undefined) row.novedades = cierre.novedades;
  if (cierre.estado !== undefined) row.estado = cierre.estado;

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

  if (cierre.liderId !== undefined) row.lider_id = cierre.liderId;
  if (cierre.descuadreLider !== undefined) row.descuadre_lider = cierre.descuadreLider;
  if (cierre.descuadreAuxiliar !== undefined) row.descuadre_auxiliar = cierre.descuadreAuxiliar;

  if (cierre.auditadoPor !== undefined) row.auditado_por = cierre.auditadoPor;
  if (cierre.auditadoAt !== undefined) row.auditado_at = cierre.auditadoAt;
  if (cierre.anuladoPor !== undefined) row.anulado_por = cierre.anuladoPor;
  if (cierre.anuladoAt !== undefined) row.anulado_at = cierre.anuladoAt;

  return row;
}

/**
 * Normaliza el nombre del rol para cumplir estrictamente con la restricción de Supabase (usuarios_role_check)
 * Las opciones permitidas estándar en la base de datos son:
 * 'Asistente de servicio', 'Lider', 'Lider de punto', 'Auxiliar', 'Admin', 'gerente', 'colaborador'
 */
export function normalizeRoleForDb(roleName?: string): string {
  if (!roleName) return "Asistente de servicio";
  const clean = roleName.trim();
  const lower = clean.toLowerCase();

  if (lower === "gerente" || lower === "admin") return lower === "gerente" ? "gerente" : "Admin";
  if (lower.includes("lider") || lower.includes("líder") || lower.includes("operador")) return "Lider de punto";
  if (lower.includes("auxiliar") || lower.includes("aux") || lower.includes("venta")) return "Auxiliar";
  if (lower.includes("colaborador")) return "colaborador";
  
  return "Asistente de servicio";
}

export const dbAdapter = {
  /**
   * Obtiene todos los cierres de caja registrados
   */
  async getCierres(): Promise<CierreCaja[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("cierres_caja")
          .select("*, colaborador:usuarios!colaborador_id(nombre), lider:usuarios!lider_id(nombre), locales(nombre), cierre_auxiliares(usuario_id, usuarios(nombre))")
          .order("fecha", { ascending: false });

        if (error) {
          console.error("Error al consultar cierres en Supabase:", error);
          throw error;
        }

        return (data || []).map(mapFromSupabase);
      } catch (err) {
        console.warn("Error en consulta Supabase. Usando LocalStorage de respaldo.", err);
        initializeLocalDB();
        const localData = localStorage.getItem("lopez_gracia_cierres");
        const list: CierreCaja[] = localData ? JSON.parse(localData) : [];
        return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
      }
    } else {
      initializeLocalDB();
      const localData = localStorage.getItem("lopez_gracia_cierres");
      const list: CierreCaja[] = localData ? JSON.parse(localData) : [];
      return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
    }
  },

  /**
   * Guarda un nuevo cierre de caja.
   * Si Supabase está configurado y ocurre un error, RE-LANZA el error para no ocultar fallas de escritura (FASE 3).
   */
  async saveCierre(cierre: Omit<CierreCaja, "id" | "createdAt">): Promise<CierreCaja> {
    if (isSupabaseConfigured && supabase) {
      // Obtener o asignar colaborador_id y local_id válidos
      const authUser = (await supabase.auth.getUser()).data.user;
      let colaboradorId = cierre.colaboradorId || authUser?.id;

      if (!colaboradorId) {
        throw new Error("Debes estar autenticado en Supabase para guardar un cierre.");
      }

      // Si no hay localId, obtener el del usuario
      let localId = cierre.localId;
      if (!localId) {
        const { data: usuario } = await supabase
          .from("usuarios")
          .select("local_id")
          .eq("id", colaboradorId)
          .single();
        localId = usuario?.local_id;
      }

      if (!localId) {
        const { data: primerLocal } = await supabase.from("locales").select("id").limit(1).single();
        localId = primerLocal?.id;
      }

      const payload = {
        ...mapToSupabase(cierre),
        colaborador_id: colaboradorId,
        local_id: localId,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("cierres_caja")
        .insert([payload])
        .select("*, colaborador:usuarios!colaborador_id(nombre), lider:usuarios!lider_id(nombre), locales(nombre)")
        .single();

      if (error) {
        console.error("Error al guardar cierre en Supabase:", error);
        throw new Error(`Error en Supabase: ${error.message}`);
      }

      // Guardar auxiliares vinculados si existen
      if (cierre.auxiliaresIds && cierre.auxiliaresIds.length > 0) {
        const auxRows = cierre.auxiliaresIds.map(uid => ({
          cierre_id: data.id,
          usuario_id: uid
        }));
        const { error: auxErr } = await supabase.from("cierre_auxiliares").insert(auxRows);
        if (auxErr) {
          console.warn("Advertencia al vincular auxiliares:", auxErr.message);
        }
      }

      return mapFromSupabase(data);
    } else {
      // Modo local
      initializeLocalDB();
      const localData = localStorage.getItem("lopez_gracia_cierres");
      const list: CierreCaja[] = localData ? JSON.parse(localData) : [];
      
      const completeCierre: CierreCaja = {
        id: "local-" + Math.random().toString(36).substring(2, 9),
        ...cierre,
        createdAt: new Date().toISOString()
      };

      list.push(completeCierre);
      localStorage.setItem("lopez_gracia_cierres", JSON.stringify(list));
      return completeCierre;
    }
  },

  /**
   * Actualiza un cierre existente. Re-lanza error si falla en Supabase.
   */
  async updateCierre(id: string, updates: Partial<CierreCaja>): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const payload = mapToSupabase(updates);

      const { error } = await supabase
        .from("cierres_caja")
        .update(payload)
        .eq("id", id);

      if (error) {
        console.error("Error al actualizar cierre en Supabase:", error);
        throw new Error(`Error al actualizar en Supabase: ${error.message}`);
      }

      if (updates.auxiliaresIds) {
        await supabase.from("cierre_auxiliares").delete().eq("cierre_id", id);
        if (updates.auxiliaresIds.length > 0) {
          const auxRows = updates.auxiliaresIds.map(uid => ({
            cierre_id: id,
            usuario_id: uid
          }));
          await supabase.from("cierre_auxiliares").insert(auxRows);
        }
      }
    } else {
      initializeLocalDB();
      const localData = localStorage.getItem("lopez_gracia_cierres");
      let list: CierreCaja[] = localData ? JSON.parse(localData) : [];
      
      list = list.map(item => item.id === id ? { ...item, ...updates } : item);
      localStorage.setItem("lopez_gracia_cierres", JSON.stringify(list));
    }
  },

  /**
   * Elimina un cierre de caja. Re-lanza error si falla en Supabase.
   */
  async deleteCierre(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("cierres_caja")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error al eliminar cierre en Supabase:", error);
        throw new Error(`Error al eliminar en Supabase: ${error.message}`);
      }
    } else {
      initializeLocalDB();
      const localData = localStorage.getItem("lopez_gracia_cierres");
      let list: CierreCaja[] = localData ? JSON.parse(localData) : [];
      
      list = list.filter(item => item.id !== id);
      localStorage.setItem("lopez_gracia_cierres", JSON.stringify(list));
    }
  },

  /**
   * Guarda un turno en la tabla `turnos_nomina`
   */
  async saveTurnoNomina(turno: {
    cierreId?: string;
    colaboradorId: string;
    cargo: string;
    fecha: string;
    horaIngreso: string; // ISO
    horaSalida: string; // ISO
    horasOrdinarias: number;
    horasNocturnas: number;
    horasDominicales: number;
    totalPago: number;
  }): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("turnos_nomina").insert([{
        cierre_id: turno.cierreId || null,
        colaborador_id: turno.colaboradorId,
        cargo: turno.cargo,
        fecha: turno.fecha,
        hora_ingreso: turno.horaIngreso,
        hora_salida: turno.horaSalida,
        horas_ordinarias: turno.horasOrdinarias,
        horas_nocturnas: turno.horasNocturnas,
        horas_dominicales: turno.horasDominicales,
        total_pago: turno.totalPago
      }]);

      if (error) {
        console.error("Error al guardar turno de nómina en Supabase:", error);
        throw new Error(`Error en Supabase turnos_nomina: ${error.message}`);
      }
    }
  },

  /**
   * Obtiene todos los usuarios/colaboradores registrados de la tabla `usuarios` de Supabase o LocalStorage
   */
  async getUsuarios(): Promise<any[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("usuarios")
          .select("*, locales(id, nombre)")
          .order("nombre", { ascending: true });

        if (error) {
          console.error("Error al consultar usuarios en Supabase:", error);
          throw error;
        }

        if (data && data.length > 0) {
          return data.map((u: any) => ({
            id: u.id,
            nombre: u.nombre,
            cedula: u.cedula || "",
            role: u.role || "Asistente de servicio",
            localId: u.local_id,
            local: u.locales?.nombre || "Chapinero",
            created_at: u.created_at
          }));
        }
      } catch (err) {
        console.warn("Error en la consulta de usuarios en Supabase. Usando LocalStorage.", err);
      }
    }

    // Fallback LocalStorage
    const localData = localStorage.getItem("lopez_gracia_user_registry");
    return localData ? JSON.parse(localData) : [];
  },

  /**
   * Guarda un nuevo usuario en la tabla `usuarios` de Supabase
   */
  async saveUsuario(user: { nombre: string; cedula?: string; role: string; localNombre?: string; localId?: string }): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      let localId = user.localId;
      if (!localId) {
        const { data: primerLocal } = await supabase.from("locales").select("id").limit(1).single();
        localId = primerLocal?.id;
      }

      const roleForDb = normalizeRoleForDb(user.role);
      const payload = {
        nombre: user.nombre.trim(),
        cedula: user.cedula ? user.cedula.trim() : null,
        role: roleForDb,
        local_id: localId
      };

      let { data, error } = await supabase
        .from("usuarios")
        .insert([payload])
        .select("*, locales(id, nombre)")
        .single();

      if (error && (error.code === "23514" || error.message?.includes("usuarios_role_check"))) {
        console.warn("Reintentando creación con rol genérico 'Asistente de servicio' debido a restricción DB:", error);
        payload.role = "Asistente de servicio";
        const retry = await supabase
          .from("usuarios")
          .insert([payload])
          .select("*, locales(id, nombre)")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("Error al crear usuario en Supabase:", error);
        throw new Error(`Error al crear usuario en Supabase: ${error.message}`);
      }

      return {
        id: data.id,
        nombre: data.nombre,
        cedula: data.cedula || "",
        role: user.role || data.role || "Asistente de servicio",
        localId: data.local_id,
        local: data.locales?.nombre || "Chapinero",
        created_at: data.created_at
      };
    } else {
      const localData = localStorage.getItem("lopez_gracia_user_registry");
      const list = localData ? JSON.parse(localData) : [];
      list.push(user);
      localStorage.setItem("lopez_gracia_user_registry", JSON.stringify(list));
      return user;
    }
  },

  /**
   * Actualiza un usuario en Supabase (tabla `usuarios`)
   */
  async updateUsuario(id: string, updates: Partial<{ nombre: string; cedula: string; role: string; localId: string }>): Promise<void> {
    if (isSupabaseConfigured && supabase && id) {
      const payload: Record<string, any> = {};
      if (updates.nombre !== undefined) payload.nombre = updates.nombre;
      if (updates.cedula !== undefined) payload.cedula = updates.cedula || null;
      if (updates.role !== undefined) payload.role = normalizeRoleForDb(updates.role);
      if (updates.localId !== undefined) payload.local_id = updates.localId;

      let { error } = await supabase
        .from("usuarios")
        .update(payload)
        .eq("id", id);

      if (error && (error.code === "23514" || error.message?.includes("usuarios_role_check"))) {
        console.warn("Reintentando actualización de rol con 'Asistente de servicio' debido a restricción DB:", error);
        payload.role = "Asistente de servicio";
        const retry = await supabase
          .from("usuarios")
          .update(payload)
          .eq("id", id);
        error = retry.error;
      }

      if (error) {
        console.error("Error al actualizar usuario en Supabase:", error);
        throw new Error(`Error al actualizar usuario en Supabase: ${error.message}`);
      }
    }
  },

  /**
   * Elimina un usuario de Supabase (tabla `usuarios`)
   */
  async deleteUsuario(id?: string, nombre?: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      if (id) {
        const { error } = await supabase.from("usuarios").delete().eq("id", id);
        if (error) {
          console.error("Error al eliminar usuario en Supabase por id:", error);
          throw new Error(`Error al eliminar usuario en Supabase: ${error.message}`);
        }
      } else if (nombre) {
        const { error } = await supabase.from("usuarios").delete().eq("nombre", nombre);
        if (error) {
          console.error("Error al eliminar usuario en Supabase por nombre:", error);
        }
      }
    }
  }
};
