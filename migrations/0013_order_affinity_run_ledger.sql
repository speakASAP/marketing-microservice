create table if not exists marketing_order_affinity_runs (
  run_id text primary key,
  source_owner text not null,
  channel text not null,
  window_start timestamptz,
  window_end timestamptz,
  cursor_before text,
  cursor_after text,
  mode text not null,
  status text not null,
  input_records integer not null default 0,
  accepted_created_events integer not null default 0,
  rejected_records integer not null default 0,
  skipped_events integer not null default 0,
  aggregate_pairs integer not null default 0,
  total_pair_evidence integer not null default 0,
  batch_count integer not null default 0,
  rejection_reasons jsonb not null default '{}'::jsonb,
  by_channel jsonb not null default '{}'::jsonb,
  catalog_idempotency_keys jsonb not null default '[]'::jsonb,
  complete_snapshot boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (mode in ('dry-run', 'publish')),
  check (status in ('planned', 'running', 'dry_run_passed', 'published', 'failed', 'blocked'))
);

create index if not exists marketing_order_affinity_runs_source_window_idx
  on marketing_order_affinity_runs(source_owner, channel, window_start, window_end);
create index if not exists marketing_order_affinity_runs_status_idx
  on marketing_order_affinity_runs(status, created_at desc);

create table if not exists marketing_order_affinity_idempotency_keys (
  idempotency_key text primary key,
  run_id text not null references marketing_order_affinity_runs(run_id) on delete cascade,
  batch_index integer not null,
  source_owner text not null,
  channel text not null,
  window_start timestamptz,
  window_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists marketing_order_affinity_idempotency_run_idx
  on marketing_order_affinity_idempotency_keys(run_id, batch_index);
create index if not exists marketing_order_affinity_idempotency_source_window_idx
  on marketing_order_affinity_idempotency_keys(source_owner, channel, window_start, window_end);


alter table marketing_order_affinity_runs
  add column if not exists complete_snapshot boolean not null default false;
