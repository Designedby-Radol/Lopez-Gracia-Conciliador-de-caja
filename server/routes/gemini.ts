import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { requireGerencia } from "../auth";

export const geminiRouter = Router();
geminiRouter.use(requireGerencia);

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Consultas laborales y liquidaciones con IA Gemini (Experto Laboralista Colombiano).
// Nota: envía datos personales y salariales a Google; requiere autorización de
// tratamiento de datos de los colaboradores (Ley 1581 de 2012).
geminiRouter.post("/laboral", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const { prompt, employeeContext } = req.body;

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        text: "⚠️ **Atención**: No se encontró la clave de API (GEMINI_API_KEY) en las variables de entorno. Por favor verifica los secretos en la configuración."
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const systemInstruction = `Eres un Abogado Experto en Derecho Laboral Colombiano y Especialista en Liquidación de Nómina conforme al Código Sustantivo del Trabajo (CST) de Colombia con sus más recientes reformas vigentes a Julio de 2026.
Tu función es guiar al gerente/empleador de "López & Gracia" en la gestión de salarios y liquidación de quincenas para su equipo de trabajo.

Tipos de Contrato y Reglas de Liquidación en la Empresa:
1. Término Indefinido:
 - Salario Base Mensual ($1.750.905 COP o el parametrizado).
 - Incluye el derecho a 1 día de descanso pago remunerado a la semana.
 - Auxilio de transporte: Se liquida ÚNICAMENTE por los días en que el trabajador asistió a laborar en el sitio ($8.303,17 COP/día asistido).
 - Deducciones de ley: 4% Salud (EPS) + 4% Pensión sobre el ingreso salarial devengado (IBC).
2. Por Días (Fines de semana / Ocasionales):
 - Turno Tiempo Completo: 12:00 PM a 7:30 PM (7.5 hrs de permanencia con 0.5 hrs de almuerzo = 7.0 hrs de trabajo efectivo).
 - Turno Medio Tiempo: 2:00 PM a 7:30 PM (5.5 hrs de trabajo efectivo sin almuerzo).
 - Auxilio de transporte: $8.303,17 COP por cada día efectivamente asistido.
 - EXONERACIÓN DE DEDUCCIONES: A las personas que trabajan "Por días", NO se les realizan deducciones de Salud ni Pensión ($0 EPS / $0 Pensión).

Normativa y parámetros de ley colombiana vigentes (Actualizado a Julio de 2026):
1. Salario Mínimo Legal Vigente (SMMLV 2026): $1.750.905 COP mensuales ($875.452,50 COP quincenal). Total devengado con auxilio de transporte: $2.000.000 COP.
2. Auxilio de Transporte de Ley 2026: $249.095 COP mensuales ($8.303,17 COP por día asistido).
3. Jornada Máxima Legal: 42 horas semanales (en vigor desde el 15 de julio de 2026, Ley 2101 de 2021).
4. Divisor para valor hora ordinaria: 210 horas mensuales (Salario Base Mensual / 210 = $8.337,64 COP/hora).
5. Jornada Nocturna: Comprende desde las 7:00 p.m. hasta las 6:00 a.m. del día siguiente.
6. Salario Base Quincenal = Salario Base Mensual / 2.
7. Deducciones Obligatorias del Trabajador:
 - Salud: 4% sobre el Ingreso Base de Cotización (IBC).
 - Pensión: 4% sobre el Ingreso Base de Cotización (IBC).
 (El auxilio de transporte no suma para la base de salud ni pensión).
8. Tabla Oficial de Factores de Multiplicación y Recargos (Vigentes a Julio de 2026):
 - Hora Extra Diurna (HED): Factor 1.25 (+25% recargo)
 - Recargo Nocturno Ordinario (RN - 7pm a 6am): Factor 1.35 (+35% recargo)
 - Hora Extra Nocturna (HEN): Factor 1.75 (+75% recargo)
 - Dominical / Festivo Diurno Ordinario: Factor 1.90 (+90% recargo, actualizado desde el 1 de julio de 2026)
 - Dominical / Festivo Nocturno Ordinario: Factor 2.25 (+125% recargo = 90% dominical + 35% nocturno)
 - Hora Extra Diurna Dominical / Festiva: Factor 2.15 (+115% recargo = 25% extra diurna + 90% dominical)
 - Hora Extra Nocturna Dominical / Festiva: Factor 2.65 (+165% recargo = 75% extra nocturna + 90% dominical)
9. Bonos no constitutivos de salario (Art. 128 CST): válidos siempre que no desnaturalicen el salario ni superen el tope del 40%.

Instrucciones de respuesta:
- Realiza el desglose detallado de la quincena (Devengados, Deducciones y Neto a Pagar) aplicando los parámetros correspondientes (Salario Base de $1.750.905 COP o el configurado, Auxilio de Transporte de $249.095 COP mensuales / $124.547,50 quincenal si aplica), la jornada de 42 horas (divisor 210) y el inicio de jornada nocturna a las 7:00 p.m.
- Analiza la "Información Particular" del trabajador (observaciones de contrato, horarios, tiempo de almuerzo, novedades de ausencias, acuerdos) y resalta aspectos legales importantes o riesgos jurídicos según el CST.
- Responde de forma estructurada, profesional, clara, con títulos en Markdown y viñetas explicativas.`;

    let userMessage = prompt || "Por favor analiza la liquidación de la quincena para este trabajador.";
    if (employeeContext) {
      userMessage += `\n\n--- DATOS DEL COLABORADOR Y QUINCENA ---
Nombre: ${employeeContext.nombre || "No especificado"}
Cargo: ${employeeContext.cargo || "No especificado"}
Salario Base Mensual: $${Number(employeeContext.salarioBase || 0).toLocaleString('es-CO')} COP
Tipo de Contrato: ${employeeContext.tipoContrato || "Indefinido"}
Auxilio de Transporte Aplica: ${employeeContext.auxilioTransporte ? "SÍ" : "NO"}
Periodo a Liquidar: ${employeeContext.quincenaPeriodo || "Quincena de 15 días"}
Información Particular / Anotaciones Especiales: ${employeeContext.informacionParticular || "Sin anotaciones especiales."}

Novedades de la quincena:
- Horas Extra Diurnas (HED): ${employeeContext.novedadesIngresadas?.horasExtraDiurnas || 0} horas
- Horas Extra Nocturnas (HEN): ${employeeContext.novedadesIngresadas?.horasExtraNocturnas || 0} horas
- Recargos Dominicales/Festivos: ${employeeContext.novedadesIngresadas?.recargosDominicales || 0} horas
- Bonos no salariales / Auxilios: $${Number(employeeContext.novedadesIngresadas?.bonoNoSalarial || 0).toLocaleString('es-CO')} COP
- Deducciones particulares (préstamos, adelantos, consumos): $${Number(employeeContext.novedadesIngresadas?.deduccionesAdicionales || 0).toLocaleString('es-CO')} COP`;
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userMessage,
      config: {
        systemInstruction,
        temperature: 0.2
      }
    });

    return res.json({
      success: true,
      text: response.text
    });
  } catch (error: any) {
    console.error("Error en /api/gemini/laboral:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Ocurrió un error al procesar la solicitud con IA."
    });
  }
});
