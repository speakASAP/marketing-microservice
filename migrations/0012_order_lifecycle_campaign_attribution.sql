alter table marketing_order_lifecycle_events
  add column if not exists campaign_id text;

create index if not exists idx_marketing_order_lifecycle_events_campaign_id on marketing_order_lifecycle_events(campaign_id);
