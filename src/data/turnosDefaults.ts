export const ROLE_POINTS_MAP: Record<string, number> = {
  "Lider de punto": 2.0,
  "Líder de punto": 2.0,
  "Líder operador": 2.0,
  "Lider operador": 2.0,
  "Líder de pastelería": 1.5,
  "Lider de pasteleria": 1.5,
  "Auxiliar de pastelería": 0.8,
  "Auxiliar de pasteleria": 0.8,
  "Asistente de pasteleria": 0.8,
  "Asistente de Servicio": 1.3,
  "Asistente de servicio": 1.3,
  "Asistente de servicio tiempo completo (TC)": 1.3,
  "Asistente de servicio medio tiempo (MT)": 1.0,
  "Aux de Venta": 1.0,
  "colaborador": 1.0,
  "gerente": 0.0,
  "Gerente": 0.0
};

export const getRolePoints = (roleName: string): number => {
  if (!roleName) return 1.0;
  const clean = roleName.trim();
  if (ROLE_POINTS_MAP[clean] !== undefined) return ROLE_POINTS_MAP[clean];

  const lower = clean.toLowerCase();
  if (lower.includes("gerente")) return 0.0;
  if (
    lower.includes("lider de punto") || 
    lower.includes("líder de punto") || 
    lower.includes("operador") || 
    (lower.includes("lider") && !lower.includes("pasteler")) || 
    (lower.includes("líder") && !lower.includes("pasteler"))
  ) return 2.0;
  if (lower.includes("pasteler")) {
    if (lower.includes("líder") || lower.includes("lider")) return 1.5;
    return 0.8;
  }
  if (lower.includes("asistente") || lower.includes("aux")) {
    if (lower.includes("medio") || lower.includes("mt")) return 1.0;
    return 1.3;
  }
  return 1.0;
};
