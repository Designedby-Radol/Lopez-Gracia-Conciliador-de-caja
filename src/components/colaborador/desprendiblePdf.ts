import { loadJsPDF } from "../../lib/lazyLibs";
import type { DesprendibleDetalle } from "./types";
import { formatCOP } from "./ui";

/** Genera el PDF del desprendible publicado (mismo formato que el comprobante de Gerencia). */
export async function descargarDesprendiblePdf(d: DesprendibleDetalle) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const periodo = d.quincena_nombre ? `${d.quincena_nombre} (${d.fecha_inicio} al ${d.fecha_fin})` : `${d.fecha_inicio} al ${d.fecha_fin}`;

  doc.setFillColor(30, 62, 48);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LÓPEZ & GRACIA - PANADERÍA Y PASTELERÍA", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("DESPRENDIBLE DE PAGO DE NÓMINA", 14, 21);
  doc.setFontSize(8);
  doc.text(`Periodo: ${periodo}${d.version > 1 ? ` · Versión ${d.version}` : ""}`, 14, 27);

  doc.setFillColor(245, 245, 244);
  doc.rect(14, 38, 182, 24, "F");
  doc.setTextColor(28, 46, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Colaborador: ${d.datos.nombre.toUpperCase()}`, 18, 45);
  doc.text(`Cargo: ${d.datos.cargo || "—"}`, 18, 52);
  doc.text(`Contrato: ${d.datos.tipoContrato || "—"}`, 115, 45);
  if (d.datos.diasLaborados !== null || d.datos.diasAsistidos !== null) {
    doc.text(`Días asistidos / laborados: ${d.datos.diasAsistidos ?? "—"} / ${d.datos.diasLaborados ?? "—"}`, 115, 52);
  }

  let y = 70;
  doc.setFillColor(232, 243, 238);
  doc.rect(14, y, 182, 7, "F");
  doc.setTextColor(30, 62, 48);
  doc.text("CONCEPTO", 18, y + 5);
  doc.text("DEVENGADO", 120, y + 5);
  doc.text("DEDUCCIÓN", 160, y + 5);
  y += 13;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(28, 46, 36);
  for (const c of d.datos.conceptos) {
    doc.text(c.concepto, 18, y);
    doc.text(c.devengado > 0 ? formatCOP(c.devengado) : "-", 120, y);
    doc.text(c.deduccion > 0 ? formatCOP(c.deduccion) : "-", 160, y);
    doc.setDrawColor(230, 230, 230);
    doc.line(14, y + 2, 196, y + 2);
    y += 7;
  }

  y += 4;
  doc.setFillColor(28, 46, 36);
  doc.rect(14, y, 182, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`Devengado: ${formatCOP(d.devengado)}`, 18, y + 6);
  doc.text(`Deducciones: ${formatCOP(d.deducciones)}`, 110, y + 6);
  doc.setFontSize(11);
  doc.text(`NETO A PAGAR: ${formatCOP(d.neto)}`, 18, y + 12.5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Publicado por Gerencia el ${new Date(d.publicado_at).toLocaleDateString("es-CO")}. Documento generado desde el portal López & Gracia.`, 14, 280);

  const nombre = d.datos.nombre.replace(/\s+/g, "_");
  doc.save(`Desprendible_${nombre}_${d.fecha_inicio}_a_${d.fecha_fin}.pdf`);
}
