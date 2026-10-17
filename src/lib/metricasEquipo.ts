/**
 * Métricas personales y del punto para los perfiles que no son Gerencia.
 * Funciones puras: el servidor (server/routes/me.ts) las aplica a las filas de BD
 * ya filtradas por usuario y local, y el cliente solo pinta el resultado.
 *
 * Los montos de descuadre se leen tal como los guardó la auditoría
 * (descuadre_lider / descuadre_auxiliar); aquí no se recalcula el 60/40.
 */
import { addDaysIso, startOfMonthIso } from "./dates";

/** Diferencia por canal que todavía cuenta como cuadre limpio (redondeos de caja). */
export const TOLERANCIA_CUADRE = 500;

export interface CierreFila {
  id: string;
  fecha: string;
  estado: string;
  colaborador_id?: string | null;
  lider_id?: string | null;
  auxiliares?: { id: string | null; nombre?: string | null }[];
  efectivo_cierre?: number | null;
  datafono_cierre?: number | null;
  justo_cierre?: number | null;
  rappi_cierre?: number | null;
  transferencias_cierre?: number | null;
  propinas?: number | null;
  dif_efectivo?: number | null;
  dif_tarjetas?: number | null;
  dif_justo?: number | null;
  dif_rappi?: number | null;
  dif_transferencias?: number | null;
  descuadre_lider?: number | null;
  descuadre_auxiliar?: number | null;
}

export interface ChecklistFila {
  fecha: string;
  usuario_id?: string | null;
  data?: {
    turno?: string;
    porcentajeCumplimiento?: number;
    tasks?: { seccion?: string; estado?: string }[];
  } | null;
}

export interface InventarioFila {
  fecha: string;
  usuario_id?: string | null;
  data?: { totalItemsCounted?: number } | null;
}

export type RolEnCierre = "lider" | "auxiliar" | "registro";

const normalizar = (s: string | null | undefined) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cualquier líder (operador o de pastelería): ve los cierres de todo su local. */
export const esCargoLider = (cargo: string | null | undefined) => normalizar(cargo).includes("lider");
export const esCargoPasteleria = (cargo: string | null | undefined) => normalizar(cargo).includes("pastel");
/** Líder de caja/servicio: es el único perfil no gerencial con panel del punto. */
export const esLiderOperador = (cargo: string | null | undefined) => esCargoLider(cargo) && !esCargoPasteleria(cargo);

const ESTADO_CUADRADO = "Cuadrado";
const ESTADO_PENDIENTE = "Pendiente por Cuadrar";
const num = (v: unknown) => Number(v) || 0;

/** Papel del usuario en un cierre (el de mayor responsabilidad si tiene varios). */
export function rolEnCierre(c: CierreFila, usuarioId: string): RolEnCierre | null {
  if (c.lider_id === usuarioId) return "lider";
  if ((c.auxiliares || []).some((a) => a.id === usuarioId)) return "auxiliar";
  if (c.colaborador_id === usuarioId) return "registro";
  return null;
}

/** Lo que la auditoría le asignó a este usuario en un cierre cuadrado (positivo = se le cobra). */
export function montoDescuadre(c: CierreFila, rol: RolEnCierre | null): number {
  if (c.estado !== ESTADO_CUADRADO) return 0;
  if (rol === "lider") return Math.max(0, num(c.descuadre_lider));
  if (rol === "auxiliar") return Math.max(0, num(c.descuadre_auxiliar));
  return 0;
}

export function diferenciasPorCanal(c: CierreFila) {
  return {
    efectivo: num(c.dif_efectivo),
    tarjetas: num(c.dif_tarjetas),
    justo: num(c.dif_justo),
    rappi: num(c.dif_rappi),
    transferencias: num(c.dif_transferencias),
  };
}

/** Cierre auditado en el que ningún canal se desvía más de la tolerancia. */
export function esCuadreLimpio(c: CierreFila): boolean {
  if (c.estado !== ESTADO_CUADRADO) return false;
  return Object.values(diferenciasPorCanal(c)).every((d) => Math.abs(d) <= TOLERANCIA_CUADRE);
}

export function totalDeclarado(c: CierreFila): number {
  return num(c.efectivo_cierre) + num(c.datafono_cierre) + num(c.justo_cierre) + num(c.rappi_cierre) + num(c.transferencias_cierre);
}

/** Racha actual (desde el cierre auditado más reciente) y la mejor histórica de cuadres limpios. */
export function rachasDeCuadre(cierres: CierreFila[]): { actual: number; mejor: number } {
  const auditados = cierres
    .filter((c) => c.estado === ESTADO_CUADRADO)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  let mejor = 0;
  let corriendo = 0;
  for (const c of auditados) {
    corriendo = esCuadreLimpio(c) ? corriendo + 1 : 0;
    mejor = Math.max(mejor, corriendo);
  }
  return { actual: corriendo, mejor };
}

/** Quincena a la que pertenece una fecha: "2026-10-1" (1–15) o "2026-10-2" (16–fin). */
export function claveQuincena(fecha: string): string {
  return `${fecha.slice(0, 7)}-${Number(fecha.slice(8, 10)) <= 15 ? 1 : 2}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function etiquetaQuincena(clave: string): string {
  const [anio, mes, q] = clave.split("-");
  const nombreMes = MESES[Number(mes) - 1] || mes;
  return q === "1" ? `1–15 ${nombreMes} ${anio}` : `16–fin ${nombreMes} ${anio}`;
}

export interface Logro {
  id: string;
  titulo: string;
  descripcion: string;
  obtenido: boolean;
  progreso: number; // 0–1
}

function logros(input: { rachaMejor: number; cuadradosLimpios: number; checklistsCompletos: number; conteos: number; sinDescuadreQuincena: boolean; participaDescuadre: boolean }): Logro[] {
  const lista: Logro[] = [];
  const meta = (id: string, titulo: string, descripcion: string, valor: number, objetivo: number) =>
    lista.push({ id, titulo, descripcion, obtenido: valor >= objetivo, progreso: Math.min(1, valor / objetivo) });

  if (input.participaDescuadre) {
    meta("racha-5", "Racha de 5", "Cinco cierres seguidos cuadrados sin diferencias", input.rachaMejor, 5);
    meta("racha-15", "Quincena impecable", "Quince cierres seguidos cuadrados sin diferencias", input.rachaMejor, 15);
    meta("limpios-30", "Mano firme", "Treinta cierres cuadrados sin diferencias", input.cuadradosLimpios, 30);
    lista.push({
      id: "quincena-cero",
      titulo: "Quincena en cero",
      descripcion: "Ningún descuadre asignado en la quincena actual",
      obtenido: input.sinDescuadreQuincena,
      progreso: input.sinDescuadreQuincena ? 1 : 0,
    });
  }
  meta("checklist-10", "Checklist al 100%", "Diez checklists completados al 100%", input.checklistsCompletos, 10);
  meta("conteos-10", "Inventario al día", "Diez conteos de inventario registrados", input.conteos, 10);
  return lista;
}

export interface ResumenPersonalInput {
  usuarioId: string;
  participaDescuadre: boolean;
  /** Cierres del local donde el usuario figura (ya filtrados por el servidor). */
  cierres: CierreFila[];
  checklists: ChecklistFila[];
  inventarios: InventarioFila[];
  catalogoSize: number;
  hoy: string;
  /** Rango para los totales del período; las rachas y logros usan todo el historial. */
  desde: string;
}

export function resumenPersonal(input: ResumenPersonalInput) {
  const { usuarioId, hoy, desde } = input;
  const enRango = <T extends { fecha: string }>(f: T) => f.fecha >= desde && f.fecha <= hoy;

  const misCierres = input.cierres
    .map((c) => ({ c, rol: rolEnCierre(c, usuarioId) }))
    .filter((x) => x.rol !== null);
  const delPeriodo = misCierres.filter((x) => enRango(x.c));

  const cuadrados = delPeriodo.filter((x) => x.c.estado === ESTADO_CUADRADO);
  const limpios = cuadrados.filter((x) => esCuadreLimpio(x.c));
  // La racha solo cuenta turnos en los que la persona respondía por la caja.
  const rachas = rachasDeCuadre(misCierres.filter((x) => x.rol !== "registro").map((x) => x.c));

  // Descuadres: detalle por cierre y agrupado por quincena (todo el historial, más reciente primero).
  const detalle = misCierres
    .map(({ c, rol }) => ({ cierreId: c.id, fecha: c.fecha, rol: rol!, monto: montoDescuadre(c, rol), canales: diferenciasPorCanal(c) }))
    .filter((d) => d.monto > 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const porQuincenaMap = new Map<string, { monto: number; cierres: number }>();
  for (const d of detalle) {
    const k = claveQuincena(d.fecha);
    const acc = porQuincenaMap.get(k) || { monto: 0, cierres: 0 };
    acc.monto += d.monto;
    acc.cierres += 1;
    porQuincenaMap.set(k, acc);
  }
  const porQuincena = [...porQuincenaMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([clave, v]) => ({ clave, etiqueta: etiquetaQuincena(clave), ...v }));
  const quincenaActual = claveQuincena(hoy);
  const montoQuincenaActual = porQuincenaMap.get(quincenaActual)?.monto || 0;

  // Checklist propios
  const misChecklists = input.checklists.filter((r) => r.usuario_id === usuarioId);
  const checklistsPeriodo = misChecklists.filter(enRango);
  const porSeccion: Record<string, { ok: number; total: number }> = {
    apertura: { ok: 0, total: 0 },
    turno: { ok: 0, total: 0 },
    cierre: { ok: 0, total: 0 },
  };
  let sumaCumplimiento = 0;
  for (const r of checklistsPeriodo) {
    sumaCumplimiento += num(r.data?.porcentajeCumplimiento);
    for (const t of r.data?.tasks || []) {
      const sec = porSeccion[t.seccion || ""];
      if (!sec || t.estado === "no_aplica" || t.estado === "sin_evaluar") continue;
      sec.total += 1;
      if (t.estado === "cumplido") sec.ok += 1;
    }
  }
  const pct = (ok: number, total: number) => (total > 0 ? Math.round((ok / total) * 100) : null);
  const secciones = Object.fromEntries(Object.entries(porSeccion).map(([k, v]) => [k, pct(v.ok, v.total)])) as Record<
    "apertura" | "turno" | "cierre",
    number | null
  >;
  const seccionesEvaluadas = Object.entries(secciones).filter(([, v]) => v !== null) as [string, number][];
  const peorSeccion = seccionesEvaluadas.length > 1 ? seccionesEvaluadas.reduce((a, b) => (b[1] < a[1] ? b : a))[0] : null;

  // Inventario propio
  const misConteos = input.inventarios.filter((r) => r.usuario_id === usuarioId);
  const conteosPeriodo = misConteos.filter(enRango);
  const cobertura = (r: InventarioFila) =>
    input.catalogoSize > 0 ? Math.min(100, Math.round((num(r.data?.totalItemsCounted) / input.catalogoSize) * 100)) : null;
  const coberturas = conteosPeriodo.map(cobertura).filter((v): v is number => v !== null);
  const ultimoConteo = [...misConteos].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

  return {
    periodo: { desde, hasta: hoy },
    cierres: {
      total: delPeriodo.length,
      comoLider: delPeriodo.filter((x) => x.rol === "lider").length,
      comoAuxiliar: delPeriodo.filter((x) => x.rol === "auxiliar").length,
      pendientes: delPeriodo.filter((x) => x.c.estado === ESTADO_PENDIENTE).length,
      cuadrados: cuadrados.length,
      limpios: limpios.length,
      tasaCuadre: cuadrados.length > 0 ? Math.round((limpios.length / cuadrados.length) * 100) : null,
      rachaActual: rachas.actual,
      mejorRacha: rachas.mejor,
      recientes: misCierres
        .slice()
        .sort((a, b) => b.c.fecha.localeCompare(a.c.fecha))
        .slice(0, 20)
        .map(({ c, rol }) => ({ id: c.id, fecha: c.fecha, estado: c.estado, rol: rol!, limpio: esCuadreLimpio(c), monto: montoDescuadre(c, rol) })),
    },
    descuadres: input.participaDescuadre
      ? {
          totalPeriodo: detalle.filter((d) => enRango(d)).reduce((s, d) => s + d.monto, 0),
          quincenaActual: { clave: quincenaActual, etiqueta: etiquetaQuincena(quincenaActual), monto: montoQuincenaActual },
          porQuincena: porQuincena.slice(0, 6),
          detalle: detalle.slice(0, 30),
        }
      : null,
    checklist: {
      total: checklistsPeriodo.length,
      promedio: checklistsPeriodo.length > 0 ? Math.round(sumaCumplimiento / checklistsPeriodo.length) : null,
      secciones,
      peorSeccion,
    },
    inventario: {
      conteos: conteosPeriodo.length,
      coberturaPromedio: coberturas.length > 0 ? Math.round(coberturas.reduce((s, v) => s + v, 0) / coberturas.length) : null,
      ultimo: ultimoConteo ? { fecha: ultimoConteo.fecha, cobertura: cobertura(ultimoConteo) } : null,
    },
    logros: logros({
      rachaMejor: rachas.mejor,
      cuadradosLimpios: misCierres.filter((x) => x.rol !== "registro" && esCuadreLimpio(x.c)).length,
      checklistsCompletos: misChecklists.filter((r) => num(r.data?.porcentajeCumplimiento) >= 100).length,
      conteos: misConteos.length,
      sinDescuadreQuincena: montoQuincenaActual === 0 && misCierres.some((x) => claveQuincena(x.c.fecha) === quincenaActual && x.c.estado === ESTADO_CUADRADO),
      participaDescuadre: input.participaDescuadre,
    }),
  };
}

export type ResumenPersonal = ReturnType<typeof resumenPersonal>;

/** Lo que falta hoy en el local (un solo cierre por local y día). */
export function pendientesDelDia(input: { hoy: string; cierresLocal: CierreFila[]; checklistsLocal: ChecklistFila[]; inventariosLocal: InventarioFila[] }) {
  const { hoy } = input;
  const ayer = addDaysIso(hoy, -1);
  const cierreHoy = input.cierresLocal.find((c) => c.fecha === hoy);
  const cierreAyer = input.cierresLocal.find((c) => c.fecha === ayer);
  const turnosHoy = new Set(
    input.checklistsLocal.filter((r) => r.fecha === hoy).map((r) => (r.data?.turno || "").toLowerCase()).filter(Boolean),
  );
  return {
    // Sin id: este dato llega a todo el local, participe o no del cierre.
    cierreHoy: cierreHoy ? { estado: cierreHoy.estado } : null,
    cierreAyerFalta: !cierreAyer,
    checklistTurnosHoy: [...turnosHoy],
    inventarioHoy: input.inventariosLocal.some((r) => r.fecha === hoy),
  };
}

export type PendientesDelDia = ReturnType<typeof pendientesDelDia>;

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface MiembroPunto {
  id: string;
  nombre: string;
  cargo?: string | null;
}

/**
 * Panel del Líder Operador: ventas declaradas del local frente a la meta,
 * desempeño por persona y alertas. Usa cierres no anulados (pendientes incluidos),
 * así que las ventas son las declaradas, no las auditadas.
 */
export function panelPunto(input: {
  hoy: string;
  metaMensual: number;
  cierresLocal: CierreFila[];
  checklistsLocal: ChecklistFila[];
  inventariosLocal: InventarioFila[];
  equipo: MiembroPunto[];
}) {
  const { hoy } = input;
  const inicioMes = startOfMonthIso(hoy);
  const inicioSemana = addDaysIso(hoy, -((diaSemana(hoy) + 6) % 7)); // lunes
  const mesAnteriorInicio = startOfMonthIso(addDaysIso(inicioMes, -1));
  const mismoDiaMesAnterior = addDaysIso(mesAnteriorInicio, Number(hoy.slice(8, 10)) - 1);

  const suma = (desde: string, hasta: string) =>
    input.cierresLocal.filter((c) => c.fecha >= desde && c.fecha <= hasta).reduce((s, c) => s + totalDeclarado(c), 0);

  const ventasMes = suma(inicioMes, hoy);
  const ventasMesAnteriorMismoCorte = suma(mesAnteriorInicio, mismoDiaMesAnterior < inicioMes ? mismoDiaMesAnterior : addDaysIso(inicioMes, -1));

  const ultimos60 = input.cierresLocal.filter((c) => c.fecha >= addDaysIso(hoy, -59) && c.fecha <= hoy);
  const porDia = DIAS_SEMANA.map((etiqueta, i) => {
    const delDia = ultimos60.filter((c) => diaSemana(c.fecha) === i);
    const total = delDia.reduce((s, c) => s + totalDeclarado(c), 0);
    return { etiqueta, promedio: delDia.length > 0 ? Math.round(total / delDia.length) : 0, dias: delDia.length };
  });

  const ultimos14 = Array.from({ length: 14 }, (_, i) => addDaysIso(hoy, i - 13)).map((fecha) => {
    const c = input.cierresLocal.find((x) => x.fecha === fecha);
    return { fecha, total: c ? totalDeclarado(c) : null };
  });

  const desde30 = addDaysIso(hoy, -29);
  const equipo = input.equipo.map((m) => {
    const turnos = input.cierresLocal.filter((c) => c.fecha >= desde30 && (c.lider_id === m.id || (c.auxiliares || []).some((a) => a.id === m.id)));
    const cuadrados = turnos.filter((c) => c.estado === ESTADO_CUADRADO);
    const checklists = input.checklistsLocal.filter((r) => r.usuario_id === m.id && r.fecha >= desde30);
    return {
      id: m.id,
      nombre: m.nombre,
      cargo: m.cargo || null,
      turnos: turnos.length,
      cuadrados: cuadrados.length,
      tasaCuadre: cuadrados.length > 0 ? Math.round((cuadrados.filter(esCuadreLimpio).length / cuadrados.length) * 100) : null,
      checklists: checklists.length,
      checklistPromedio:
        checklists.length > 0 ? Math.round(checklists.reduce((s, r) => s + num(r.data?.porcentajeCumplimiento), 0) / checklists.length) : null,
      conteos: input.inventariosLocal.filter((r) => r.usuario_id === m.id && r.fecha >= desde30).length,
    };
  });

  // Alertas: días recientes sin cierre, pendientes de auditoría, inventario sin contar hoy.
  const alertas: { tipo: "cierre_faltante" | "pendientes_auditoria" | "inventario_hoy" | "checklist_hoy"; mensaje: string; nivel: "alta" | "media" }[] = [];
  const diasSinCierre = Array.from({ length: 7 }, (_, i) => addDaysIso(hoy, -(i + 1))).filter(
    (f) => !input.cierresLocal.some((c) => c.fecha === f),
  );
  if (diasSinCierre.length > 0) {
    alertas.push({
      tipo: "cierre_faltante",
      nivel: diasSinCierre.includes(addDaysIso(hoy, -1)) ? "alta" : "media",
      mensaje:
        diasSinCierre.length === 1
          ? `No hay cierre registrado del ${diasSinCierre[0]}.`
          : `Faltan ${diasSinCierre.length} cierres en los últimos 7 días (el más reciente: ${diasSinCierre[0]}).`,
    });
  }
  const pendientes = input.cierresLocal.filter((c) => c.estado === ESTADO_PENDIENTE);
  if (pendientes.length > 0) {
    alertas.push({
      tipo: "pendientes_auditoria",
      nivel: pendientes.length > 3 ? "alta" : "media",
      mensaje: `${pendientes.length} cierre${pendientes.length === 1 ? "" : "s"} pendiente${pendientes.length === 1 ? "" : "s"} de auditoría por Gerencia.`,
    });
  }
  if (!input.inventariosLocal.some((r) => r.fecha === hoy)) {
    alertas.push({ tipo: "inventario_hoy", nivel: "media", mensaje: "Todavía no se registra el conteo de inventario de hoy." });
  }
  if (!input.checklistsLocal.some((r) => r.fecha === hoy)) {
    alertas.push({ tipo: "checklist_hoy", nivel: "media", mensaje: "Todavía no hay checklist registrado hoy." });
  }

  return {
    ventas: {
      semana: suma(inicioSemana, hoy),
      mes: ventasMes,
      mesAnteriorMismoCorte: ventasMesAnteriorMismoCorte,
      metaMensual: input.metaMensual,
      avanceMeta: input.metaMensual > 0 ? Math.round((ventasMes / input.metaMensual) * 100) : null,
      porDiaSemana: porDia,
      ultimos14,
    },
    equipo: equipo.sort((a, b) => b.turnos - a.turnos || a.nombre.localeCompare(b.nombre, "es")),
    alertas,
  };
}

export type PanelPunto = ReturnType<typeof panelPunto>;
