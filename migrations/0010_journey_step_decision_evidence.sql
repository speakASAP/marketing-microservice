alter table marketing_journey_step_claims add column if not exists decision_evidence jsonb not null default '{}'::jsonb;
