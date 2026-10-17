-- =============================================================================
-- López & Gracia — Desprendibles de nómina y avisos (2026-10-16)
-- Ejecutar DESPUÉS de las migraciones anteriores, en Supabase → SQL Editor.
--
-- desprendibles: copia final e inmutable de la liquidación de cada persona y
--   quincena. turnos_nomina sigue siendo el borrador de Gerencia; el empleado
--   solo ve lo que Gerencia publica aquí. Corregir una quincena publicada crea
--   una versión nueva y la anterior queda como 'reemplazado'.
-- notificaciones: avisos en la app (cierre cuadrado, descuadre asignado,
--   desprendible publicado).
--
-- Como el resto del esquema: RLS activo sin políticas; solo el servidor
-- (service_role) lee y escribe.
-- =============================================================================

create table if not exists public.desprendibles (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.usuarios(id) on delete cascade,
  local_id         uuid references public.locales(id) on delete set null,
  turno_nomina_id  uuid references public.turnos_nomina(id) on delete set null,
  fecha_inicio     date not null,
  fecha_fin        date not null,
  quincena_nombre  text,
  version          integer not null default 1 check (version >= 1),
  estado           text not null default 'publicado' check (estado in ('publicado', 'reemplazado', 'retirado')),
  -- Solo lo que el empleado puede ver: nombre, cargo, contrato, días y conceptos.
  datos            jsonb not null,
  devengado        numeric(14, 2) not null,
  deducciones      numeric(14, 2) not null,
  neto             numeric(14, 2) not null,
  publicado_por    uuid references public.usuarios(id) on delete set null,
  publicado_at     timestamptz not null default now(),
  retirado_por     uuid references public.usuarios(id) on delete set null,
  retirado_at      timestamptz,
  check (fecha_fin >= fecha_inicio)
);

-- Una sola versión vigente por persona y período; las versiones no se repiten.
create unique index if not exists desprendibles_vigente_idx
  on public.desprendibles (usuario_id, fecha_inicio, fecha_fin) where estado = 'publicado';
create unique index if not exists desprendibles_version_idx
  on public.desprendibles (usuario_id, fecha_inicio, fecha_fin, version);
create index if not exists desprendibles_usuario_fecha_idx
  on public.desprendibles (usuario_id, fecha_fin desc);
create index if not exists desprendibles_turno_idx on public.desprendibles (turno_nomina_id);
create index if not exists desprendibles_local_idx on public.desprendibles (local_id);
create index if not exists desprendibles_publicado_por_idx on public.desprendibles (publicado_por);
create index if not exists desprendibles_retirado_por_idx on public.desprendibles (retirado_por);

alter table public.desprendibles enable row level security;

-- Publica (o reemplaza) el desprendible de una persona y período en una sola
-- transacción: la versión vigente pasa a 'reemplazado' y se inserta la nueva.
create or replace function public.publicar_desprendible(
  p_usuario_id uuid,
  p_local_id uuid,
  p_turno_nomina_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_quincena_nombre text,
  p_datos jsonb,
  p_devengado numeric,
  p_deducciones numeric,
  p_neto numeric,
  p_publicado_por uuid
)
returns public.desprendibles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version integer;
  v_fila public.desprendibles;
begin
  -- Serializa publicaciones simultáneas de la misma persona y período.
  perform pg_advisory_xact_lock(hashtextextended(p_usuario_id::text || p_fecha_inicio::text || p_fecha_fin::text, 0));

  select coalesce(max(version), 0) + 1 into v_version
  from public.desprendibles
  where usuario_id = p_usuario_id and fecha_inicio = p_fecha_inicio and fecha_fin = p_fecha_fin;

  update public.desprendibles
    set estado = 'reemplazado'
  where usuario_id = p_usuario_id and fecha_inicio = p_fecha_inicio and fecha_fin = p_fecha_fin
    and estado = 'publicado';

  insert into public.desprendibles (
    usuario_id, local_id, turno_nomina_id, fecha_inicio, fecha_fin, quincena_nombre,
    version, estado, datos, devengado, deducciones, neto, publicado_por
  ) values (
    p_usuario_id, p_local_id, p_turno_nomina_id, p_fecha_inicio, p_fecha_fin, p_quincena_nombre,
    v_version, 'publicado', p_datos, p_devengado, p_deducciones, p_neto, p_publicado_por
  )
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.publicar_desprendible(uuid, uuid, uuid, date, date, text, jsonb, numeric, numeric, numeric, uuid)
  from public, anon, authenticated;
grant execute on function public.publicar_desprendible(uuid, uuid, uuid, date, date, text, jsonb, numeric, numeric, numeric, uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- Avisos en la app
-- -----------------------------------------------------------------------------
create table if not exists public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  mensaje     text,
  ref_tipo    text,
  ref_id      uuid,
  leida_at    timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notificaciones_usuario_fecha_idx
  on public.notificaciones (usuario_id, created_at desc);
create index if not exists notificaciones_no_leidas_idx
  on public.notificaciones (usuario_id) where leida_at is null;

alter table public.notificaciones enable row level security;

revoke all on public.desprendibles, public.notificaciones from anon, authenticated;
