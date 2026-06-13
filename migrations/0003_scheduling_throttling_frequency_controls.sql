alter table marketing_campaigns
  add column if not exists scheduler_lock_owner text,
  add column if not exists scheduler_lock_until timestamptz,
  add column if not exists last_scheduled_run_at timestamptz;

create index if not exists marketing_campaigns_due_schedule_idx
  on marketing_campaigns(schedule_at, campaign_id)
  where status = 'scheduled';

create index if not exists marketing_campaigns_scheduler_lock_idx
  on marketing_campaigns(scheduler_lock_until)
  where scheduler_lock_until is not null;
