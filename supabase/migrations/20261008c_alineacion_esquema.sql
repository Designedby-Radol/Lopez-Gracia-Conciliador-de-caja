-- =============================================================================
-- López & Gracia — Alinear el esquema con server/routes/*.ts (2026-10-08)
-- Ejecutar DESPUÉS de 20261008_seguridad.sql y 20261008b_operacion.sql.
--
-- No modifica descuadre_lider / descuadre_auxiliar ni el reparto 60/40.
-- =============================================================================

-- ---------- 1. usuarios ----------
-- El login acepta correo; POST/PATCH /api/db/usuarios escriben "email".
alter table public.usuarios add column if not exists email text;

-- Hoy ningún usuario tiene cédula: se copia el correo que ya tienen en Supabase Auth
-- para que puedan entrar con él además del nombre.
update public.usuarios u
set email = lower(a.email)
from auth.users a
where a.id = u.id
  and u.email is null
  and a.email is not null;

create unique index if not exists usuarios_email_lower_key on public.usuarios (lower(email));

-- Los usuarios nuevos se crean desde la app (sin Supabase Auth): el id ya no puede
-- depender de auth.users y necesita valor por defecto.
alter table public.usuarios drop constraint if exists usuarios_id_fkey;
alter table public.usuarios alter column id set default gen_random_uuid();

-- ---------- 2. locales: ids de las integraciones ----------
alter table public.locales add column if not exists intuipos_store_id text;
alter table public.locales add column if not exists justo_store_id   text;

-- ---------- 3. cierres_caja: columnas de Justo que envía Gerencia ----------
alter table public.cierres_caja add column if not exists justo_pedidos_pos                numeric;
alter table public.cierres_caja add column if not exists justo_sobrante_efectivo_despacho numeric;

-- Un solo cierre vigente por local y fecha (el servidor ya lo valida; esto cierra la
-- carrera entre dos envíos simultáneos). Las filas SYSTEM_* están Anuladas.
-- La restricción original uq_cierre_fecha_local contaba también los anulados.
alter table public.cierres_caja drop constraint if exists uq_cierre_fecha_local;
create unique index if not exists cierres_caja_local_fecha_vigente_key
  on public.cierres_caja (local_id, fecha)
  where estado <> 'Anulado';

-- ---------- 4. turnos_nomina: historial de liquidaciones por quincena ----------
-- La tabla actual guarda turnos sueltos (hora_ingreso, horas_nocturnas, ...) que el
-- código ya no usa y está vacía. Se recrea con la forma que espera /api/db/turnos-nomina.
do $$
begin
  if exists (select 1 from public.turnos_nomina) then
    raise exception 'turnos_nomina tiene datos; revisar antes de recrearla';
  end if;
end $$;

drop table public.turnos_nomina;

create table public.turnos_nomina (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.usuarios(id) on delete cascade,
  local_id         uuid references public.locales(id) on delete set null,
  fecha_inicio     date not null,
  fecha_fin        date not null,
  quincena_nombre  text,
  liquidacion      jsonb,
  ai_analysis      text,
  created_at       timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);
alter table public.turnos_nomina enable row level security;

create index turnos_nomina_local_fecha_fin_idx on public.turnos_nomina (local_id, fecha_fin desc);
create index turnos_nomina_usuario_id_idx      on public.turnos_nomina (usuario_id);

-- ---------- 5. cargo_puntos ----------
-- GET /api/db/cargo-puntos lee { cargo, puntos }. Sin datos iniciales.
create table if not exists public.cargo_puntos (
  cargo   text primary key,
  puntos  numeric not null default 1 check (puntos >= 0)
);
alter table public.cargo_puntos enable row level security;

-- ---------- 6. Índices de llaves foráneas ----------
create index if not exists cierres_caja_colaborador_id_idx   on public.cierres_caja (colaborador_id);
create index if not exists cierres_caja_lider_id_idx         on public.cierres_caja (lider_id);
create index if not exists cierres_caja_auditado_por_idx     on public.cierres_caja (auditado_por);
create index if not exists cierres_caja_anulado_por_idx      on public.cierres_caja (anulado_por);
create index if not exists cierres_caja_local_fecha_idx      on public.cierres_caja (local_id, fecha desc);
create index if not exists cierre_auxiliares_usuario_id_idx  on public.cierre_auxiliares (usuario_id);
create index if not exists registros_operativos_usuario_idx  on public.registros_operativos (usuario_id);
create index if not exists registros_operativos_local_id_idx on public.registros_operativos (local_id);
create index if not exists app_config_updated_by_idx         on public.app_config (updated_by);

-- set_updated_at() (trigger existente) sin search_path fijo.
alter function public.set_updated_at() set search_path = '';

-- ---------- 7. Sin acceso por la Data API ----------
-- El navegador ya no habla con Supabase: solo el servidor (service_role).
-- RLS sin políticas ya bloquea filas; además se quitan los permisos de tabla.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
