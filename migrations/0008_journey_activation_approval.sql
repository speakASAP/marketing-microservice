alter table marketing_journeys
  add column if not exists approval_status text not null default $$pending$$,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_note text,
  add column if not exists activated_at timestamptz;

create index if not exists marketing_journeys_approval_status_idx on marketing_journeys(approval_status);
create index if not exists marketing_journeys_active_approved_idx on marketing_journeys(status, approval_status);
