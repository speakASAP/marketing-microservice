alter table marketing_campaigns
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_note text;

alter table marketing_campaign_runs
  add column if not exists dry_run boolean not null default false,
  add column if not exists approval_status text,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz;
