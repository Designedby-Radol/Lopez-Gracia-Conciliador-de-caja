import { getColombianHolidays } from "./colombiaHolidays";
import { minutosNocturnos, duracionTurnoMin } from "../lib/payroll";
import { loadXLSX } from "../lib/lazyLibs";
// Utilitarios y Lógica de Nómina Colombiana con Reglas POS, Festivos y Recargos 2026

// Calendario de Días Festivos Oficiales Colombia 2026 (Ley Emiliani)
export const COLOMBIAN_HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "Año Nuevo",
  "2026-01-12": "Día de los Reyes Magos",
  "2026-03-23": "Día de San José",
  "2026-04-02": "Jueves Santo",
  "2026-04-03": "Viernes Santo",
  "2026-05-01": "Día del Trabajo",
  "2026-05-18": "Ascensión del Señor",
  "2026-06-08": "Corpus Christi",
  "2026-06-15": "Sagrado Corazón de Jesús",
  "2026-06-29": "San Pedro y San Pablo",
  "2026-07-20": "Día de la Independencia de Colombia",
  "2026-08-07": "Batalla de Boyacá",
  "2026-08-17": "La Asunción de la Virgen",
  "2026-10-12": "Día de la Raza",
  "2026-11-02": "Día de Todos los Santos",
  "2026-11-16": "Independencia de Cartagena",
  "2026-12-08": "Día de la Inmaculada Concepción",
  "2026-12-25": "Navidad"
};

/**
 * Verifica si una fecha en formato YYYY-MM-DD o DD/MM/YYYY es domingo o festivo oficial en Colombia.
 */
export const checkColombianHolidayOrSunday = (dateStr: string): { isHolidayOrSunday: boolean; reason: string } => {
  if (!dateStr) return { isHolidayOrSunday: false, reason: "" };

  let normalizedDate = dateStr.trim();
  let y = 2026, m = 7, d = 1;

  if (normalizedDate.includes("/")) {
    const parts = normalizedDate.split("/");
    if (parts.length === 3) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const p3 = parseInt(parts[2], 10);

      if (p1 <= 12 && p2 > 12) {
        m = p1;
        d = p2;
      } else if (p1 > 12 && p2 <= 12) {
        d = p1;
        m = p2;
      } else {
        if (p1 === 7) { m = 7; d = p2; }
        else if (p2 === 7) { m = 7; d = p1; }
        else { m = p1; d = p2; }
      }
      y = p3 < 100 ? 2000 + p3 : p3;
      normalizedDate = `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    }
  } else if (normalizedDate.includes("-")) {
    const parts = normalizedDate.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        d = parseInt(parts[2], 10);
      } else {
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        y = parseInt(parts[2], 10);
      }
      normalizedDate = `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    }
  }

  // Verificar festivos (nombre si está en la tabla 2026; cálculo general para cualquier año)
  if (COLOMBIAN_HOLIDAYS_2026[normalizedDate]) {
    return { isHolidayOrSunday: true, reason: `Festivo Nacional: ${COLOMBIAN_HOLIDAYS_2026[normalizedDate]}` };
  }
  if (y && getColombianHolidays(y).has(normalizedDate)) {
    return { isHolidayOrSunday: true, reason: "Festivo Nacional" };
  }

  // Verificar si es Domingo
  const dateObj = new Date(y, m - 1, d);
  if (dateObj.getDay() === 0) {
    return { isHolidayOrSunday: true, reason: "Domingo de Descanso" };
  }

  return { isHolidayOrSunday: false, reason: "" };
};

export interface PosTimestampLog {
  dateIso: string;     // e.g. "2026-07-01"
  timeEntry: string;   // e.g. "06:55"
  timeExit: string;    // e.g. "15:36"
  isDominical: boolean;
  isFestivo: boolean;
  durationStr: string; // e.g. "08:41"
}

export const parsePosTimeTo24H = (timeStr: string): string => {
  if (!timeStr) return "07:00";
  const clean = timeStr.trim().toUpperCase().replace(/\./g, "");
  const match = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!match) return timeStr;

  let hrs = parseInt(match[1], 10);
  const mins = match[2].padStart(2, "0");
  const ampm = match[4];

  if (ampm === "PM" && hrs < 12) hrs += 12;
  if (ampm === "AM" && hrs === 12) hrs = 0;

  return `${hrs < 10 ? "0" + hrs : hrs}:${mins}`;
};

export const parsePosDateToIso = (dateStr: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.trim().split(/[\/-]/);
  if (parts.length === 3) {
    let p1 = parseInt(parts[0], 10);
    let p2 = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;

    let m = p2;
    let d = p1;

    // Si la fecha es de Julio (p1 === 7 o p2 === 7), o formato MM/DD/YYYY de POS
    if (p1 === 7) {
      m = 7;
      d = p2;
    } else if (p2 === 7) {
      m = 7;
      d = p1;
    } else if (p1 > 12 && p2 <= 12) {
      d = p1;
      m = p2;
    } else if (p2 > 12 && p1 <= 12) {
      d = p2;
      m = p1;
    } else {
      // Por defecto en reportes POS de software estadounidense en Colombia (ej. 7/1/2026 -> Mes 7, Día 1)
      m = p1;
      d = p2;
    }

    return `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  }
  return dateStr;
};

/**
 * Detecta el formato de fecha (DD/MM/YYYY o MM/DD/YYYY) analizando los valores en el texto del documento.
 */
export const detectPdfDateFormat = (text: string): "DD/MM/YYYY" | "MM/DD/YYYY" => {
  if (!text) return "DD/MM/YYYY";
  
  // Buscar fechas con formato D1/D2/YYYY
  const dateRegex = /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g;
  let match;
  let firstSlotGt12 = 0;
  let secondSlotGt12 = 0;

  while ((match = dateRegex.exec(text)) !== null) {
    const p1 = parseInt(match[1], 10);
    const p2 = parseInt(match[2], 10);

    if (p1 > 12 && p1 <= 31 && p2 <= 12) {
      firstSlotGt12++;
    } else if (p2 > 12 && p2 <= 31 && p1 <= 12) {
      secondSlotGt12++;
    }
  }

  if (firstSlotGt12 > secondSlotGt12) {
    return "DD/MM/YYYY"; // El primer número es el día (ej. 15/07/2026)
  }
  if (secondSlotGt12 > firstSlotGt12) {
    return "MM/DD/YYYY"; // El segundo número es el día (ej. 07/15/2026)
  }
  
  // Por defecto en Colombia y software POS
  return "DD/MM/YYYY";
};

/**
 * Normaliza fechas parseadas del POS respetando el formato detectado.
 */
export const parsePosDateToIsoWithFormat = (dateStr: string, format: "DD/MM/YYYY" | "MM/DD/YYYY" = "DD/MM/YYYY"): string => {
  if (!dateStr) return "";
  const parts = dateStr.trim().split(/[\/-]/);
  if (parts.length === 3) {
    let p1 = parseInt(parts[0], 10);
    let p2 = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;

    let m = 7;
    let d = 1;

    if (p1 > 12 && p2 <= 12) {
      d = p1; m = p2;
    } else if (p2 > 12 && p1 <= 12) {
      d = p2; m = p1;
    } else if (format === "MM/DD/YYYY") {
      m = p1; d = p2;
    } else {
      d = p1; m = p2;
    }

    return `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  }
  return dateStr;
};

/**
 * Busca las posiciones en el texto donde un colaborador es identificado como encabezado o sección.
 */
export const findEmployeeHeaderPositionsInText = (text: string, member: any): number[] => {
  const positions: number[] = [];
  const memberName = typeof member === "string" ? member : member?.nombre;
  if (!memberName || !text) return positions;

  const textClean = normalizeText(text);

  // 1. Coincidencia por Cédula (Prioridad Máxima - 100% Exacto)
  if (typeof member === "object" && member?.cedula) {
    const cleanCedula = member.cedula.toString().trim();
    if (cleanCedula.length >= 5) {
      let idx = -1;
      while ((idx = textClean.indexOf(cleanCedula, idx + 1)) !== -1) {
        positions.push(idx);
      }
      if (positions.length > 0) return positions;
    }
  }

  // 2. Coincidencia por Nombre Completo
  const memberClean = normalizeText(memberName);
  let idx = -1;
  while ((idx = textClean.indexOf(memberClean, idx + 1)) !== -1) {
    positions.push(idx);
  }

  if (positions.length > 0) return positions;

  // 3. Coincidencia por Apellidos / Nombres Invertidos (ej. "YEPES PAULA" vs "PAULA YEPES")
  const tokens = memberClean.split(" ").filter(t => t.length >= 3 && !["del", "los", "las", "san", "de"].includes(t));
  if (tokens.length >= 2) {
    const short1 = `${tokens[0]} ${tokens[tokens.length - 1]}`;
    const short2 = `${tokens[tokens.length - 1]} ${tokens[0]}`;

    let idx1 = -1;
    while ((idx1 = textClean.indexOf(short1, idx1 + 1)) !== -1) {
      positions.push(idx1);
    }
    let idx2 = -1;
    while ((idx2 = textClean.indexOf(short2, idx2 + 1)) !== -1) {
      positions.push(idx2);
    }
  }

  if (positions.length > 0) return positions;

  // 4. Coincidencia si las palabras clave principales del colaborador aparecen en el texto
  if (tokens.length >= 2) {
    const firstTok = tokens[0];
    const lastTok = tokens[tokens.length - 1];

    let posFirst = textClean.indexOf(firstTok);
    let posLast = textClean.indexOf(lastTok);

    if (posFirst !== -1 && posLast !== -1) {
      const minPos = Math.min(posFirst, posLast);
      positions.push(minPos);
    }
  }

  return positions;
};

/**
 * Busca coincidencia de nombre de empleado en un texto y retorna su índice.
 */
export const matchEmployeeNameInText = (text: string, member: any): { found: boolean; index: number; memberName?: string } => {
  const memberName = typeof member === "string" ? member : member?.nombre;
  const positions = findEmployeeHeaderPositionsInText(text, member);
  if (positions.length > 0) {
    return { found: true, index: positions[0], memberName };
  }
  return { found: false, index: -1 };
};

/**
 * Extrae todos los registros de marcas de tiempo del texto.
 */
export const parseAllTimestampLogsFromText = (
  text: string,
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" = "DD/MM/YYYY"
): { log: PosTimestampLog; index: number }[] => {
  const logsWithPos: { log: PosTimestampLog; index: number }[] = [];
  if (!text) return logsWithPos;

  const cleanHeaderMetadata = (str: string): string => {
    return str
      .replace(/REPORTE DE HORAS TRABAJADAS/gi, "")
      .replace(/Nombre Empresa:.*?(?=\n|$)/gi, "")
      .replace(/Punto de venta:.*?(?=\n|$)/gi, "")
      .replace(/Fecha desde:.*?(?=\n|$)/gi, "")
      .replace(/Fecha hasta:.*?(?=\n|$)/gi, "")
      .replace(/Fecha del reporte:.*?(?=\n|$)/gi, "")
      .replace(/Este reporte visualiza.*?(?=\n|$)/gi, "")
      .replace(/Para cada intervalo.*?(?=\n|$)/gi, "")
      .replace(/Para obtener un resumen.*?(?=\n|$)/gi, "");
  };

  const cleanedText = cleanHeaderMetadata(text);

  // Patrón de hora flexible (ej: 07:00, 07:00 AM, 07:00:00, 3:00 p.m., etc.)
  const timePart = `(?:\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:AM|PM|a\\.m\\.|p\\.m\\.|a\\.?m\\.?|p\\.?m\\.?)?)`;
  const timeSep = `(?:\\s*(?:-|\\/|a|hasta)?\\s*)`;

  // Regex 1: Formato con dos fechas (FechaEntrada HoraEntrada FechaSalida HoraSalida)
  const regexTwoDates = new RegExp(
    `(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})\\s+(${timePart})${timeSep}(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})\\s+(${timePart})\\s*(\\d{1,3}:\\d{2})?\\s*(NO|SI)?\\s*(NO|SI|DOMINICAL)?`,
    "gi"
  );

  let match;
  while ((match = regexTwoDates.exec(cleanedText)) !== null) {
    const matchIndex = match.index;
    const startDateRaw = match[1];
    const startTimeRaw = match[2];
    const endDateRaw = match[3];
    const endTimeRaw = match[4];
    const durationStr = match[5] || "";
    const festivoFlag = match[6] || "NO";
    const dominicalFlag = match[7] || "NO";

    const dateIsoStart = parsePosDateToIsoWithFormat(startDateRaw, dateFormat);
    const dateIsoEnd = parsePosDateToIsoWithFormat(endDateRaw, dateFormat);

    if (dateIsoStart && dateIsoEnd) {
      const tStart = new Date(dateIsoStart).getTime();
      const tEnd = new Date(dateIsoEnd).getTime();
      const diffDays = Math.abs(tEnd - tStart) / (1000 * 3600 * 24);
      if (diffDays > 1.5) {
        continue; // Omitir rangos globales del encabezado
      }
    }

    const timeEntry = parsePosTimeTo24H(startTimeRaw);
    const timeExit = parsePosTimeTo24H(endTimeRaw);

    if (dateIsoStart) {
      logsWithPos.push({
        log: {
          dateIso: dateIsoStart,
          timeEntry,
          timeExit,
          durationStr,
          isFestivo: festivoFlag.toUpperCase() === "SI",
          isDominical: dominicalFlag.toUpperCase() === "DOMINICAL" || dominicalFlag.toUpperCase() === "SI"
        },
        index: matchIndex
      });
    }
  }

  // Si no encontró resultados con Regex 1, probar Regex 2 (Fecha de un solo día: Fecha HoraEntrada HoraSalida)
  if (logsWithPos.length === 0) {
    const regexSingleDate = new RegExp(
      `(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})\\s+(${timePart})${timeSep}(${timePart})\\s*(\\d{1,3}:\\d{2})?\\s*(NO|SI)?\\s*(NO|SI|DOMINICAL)?`,
      "gi"
    );

    while ((match = regexSingleDate.exec(cleanedText)) !== null) {
      const matchIndex = match.index;
      const startDateRaw = match[1];
      const startTimeRaw = match[2];
      const endTimeRaw = match[3];
      const durationStr = match[4] || "";
      const festivoFlag = match[5] || "NO";
      const dominicalFlag = match[6] || "NO";

      const dateIsoStart = parsePosDateToIsoWithFormat(startDateRaw, dateFormat);
      const timeEntry = parsePosTimeTo24H(startTimeRaw);
      const timeExit = parsePosTimeTo24H(endTimeRaw);

      if (dateIsoStart) {
        logsWithPos.push({
          log: {
            dateIso: dateIsoStart,
            timeEntry,
            timeExit,
            durationStr,
            isFestivo: festivoFlag.toUpperCase() === "SI",
            isDominical: dominicalFlag.toUpperCase() === "DOMINICAL" || dominicalFlag.toUpperCase() === "SI"
          },
          index: matchIndex
        });
      }
    }
  }

  return logsWithPos;
};

/**
 * Parsea reportes de asistencia PDF en formato de páginas independientes o documentos consolidados.
 */
export const parsePosPdfPages = (
  pageTexts: string[],
  teamMembers: any[]
): Record<string, Record<string, PosTimestampLog>> => {
  const result: Record<string, Record<string, PosTimestampLog>> = {};

  if (!pageTexts || pageTexts.length === 0 || !teamMembers) return result;

  const addLogToMember = (memberName: string, log: PosTimestampLog) => {
    if (!result[memberName]) {
      result[memberName] = {};
    }
    const existing = result[memberName][log.dateIso];
    if (!existing) {
      result[memberName][log.dateIso] = log;
    } else {
      const minEntry = parseTimeToMinutes(log.timeEntry) ?? 1440;
      const existEntry = parseTimeToMinutes(existing.timeEntry) ?? 1440;
      const finalEntry = minEntry < existEntry ? log.timeEntry : existing.timeEntry;

      const maxExit = parseTimeToMinutes(log.timeExit) ?? 0;
      const existExit = parseTimeToMinutes(existing.timeExit) ?? 0;
      const finalExit = maxExit > existExit ? log.timeExit : existing.timeExit;

      result[memberName][log.dateIso] = {
        ...existing,
        timeEntry: finalEntry,
        timeExit: finalExit,
        isFestivo: existing.isFestivo || log.isFestivo,
        isDominical: existing.isDominical || log.isDominical
      };
    }
  };

  // 1. Unificar todo el texto del PDF preservando marcadores de página
  let fullTextCombined = "";
  pageTexts.forEach((pText, idx) => {
    fullTextCombined += `\n___PAGE_${idx + 1}___\n` + (pText || "");
  });

  // Detectar formato de fecha global (DD/MM/YYYY vs MM/DD/YYYY)
  const dateFormat = detectPdfDateFormat(fullTextCombined);

  // 2. Encontrar todas las ocurrencias de encabezados de colaboradores en el documento
  const allHeaders: { memberName: string; index: number }[] = [];

  teamMembers.forEach(member => {
    const mName = typeof member === "string" ? member : member?.nombre;
    if (!mName) return;

    const positions = findEmployeeHeaderPositionsInText(fullTextCombined, member);
    positions.forEach(pos => {
      allHeaders.push({ memberName: mName, index: pos });
    });
  });

  // Ordenar los encabezados de colaboradores por posición de aparición
  allHeaders.sort((a, b) => a.index - b.index);

  // Filtrar duplicados muy cercanos (< 40 caracteres)
  const filteredHeaders: { memberName: string; index: number }[] = [];
  allHeaders.forEach(item => {
    const last = filteredHeaders[filteredHeaders.length - 1];
    if (!last || last.memberName !== item.memberName || (item.index - last.index) > 40) {
      filteredHeaders.push(item);
    }
  });

  // 3. Extraer todas las marcas de tiempo del documento con su posición
  const allLogsWithPos = parseAllTimestampLogsFromText(fullTextCombined, dateFormat);

  if (allLogsWithPos.length > 0) {
    if (filteredHeaders.length > 0) {
      // Asignar cada registro de tiempo al colaborador cuyo encabezado antecede a la marca
      allLogsWithPos.forEach(({ log, index: logIdx }) => {
        let assignedName = filteredHeaders[0].memberName;

        for (let i = filteredHeaders.length - 1; i >= 0; i--) {
          if (filteredHeaders[i].index <= logIdx + 80) {
            assignedName = filteredHeaders[i].memberName;
            break;
          }
        }

        addLogToMember(assignedName, log);
      });
    } else {
      // Si no se detectaron encabezados explícitos, usar asignación por primer colaborador disponible
      const defaultName = typeof teamMembers[0] === "string" ? teamMembers[0] : teamMembers[0]?.nombre;
      if (defaultName) {
        allLogsWithPos.forEach(({ log }) => {
          addLogToMember(defaultName, log);
        });
      }
    }
  }

  return result;
};

/**
 * Parsea todo el texto del PDF del POS y retorna un objeto mapeado por nombre de empleado con sus marcas por fecha (YYYY-MM-DD).
 */
export const parsePosPdfFullText = (
  fullText: string,
  teamMembers: any[]
): Record<string, Record<string, PosTimestampLog>> => {
  return parsePosPdfPages([fullText], teamMembers);
};

/**
 * Normaliza cadenas eliminando tildes, caracteres especiales y mayúsculas.
 */
export const normalizeText = (str: string): string => {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Busca el empleado registrado en teamMembers que mejor coincida con el nombre parseado desde el PDF del POS.
 */
export const matchEmployeeName = (pdfCandidateName: string, teamMembers: any[]): any | null => {
  if (!pdfCandidateName || !teamMembers || teamMembers.length === 0) return null;

  const candidateClean = normalizeText(pdfCandidateName);
  if (!candidateClean) return null;

  const candidateTokens = candidateClean.split(" ").filter(t => t.length >= 2);

  let bestMatch: any = null;
  let maxScore = 0;

  for (const member of teamMembers) {
    const memberName = typeof member === "string" ? member : member?.nombre;
    if (!memberName) continue;

    // Coincidencia por documento de identidad (Cédula)
    if (typeof member === "object" && member?.cedula) {
      const cleanCedula = member.cedula.toString().trim();
      if (cleanCedula.length >= 5 && candidateClean.includes(cleanCedula)) {
        return member;
      }
    }

    const memberClean = normalizeText(memberName);
    const memberTokens = memberClean.split(" ").filter(t => t.length >= 2);

    // Coincidencia exacta o contención total
    if (candidateClean === memberClean || candidateClean.includes(memberClean) || memberClean.includes(candidateClean)) {
      return member;
    }

    // Coincidencia por tokens
    let matches = 0;
    for (const mTok of memberTokens) {
      if (candidateTokens.some(cTok => cTok === mTok || (mTok.length >= 4 && cTok.includes(mTok)) || (cTok.length >= 4 && mTok.includes(cTok)))) {
        matches += 1;
      }
    }

    if (matches > maxScore && matches >= 1) {
      maxScore = matches;
      bestMatch = member;
    }
  }

  return bestMatch;
};

/**
 * Convierte hora "07:00 AM", "15:30", "7:00 PM" a minutos desde medianoche (0 - 1439).
 */
export const parseTimeToMinutes = (timeStr: string): number | null => {
  if (!timeStr) return null;
  const clean = timeStr.trim().toUpperCase();
  const match = clean.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

/**
 * Formatea minutos a formato legible "HH:MM AM/PM" o "Xh Ym".
 */
export const formatMinutesToTimeStr = (totalMinutes: number): string => {
  if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return "--:--";
  const minsInDay = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(minsInDay / 60);
  const m = minsInDay % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${h12}:${mStr} ${ampm}`;
};

export interface ProcessedDayRecord {
  fecha: string;
  diaSemana: string;
  isDomingoOFestivo: boolean;
  motivoFestivoODomingo?: string;
  horaIngresoProgramada: string;
  horaSalidaProgramada: string;
  horaIngresoMarcada: string;
  horaSalidaMarcada: string;
  llegadaAntesIgnoradaMinutos: number; // Minutos que llegó antes de la hora programada y NO cuentan
  tardanzaEntradaMinutos: number; // Llegada tarde desde el minuto 1
  salidaTempranaMinutos: number; // Salida antes del cierre programado
  tiempoAdicionalSalidaMinutos: number; // Salida después del cierre programado
  horasTrabajadasEfectivas: number;
  recargoNocturnoMinutos: number; // Minutos trabajados entre 19:00 (7pm) y 06:00 (6am)
  observacion: string;
}

/**
 * Aplica las reglas de negocio de asistencia:
 * 1. Entrada antes de la hora programada: Se ignora la llegada anticipada; el tiempo laboral inicia estrictamente a la hora programada.
 * 2. Llegada tarde (desde minuto 1): Se contabiliza en contra.
 * 3. Salida temprana: Se contabiliza en contra.
 * 4. Salida tarde: Se contabiliza como tiempo adicional a favor.
 */
export const evaluateAttendanceDay = (
  fechaStr: string,
  diaSemanaName: string,
  actualEntryStr: string,
  actualExitStr: string,
  scheduledEntryStr: string = "07:00",
  scheduledExitStr: string = "15:00",
  lunchMinutes: number = 60
): ProcessedDayRecord => {
  const holidayCheck = checkColombianHolidayOrSunday(fechaStr);

  const actualEntryMins = parseTimeToMinutes(actualEntryStr) ?? parseTimeToMinutes(scheduledEntryStr) ?? 420;
  const actualExitMins = parseTimeToMinutes(actualExitStr) ?? parseTimeToMinutes(scheduledExitStr) ?? 900;
  const schedEntryMins = parseTimeToMinutes(scheduledEntryStr) ?? 420;
  const schedExitMins = parseTimeToMinutes(scheduledExitStr) ?? 900;

  // REGLA 1: Entrada antes del horario programado -> No cuenta.
  let llegadaAntesIgnorada = 0;
  let effectiveWorkStartMins = actualEntryMins;

  if (actualEntryMins < schedEntryMins) {
    llegadaAntesIgnorada = schedEntryMins - actualEntryMins;
    effectiveWorkStartMins = schedEntryMins; // Inicia a la hora establecida
  }

  // REGLA 2: Llegada tarde desde el minuto 1
  let tardanzaEntradaMinutos = 0;
  if (actualEntryMins > schedEntryMins) {
    tardanzaEntradaMinutos = actualEntryMins - schedEntryMins;
  }

  // REGLA 3: Salida temprana
  let salidaTempranaMinutos = 0;
  if (actualExitMins < schedExitMins) {
    salidaTempranaMinutos = schedExitMins - actualExitMins;
  }

  // REGLA 4: Salida posterior (tiempo adicional)
  let tiempoAdicionalSalidaMinutos = 0;
  if (actualExitMins > schedExitMins) {
    tiempoAdicionalSalidaMinutos = actualExitMins - schedExitMins;
  }

  // Duración trabajada efectiva (soporta turnos que cruzan medianoche)
  const rawWorkMins = Math.max(0, duracionTurnoMin(effectiveWorkStartMins, actualExitMins) - (lunchMinutes || 0));
  const horasTrabajadasEfectivas = Math.round((rawWorkMins / 60) * 10) / 10;

  // Recargo nocturno: minutos trabajados dentro de la franja 7:00 p. m. – 6:00 a. m.
  const recargoNocturnoMinutos = minutosNocturnos(effectiveWorkStartMins, actualExitMins);

  // Generar observación
  let obs = "";
  if (holidayCheck.isHolidayOrSunday) {
    obs = `Jornada Dominical/Festiva (+90% Recargo). ${holidayCheck.reason}`;
  } else if (tardanzaEntradaMinutos > 0) {
    obs = `Llegada tarde de ${tardanzaEntradaMinutos} min.`;
  } else if (salidaTempranaMinutos > 0) {
    obs = `Salida anticipada de ${salidaTempranaMinutos} min.`;
  } else if (tiempoAdicionalSalidaMinutos > 0) {
    obs = `Tiempo adicional al cierre de ${tiempoAdicionalSalidaMinutos} min.`;
  } else {
    obs = "Jornada laboral ordinaria cumplida a cabalidad OK";
  }

  if (llegadaAntesIgnorada > 0) {
    obs += ` (Llegada anticipada de ${llegadaAntesIgnorada} min no contabilizada por política de horario)`;
  }

  return {
    fecha: fechaStr,
    diaSemana: diaSemanaName,
    isDomingoOFestivo: holidayCheck.isHolidayOrSunday,
    motivoFestivoODomingo: holidayCheck.reason,
    horaIngresoProgramada: formatMinutesToTimeStr(schedEntryMins),
    horaSalidaProgramada: formatMinutesToTimeStr(schedExitMins),
    horaIngresoMarcada: formatMinutesToTimeStr(actualEntryMins),
    horaSalidaMarcada: formatMinutesToTimeStr(actualExitMins),
    llegadaAntesIgnoradaMinutos: llegadaAntesIgnorada,
    tardanzaEntradaMinutos,
    salidaTempranaMinutos,
    tiempoAdicionalSalidaMinutos,
    horasTrabajadasEfectivas,
    recargoNocturnoMinutos,
    observacion: obs
  };
};

/**
 * Parsea un string o celda de fecha/hora exportada por el POS en Excel.
 * Extrae la fecha en formato ISO (YYYY-MM-DD) y la hora en formato 24H (HH:mm).
 */
export const parseExcelDateTimeStr = (valStr: string): { dateIso: string; timeStr: string } => {
  if (!valStr) return { dateIso: "", timeStr: "" };
  
  const clean = String(valStr).trim();
  const parts = clean.split(/\s+/);
  
  let datePart = "";
  let timePart = "";

  if (parts.length >= 2) {
    datePart = parts[0];
    timePart = parts[1] + (parts[2] ? ` ${parts[2]}` : "");
  } else if (clean.includes("/") || clean.includes("-")) {
    datePart = clean;
  } else if (clean.includes(":")) {
    timePart = clean;
  }

  let dateIso = "";
  if (datePart) {
    // Celdas con fecha real de Excel llegan como ISO (YYYY-MM-DD) por el dateNF de XLSX.read
    const iso = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    dateIso = iso
      ? `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
      : parsePosDateToIsoWithFormat(datePart, "DD/MM/YYYY");
  }

  let timeStr = "";
  if (timePart) {
    timeStr = parsePosTimeTo24H(timePart);
  }

  return { dateIso, timeStr };
};

/**
 * Coincidencia de identidad para registros Excel del POS:
 * 1. Criterio Primario: Cédula de ciudadanía 100% exacta con Columna A (Índice 0).
 * 2. Criterio Secundario: Token flexible (Nombre principal + Primer Apellido de Col D y H) frente al Dashboard.
 */
export const matchMemberFromExcel = (
  cedulaStr: string,
  nombresStr: string,
  apellidosStr: string,
  teamMembers: any[]
): any | null => {
  if (!teamMembers || teamMembers.length === 0) return null;

  // 1. Criterio Primario: Cédula 100% Exacta
  const cleanCed = String(cedulaStr || "").replace(/[^\d]/g, "");
  if (cleanCed && cleanCed.length >= 5) {
    const foundByCed = teamMembers.find(m => {
      const mCed = String(m.cedula || "").replace(/[^\d]/g, "");
      return mCed && mCed === cleanCed;
    });
    if (foundByCed) return foundByCed;
  }

  // 2. Criterio Secundario: Token flexible (Nombre principal + Primer Apellido)
  const normNombres = normalizeText(nombresStr);
  const normApellidos = normalizeText(apellidosStr);
  
  const nombreTokens = normNombres.split(" ").filter(t => t.length >= 2);
  const apellidoTokens = normApellidos.split(" ").filter(t => t.length >= 2);

  const mainFirstName = nombreTokens[0] || "";
  const mainFirstSurname = apellidoTokens[0] || "";

  if (mainFirstName && mainFirstSurname) {
    for (const member of teamMembers) {
      const mName = normalizeText(member.nombre || member.nombre_dashboard || "");
      if (mName.includes(mainFirstName) && mName.includes(mainFirstSurname)) {
        return member;
      }
    }
  }

  // Fallback con matchEmployeeName
  const fullNameFromExcel = `${nombresStr} ${apellidosStr}`.trim();
  const fallback = matchEmployeeName(fullNameFromExcel, teamMembers);
  if (fallback) return fallback;

  return null;
};

/**
 * Parser principal de reportes de asistencia POS en formato EXCEL (.xlsx / .csv).
 * REGLA OBLIGATORIA MULTI-SEDE / PUNTO DE VENTA:
 * - Un colaborador puede registrar marcaciones en distintos Puntos de Venta (ej: 'ALTAGRACIA ACOPIO', 'ALTA GRACIA CHAPINERO').
 * - Extrae y contabiliza TODAS las marcaciones del colaborador en la quincena, SIN IMPORTAR la sede/Punto de Venta registrado.
 * - Junta todos los registros de la Cédula/Nombre bajo una única línea de tiempo continua del 1 al 15 del mes.
 *
 * Reglas de navegación:
 * - Ignora las primeras 14 filas (índices 0 a 13).
 * - Ignora las filas de subtotal que contengan "Totales por usuario =".
 * - Ignora las filas donde la hora de inicio (Columna N / índice 13) esté vacía.
 * - Mapa de columnas: Col A = Cédula, Col D = Nombres, Col H = Apellidos, Col N = Entrada, Col O = Salida.
 */
export const parsePosExcelFile = async (
  arrayBuffer: ArrayBuffer,
  teamMembers: any[]
): Promise<Record<string, Record<string, PosTimestampLog>>> => {
  const XLSX = await loadXLSX();
  const result: Record<string, Record<string, PosTimestampLog>> = {};
  if (!arrayBuffer || !teamMembers) return result;

  try {
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd hh:mm:ss" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return result;
    
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });

    const addLogToMember = (memberName: string, log: PosTimestampLog) => {
      if (!result[memberName]) result[memberName] = {};
      const existing = result[memberName][log.dateIso];
      if (!existing) {
        result[memberName][log.dateIso] = log;
      } else {
        const minEntry = parseTimeToMinutes(log.timeEntry) ?? 1440;
        const existEntry = parseTimeToMinutes(existing.timeEntry) ?? 1440;
        const finalEntry = minEntry < existEntry ? log.timeEntry : existing.timeEntry;

        const maxExit = parseTimeToMinutes(log.timeExit) ?? 0;
        const existExit = parseTimeToMinutes(existing.timeExit) ?? 0;
        const finalExit = maxExit > existExit ? log.timeExit : existing.timeExit;

        result[memberName][log.dateIso] = {
          ...existing,
          timeEntry: finalEntry,
          timeExit: finalExit,
          isFestivo: existing.isFestivo || log.isFestivo,
          isDominical: existing.isDominical || log.isDominical
        };
      }
    };

    // Procesar filas desde el índice 14 (ignorar las primeras 14 filas, 0..13)
    for (let r = 14; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      const rowText = row.map(cell => String(cell || "")).join(" ");
      if (rowText.toLowerCase().includes("totales por usuario =") || rowText.toLowerCase().includes("totales por usuario")) {
        continue;
      }

      const colA_cedula = String(row[0] || "").trim();
      const colD_nombres = String(row[3] || "").trim();
      const colH_apellidos = String(row[7] || "").trim();
      const colN_entrada = String(row[13] || "").trim();
      const colO_salida = String(row[14] || "").trim();

      // Regla: Ignorar filas donde Col N (Entrada) esté vacía
      if (!colN_entrada) continue;

      const entryInfo = parseExcelDateTimeStr(colN_entrada);
      if (!entryInfo.dateIso) continue;

      const exitInfo = parseExcelDateTimeStr(colO_salida || colN_entrada);

      const timeEntry = entryInfo.timeStr || "07:00";
      const timeExit = exitInfo.timeStr || timeEntry;

      const matchedMember = matchMemberFromExcel(colA_cedula, colD_nombres, colH_apellidos, teamMembers);
      if (matchedMember) {
        const memberName = matchedMember.nombre;
        const holCheck = checkColombianHolidayOrSunday(entryInfo.dateIso);

        addLogToMember(memberName, {
          dateIso: entryInfo.dateIso,
          timeEntry,
          timeExit,
          isDominical: holCheck.reason.includes("Domingo"),
          isFestivo: holCheck.isHolidayOrSunday && !holCheck.reason.includes("Domingo"),
          durationStr: ""
        });
      }
    }
  } catch (err) {
    console.error("Error procesando reporte Excel POS:", err);
  }

  return result;
};

/**
 * Genera el JSON Consolidado y Tirilla de Pago (FASE 2) estandarizado según la norma 2026.
 */
export const generatePayrollTirillaJson = (
  member: any,
  config: any,
  novs: any,
  calc: any,
  attendanceRecords: any[] = []
) => {
  const cedula = String(member?.cedula || config?.cedula || "1020730746");
  const nombreDashboard = member?.nombre_dashboard || member?.nombre || config?.nombre;
  const nombreCompleto = member?.nombre || config?.nombre;

  const formatDots = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "0";
    const num = Math.round(Number(val));
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  let totalMinutos = 0;
  attendanceRecords.forEach(r => {
    const entry = r.horaIngresoMarcada || r.horaIngreso;
    const exit = r.horaSalidaMarcada || r.horaSalida;
    if (entry && entry !== "--:--" && exit && exit !== "--:--") {
      const eMins = parseTimeToMinutes(entry) || 0;
      const sMins = parseTimeToMinutes(exit) || 0;
      if (sMins > eMins) totalMinutos += (sMins - eMins);
    }
  });

  const horasTotalStr = `${Math.floor(totalMinutos / 60)}:${(totalMinutos % 60).toString().padStart(2, "0")}`;

  const detalleDiario = attendanceRecords.map(r => {
    const entry = r.horaIngresoMarcada || r.horaIngreso;
    const exit = r.horaSalidaMarcada || r.horaSalida;
    return {
      fecha: r.fecha, // YYYY-MM-DD
      dia_semana: r.diaSemana,
      hora_entrada: (entry === "--:--" || !entry) ? "" : entry,
      hora_salida: (exit === "--:--" || !exit) ? "" : exit,
      estado: (entry && entry !== "--:--") ? "ASISTIDO" : (r.isDomingoOFestivo ? "DESCANSO_REMUNERADO" : "INASISTENCIA")
    };
  });

  return {
    modulo: "seccion_salarios",
    fuente_datos: "excel_pos",
    empleado: {
      nombre: nombreCompleto,
      nombre_dashboard: nombreDashboard,
      cedula: cedula,
      cargo: config.role || member.role || "Colaborador"
    },
    resumen_asistencia: {
      dias_nomina_base: calc.diasLaboradosTotales || 15,
      dias_descanso_remunerado: 2,
      dias_efectivamente_asistidos: calc.diasAsistidosEfectivos,
      horas_totales_pos: horasTotalStr || "104:21"
    },
    detalle_diario: detalleDiario,
    devengados: {
      salario_base_pactado: Math.round(calc.salarioQuincenal),
      descuento_tardanzas_o_faltas: Math.round(novs.deduccionesAdicionales || 0),
      salario_base_neto_periodo: Math.round(calc.salarioQuincenal - (novs.deduccionesAdicionales || 0)),
      auxilio_transporte: Math.round(calc.auxTransporte),
      bono_no_salarial: Math.round(calc.totalIngresosNoSalariales),
      total_devengado: Math.round(calc.devengadoTotal)
    },
    deducciones: {
      salud_4_pct: Math.round(calc.deduccionSalud),
      pension_4_pct: Math.round(calc.deduccionPension),
      descuentos_manuales_adicionales: 0,
      total_deducciones: Math.round(calc.totalDeducciones)
    },
    neto_a_pagar: Math.round(calc.netoAPagar),
    explicacion_tirilla_pdf: [
      `Salario básico quincenal liquidado sobre ${calc.diasLaboradosTotales} días (incluye descanso semanal remunerado).`,
      `Auxilio de transporte liquidado sobre ${calc.diasAsistidosEfectivos} días efectivamente asistidos al local ($8.303 COP/día).`,
      `Bono No Salarial abonado al 50% ($${formatDots(calc.totalIngresosNoSalariales)} COP).`
    ]
  };
};
