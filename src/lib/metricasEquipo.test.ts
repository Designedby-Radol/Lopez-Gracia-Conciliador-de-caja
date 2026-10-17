import { describe, it, expect } from "vitest";
import {
  rolEnCierre,
  montoDescuadre,
  esCuadreLimpio,
  rachasDeCuadre,
  claveQuincena,
  etiquetaQuincena,
  resumenPersonal,
  pendientesDelDia,
  panelPunto,
  type CierreFila,
} from "./metricasEquipo";

const YO = "u-yo";
const OTRO = "u-otro";

function cierre(p: Partial<CierreFila> & { fecha: string }): CierreFila {
  return { id: `c-${p.fecha}`, estado: "Cuadrado", lider_id: OTRO, auxiliares: [], ...p };
}

describe("rolEnCierre", () => {
  it("prioriza líder sobre auxiliar y registro", () => {
    expect(rolEnCierre(cierre({ fecha: "2026-10-01", lider_id: YO, colaborador_id: YO }), YO)).toBe("lider");
    expect(rolEnCierre(cierre({ fecha: "2026-10-01", auxiliares: [{ id: YO }], colaborador_id: YO }), YO)).toBe("auxiliar");
    expect(rolEnCierre(cierre({ fecha: "2026-10-01", colaborador_id: YO }), YO)).toBe("registro");
    expect(rolEnCierre(cierre({ fecha: "2026-10-01" }), YO)).toBeNull();
  });
});

describe("montoDescuadre", () => {
  const c = cierre({ fecha: "2026-10-01", descuadre_lider: 6000, descuadre_auxiliar: 2000 });
  it("lee el monto guardado por la auditoría según el rol", () => {
    expect(montoDescuadre(c, "lider")).toBe(6000);
    expect(montoDescuadre(c, "auxiliar")).toBe(2000);
    expect(montoDescuadre(c, "registro")).toBe(0);
  });
  it("no cuenta cierres pendientes", () => {
    expect(montoDescuadre({ ...c, estado: "Pendiente por Cuadrar" }, "lider")).toBe(0);
  });
});

describe("esCuadreLimpio", () => {
  it("acepta diferencias dentro de la tolerancia por canal", () => {
    expect(esCuadreLimpio(cierre({ fecha: "2026-10-01", dif_efectivo: -500, dif_tarjetas: 300 }))).toBe(true);
  });
  it("no deja que un sobrante tape un faltante en otro canal", () => {
    expect(esCuadreLimpio(cierre({ fecha: "2026-10-01", dif_efectivo: -10000, dif_tarjetas: 10000 }))).toBe(false);
  });
  it("un pendiente nunca es limpio", () => {
    expect(esCuadreLimpio(cierre({ fecha: "2026-10-01", estado: "Pendiente por Cuadrar" }))).toBe(false);
  });
});

describe("rachasDeCuadre", () => {
  it("calcula racha actual y mejor ignorando pendientes", () => {
    const r = rachasDeCuadre([
      cierre({ fecha: "2026-10-01" }),
      cierre({ fecha: "2026-10-02" }),
      cierre({ fecha: "2026-10-03" }),
      cierre({ fecha: "2026-10-04", dif_efectivo: -5000 }),
      cierre({ fecha: "2026-10-05" }),
      cierre({ fecha: "2026-10-06", estado: "Pendiente por Cuadrar", dif_efectivo: -9999 }),
    ]);
    expect(r).toEqual({ actual: 1, mejor: 3 });
  });
});

describe("quincenas", () => {
  it("parte el mes en 1–15 y 16–fin", () => {
    expect(claveQuincena("2026-10-15")).toBe("2026-10-1");
    expect(claveQuincena("2026-10-16")).toBe("2026-10-2");
    expect(etiquetaQuincena("2026-10-2")).toBe("16–fin oct 2026");
  });
});

describe("resumenPersonal", () => {
  const base = {
    usuarioId: YO,
    participaDescuadre: true,
    checklists: [],
    inventarios: [],
    catalogoSize: 0,
    hoy: "2026-10-20",
    desde: "2026-10-01",
  };

  it("solo cuenta los cierres donde participa y agrupa descuadres por quincena", () => {
    const r = resumenPersonal({
      ...base,
      cierres: [
        cierre({ fecha: "2026-10-03", lider_id: YO, descuadre_lider: 6000, dif_efectivo: -10000 }),
        cierre({ fecha: "2026-10-17", auxiliares: [{ id: YO }], descuadre_auxiliar: 1500, dif_efectivo: -7500 }),
        cierre({ fecha: "2026-10-18", auxiliares: [{ id: YO }] }),
        cierre({ fecha: "2026-10-19", lider_id: OTRO, descuadre_lider: 99999 }),
      ],
    });
    expect(r.cierres.total).toBe(3);
    expect(r.cierres.comoLider).toBe(1);
    expect(r.cierres.limpios).toBe(1);
    expect(r.cierres.tasaCuadre).toBe(33);
    expect(r.descuadres?.totalPeriodo).toBe(7500);
    expect(r.descuadres?.porQuincena.map((q) => [q.clave, q.monto])).toEqual([
      ["2026-10-2", 1500],
      ["2026-10-1", 6000],
    ]);
    expect(r.descuadres?.quincenaActual.monto).toBe(1500);
  });

  it("oculta descuadres y logros de caja a quien no participa del 60/40", () => {
    const r = resumenPersonal({ ...base, participaDescuadre: false, cierres: [] });
    expect(r.descuadres).toBeNull();
    expect(r.logros.some((l) => l.id.startsWith("racha"))).toBe(false);
  });

  it("calcula checklist por sección y peor sección con los registros propios", () => {
    const r = resumenPersonal({
      ...base,
      cierres: [],
      checklists: [
        {
          fecha: "2026-10-10",
          usuario_id: YO,
          data: {
            porcentajeCumplimiento: 80,
            tasks: [
              { seccion: "apertura", estado: "cumplido" },
              { seccion: "cierre", estado: "pendiente" },
              { seccion: "cierre", estado: "cumplido" },
              { seccion: "turno", estado: "no_aplica" },
            ],
          },
        },
        { fecha: "2026-10-11", usuario_id: OTRO, data: { porcentajeCumplimiento: 10 } },
      ],
    });
    expect(r.checklist.total).toBe(1);
    expect(r.checklist.promedio).toBe(80);
    expect(r.checklist.secciones).toEqual({ apertura: 100, turno: null, cierre: 50 });
    expect(r.checklist.peorSeccion).toBe("cierre");
  });
});

describe("pendientesDelDia", () => {
  it("detecta cierre de hoy, cierre de ayer faltante y turnos de checklist", () => {
    const p = pendientesDelDia({
      hoy: "2026-10-20",
      cierresLocal: [cierre({ fecha: "2026-10-20", estado: "Pendiente por Cuadrar" })],
      checklistsLocal: [{ fecha: "2026-10-20", data: { turno: "Apertura" } }],
      inventariosLocal: [],
    });
    expect(p.cierreHoy?.estado).toBe("Pendiente por Cuadrar");
    expect(p.cierreAyerFalta).toBe(true);
    expect(p.checklistTurnosHoy).toEqual(["apertura"]);
    expect(p.inventarioHoy).toBe(false);
  });
});

describe("panelPunto", () => {
  it("suma ventas declaradas del mes y genera alertas", () => {
    const p = panelPunto({
      hoy: "2026-10-20",
      metaMensual: 1000000,
      cierresLocal: [
        cierre({ fecha: "2026-10-19", efectivo_cierre: 300000, datafono_cierre: 200000, estado: "Pendiente por Cuadrar" }),
        cierre({ fecha: "2026-10-01", efectivo_cierre: 100000, lider_id: YO }),
        cierre({ fecha: "2026-09-15", efectivo_cierre: 999999 }),
      ],
      checklistsLocal: [],
      inventariosLocal: [],
      equipo: [{ id: YO, nombre: "Yo" }],
    });
    expect(p.ventas.mes).toBe(600000);
    expect(p.ventas.avanceMeta).toBe(60);
    expect(p.ventas.mesAnteriorMismoCorte).toBe(999999);
    expect(p.equipo[0]).toMatchObject({ id: YO, turnos: 1, cuadrados: 1, tasaCuadre: 100 });
    expect(p.alertas.map((a) => a.tipo)).toEqual(["cierre_faltante", "pendientes_auditoria", "inventario_hoy", "checklist_hoy"]);
  });
});
