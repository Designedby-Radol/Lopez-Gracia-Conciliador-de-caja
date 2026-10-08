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

-- =============================================================================
-- DESPUÉS de desplegar el nuevo servidor y verificar que todos pueden entrar:
--   delete from public.cierres_caja
--   where pos_file_name in ('SYSTEM_SECURITY_CONFIG', 'SYSTEM_AUDIT_LOG');
-- (contienen las contraseñas antiguas en texto plano)
-- =============================================================================
