/**
 * Carga diferida de librerías pesadas (pdfjs ~1,2 MB de worker, jsPDF, SheetJS).
 * Solo se descargan cuando el usuario lee un PDF, exporta un reporte o carga un Excel.
 */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

export async function loadJsPDF() {
  return (await import("jspdf")).jsPDF;
}

export function loadXLSX() {
  return import("xlsx");
}
