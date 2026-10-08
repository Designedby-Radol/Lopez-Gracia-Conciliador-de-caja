# López & Gracia — Sistema de Control Operativo, Cierres de Caja y Auditoría POS

Plataforma integral desarrollada en **React 19**, **TypeScript** y **Tailwind CSS**, diseñada para estandarizar la operación diaria en punto de venta, garantizar la trazabilidad del recaudo financiero, automatizar la auditoría contra reportes de puntos de venta (POS) y liquidar de forma transparente propinas, inventarios y nómina.

---

## 📌 Resumen Ejecutivo del Proyecto

El sistema resuelve la complejidad del cierre diario de caja y la conciliación contable de restaurantes y pastelerías de alta rotación. Permite a los equipos de tienda realizar un arqueo de caja físico rápido y guiado, mientras que el equipo de auditoría y gerencia puede conciliar en segundos las ventas contra las plataformas de delivery (Rappi, Justo) y el sistema POS, aplicando políticas empresariales de control de faltantes (Regla 60/40).

---

## 🚀 Módulos y Capacidades del Sistema

### 1. Cierre Diario de Caja en Tienda (`CollaboratorInflow`)
- **Arqueo Físico de Efectivo Guiado**: Desglose interactivo por denominaciones de billetes ($100.000, $50.000, $20.000, $10.000, $5.000, $2.000) y monedas colombianas (COP).
- **Recaudo por Múltiples Canales**:
  - Efectivo contado en caja y deducción de base inicial de cambio.
  - Vouchers y datáfonos de tarjetas débito/crédito.
  - Canales digitales y delivery: **Justo App**, **Rappi App** y **Transferencias Bancarias (Bancolombia / Nequi / PSE)**.
- **Control de Propinas y Gastos**: Registro de propinas voluntarias del servicio y gastos menores de caja menor con soporte de comprobante.
- **Registro de Novedades**: Campo para reporte inmediato de incidentes de turno (anulaciones, fallos de datáfono, billetes en mal estado).

### 2. Auditoría y Conciliación Gerencial (`ManagerDashboard`)
- **Paso 1 (Opcional - Automatización de Reportes POS)**:
  - Carga y procesamiento local en el navegador de reportes POS en formato **PDF**, **TXT** o **CSV**.
  - Extracción inteligente de totales por medio de pago mediante `pdfjs-dist`.
  - Detección automática de **débitos por anulación de facturas** con generación de advertencias operativas.
  - El paso es 100% opcional: los administradores pueden auditar directamente sin requerir un archivo obligatorio.
- **Paso 2 (Conciliación de Auditoría Real)**:
  - Tabla comparativa lado a lado entre lo reportado por tienda, lo registrado en POS y los valores reales validados en portales (Justo / Rappi / Extracto bancario).
  - Cálculo instantáneo de desfases por canal (Efectivo, Tarjetas, Justo, Rappi, Transferencias).
- **Aplicación Automática de la Política de Descuadres (60/40)**:
  - En caso de faltante no justificado, el sistema desglosa la responsabilidad del turno:
    - **60%** atribuido al **Líder Operador / Líder de Turno**.
    - **40%** dividido de manera equitativa entre los **Auxiliares de Tienda** presentes en el turno.
  - Persistencia de los descuentos para su deducción en la liquidación periódica.

### 3. Liquidación y Distribución de Propinas
- Consolidación de propinas acumuladas en cierres con estado `"Cuadrado"`.
- Filtro personalizado por rango de fechas (quincenal, mensual o semanal).
- Asignación de colaboradores participantes por día y cálculo proporcional de la distribución.
- Exportación de actas de dispersión a formato PDF y hoja de cálculo Excel (`.xlsx`).

### 4. Cierre y Control de Inventarios (`InventoryClosure`)
- Registro de existencias físicas de productos clave, materias primas e insumos.
- Comparación contra existencias esperadas según ventas del sistema.
- Registro y justificación de mermas, vencimientos y averías para control de costos.

### 5. Checklist Operativo de Tienda (`OperationalChecklist`)
- Listas de verificación secuenciales para:
  - **Apertura**: Verificación de bases, encendido de equipos, cadena de frío y orden de vitrinas.
  - **Cambio de Turno**: Traspaso de fondos y estado del salón.
  - **Cierre Operativo**: Limpieza profunda, apagado seguro y entrega de turno.

### 6. Gestión de Nómina & Salarios (`SalariesManager`)
- Directorio de colaboradores clasificado por cargos (*Líder Operador*, *Líder Pastelería*, *Auxiliar Pastelería*, *Asistente de Servicio*, *Gerencia*).
- Control de salarios base, turnos laborados y deducciones automáticas generadas por auditorías de caja.
- Resumen consolidado para dispersión de pagos.

### 7. Indicadores & KPIs de Gestión (`IndicadoresDashboard`)
- Métricas en tiempo real:
  - Volumen total de ventas consolidadas.
  - Mix de venta por canal (Efectivo vs. Datáfono vs. Rappi vs. Justo).
  - Tasa de efectividad de cuadres (cierres limpios vs. cierres con descuadre).
  - Histórico de desfases acumulados y pérdidas operativas.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React |
| **Procesamiento de Archivos** | `pdfjs-dist` (análisis de PDF), `jspdf` (recibos y reportes PDF), `xlsx` (exportación Excel) |
| **Backend & Servidor** | Node.js, Express 4.x, Vite 6 como middleware de desarrollo |
| **Compilación de Producción**| `esbuild` (bundling a `dist/server.cjs`), Vite SPA build |
| **Persistencia de Datos** | Supabase (PostgreSQL) accedido solo desde el servidor con `service_role`; RLS activo |
| **Seguridad** | Sesión firmada en cookie httpOnly, contraseñas con scrypt, permisos por rol en el servidor |
| **Pruebas** | Vitest (`npm test`) para descuadres, 60/40, propinas, nómina, festivos y sesión |

---

## 💻 Instrucciones de Instalación y Ejecución

### Prerrequisitos
- **Node.js**: Versión 18 o superior instalada.
- **npm**: Versión 9 o superior.

### 1. Instalación de dependencias
```bash
npm install
```

### 2. Configuración de variables de entorno
```bash
cp .env.example .env
```
Obligatorias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SESSION_SECRET` (32+ caracteres aleatorios).
El navegador ya no recibe ninguna clave de Supabase.

### 3. Base de datos (una sola vez)
Ejecuta en Supabase → SQL Editor, en este orden:
1. `supabase/migrations/20261008_seguridad.sql` (credenciales, auditoría, configuración y RLS)
2. `supabase/migrations/20261008b_operacion.sql` (inventarios y checklists)

En el primer ingreso cada usuario debe cambiar su contraseña. Gerencia asigna claves temporales desde **Seguridad & Roles**.

### 4. Modo de desarrollo
Inicia el servidor local con Express y Vite:
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

### 5. Verificación de tipos y pruebas
```bash
npm run lint
npm test
```

### 6. Compilación para producción
Compila los activos del cliente y empaqueta el servidor Node.js autónomo:
```bash
npm run build
npm start
```

---

## 🔒 Roles y Niveles de Acceso

1. **Usuario / Asistente de Servicio**:
   - Registro de cierre de caja físico diario.
   - Diligenciamiento de checklists operativos e inventarios.
2. **Administrador / Gerencia**:
   - Auditoría de cierres pendientes de conciliar.
   - Carga opcional de reportes POS y aprobación final de cierres.
   - Acceso al tablero de indicadores, liquidación de propinas y nómina.
