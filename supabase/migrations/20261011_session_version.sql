-- =============================================================================
-- Revocación de sesiones: credenciales.session_version
-- Ejecutar en Supabase → SQL Editor (una sola vez).
--
-- La cookie de sesión lleva la versión vigente al iniciar sesión. Suspender,
-- cambiar rol/cargo o cambiar/asignar clave la incrementa y las cookies
-- anteriores dejan de valer (el servidor la verifica con caché de 15 s).
-- =============================================================================

alter table public.credenciales
  add column if not exists session_version integer not null default 0;

-- Incremento atómico; crea la fila si el usuario aún no tiene credenciales.
create or replace function public.bump_session_version(p_usuario_id uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.credenciales (usuario_id, session_version)
  values (p_usuario_id, 1)
  on conflict (usuario_id) do update
    set session_version = public.credenciales.session_version + 1,
        updated_at = now()
  returning session_version;
$$;

revoke all on function public.bump_session_version(uuid) from public, anon, authenticated;
grant execute on function public.bump_session_version(uuid) to service_role;
