# 🇨🇴 López & Gracia - Sistema Integrado de Conciliación de Caja, Auditoría POS y Nómina

Sistema web integral de conciliación de caja, auditoría de reportes POS mediante Inteligencia Artificial (Google Gemini AI), control multitienda y liquidación de nómina según la legislación laboral de Colombia.

## 📘 Documentación Completa

Hemos preparado un documento de especificación y arquitectura detallado para usuarios **Técnicos 🔧** y **No Técnicos 👤**:

👉 **[Ver Documentación Completa del Producto (DOCUMENTACION.md)](./DOCUMENTACION.md)**

---

## 🛠️ Tecnologías Principales

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend / API**: Node.js, Express, esbuild, tsx.
- **Inteligencia Artificial**: Google Gemini API (`@google/genai`) para OCR y análisis de reportes POS/PDF.
- **Persistencia**: Google Cloud Firestore (Firebase) con estrategia Offline-First (IndexedDB / LocalStorage).
- **Reportabilidad**: jsPDF (exportación a PDF) y SheetJS/XLSX (exportación a Excel).

---

## 🚀 Comandos de Ejecución

```bash
# Servidor de Desarrollo (Puerto 3000)
npm run dev

# Compilación para Producción
npm run build

# Iniciar servidor de Producción
npm start
```
