create table if not exists marketing_journey_step_claims (
  id text primary key,
  journey_id text not null references marketing_journeys(journey_id) on delete cascade,
  step_id text not null,
  campaign_id text not null references marketing_campaigns(campaign_id) on delete restrict,
  due_at timestamptz not null,
  scheduler_lock_owner text not null,
  scheduler_lock_until timestamptz not null,
  status text not null default 'claimed',
  run_id text references marketing_campaign_runs(id) on delete set null,
  error text,
  decision_evidence jsonb not null default '{}'::jsonb,
  decision_evidence jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journey_id, step_id, due_at)
);

create index if not exists marketing_journey_step_claims_due_idx on marketing_journey_step_claims(status, due_at);
create index if not exists marketing_journey_step_claims_journey_idx on marketing_journey_step_claims(journey_id, step_id);
create index if not exists marketing_journey_step_claims_run_idx on marketing_journey_step_claims(run_id);
