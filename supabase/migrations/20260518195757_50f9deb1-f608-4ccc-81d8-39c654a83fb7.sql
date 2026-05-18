-- 1.1 Novos identificadores em tracking_sessions
alter table public.tracking_sessions
  add column if not exists fbp text,
  add column if not exists fbc text,
  add column if not exists ttclid text,
  add column if not exists li_fat_id text;

-- 1.2 Dados brutos em tracking_sessions
alter table public.tracking_sessions
  add column if not exists raw_querystring text,
  add column if not exists raw_referrer text,
  add column if not exists raw_params jsonb;

-- 1.3 Tabela tracking_lead_sources (fotografia imutável da atribuição)
create table if not exists public.tracking_lead_sources (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  lead_id uuid not null,
  visitor_id text not null,
  session_id text,
  source_type text not null check (source_type in ('first_touch','conversion_touch','last_non_direct')),
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  channel_group text,
  landing_page text,
  conversion_page text,
  referrer text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  fbp text,
  fbc text,
  ttclid text,
  msclkid text,
  li_fat_id text,
  confidence_score int,
  raw_params jsonb,
  created_at timestamptz not null default now(),
  unique (clinic_id, lead_id, source_type)
);

create index if not exists idx_tracking_lead_sources_clinic_lead
  on public.tracking_lead_sources (clinic_id, lead_id);

create index if not exists idx_tracking_lead_sources_visitor
  on public.tracking_lead_sources (clinic_id, visitor_id);

alter table public.tracking_lead_sources enable row level security;

drop policy if exists "tracking_lead_sources_select" on public.tracking_lead_sources;
drop policy if exists "tracking_lead_sources_insert" on public.tracking_lead_sources;
drop policy if exists "tracking_lead_sources_update" on public.tracking_lead_sources;

create policy "tracking_lead_sources_select" on public.tracking_lead_sources
  for select using (clinic_id = current_clinic_id());

create policy "tracking_lead_sources_insert" on public.tracking_lead_sources
  for insert with check (clinic_id = current_clinic_id());

create policy "tracking_lead_sources_update" on public.tracking_lead_sources
  for update using (clinic_id = current_clinic_id());