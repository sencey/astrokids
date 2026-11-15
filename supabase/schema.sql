-- Pati's Storm Watch: Postgres / Supabase schema.
-- No personal data anywhere. Space-data tables are public read-only (RLS); writes only via service role.
-- agg_choice is anonymous aggregate counters, incremented only through increment_choice().

create table if not exists source (
  id text primary key,                -- e.g. 'donki-flr', 'radlab'
  name text not null,
  base_url text not null,
  license_note text
);

create table if not exists fetch_run (
  id bigint generated always as identity primary key,
  source_id text references source(id),
  source_url text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  record_count int,
  error text
);

-- Common provenance columns on every space-data table:
--   source_id, source_url, fetched_at, is_live, fetch_run_id, raw
create table if not exists sw_flare (
  flr_id text primary key,
  peak_time timestamptz not null,
  begin_time timestamptz,
  end_time timestamptz,
  class_type text not null,
  source_location text,
  active_region_num int,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb
);
create index if not exists sw_flare_peak_idx on sw_flare (peak_time desc);

create table if not exists sw_cme (
  activity_id text primary key,
  start_time timestamptz not null,
  speed_kms numeric,
  half_angle numeric,
  latitude numeric,
  longitude numeric,
  type text,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb
);
create index if not exists sw_cme_start_idx on sw_cme (start_time desc);

create table if not exists sw_enlil_run (
  simulation_id text primary key,
  model_completion_time timestamptz not null,
  cme_activity_id text references sw_cme(activity_id) deferrable initially deferred,
  est_shock_arrival_earth timestamptz,
  kp_90 int,
  kp_135 int,
  kp_180 int,
  is_earth_gb boolean,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb
);
create index if not exists sw_enlil_run_done_idx on sw_enlil_run (model_completion_time desc);

create table if not exists sw_enlil_impact (
  id bigint generated always as identity primary key,
  simulation_id text not null references sw_enlil_run(simulation_id) on delete cascade,
  location text not null,              -- 'Earth', 'Mars', 'STEREO A', ...
  arrival_time timestamptz,
  is_glancing_blow boolean,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb,
  unique (simulation_id, location, arrival_time)
);

create table if not exists sw_shock_arrival (
  activity_id text primary key,
  event_time timestamptz not null,
  location text not null,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb
);

create table if not exists sw_sep (
  sep_id text primary key,
  event_time timestamptz not null,
  instrument text,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb
);

create table if not exists sw_gst (
  gst_id text primary key,
  start_time timestamptz not null,
  max_kp numeric,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb
);

create table if not exists sw_notification (
  message_id text primary key,
  message_type text,
  issue_time timestamptz not null,
  summary text,
  url text,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb
);
create index if not exists sw_notification_issue_idx on sw_notification (issue_time desc);

-- Daily dose per detector. Only compare ratios WITHIN one instrument_id, never absolute values across detectors.
create table if not exists rad_daily (
  instrument_id text not null,         -- RadLab instrument_id, e.g. 'CRaTER-D1D2'
  date date not null,                  -- UTC day
  place text not null check (place in ('iss','lunarOrbit','deepSpace','marsSurface')),
  dose_ugy_day numeric not null,
  samples int,
  quiet_baseline numeric,
  ratio numeric,
  source_id text not null references source(id),
  source_url text not null,
  fetched_at timestamptz not null,
  is_live boolean not null default false,
  fetch_run_id bigint references fetch_run(id),
  raw jsonb,
  primary key (instrument_id, date)
);

-- Game content
create table if not exists scenario (
  id text primary key,
  slug text unique not null,
  title_tr text not null,
  title_en text not null,
  world text not null default 'moon',
  data_mode text not null check (data_mode in ('archive','live')),
  start_date date not null,
  end_date date not null,
  lesson_tr text,
  lesson_en text,
  generated_at timestamptz not null,
  sources jsonb not null default '[]'
);

create table if not exists scenario_day (
  scenario_id text not null references scenario(id) on delete cascade,
  day_index int not null,
  date date not null,
  sparkle_band text not null check (sparkle_band in ('calm','storm','super')),
  sparkle_ratio numeric,
  rad_instrument text,
  band_is_assumption boolean not null,
  alarm_at timestamptz,
  payload jsonb not null,              -- full ScenarioDay JSON incl. provenance
  primary key (scenario_id, day_index)
);

create table if not exists game_rule (
  key text primary key,
  value jsonb not null,
  description text
);

create table if not exists voice_line (
  id text primary key,
  lang text not null check (lang in ('tr','en')),
  speaker text,
  text text not null,
  audio_url text
);

create table if not exists fact_card (
  id text primary key,
  lang text not null check (lang in ('tr','en')),
  title text not null,
  body text not null,
  source_url text
);

-- Anonymous aggregate of choices: no user id, no session id, no IP.
create table if not exists agg_choice (
  scenario_id text not null,
  day_index int not null,
  choice_key text not null,
  n bigint not null default 0,
  primary key (scenario_id, day_index, choice_key)
);

create or replace function increment_choice(p_scenario_id text, p_day_index int, p_choice_key text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into agg_choice (scenario_id, day_index, choice_key, n)
  values (left(p_scenario_id, 64), p_day_index, left(p_choice_key, 64), 1)
  on conflict (scenario_id, day_index, choice_key) do update set n = agg_choice.n + 1;
$$;
revoke all on function increment_choice(text, int, text) from public;
grant execute on function increment_choice(text, int, text) to anon, authenticated;

-- Row level security: public read-only on content/space tables.
do $$
declare t text;
begin
  foreach t in array array['source','fetch_run','sw_flare','sw_cme','sw_enlil_run','sw_enlil_impact','sw_shock_arrival','sw_sep','sw_gst','sw_notification','rad_daily','scenario','scenario_day','game_rule','voice_line','fact_card','agg_choice']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
-- No insert/update/delete policies exist, so anon cannot write directly.
-- agg_choice is only writable through increment_choice() (security definer, increments n by 1).
-- The service role key (used by scripts/upsert-supabase.mjs, CI only) bypasses RLS.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
