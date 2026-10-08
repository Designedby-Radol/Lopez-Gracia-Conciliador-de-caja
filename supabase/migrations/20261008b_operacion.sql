-- =============================================================================
-- López & Gracia — Registros operativos (2026-10-08)
-- Ejecutar DESPUÉS de 20261008_seguridad.sql.
--
-- Inventarios y checklists dejan de vivir solo en el navegador de cada equipo.
-- El detalle (ítems contados, tareas) se guarda como JSON en "data" para no
-- romper el formato que ya usa la aplicación.
-- =============================================================================

create table if not exists public.registros_operativos (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('inventario', 'checklist')),
  local_id     uuid not null references public.locales(id) on delete cascade,
  usuario_id   uuid references public.usuarios(id) on delete set null,
  fecha        date not null,
  data         jsonb not null,
  -- id que tenía el registro cuando vivía en localStorage (evita importarlo dos veces)
  legacy_id    text,
  created_at   timestamptz not null default now()
);

create index if not exists registros_operativos_tipo_local_fecha_idx
  on public.registros_operativos (tipo, local_id, fecha desc);

-- Índice único completo (no parcial) para que funcione ON CONFLICT (tipo, legacy_id).
-- Los legacy_id NULL no chocan entre sí.
create unique index if not exists registros_operativos_legacy_idx
  on public.registros_operativos (tipo, legacy_id);

alter table public.registros_operativos enable row level security;

-- El catálogo de insumos se guarda en app_config con la clave 'inventario_catalogo'.
