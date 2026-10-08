import { 
  EmployeeSalaryConfig, 
  EmployeeHRProfile, 
  DisciplinarySanction, 
  EmployeeBonusRecord, 
  VacationPeriod,
  DailySchedule 
} from "../types";

const HR_STORAGE_KEY = "lopez_gracia_hr_profiles_config_v2";

export const getDefaultSchedule = (diaDescanso: string = "Domingo"): DailySchedule[] => {
  const dias: ("Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo")[] = [
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
  ];
  return dias.map(d => {
    const isRest = d === diaDescanso;
    return {
      dia: d,
      activo: !isRest,
      horaEntrada: "11:00",
      horaSalida: "19:00",
      minutosAlmuerzo: 60,
      horasCalculadas: isRest ? 0 : 7.0
    };
  });
};

export const calculateTotalWeeklyHours = (schedule?: DailySchedule[]): number => {
  if (!schedule || schedule.length === 0) return 42;
  return schedule.reduce((acc, curr) => acc + (curr.activo ? (curr.horasCalculadas || 0) : 0), 0);
};

export const calculateEffectiveHours = (
  horaEntrada: string,
  horaSalida: string,
  minutosAlmuerzo: number
): number => {
  if (!horaEntrada || !horaSalida) return 0;
  const [hIn, mIn] = horaEntrada.split(":").map(Number);
  const [hOut, mOut] = horaSalida.split(":").map(Number);
  if (isNaN(hIn) || isNaN(mIn) || isNaN(hOut) || isNaN(mOut)) return 0;

  const totalMinIn = hIn * 60 + mIn;
  let totalMinOut = hOut * 60 + mOut;
  if (totalMinOut < totalMinIn) {
    totalMinOut += 24 * 60; // Turno trasnocho
  }
  const diffMinutes = Math.max(0, totalMinOut - totalMinIn - (minutosAlmuerzo || 0));
  return Math.round((diffMinutes / 60) * 10) / 10;
};

// Cálculo de días de vacaciones según CST Colombia: 15 días hábiles por cada 360 días laborados
export const calculateVacationDaysAccrued = (fechaIngreso?: string): {
  diasLaborados: number;
  diasCausados: number;
  antiguedadAnios: number;
  antiguedadMeses: number;
} => {
  if (!fechaIngreso) {
    return { diasLaborados: 360, diasCausados: 15.0, antiguedadAnios: 1, antiguedadMeses: 0 };
  }
  const start = new Date(fechaIngreso);
  const now = new Date();
  if (isNaN(start.getTime())) {
    return { diasLaborados: 360, diasCausados: 15.0, antiguedadAnios: 1, antiguedadMeses: 0 };
  }

  const diffTime = Math.max(0, now.getTime() - start.getTime());
  const diasLaborados = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diasCausados = Math.round(((diasLaborados * 15) / 360) * 10) / 10;
  const antiguedadAnios = Math.floor(diasLaborados / 365);
  const antiguedadMeses = Math.floor((diasLaborados % 365) / 30);

  return { diasLaborados, diasCausados, antiguedadAnios, antiguedadMeses };
};

class HRStore {
  private cache: Record<string, EmployeeSalaryConfig> = {};
  private isLoaded: boolean = false;

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(HR_STORAGE_KEY);
      if (stored) {
        this.cache = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error cargando configuración local de RRHH:", e);
      this.cache = {};
    }
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem(HR_STORAGE_KEY, JSON.stringify(this.cache));
    } catch (e) {
      console.error("Error guardando configuración local de RRHH:", e);
    }
  }

  public async fetchHrConfigFromSupabase(): Promise<Record<string, EmployeeSalaryConfig>> {
    try {
      const res = await fetch("/api/db/hr-config");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.cache = { ...this.cache, ...json.data };
          this.saveToLocalStorage();
          this.isLoaded = true;
          return this.cache;
        }
      }
    } catch (err) {
      console.warn("No se pudo contactar endpoint de Supabase HR, usando caché local:", err);
    }
    this.isLoaded = true;
    return this.cache;
  }

  public async saveHrConfigToSupabase(newMap: Record<string, EmployeeSalaryConfig>): Promise<boolean> {
    this.cache = { ...this.cache, ...newMap };
    this.saveToLocalStorage();

    try {
      const res = await fetch("/api/db/hr-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMap)
      });
      return res.ok;
    } catch (err) {
      console.error("Error guardando en Supabase HR:", err);
      return false;
    }
  }

  public getAllConfigs(): Record<string, EmployeeSalaryConfig> {
    return this.cache;
  }

  public getEmployeeConfig(member: any): EmployeeSalaryConfig {
    const nameClean = (member?.nombre || "").trim();
    const smmlv = Number(localStorage.getItem("lopez_gracia_smmlv_base")) || 1750905;
    const role = member?.role || member?.cargo || "Asistente de Servicio";
    const isPasteleria = role.toLowerCase().includes("pasteler") || role.toLowerCase().includes("cocina");

    if (nameClean && this.cache[nameClean]) {
      const existing = { ...this.cache[nameClean] };
      // Validar que tenga las listas inicializadas
      if (!existing.bonosConfigurados) existing.bonosConfigurados = [];
      if (!existing.bonificaciones) existing.bonificaciones = [];
      if (!existing.sanciones) existing.sanciones = [];
      if (!existing.vacaciones) existing.vacaciones = [];
      if (!existing.hrProfile) existing.hrProfile = {};
      if (!existing.horarioSemanal || existing.horarioSemanal.length === 0) {
        existing.horarioSemanal = getDefaultSchedule(existing.diaDescansoContractual || "Domingo");
      }
      return existing;
    }

    // Default nuevo colaborador
    return {
      nombre: nameClean,
      cedula: member?.cedula || "",
      role: role,
      area: isPasteleria ? "Pastelería" : "Ventas",
      salarioBaseMensual: smmlv,
      tipoContrato: "Indefinido",
      auxilioTransporteAplica: true,
      informacionParticular: "",
      diaDescansoContractual: "Domingo",
      horarioSemanal: getDefaultSchedule("Domingo"),
      bonosConfigurados: [],
      bonificaciones: [],
      sanciones: [],
      vacaciones: [],
      hrProfile: {
        fechaIngreso: new Date().toISOString().split("T")[0],
        eps: "Compensar",
        arl: "SURA (Riesgo I)",
        fondoPensiones: "Porvenir",
        fondoCesantias: "Porvenir"
      }
    };
  }

  public async updateEmployeeConfig(
    employeeName: string, 
    updates: Partial<EmployeeSalaryConfig>
  ): Promise<EmployeeSalaryConfig> {
    const current = this.getEmployeeConfig({ nombre: employeeName });
    const updated: EmployeeSalaryConfig = {
      ...current,
      ...updates
    };

    // Validar auxilio de transporte
    if (updates.salarioBaseMensual !== undefined) {
      const smmlv = Number(localStorage.getItem("lopez_gracia_smmlv_base")) || 1750905;
      updated.auxilioTransporteAplica = updates.salarioBaseMensual <= (smmlv * 2);
    }

    this.cache[employeeName] = updated;
    this.saveToLocalStorage();
    await this.saveHrConfigToSupabase({ [employeeName]: updated });
    return updated;
  }
}

export const hrStore = new HRStore();
