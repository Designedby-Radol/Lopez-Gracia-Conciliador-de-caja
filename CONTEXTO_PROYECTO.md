# Contexto General del Proyecto: Sistema López & Gracia

Documento maestro de arquitectura técnica, lógica de negocio y flujos operativos para el sistema de conciliación de caja, auditoría POS y gestión de personal de **López & Gracia**.

---

## 1. Visión General del Sistema

El sistema para **López & Gracia** es una plataforma web integral diseñada para estandarizar, agilizar y auditar los procesos operativos, financieros y laborales diarios en los puntos de venta (ej. Sede Chapinero). 

### Objetivos Clave:
1. **Conciliación y Arqueo de Caja**: Cuadrar los reportes de ventas físicas diarias (efectivo, datáfono, plataformas Justo, Rappi y transferencias) contra los reportes del sistema POS.
2. **Auditoría Automatizada**: Asistencia de lectura y extracción de reportes POS (PDF/TXT) con detección y cálculo automático de sobrantes o faltantes.
3. **Distribución Justa de Propinas**: Reparto proporcional de propinas basado en un sistema ponderado de puntos por rol operativo y días asistidos.
4. **Listas de Verificación Operativa Dinámicas (Checklists)**: Control de apertura, turno y cierre de local con reprogramación inteligente de tareas según el calendario de festivos de Colombia (Ley Emiliani).
5. **Gestión Salarial y Asesoría Laboral con IA**: Liquidación de nómina adaptada a la legislación colombiana vigente a julio de 2026 (jornada de 42 horas semanales, recargo nocturno desde las 7:00 p.m., dominicales al 90%) respaldada por un agente experto con Google Gemini.

---

## 2. Arquitectura Tecnológica

El aplicativo implementa una arquitectura cliente-servidor moderna de alto rendimiento que combina una Single Page Application (SPA) en el frontend, un backend servidor en Node.js/Express, y persistencia relacional en la nube con **Supabase (PostgreSQL 15+)** y **Supabase Auth**.

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTE (SPA)                         │
│  React 19 + TypeScript + Tailwind CSS v4 + Motion           │
│  - ManagerDashboard, OperationalChecklist, SalariesManager  │
│  - CollaboratorInflow, IndicadoresDashboard, PDFUploader     │
│  - pdfjs-dist, jsPDF, XLSX                                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                REST / JSON    │  Lecturas & Escrituras
                               │  Directas a Supabase
                               ▼
┌──────────────────────────────┴──────────────────────────────┐
│                  BACKEND (server.ts - Node.js)              │
│  - Express 4.x sobre puerto 3000 (0.0.0.0:3000)             │
│  - Vite Middleware (Desarrollo) / Static Server (Producción)│
│  - POST /api/gemini/laboral (Google GenAI SDK - Gemini)     │
│  - GET/POST /api/pos/justo (Integración API Justo)          │
│  - GET/POST /api/pos/intuipos (Integración API IntuiPOS)    │
│  - POST /api/pos/sync-closure (Sincronización de Cierre)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 PERSISTENCIA & BASE DE DATOS                │
│  Supabase (PostgreSQL Relacional + Supabase Auth)           │
│  - Tablas: locales, usuarios, cierres_caja, nomina_config,  │
│            turnos_nomina, configuracion_nomina              │
│  - Configuración: supabaseConfig.ts (URL + Anon Key)        │
│  - Capa de abstracción: dbAdapter.ts                        │
│  - Autenticación: Supabase Auth (Email/Contraseña/Cédula)   │
└─────────────────────────────────────────────────────────────┘
```

### Componentes de la Arquitectura:

1. **Frontend (SPA)**:
   - **Framework**: React 19 con TypeScript (~5.8).
   - **Estilos**: Tailwind CSS v4 con paleta corporativa cálida y neutral (`brand-bg`, `brand-ink`, etc.).
   - **Iconografía e Interacción**: `lucide-react` para iconografía consistente y `motion` (`motion/react`) para transiciones y micro-interacciones.
   - **Procesamiento de Documentos**: `pdfjs-dist` para lectura y extracción de texto de reportes POS en el navegador; `jspdf` y `xlsx` para la exportación de comprobantes de cuadre y reportes consolidados.

2. **Backend & Servidor de Aplicación (`server.ts`)**:
   - Servidor Express en Node.js configurado para escuchar en el puerto 3000 (`0.0.0.0:3000`).
   - Soporta doble ciclo de vida:
     - *Desarrollo*: Integración de Vite en modo middleware (`createViteServer`) con soporte de TypeScript vía `tsx`.
     - *Producción*: Empaquetado optimizado mediante `esbuild` a un bundle CommonJS (`dist/server.cjs`) sirviendo los estáticos generados en `dist/`.
   - Proxy seguro para el SDK de IA: Ninguna clave de API de Google Gemini queda expuesta al navegador.
   - Endpoints de integración POS con APIs externas:
     - `/api/pos/justo`: Obtención de órdenes y ventas de la plataforma Justo.
     - `/api/pos/intuipos`: Sincronización de reportes Z y transaccionales de IntuiPOS.
     - `/api/pos/sync-closure`: Cruce unificado y consolidación de auditoría.

3. **Capa de Persistencia y Base de Datos (Supabase)**:
   - **Motor Relacional**: PostgreSQL con integridad referencial, índices y tipos enum (`cargo`, `access_role`, `estado_cierre`).
   - **`dbAdapter.ts`**: Patrón de diseño Adapter que encapsula toda la interacción con Supabase:
     - Gestión de sedes/locales (`locales`).
     - Gestión de equipo y roles (`usuarios`).
     - Cuadres y auditorías de caja (`cierres_caja`).
     - Configuraciones individuales de nómina (`nomina_config`).
     - Historial y liquidaciones quincenales (`turnos_nomina`).
     - Parámetros macro de nómina (`configuracion_nomina`: SMMLV y Auxilio de Transporte).
   - **Seguridad**: Autenticación centralizada mediante Supabase Auth para colaboradores y gerentes.

4. **Integración con Inteligencia Artificial (Google Gemini)**:
   - Uso de la librería oficial `@google/genai` con el modelo de alta velocidad y razonamiento `gemini-3.6-flash`.
   - Endpoint `/api/gemini/laboral` parametrizado con un prompt de sistema que asume el rol de Abogado Laboralista Colombiano, analizando horas extras diurnas/nocturnas, recargos festivos, auxilio de transporte por día y cláusulas contractuales particulares.

---

## 3. Lógica de Negocio y Reglas Operativas

### 3.1. Conciliación y Arqueo de Caja

La conciliación diaria cruza los valores físicos reportados por el equipo en el punto de venta contra los datos arrojados por el sistema POS:

$$\text{Diferencia} = \text{Valor Arqueo Físico} - \text{Valor Reporte POS}$$

| Canal / Método de Pago | Origen Físico | Origen POS | Implicación del Descuadre |
| :--- | :--- | :--- | :--- |
| **Efectivo** | Conteo de billetes y monedas en caja | Total efectivo facturado en POS | Un faltante implica dinero faltante en caja. |
| **Datáfono / Tarjetas** | Sumatoria de vouchers emitidos por el terminal físico | Total tarjetas facturado en POS | Desfases por vouchers no pasados o doble cobro. |
| **Justo** | Reporte de cierre de la app Justo | Facturación registrada bajo Justo en POS | Pedidos no cerrados o pedidos anulados en plataforma. |
| **Rappi** | Reporte de cierre del portal Rappi Aliados | Facturación Rappi en POS | Descuadre por comisiones, cancelaciones o pedidos pendientes. |
| **Transferencias** | Comprobantes de Nequi, Daviplata o Bancolombia | Facturación por transferencias en POS | Comprobantes duplicados o transferencias no confirmadas. |

#### Política de Descuadres (Regla 60/40 con Validación de Roles)
Cuando se registra un **faltante de efectivo**, el sistema aplica automáticamente la política de responsabilidad compartida con segregación estricta de funciones operativas:
- **60% del descuadre**: Asignado al **Líder Operador / Líder de Punto** en turno, como custodio y responsable principal del dinero en caja.
- **40% del descuadre**: Distribuido equitativamente entre los **Auxiliares / Asistentes de Servicio** que estuvieron presentes en el turno manipulando la registradora.
- **Roles Excluidos de Deducción por Descuadre**:
  - **Gerencia / Administrador**: No manipulan caja registradora en el turno operativo.
  - **Líder de Pastelería y Auxiliares de Cocina/Pastelería**: Su responsabilidad funcional es la producción, horneado y mise en place, por lo cual la normativa interna los exonera de asumir deducciones por faltantes en caja registradora.

---

### 3.2. Sistema de Reparto de Propinas por Puntos

Las propinas recaudadas en el periodo se distribuyen equitativamente utilizando un sistema ponderado de puntos por rol. Esto premia la experiencia, el nivel de responsabilidad y los días efectivamente asistidos:

$$\text{Puntos Ponderados del Colaborador} = \text{Puntos del Rol} \times \text{Días Laborados}$$

$$\text{Valor por Punto} = \frac{\text{Bolsa Total de Propinas}}{\sum \text{Puntos Ponderados de Todos los Colaboradores}}$$

$$\text{Propina Individual} = \text{Puntos Ponderados del Colaborador} \times \text{Valor por Punto}$$

#### Tabla Oficial de Puntos por Rol (`ROLE_POINTS_MAP`):
| Rol en el Sistema | Puntos Asignados | Justificación Operativa |
| :--- | :---: | :--- |
| **Líder de punto / Líder operador** | **2.0** | Responsabilidad integral de apertura, caja, control de equipo y servicio. |
| **Líder de pastelería** | **1.5** | Responsable técnico de producción, calidad y abastecimiento de vitrinas. |
| **Asistente de Servicio Tiempo Completo (TC)** | **1.3** | Atención directa en salón, toma de comandas y soporte operativo continuo. |
| **Asistente de Servicio Medio Tiempo (MT)** | **1.0** | Turnos de refuerzo de servicio en picos de demanda. |
| **Auxiliar / Asistente de pastelería** | **0.8** | Soporte en mise en place, horneado y empaque de producto. |
| **Aux de Venta / Colaborador base** | **1.0** | Soporte de mostrador y ventas. |
| **Gerente** | **0.0** | No participa en la bolsa de propinas operativas. |

---

### 3.3. Checklists Operativos con Calendario Dinámico (Ley Emiliani)

Las tareas operativas del punto de venta no son estáticas: dependen directamente del calendario laboral colombiano, regido por la **Ley 51 de 1983 (Ley Emiliani)**, que traslada los días feriados al lunes más próximo.

El módulo `src/utils/colombiaHolidays.ts` calcula de forma determinística los festivos fijos y móviles (mediante el algoritmo astronómico de Meeus/Butcher para determinar el Domingo de Pascua) y ajusta las tareas programadas:

```
                  ┌─────────────────────────────────────┐
                  │   ¿La semana tiene Lunes Festivo?   │
                  └───────────────┬─────────────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
             [ NO ]                             [ SÍ ]
      (Semana Regular)                 (Semana con Festivo)
 ─────────────────────────────     ─────────────────────────────
 • Riego de plantas:               • Riego de plantas:
   -> Martes y Viernes               -> Miércoles y Sábado
 • Limpieza profunda de canecas:   • Limpieza profunda de canecas:
   -> Martes                         -> Miércoles
 • Cepillado profundo de pisos:    • Cepillado profundo de pisos:
   -> Domingo (Cierre regular)       -> Lunes Festivo (Cierre extendido)
```

#### Justificación del Negocio:
- Cuando el lunes es festivo, el punto opera con horario y afluencia alta de fin de semana festivo. La semana de mantenimiento regular arranca el martes o miércoles.
- El cepillado profundo de pisos se ejecuta el último día laboral antes de la jornada de descanso general.

---

### 3.4. Normativa y Liquidación Laboral Colombiana (Vigente a Julio de 2026)

El módulo de salarios y el agente de IA aplican rigurosamente los parámetros de la legislación laboral colombiana vigentes a julio de 2026:

1. **Jornada Máxima Legal (Ley 2101 de 2021)**: **42 horas semanales** (vigente a partir del 15 de julio de 2026).
   - Divisor legal para la hora ordinaria: $210 \text{ horas/mes}$.
   - Valor hora ordinaria base: $\frac{\$1.750.905}{210} \approx \$8.337,64 \text{ COP}$.
2. **Salario Mínimo Legal Vigente (SMMLV 2026)**: $\$1.750.905 \text{ COP/mes}$ ($\$875.452,50 \text{ COP/quincena}$).
3. **Auxilio de Transporte de Ley 2026**: $\$249.095 \text{ COP/mes}$ ($\$8.303,17 \text{ COP por día asistido}$).
   - **Regla del negocio**: Se liquida únicamente por los días presenciales efectivamente trabajados.
4. **Jornada Nocturna**: Inicia a las **7:00 p.m.** y concluye a las **6:00 a.m.** del día siguiente.
5. **Deducciones de Ley (Seguridad Social)**:
   - Salud (EPS): $4\%$ sobre el IBC (Ingreso Base de Cotización, sin auxilio de transporte).
   - Pensión: $4\%$ sobre el IBC.
6. **Tipos de Contratos y Exoneraciones**:
   - **Término Indefinido**: Salario mensualizado, auxilio de transporte proporcional y deducciones de salud/pensión ($4\% + 4\%$).
   - **Por Días / Fines de Semana**: Jornadas de 7.0 horas efectivas (completo) o 5.5 horas (medio turno), auxilio de transporte por día asistido, y **exoneración de deducciones de salud y pensión en el neto quincenal ($0 EPS / $0 Pensión)**.
7. **Tabla Oficial de Factores de Recargo (2026)**:
   - Hora Extra Diurna (HED): $1.25$ ($+25\%$)
   - Recargo Nocturno Ordinario (RN - 7pm a 6am): $1.35$ ($+35\%$)
   - Hora Extra Nocturna (HEN): $1.75$ ($+75\%$)
   - Dominical / Festivo Ordinario Diurno: $1.90$ ($+90\%$ vigente desde julio 2026)
   - Dominical Nocturno Ordinario: $2.25$ ($+125\%$)
   - Hora Extra Diurna Dominical / Festiva: $2.15$ ($+115\%$)
   - Hora Extra Nocturna Dominical / Festiva: $2.65$ ($+165\%$)

---

## 4. Flujos del Negocio (Workflows Paso a Paso)

### Flujo 1: Inicio de Sesión y Selección de Sede
```
┌──────────────┐     Selecciona Rol (Líder / Colaborador / Gerente)
│  Login.tsx   │ ──► Ingresa Nombre y Sede (ej. Chapinero)
└──────┬───────┘     Guarda sesión en localStorage
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
[ Colaborador / Líder ]           [ Líder Operador ]                  [ Gerente ]
Acceso al Checklist               Acceso a Cierres de Caja         Acceso al Dashboard
Operativo y Arqueo Diario         y Operación Diaria               Gerencial Completo
```

---

### Flujo 2: Operación Diaria del Colaborador
1. **Apertura del Local**:
   - Ingresa al módulo de **Checklist Operativo**.
   - El sistema consulta `getScheduledTasksForDate`: si hoy corresponde riego de plantas o cepillado de pisos, la tarea aparece señalada con badge de prioridad.
   - Marca ítems de vitrina, luces, música, inventario inicial y firma digital de apertura.
2. **Durante el Turno**:
   - Registro de novedades operativas (fallas de datáfono, producto no conforme, faltantes de inventario).
3. **Cierre de Turno**:
   - Diligenciamiento del arqueo físico de caja: efectivo, vouchers de datáfono, cierres de Justo y Rappi, propinas en urna.
   - Registro enviado a Firestore bajo el estado `Pendiente por Cuadrar`.

---

### Flujo 3: Auditoría y Cuadre Gerencial
1. El Gerente abre la pestaña **Cierres de Caja** en `ManagerDashboard`.
2. Selecciona el cierre diario pendiente.
3. **Carga del Reporte POS**:
   - Carga el archivo PDF o TXT emitido por el sistema POS mediante `PDFUploader`.
   - El sistema extrae automáticamente: Ventas en Efectivo, Tarjetas, Justo, Rappi y Transferencias.
4. **Cruce y Validación**:
   - El sistema contrasta ítem por ítem y calcula las diferencias algebraicas.
   - Si existe faltante de efectivo, calcula la deducción del $60\%$ para el Líder y $40\%$ para el equipo auxiliar.
5. **Cierre de Auditoría**:
   - El estado cambia a `Cuadrado`.
   - Se genera el acta de conciliación exportable en **PDF** y consolidada en **Excel**.

---

### Flujo 4: Liquidación y Asesoría Laboral con IA Gemini
1. El Gerente ingresa a **Gestión de Salarios y Nómina**.
2. Modifica o valida novedades: horas extra, dominicales laborados, ausencias y auxilio de transporte.
3. Pulsa el botón de **Asesoría Laboral con IA**:
   - El backend invoca `/api/gemini/laboral` enviando el desglose numérico y anotaciones del contrato.
   - Gemini emite un informe estructurado analizando la procedencia de los recargos conforme a la Ley 2101 de 2021 y el Código Sustantivo del Trabajo.

---

## 5. Estructura del Código y Mapa de Archivos

```
/
├── server.ts                       # Servidor Express, endpoints de IA Gemini y APIs POS (Justo/IntuiPOS)
├── package.json                    # Dependencias y scripts de construcción (dev, build, start)
├── metadata.json                   # Metadatos del applet de AI Studio
├── CONTEXTO_PROYECTO.md            # Documentación maestra técnica y de negocio
│
├── src/
│   ├── App.tsx                     # Enrutador principal, autenticación y estado global de sesión
│   ├── main.tsx                    # Punto de entrada de React 19
│   ├── index.css                   # Importación y configuración de Tailwind CSS v4
│   ├── types.ts                    # Modelos TypeScript: User, CierreCaja, UserRole, POSReport
│   │
│   ├── db/
│   │   ├── supabaseConfig.ts       # Inicialización del cliente de Supabase JS
│   │   └── dbAdapter.ts            # Adaptador CRUD desacoplado para PostgreSQL (cierres, equipo, nómina)
│   │
│   ├── utils/
│   │   ├── colombiaHolidays.ts     # Ley Emiliani, Pascua (Butcher/Meeus) y tareas dinámicas
│   │   └── colombianPayroll.ts     # Fórmulas de nómina, jornada 42h, recargos y parser POS (PDF/Excel)
│   │
│   └── components/
│       ├── Login.tsx               # Selector de roles, nombre y sede de trabajo
│       ├── ManagerDashboard.tsx    # Dashboard gerencial: KPIs, conciliación, auditoría y propinas
│       ├── OperationalChecklist.tsx# Checklist de apertura/cierre sincronizado con festivos
│       ├── PDFUploader.tsx         # Drag & Drop y parser de reportes POS con pdfjs
│       ├── SalariesManager.tsx     # Nómina quincenal, cálculo de horas y consulta con IA en Supabase
│       ├── IndicadoresDashboard.tsx# Visualización de métricas y tendencias de venta
│       ├── InventoryClosure.tsx    # Cuadre de mermas e inventarios al cierre
│       ├── CollaboratorInflow.tsx  # Vista para colaboradores, turnos, propinas y cambio de contraseña
│       └── Logo.tsx                # Logotipo e isotipo de López & Gracia
```

---

## 6. Estado del Repositorio Git y Exportación

### Inicialización Local:
El proyecto cuenta con repositorio Git inicializado en la rama principal `main`, con configuración de usuario y archivo `.gitignore` protegiendo dependencias (`node_modules/`), artefactos de compilación (`dist/`) y secretos (`.env*`).

### Opciones para sincronizar con un repositorio remoto (GitHub / GitLab):

#### Opción A: Desde la consola / terminal
Para conectar este proyecto con un repositorio remoto propio (por ejemplo, en GitHub):
```bash
# 1. Vincular la URL del repositorio remoto
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# 2. Subir los cambios a la rama main
git push -u origin main
```

#### Opción B: Desde la interfaz de Google AI Studio
El entorno de Google AI Studio dispone de integración nativa para exportar el código:
1. Abrir el menú **Settings** o el menú superior derecho.
2. Seleccionar **Export to GitHub** o **Download ZIP**.
3. Autorizar la sincronización automática con la cuenta de GitHub elegida.
