/**
 * Reparto de propinas por puntos.
 *
 *   Propina individual = bolsa × (puntos del colaborador / suma de puntos del día)
 *
 * Se usa el método del mayor residuo para que la suma repartida sea exactamente
 * la bolsa del día (con Math.round por persona se pierden o sobran pesos).
 */
export interface ParticipantePropina {
  name: string;
  puntos: number;
}

export function repartirPropinas(bolsa: number, participantes: ParticipantePropina[]): Record<string, number> {
  const total = Math.round(Number(bolsa) || 0);
  const validos = participantes.filter((p) => p.puntos > 0);
  const out: Record<string, number> = Object.fromEntries(participantes.map((p) => [p.name, 0]));
  const sumaPuntos = validos.reduce((acc, p) => acc + p.puntos, 0);
  if (total <= 0 || sumaPuntos <= 0) return out;

  const exactos = validos.map((p) => ({ name: p.name, exacto: (total * p.puntos) / sumaPuntos }));
  let asignado = 0;
  for (const e of exactos) {
    out[e.name] = (out[e.name] || 0) + Math.floor(e.exacto);
    asignado += Math.floor(e.exacto);
  }

  // Repartir los pesos restantes a quienes tengan mayor parte decimal.
  const restantes = total - asignado;
  [...exactos]
    .sort((a, b) => (b.exacto % 1) - (a.exacto % 1))
    .slice(0, restantes)
    .forEach((e) => { out[e.name] += 1; });

  return out;
}

/** Reparto equitativo (todos con el mismo peso). */
export function repartirPropinasEquitativo(bolsa: number, nombres: string[]): Record<string, number> {
  return repartirPropinas(bolsa, nombres.map((name) => ({ name, puntos: 1 })));
}
