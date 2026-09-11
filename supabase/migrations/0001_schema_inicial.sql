-- ═══════════════════════════════════════════════════════════════════════════
-- Migración inicial: SaaS multi-tenant (rubros, negocios, leads, sesiones).
--
-- Cómo aplicarla: pega este archivo completo en el SQL Editor del dashboard
-- de Supabase y ejecútalo. Es idempotente-hostil (no usa IF NOT EXISTS a
-- propósito): si necesitas re-correrla, borra primero el schema public.
-- Guía completa: docs/08-supabase-saas.md
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Roles de usuario ─────────────────────────────────────────────────────────
create type public.user_role as enum ('admin', 'cliente', 'invitado');

-- ── Perfiles (1:1 con auth.users) ────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'cliente',
  created_at timestamptz not null default now()
);

-- Crea el profile automáticamente al registrarse un usuario.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Rubros: plantillas verticales (estética, barbería, spa…) ────────────────
-- `template` es un BusinessConfig parcial (services, messages, followUps,
-- personas por defecto). El cliente crea su negocio a partir de él.
create table public.rubros (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  descripcion text,
  template jsonb not null,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Asignaciones: qué rubros puede usar cada cliente ─────────────────────────
create table public.asignaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rubro_id uuid not null references public.rubros(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, rubro_id)
);

-- ── Negocios: el BusinessConfig personalizado del cliente ────────────────────
-- `slug` es el businessSlug que usa el motor del bot.
-- `config` es un BusinessConfig completo (validado con Zod al escribir).
-- `whatsapp_phone_number_id` mapea el webhook de Meta → negocio.
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  rubro_id uuid not null references public.rubros(id),
  slug text not null unique,
  config jsonb not null,
  whatsapp_phone_number_id text unique,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Leads del bot (columnas espejo de `Lead` en core/types.ts) ───────────────
create table public.leads (
  id text primary key,
  business_slug text not null,
  channel text not null,
  contact text not null,
  name text,
  service_id text,
  tentative_date text,
  state text not null,
  stage text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_inbound_at timestamptz not null,
  follow_ups_sent jsonb not null default '[]',
  notes text,
  unique (business_slug, contact)
);

create index leads_business_idx on public.leads (business_slug, updated_at desc);

-- ── Sesiones: memoria de conversación (últimos 10 turnos en JSON) ────────────
create table public.sesiones (
  business_slug text not null,
  contact text not null,
  channel text not null,
  history jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (business_slug, contact, channel)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- El bot (webhook) escribe con la SERVICE ROLE key, que bypassa RLS.
-- RLS protege el acceso web: portal (cliente), back office (admin) y demo (anon).
-- ═══════════════════════════════════════════════════════════════════════════

-- Helpers security definer: evitan recursión de RLS al consultar profiles.
create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function public.owns_negocio(p_slug text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from negocios where slug = p_slug and owner_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.rubros enable row level security;
alter table public.asignaciones enable row level security;
alter table public.negocios enable row level security;
alter table public.leads enable row level security;
alter table public.sesiones enable row level security;

-- profiles: cada usuario ve el suyo; admin ve y edita todos.
create policy profiles_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin());

-- rubros: admin todo; cliente lee los asignados; anon lee solo los demo.
create policy rubros_admin on public.rubros
  for all using (public.is_admin());
create policy rubros_asignados on public.rubros
  for select using (
    exists (
      select 1 from public.asignaciones a
      where a.rubro_id = id and a.user_id = auth.uid()
    )
  );
create policy rubros_demo_public on public.rubros
  for select to anon using (es_demo);

-- asignaciones: admin todo; cliente lee las suyas.
create policy asignaciones_admin on public.asignaciones
  for all using (public.is_admin());
create policy asignaciones_own on public.asignaciones
  for select using (user_id = auth.uid());

-- negocios: admin todo; cliente CRUD de los suyos (solo desde rubros asignados);
-- anon lee solo los demo.
create policy negocios_admin on public.negocios
  for all using (public.is_admin());
create policy negocios_own on public.negocios
  for all using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.asignaciones a
      where a.rubro_id = rubro_id and a.user_id = auth.uid()
    )
  );
create policy negocios_demo_public on public.negocios
  for select to anon using (es_demo);

-- leads: admin todo; cliente lee los de sus negocios; anon nada.
create policy leads_admin on public.leads
  for all using (public.is_admin());
create policy leads_own on public.leads
  for select using (public.owns_negocio(business_slug));

-- sesiones: admin todo; el resto solo via service role (el bot).
create policy sesiones_admin on public.sesiones
  for all using (public.is_admin());
