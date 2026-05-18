alter table public.tracking_sessions
  add column if not exists channel_group text,
  add column if not exists confidence_score int,
  add column if not exists attribution_reason text;

alter table public.tracking_visitors
  add column if not exists last_source text,
  add column if not exists last_medium text,
  add column if not exists last_campaign text,
  add column if not exists last_channel_group text,
  add column if not exists last_seen_attribution_at timestamptz;

alter table public.tracking_visitors
  add column if not exists last_non_direct_source text,
  add column if not exists last_non_direct_medium text,
  add column if not exists last_non_direct_campaign text,
  add column if not exists last_non_direct_channel_group text,
  add column if not exists last_non_direct_at timestamptz;

update public.tracking_visitors
  set last_source = first_source,
      last_medium = first_medium,
      last_campaign = first_campaign,
      last_seen_attribution_at = first_seen_at
  where last_source is null and first_source is not null;