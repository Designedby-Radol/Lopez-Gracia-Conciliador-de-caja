# 📘 Documentación del Producto: López & Gracia - Sistema Integrado de Conciliación de Caja, Auditoría POS y Nómina

---

## 📌 1. Introducción y Propósito del Producto

El **Sistema Integrado de Conciliación de Caja, Auditoría POS y Gestión de Nómina de López & Gracia** es una plataforma web integral diseñada para automatizar, controlar y auditar la operación financiera diaria de los puntos de venta (locales/sedes) y la gestión del talento humano de la empresa.

### 👤 Visión No Técnica
> **Analogía Simple:** Imagina que el sistema funciona como un **asistente de contabilidad y auditor en tiempo real** que vive dentro de una tablet o computador en cada tienda. 
> - Al cierre de turno, ayuda a los colaboradores a contar el dinero billete por billete y comparar lo reportado en los datáfonos y plataformas digitales sin necesidad de calculadoras ni planillas manuales en papel.
> - A la gerencia le permite tener una "visión de águila" en vivo sobre el dinero real de cada local, detectando descuadres al instante y calculando la nómina de los empleados de forma exacta según las leyes colombianas.

### 🔧 Visión Técnica
> **Arquitectura:** Es una aplicación web full-stack basada en **React 19 + TypeScript**, compilada con **Vite** y con un servidor backend Node.js (**Express**). 
> - **Procesamiento de Inteligencia Artificial:** Integra el SDK de **Google Gemini AI (`@google/genai`)** para la lectura analítica y OCR estructurado de reportes POS y datáfonos en formatos PDF e imágenes.
> - **Persistencia y Base de Datos (Supabase PostgreSQL):** Utiliza un adaptador de base de datos (`dbAdapter.ts`) respaldado por **Supabase** (PostgreSQL relacional) con fallback automático a almacenamiento persistente local (`localStorage`) para garantizar tolerancia total a fallos de red en las tiendas.
> - **Motor de Nómina:** Contiene un motor determinista de cálculo de nómina colombiana (`colombianPayroll.ts`) alineado con la legislación laboral vigente (SMMLV, Auxilio de Transporte, Horas Extras, Recargos, Deducciones y Prestaciones Sociales).

---

## 👔 2. Diferencias Específicas en el Cierre Diario: Líder de Punto vs. Auxiliar de Venta

En el proceso operativo del **Cierre Diario de Caja**, ambos roles interactúan con la plataforma pero con niveles de responsabilidad, flujo de datos y políticas de descuadres claramente diferenciados:

| Criterio / Aspecto | 👤 Líder de Punto (Líder de Tienda) | 🧑‍🍳 Auxiliar de Venta / Asistente de Servicio |
| :--- | :--- | :--- |
| **Responsabilidad Principal** | **Legal y Operativa Principal:** Es el garante final del arqueo, la integridad del sobre de efectivo depositado y la veracidad del reporte entregado a gerencia. | **Operativa de Apoyo:** Participa en la clasificación de tiquetes, soporte de comprobantes de egresos y conteo físico del dinero. |
| **Firma y Aprobación** | Firma digitalmente la tirilla/acta de cierre y asume la responsabilidad del reporte final generado ante la gerencia. | Registra sus datos de turno y apoya el proceso, pero el cierre de la tienda se consolida a nombre del Líder a cargo del turno. |
| **Política de Descuadres (Regla 60/40)** | En caso de **descuadres en efectivo o datáfonos no justificados**, el Líder asume el **60% del valor faltante** asignado en la auditoría. | Los Auxiliares de venta presentes en el turno asumen colectivamente el **40% restante del descuadre** distribuido equitativamente. |
| **Acompañamiento en PDF POS** | Sube o valida la carga del reporte PDF/POS de la caja registradora para la extracción con Gemini AI. | Asiste en la verificación visual de las tirillas o la digitación de vouchers de datáfono (Bold/Redeban). |
| **Liquidación de Nómina del Turno** | Registra el cumplimiento de horarios y la asistencia del personal del local antes de finalizar la jornada. | Su jornada queda vinculada a la lista de asistencia del turno, aplicando su tarifa de hora según el perfil de "Asistente de Servicio". |

---

## ⚡ 3. Arquitectura y Estructura de Supabase (Reemplazo de Firebase)

### 📊 Evaluación Arquitectónica: ¿Por qué cambiar Firebase a Supabase?

1. **Modelo Relacional RDBMS vs. NoSQL Documental:**
   - **Cierres de Caja y Nómina** requieren relaciones estrictas, tipos de datos precisos (`NUMERIC`, `DATE`, `TIMESTAMPTZ`) y transacciones **ACID**. Supabase (PostgreSQL) garantiza que no existan valores nulos ambiguos ni descuadres por problemas de concurrencia.
2. **Consultas SQL Avanzadas y Analítica Directa:**
   - Permite realizar agregaciones, agrupaciones por local, rangos de fechas, cálculos de varianzas y reportes contables directamente en la base de datos mediante SQL estándar, sin recargar el cliente frontend.
3. **Seguridad Nativa con Row Level Security (RLS):**
   - Las políticas RLS de PostgreSQL permiten restringir que los colaboradores de una sede únicamente puedan insertar o leer registros asignados a su respectivo local.

---

### 🗄️ Estructura DDL de la Base de Datos en Supabase (Script SQL Completo - v2 Auth & RLS)

Para aprovisionar tu proyecto en Supabase con autenticación de usuarios y Row Level Security (RLS) basado en `auth.uid()`, copia y ejecuta el siguiente script dentro del **SQL Editor** de tu consola de Supabase:

```sql
-- ============================================================
-- ESQUEMA DE BASE DE DATOS SUPABASE - LÓPEZ & GRACIA (v2 Auth & RLS)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 0. LOCALES / SEDES
-- ------------------------------------------------------------
create table if not exists public.locales (
    id uuid primary key default gen_random_uuid(),
    nombre text unique not null,
    activo boolean not null default true,
    created_at timestamptz default now()
);

insert into public.locales (nombre) values ('Chapinero')
on conflict (nombre) do nothing;

-- ------------------------------------------------------------
-- 1. USUARIOS (perfil ligado a Supabase Auth)
-- ------------------------------------------------------------
create table if not exists public.usuarios (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre text not null,
    cedula text unique,
    role text not null default 'Asistente de servicio'
        check (role in ('Asistente de servicio','Lider','Auxiliar','Admin')),
    local_id uuid not null references public.locales(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Trigger que crea el perfil en public.usuarios automáticamente
-- cuando alguien se registra en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, local_id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    (select id from public.locales order by created_at limit 1),
    'Asistente de servicio'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funciones auxiliares para RLS
create or replace function public.mi_local_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select local_id from public.usuarios where id = auth.uid();
$$;

create or replace function public.soy_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and role = 'Admin'
  );
$$;

-- ------------------------------------------------------------
-- 2. CIERRES DE CAJA Y AUDITORÍA POS
-- ------------------------------------------------------------
create table if not exists public.cierres_caja (
    id uuid primary key default gen_random_uuid(),
    fecha date not null,
    colaborador_id uuid not null references public.usuarios(id),
    local_id uuid not null references public.locales(id),

    efectivo_cierre numeric(12,2) not null default 0.00 check (efectivo_cierre >= 0),
    datafono_cierre numeric(12,2) not null default 0.00 check (datafono_cierre >= 0),
    justo_cierre numeric(12,2) not null default 0.00 check (justo_cierre >= 0),
    rappi_cierre numeric(12,2) not null default 0.00 check (rappi_cierre >= 0),
    transferencias_cierre numeric(12,2) not null default 0.00 check (transferencias_cierre >= 0),
    propinas numeric(12,2) not null default 0.00 check (propinas >= 0),
    novedades text,
    estado text not null default 'Pendiente por Cuadrar'
        check (estado in ('Pendiente por Cuadrar','Cuadrado','Con Descuadre','Anulado')),

    efectivo_pos numeric(12,2),
    tarjetas_pos numeric(12,2),
    justo_pos numeric(12,2),
    rappi_pos numeric(12,2),
    transferencias_pos numeric(12,2),
    pos_file_name text,

    dif_efectivo numeric(12,2),
    dif_tarjetas numeric(12,2),
    dif_justo numeric(12,2),
    dif_rappi numeric(12,2),
    dif_transferencias numeric(12,2),

    lider_id uuid references public.usuarios(id),
    descuadre_lider numeric(12,2),
    descuadre_auxiliar numeric(12,2),

    auditado_por uuid references public.usuarios(id),
    auditado_at timestamptz,
    anulado_por uuid references public.usuarios(id),
    anulado_at timestamptz,

    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint uq_cierre_fecha_local unique (fecha, local_id)
);

create table if not exists public.cierre_auxiliares (
    cierre_id uuid not null references public.cierres_caja(id) on delete cascade,
    usuario_id uuid not null references public.usuarios(id),
    primary key (cierre_id, usuario_id)
);

-- ------------------------------------------------------------
-- 3. TURNOS Y NÓMINA DIARIA
-- ------------------------------------------------------------
create table if not exists public.turnos_nomina (
    id uuid primary key default gen_random_uuid(),
    cierre_id uuid references public.cierres_caja(id) on delete set null,
    colaborador_id uuid not null references public.usuarios(id),
    cargo text not null,
    fecha date not null,
    hora_ingreso timestamptz not null,
    hora_salida timestamptz not null,
    horas_ordinarias numeric(5,2) default 0 check (horas_ordinarias >= 0),
    horas_nocturnas numeric(5,2) default 0 check (horas_nocturnas >= 0),
    horas_dominicales numeric(5,2) default 0 check (horas_dominicales >= 0),
    total_pago numeric(12,2) default 0.00 check (total_pago >= 0),
    created_at timestamptz default now(),
    check (hora_salida > hora_ingreso)
);

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------
alter table public.locales enable row level security;
alter table public.usuarios enable row level security;
alter table public.cierres_caja enable row level security;
alter table public.cierre_auxiliares enable row level security;
alter table public.turnos_nomina enable row level security;

create policy "locales_select_authenticated" on public.locales
  for select using (auth.role() = 'authenticated');

create policy "usuarios_select_propio_o_admin" on public.usuarios
  for select using (id = auth.uid() or public.soy_admin());

create policy "usuarios_update_propio_o_admin" on public.usuarios
  for update using (id = auth.uid() or public.soy_admin());

create policy "usuarios_insert_admin" on public.usuarios
  for insert with check (public.soy_admin());

create policy "cierres_select_local_o_admin" on public.cierres_caja
  for select using (local_id = public.mi_local_id() or public.soy_admin());

create policy "cierres_insert_local_o_admin" on public.cierres_caja
  for insert with check (local_id = public.mi_local_id() or public.soy_admin());

create policy "cierres_update_local_o_admin" on public.cierres_caja
  for update using (local_id = public.mi_local_id() or public.soy_admin());

create policy "cierres_delete_solo_admin" on public.cierres_caja
  for delete using (public.soy_admin());

create policy "aux_select_local_o_admin" on public.cierre_auxiliares
  for select using (
    exists (
      select 1 from public.cierres_caja c
      where c.id = cierre_id
      and (c.local_id = public.mi_local_id() or public.soy_admin())
    )
  );

create policy "aux_insert_local_o_admin" on public.cierre_auxiliares
  for insert with check (
    exists (
      select 1 from public.cierres_caja c
      where c.id = cierre_id
      and (c.local_id = public.mi_local_id() or public.soy_admin())
    )
  );

create policy "turnos_select_local_o_admin" on public.turnos_nomina
  for select using (
    public.soy_admin()
    or colaborador_id in (
      select id from public.usuarios where local_id = public.mi_local_id()
    )
  );

create policy "turnos_insert_local_o_admin" on public.turnos_nomina
  for insert with check (
    public.soy_admin()
    or colaborador_id in (
      select id from public.usuarios where local_id = public.mi_local_id()
    )
  );

-- ÍNDICES DE RENDIMIENTO
create index if not exists idx_cierres_fecha on public.cierres_caja(fecha desc);
create index if not exists idx_cierres_local on public.cierres_caja(local_id);
create index if not exists idx_turnos_cierre on public.turnos_nomina(cierre_id);
create index if not exists idx_turnos_colaborador on public.turnos_nomina(colaborador_id);
create index if not exists idx_usuarios_local on public.usuarios(local_id);
```

---

### 🛠️ Guía Paso a Paso para el Administrador: Configuración de Supabase

Para conectar tu proyecto de Supabase con esta aplicación, sigue estos pasos sencillos:

1. **Crear un Proyecto en Supabase:**
   - Ve a [supabase.com](https://supabase.com) e inicia sesión o regístrate.
   - Haz clic en **"New Project"**, dale un nombre (ej. `LopezGracia-Caja`) y elige una contraseña segura para tu base de datos.
2. **Ejecutar la Estructura DDL:**
   - En el menú lateral izquierdo de Supabase, entra a **SQL Editor**.
   - Haz clic en **"New Query"**, pega el código SQL DDL que te proporcionamos arriba y presiona **"Run"**.
3. **Obtener las Claves de API:**
   - Ve a **Project Settings** (icono de engranaje) -> **API**.
   - Copia los dos valores siguientes:
     - **Project URL** (ejemplo: `https://xyzcompany.supabase.co`)
     - **anon / public Key** (un token largo).
4. **Configurar las Variables en la Aplicación:**
   - Abre o crea el archivo `.env` en la raíz de tu proyecto e ingresa:
     ```env
     VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
     VITE_SUPABASE_ANON_KEY="tu-clave-anon-de-supabase"
     ```
   - Si no configuras las variables, el sistema continuará funcionando sin interrupciones en **Modo Local (LocalStorage)** para demostración.

---

## 🧩 4. Módulos y Funcionalidades Principales

### 🔑 Módulo 1: Autenticación, Control de Roles y Selección de Sede
* **¿Qué hace?**: Permite que cada empleado o gerente ingrese a la aplicación seleccionando su sede (por ejemplo, Chapinero, Usaquén, Zona T) e ingresando su contraseña o PIN de acceso.
* **Técnico**: Enrutamiento y control de acceso en `src/components/Login.tsx` y `src/App.tsx`.
* **Roles Soportados**:
  - `gerente`: Acceso total a analítica, consolidados multitienda, auditoría POS y liquidación de nómina.
  - `colaborador` / `Lider de punto` / `Asistente de servicio`: Acceso delimitado al formulario de arqueo de caja y carga de reportes del turno correspondiente.

---

### 💵 Módulo 2: Registro e Inflow de Caja de Colaboradores (Arqueo y Cierre)
* **¿Qué hace?**: Guía paso a paso al colaborador durante el cierre de caja. Permite ingresar cuántos billetes de cada denominación hay en físico, registrar vouchers de datáfonos, transferencias digitales y egresos menores.
* **Técnico**: Componente `src/components/CollaboratorInflow.tsx` consumiendo `dbAdapter.ts` (Supabase Client + LocalStorage Sync). Incluye lienzo Canvas HTML5 para la firma autógrafa digital.

---

### 🤖 Módulo 3: Auditoría Inteligente de Reportes POS con Inteligencia Artificial (Gemini AI)
* **¿Qué hace?**: Extrae automáticamente montos de ventas, impuestos, propinas y comisiones desde reportes en PDF o foto usando Inteligencia Artificial.
* **Técnico**: Componente `src/components/PDFUploader.tsx` y backend Express (`server.ts`) integrando el SDK `@google/genai` con respuestas forzadas bajo JSON Schema.

---

### 📊 Módulo 4: Dashboard Gerencial y Consolidado de Control
* **¿Qué hace?**: Un panel de control visual para la gerencia que muestra KPIs, alertas de descuadres y consolidado por sede con exportación a Excel (`xlsx`) y PDF (`jspdf`).
* **Técnico**: Componente `src/components/ManagerDashboard.tsx` sincronizado mediante `dbAdapter.ts`.

---

### 🇨🇴 Módulo 5: Gestión y Liquidación de Nómina Colombiana
* **¿Qué hace?**: Calcula el salario de cada trabajador en Colombia (Sueldo básico, Auxilio de Transporte, Horas Extras, Recargos, Deducciones del 4% Salud/Pensión y Provisiones de Ley).
* **Técnico**: Componente `src/components/SalariesManager.tsx` y motor de ley en `src/utils/colombianPayroll.ts`.

---

## ❓ Preguntas Frecuentes (FAQ)

**P: ¿El cambio a Supabase afecta a los usuarios de las tiendas?**
* R: No. La interfaz gráfica y la velocidad de respuesta se mantienen idénticas. Supabase trabaja de forma transparente en segundo plano. Si una tienda pierde la conexión a internet, los datos se guardan en el dispositivo local y se suben a Supabase en cuanto regresa la señal.

**P: ¿Qué pasa si la gerencia necesita exportar todos los cierres a Excel o conectarse con un software contable?**
* R: Gracias a Supabase, la gerencia puede exportar directamente la tabla `cierres_caja` en formato CSV/Excel desde la plataforma o conectar herramientas como PowerBI, Metabase o Python mediante conexiones SQL estándar.

---

*Documentación actualizada para López & Gracia con Arquitectura Supabase PostgreSQL.*  
*Última actualización: Agosto 2026.*
