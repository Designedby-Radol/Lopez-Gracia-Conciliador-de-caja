// Utilidad de cálculo de festivos en Colombia (Ley Emiliani y festivos fijos/móviles)
// Aplica para años actuales y futuros de forma determinística

/**
 * Calcula el Domingo de Pascua para un año dado usando el algoritmo de Butcher/Meeus
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed (2=marzo, 3=abril)
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/**
 * Si una fecha no es lunes, la traslada al lunes siguiente (Ley Emiliani 51 de 1983)
 */
function moveToNextMonday(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0: Dom, 1: Lun, 2: Mar, ..., 6: Sab
  if (dayOfWeek === 1) return new Date(date);
  const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const result = new Date(date);
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Retorna un Set con los días festivos de Colombia en formato YYYY-MM-DD para un año dado
 */
export function getColombianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // 1. Festivos fijos (no se trasladan)
  const fixed = [
    new Date(year, 0, 1),   // 1 Enero: Año Nuevo
    new Date(year, 4, 1),   // 1 Mayo: Día del Trabajo
    new Date(year, 6, 20),  // 20 Julio: Grito de Independencia
    new Date(year, 7, 7),   // 7 Agosto: Batalla de Boyacá
    new Date(year, 11, 8),  // 8 Diciembre: Inmaculada Concepción
    new Date(year, 11, 25), // 25 Diciembre: Navidad
  ];
  fixed.forEach(d => holidays.add(formatDateKey(d)));

  // 2. Festivos fijos que se trasladan al siguiente lunes (Ley Emiliani)
  const movableFixed = [
    new Date(year, 0, 6),   // 6 Enero: Reyes Magos
    new Date(year, 2, 19),  // 19 Marzo: San José
    new Date(year, 5, 29),  // 29 Junio: San Pedro y San Pablo
    new Date(year, 7, 15),  // 15 Agosto: Asunción de la Virgen
    new Date(year, 9, 12),  // 12 Octubre: Día de la Raza
    new Date(year, 10, 1),  // 1 Noviembre: Todos los Santos
    new Date(year, 10, 11), // 11 Noviembre: Independencia de Cartagena
  ];
  movableFixed.forEach(d => holidays.add(formatDateKey(moveToNextMonday(d))));

  // 3. Festivos dependientes de la Pascua (Semana Santa y móviles)
  const easter = getEasterSunday(year);
  
  // Jueves Santo (-3 días) y Viernes Santo (-2 días) -> No se trasladan
  holidays.add(formatDateKey(addDays(easter, -3)));
  holidays.add(formatDateKey(addDays(easter, -2)));

  // Móviles que se trasladan al lunes:
  // Ascensión del Señor: 40 días tras Pascua -> se traslada al lunes siguiente (+43 días desde Pascua)
  holidays.add(formatDateKey(moveToNextMonday(addDays(easter, 40))));
  
  // Corpus Christi: 60 días tras Pascua -> se traslada al lunes siguiente (+64 días desde Pascua)
  holidays.add(formatDateKey(moveToNextMonday(addDays(easter, 60))));

  // Sagrado Corazón de Jesús: 68 días tras Pascua -> se traslada al lunes siguiente (+71 días desde Pascua)
  holidays.add(formatDateKey(moveToNextMonday(addDays(easter, 68))));

  return holidays;
}

/**
 * Determina si una fecha específica es festivo en Colombia
 */
export function isColombianHoliday(dateOrDateStr: Date | string): boolean {
  let date: Date;
  if (typeof dateOrDateStr === "string") {
    const parts = dateOrDateStr.split("-").map(Number);
    date = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    date = dateOrDateStr;
  }
  const year = date.getFullYear();
  const holidays = getColombianHolidays(year);
  return holidays.has(formatDateKey(date));
}

/**
 * Obtiene el lunes de la semana a la que pertenece la fecha dada
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // 0: Dom -> el lunes anterior fue hace 6 días
  // 1: Lun -> hace 0 días
  // 2: Mar -> hace 1 día, etc.
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Verifica si la semana de una fecha tiene Lunes Festivo
 */
export function weekHasMondayHoliday(dateOrDateStr: Date | string): boolean {
  let date: Date;
  if (typeof dateOrDateStr === "string") {
    const parts = dateOrDateStr.split("-").map(Number);
    date = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    date = dateOrDateStr;
  }
  const monday = getMondayOfWeek(date);
  return isColombianHoliday(monday);
}

/**
 * Tipos de tareas programadas según calendario
 */
export interface ScheduledTaskRules {
  shouldWaterPlants: boolean;         // Regar plantas (Tarde)
  shouldDeepCleanTrash: boolean;       // Limpieza profunda de canecas (Tarde)
  shouldDeepScrubFloors: boolean;      // Cepillar y limpiado profundo de piso (Apertura)
  isMondayHolidayWeek: boolean;        // ¿La semana tuvo/tiene lunes festivo?
  reasonWaterPlants?: string;
  reasonDeepTrash?: string;
  reasonDeepFloors?: string;
}

/**
 * Evalúa para una fecha determinada cuáles tareas programadas corresponden hoy
 * siguiendo las reglas pactadas:
 * 
 * 1. Regar plantas (Tarde):
 *    - Semana normal (Lunes no festivo): Martes (2) y Viernes (5).
 *    - Semana con Lunes Festivo: Miércoles (3) y Sábado (6).
 *    - Si cae en festivo (ej. Viernes Santo), se ejecuta ese mismo día.
 * 
 * 2. Limpieza profunda de canecas (Tarde):
 *    - Semana normal: Martes (2).
 *    - Semana con Lunes Festivo: Miércoles (3).
 * 
 * 3. Cepillar y limpiado profundo de piso (Apertura):
 *    - Último día de la semana operativa:
 *      * Semana normal: Domingo (0).
 *      * Semana con Lunes Festivo: Lunes (1), ya que el lunes festivo se trabaja y culmina la jornada extendida de la semana anterior.
 */
export function getScheduledTasksForDate(dateOrDateStr: Date | string): ScheduledTaskRules {
  let date: Date;
  if (typeof dateOrDateStr === "string") {
    const parts = dateOrDateStr.split("-").map(Number);
    date = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    date = dateOrDateStr;
  }

  const dayOfWeek = date.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
  const isTodayHoliday = isColombianHoliday(date);
  const mondayHoliday = weekHasMondayHoliday(date);

  // 1. Regar plantas
  let shouldWaterPlants = false;
  let reasonWaterPlants = "";
  if (!mondayHoliday) {
    if (dayOfWeek === 2) {
      shouldWaterPlants = true;
      reasonWaterPlants = "Martes programado (Semana regular)";
    } else if (dayOfWeek === 5) {
      shouldWaterPlants = true;
      reasonWaterPlants = isTodayHoliday 
        ? "Viernes festivo programado (se labora y se ejecuta el riego)"
        : "Viernes programado (Semana regular)";
    }
  } else {
    // Semana con lunes festivo: se corre a miércoles y sábado
    if (dayOfWeek === 3) {
      shouldWaterPlants = true;
      reasonWaterPlants = "Miércoles programado (Semana corrida por Lunes Festivo laborado)";
    } else if (dayOfWeek === 6) {
      shouldWaterPlants = true;
      reasonWaterPlants = "Sábado programado (Semana corrida por Lunes Festivo laborado)";
    }
  }

  // 2. Limpieza profunda de canecas
  let shouldDeepCleanTrash = false;
  let reasonDeepTrash = "";
  if (!mondayHoliday) {
    if (dayOfWeek === 2) {
      shouldDeepCleanTrash = true;
      reasonDeepTrash = "Martes programado (Semana regular)";
    }
  } else {
    if (dayOfWeek === 3) {
      shouldDeepCleanTrash = true;
      reasonDeepTrash = "Miércoles programado (Semana corrida por Lunes Festivo laborado)";
    }
  }

  // 3. Cepillar y limpiado profundo de piso (Apertura)
  let shouldDeepScrubFloors = false;
  let reasonDeepFloors = "";
  // Último día de la semana operativa:
  // Si la semana que termina es normal, el último día laborado es Domingo (0).
  // Si el lunes siguiente es festivo, el último día de trabajo antes del descanso es el Lunes Festivo (1).
  // Analizamos si hoy es Domingo y el lunes no es festivo -> Toca hoy Domingo
  // O si hoy es Lunes y es festivo -> Toca hoy Lunes Festivo
  if (dayOfWeek === 0) {
    // Es domingo. Verificamos si mañana lunes es festivo:
    const nextDay = addDays(date, 1);
    const tomorrowIsHoliday = isColombianHoliday(nextDay);
    if (!tomorrowIsHoliday) {
      shouldDeepScrubFloors = true;
      reasonDeepFloors = "Domingo (Cierre de semana regular / último día laboral)";
    }
  } else if (dayOfWeek === 1 && isTodayHoliday) {
    // Es lunes y es festivo (último día laboral de la jornada extendida festiva)
    shouldDeepScrubFloors = true;
    reasonDeepFloors = "Lunes Festivo (Último día laboral de jornada extendida)";
  }

  return {
    shouldWaterPlants,
    shouldDeepCleanTrash,
    shouldDeepScrubFloors,
    isMondayHolidayWeek: mondayHoliday,
    reasonWaterPlants,
    reasonDeepTrash,
    reasonDeepFloors
  };
}
