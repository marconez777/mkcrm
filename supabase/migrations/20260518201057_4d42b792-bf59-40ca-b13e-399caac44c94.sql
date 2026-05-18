create table if not exists public.traffic_source_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid,
  match_type text not null check (match_type in ('exact','contains')),
  input_source text,
  input_medium text,
  normalized_source text,
  normalized_medium text,
  channel_group text,
  priority int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_traffic_source_rules_lookup
  on public.traffic_source_rules (active, priority, clinic_id);

alter table public.traffic_source_rules enable row level security;

drop policy if exists "traffic_rules_select" on public.traffic_source_rules;
create policy "traffic_rules_select" on public.traffic_source_rules
  for select using (clinic_id is null or clinic_id = current_clinic_id());

drop policy if exists "traffic_rules_insert" on public.traffic_source_rules;
create policy "traffic_rules_insert" on public.traffic_source_rules
  for insert with check (clinic_id = current_clinic_id());

drop policy if exists "traffic_rules_update" on public.traffic_source_rules;
create policy "traffic_rules_update" on public.traffic_source_rules
  for update using (clinic_id = current_clinic_id());

insert into public.traffic_source_rules (clinic_id, match_type, input_source, normalized_source, channel_group, priority) values
  (null,'exact','fb','facebook','paid_social',10),
  (null,'exact','facebook.com','facebook','organic_social',10),
  (null,'exact','m.facebook.com','facebook','organic_social',10),
  (null,'exact','l.facebook.com','facebook','organic_social',10),
  (null,'exact','ig','instagram','organic_social',10),
  (null,'exact','insta','instagram','organic_social',10),
  (null,'exact','instagram.com','instagram','organic_social',10),
  (null,'exact','l.instagram.com','instagram','organic_social',10),
  (null,'exact','metaads','meta','paid_social',10),
  (null,'exact','meta-ads','meta','paid_social',10),
  (null,'exact','googleads','google','paid_search',10),
  (null,'exact','google-ads','google','paid_search',10),
  (null,'exact','adwords','google','paid_search',10),
  (null,'exact','youtube.com','youtube','organic_social',10),
  (null,'exact','m.youtube.com','youtube','organic_social',10),
  (null,'exact','linkedin.com','linkedin','organic_social',10),
  (null,'exact','tiktok.com','tiktok','organic_social',10),
  (null,'exact','wa','whatsapp','referral',10),
  (null,'exact','whatsapp','whatsapp','referral',10),
  (null,'exact','bing.com','bing','organic_search',10),
  (null,'exact','duckduckgo.com','duckduckgo','organic_search',10)
on conflict do nothing;