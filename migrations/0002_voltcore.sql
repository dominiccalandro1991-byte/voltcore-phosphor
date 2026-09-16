-- VOLTCORE telemetry ledger + fleet ingest. Unowned operational rows (auth off).
create table if not exists events (
  id              text primary key,
  created_at      timestamptz not null default now(),
  source          text not null,
  event_type      text not null,
  severity        text not null default 'info',
  payload         jsonb not null default '{}'::jsonb,
  correlation_id  text
);
create index if not exists events_created_at_idx on events (created_at desc);
create index if not exists events_source_idx on events (source);
create index if not exists events_corr_idx on events (correlation_id);

create table if not exists system_telemetry (
  id              text primary key,
  created_at      timestamptz not null default now(),
  correlation_id  text not null,
  channel         text not null,
  model           text,
  status          text not null,
  latency_ms      integer,
  source          text,
  metric          jsonb not null default '{}'::jsonb
);
create index if not exists system_telemetry_created_at_idx on system_telemetry (created_at desc);
create index if not exists system_telemetry_corr_idx on system_telemetry (correlation_id);

create table if not exists inference_runs (
  id               text primary key,
  created_at       timestamptz not null default now(),
  correlation_id   text not null,
  prompt           text not null,
  consensus_score  double precision,
  winner_model     text,
  fused_summary    text,
  models           jsonb not null default '[]'::jsonb
);
create index if not exists inference_runs_corr_idx on inference_runs (correlation_id);
