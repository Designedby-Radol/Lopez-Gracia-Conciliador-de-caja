-- =============================================================================
-- López & Gracia — Migración de seguridad (2026-10-08)
--
-- Ejecutar en Supabase → SQL Editor (una sola vez).
--
-- 1. Credenciales con hash (ya no en texto plano dentro de cierres_caja).
-- 2. Bitácora de auditoría en su propia tabla.
-- 3. Tabla clave/valor para configuraciones (nómina, RRHH, SMMLV).
-- 4. RLS activado en TODAS las tablas sin políticas para "anon"/"authenticated":
--    el navegador ya no habla directo con Supabase; todo pasa por server.ts,
--    que usa la service_role key (ignora RLS) y valida la sesión del usuario.
-- =============================================================================

-- ---------- 1. Credenciales ----------
create table if not exists public.credenciales (
  usuario_id        uuid primary key references public.usuarios(id) on delete cascade,
  password_hash     text,                         -- formato scrypt$<salt>$<hash>
  debe_cambiar      boolean not null default true, -- fuerza cambio en el próximo login
  activo            boolean not null default true, -- false = cuenta suspendida
  updated_at        timestamptz not null default now()
);

-- ---------- 2. Auditoría ----------
create table if not exists public.audit_log (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  action       text not null,
  target_user  text,
  executed_by  text,
  description  text,
  status       text not null default 'success',
  ip           text
);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------- 3. Configuración clave/valor ----------
-- Claves usadas por el servidor:
--   configuracion_nomina          -> { smmlv_base, aux_transporte_base }
--   nomina_config:<usuario_id>    -> configuración salarial por colaborador
--   hr_config:<nombre>            -> perfil RRHH (legado, indexado por nombre)
create table if not exists public.app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.usuarios(id) on delete set null
);

-- ---------- 4. RLS ----------
-- Sin políticas = nadie con la anon key puede leer ni escribir.
alter table public.usuarios       enable row level security;
alter table public.locales        enable row level security;
alter table public.cierres_caja   enable row level security;
alter table public.cierre_auxiliares enable row level security;
alter table public.turnos_nomina  enable row level security;
alter table public.credenciales   enable row level security;
alter table public.audit_log      enable row level security;
alter table public.app_config     enable row level security;

do $$
begin
  if to_regclass('public.cargo_puntos') is not null then
    execute 'alter table public.cargo_puntos enable row level security';
  end if;
  if to_regclass('public.nomina_config') is not null then
    execute 'alter table public.nomina_config enable row level security';
  end if;
  if to_regclass('public.configuracion_nomina') is not null then
    execute 'alter table public.configuracion_nomina enable row level security';
  end if;
end $$;

-- Eliminar cualquier política previa que diera acceso al rol anon.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and ('anon' = any(roles) or 'public' = any(roles) or 'authenticated' = any(roles))
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Las funciones de las políticas antiguas ya no se usan y eran SECURITY DEFINER
-- ejecutables por anon (cualquiera podía llamarlas vía /rest/v1/rpc).
drop function if exists public.soy_admin();
drop function if exists public.mi_local_id();

-- ---------- 5. Registro por Supabase Auth ----------
-- El trigger on_auth_user_created creaba una fila en "usuarios" por cada alta en
-- Supabase Auth (accesible con la anon key). Con el login nuevo eso permitiría
-- crear cuentas desde fuera de la app. Se neutraliza la función (no se puede
-- borrar el trigger porque auth.users no pertenece al rol postgres).
-- Además: desactivar "Allow new users to sign up" en Authentication → Providers.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- 6. Datos de las filas SYSTEM_* ----------
-- Perfiles RRHH: SYSTEM_HR_CONFIG → app_config (hr_config:<clave original>).
insert into public.app_config (key, value)
select 'hr_config:' || e.key, e.value::jsonb
from public.cierres_caja c,
     lateral json_each(c.novedades::json) e
where c.pos_file_name = 'SYSTEM_HR_CONFIG'
  and c.novedades ~ '^\s*\{'
  and e.key <> '_system_test'
on conflict (key) do nothing;

-- Bitácora antigua: SYSTEM_AUDIT_LOG → audit_log (solo si audit_log está vacía).
insert into public.audit_log (created_at, action, target_user, executed_by, description, status, ip)
select coalesce((e->>'timestamp')::timestamptz, now()),
       coalesce(e->>'action', 'LEGACY'),
       e->>'targetUser', e->>'executedBy', e->>'description',
       coalesce(e->>'status', 'success'), e->>'ip'
from public.cierres_caja c,
     lateral json_array_elements(c.novedades::json) e
where c.pos_file_name = 'SYSTEM_AUDIT_LOG'
  and c.novedades ~ '^\s*\['
  and not exists (select 1 from public.audit_log);

-- =============================================================================
-- DESPUÉS de desplegar el nuevo servidor y verificar que todos pueden entrar:
--   delete from public.cierres_caja
--   where pos_file_name in ('SYSTEM_SECURITY_CONFIG', 'SYSTEM_AUDIT_LOG', 'SYSTEM_HR_CONFIG');
-- (SECURITY_CONFIG contiene las contraseñas antiguas en texto plano; las otras
--  dos ya quedaron copiadas en app_config y audit_log)
-- =============================================================================
