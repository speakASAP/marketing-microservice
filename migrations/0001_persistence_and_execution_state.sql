create table if not exists marketing_segments (
  segment_id text primary key,
  name text not null,
  source_types jsonb not null,
  rules jsonb not null,
  is_dynamic boolean not null,
  estimated_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing_campaigns (
  campaign_id text primary key,
  tenant text not null,
  name text not null,
  segment_id text not null references marketing_segments(segment_id) on delete restrict,
  description text,
  purpose text not null,
  primary_channel text not null,
  fallback_channels jsonb not null default '[]'::jsonb,
  channel_key text,
  template_ref text not null,
  schedule_at timestamptz,
  throttle_per_minute integer,
  frequency_cap_per_day integer not null default 1,
  message jsonb not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists marketing_campaign_runs (
  id text primary key,
  campaign_id text not null references marketing_campaigns(campaign_id) on delete cascade,
  idempotency_key text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  total_recipients integer not null default 0,
  total_sent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, idempotency_key)
);

create table if not exists marketing_delivery_outcomes (
  delivery_id text primary key,
  run_id text not null references marketing_campaign_runs(id) on delete cascade,
  campaign_id text not null references marketing_campaigns(campaign_id) on delete cascade,
  recipient_ref text not null,
  recipient_source text not null,
  recipient_address text not null default '',
  requested_channel text not null,
  effective_channel text not null,
  status text not null,
  decision_reason text not null,
  processed_at timestamptz not null,
  duration_ms integer not null default 0
);

create index if not exists marketing_delivery_outcomes_run_idx on marketing_delivery_outcomes(run_id);
create index if not exists marketing_delivery_outcomes_recipient_idx on marketing_delivery_outcomes(recipient_ref, processed_at desc);

create table if not exists marketing_suppression_evidence (
  id text primary key,
  run_id text not null references marketing_campaign_runs(id) on delete cascade,
  campaign_id text not null references marketing_campaigns(campaign_id) on delete cascade,
  recipient_ref text not null,
  recipient_source text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists marketing_suppression_evidence_recipient_idx on marketing_suppression_evidence(recipient_ref, recorded_at desc);

create table if not exists marketing_idempotency_keys (
  campaign_id text not null references marketing_campaigns(campaign_id) on delete cascade,
  idempotency_key text not null,
  run_id text not null references marketing_campaign_runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, idempotency_key)
);

create table if not exists marketing_send_history (
  id text primary key,
  recipient_ref text not null,
  campaign_id text not null references marketing_campaigns(campaign_id) on delete cascade,
  run_id text not null references marketing_campaign_runs(id) on delete cascade,
  sent_at timestamptz not null
);

create index if not exists marketing_send_history_recipient_idx on marketing_send_history(recipient_ref, sent_at desc);
