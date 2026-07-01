create table if not exists marketing_order_lifecycle_events (
  event_id text primary key,
  event_type text not null,
  event_version integer not null,
  order_id text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  channel text,
  status text,
  previous_status text,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_order_lifecycle_events_order_id on marketing_order_lifecycle_events(order_id);
create index if not exists idx_marketing_order_lifecycle_events_type on marketing_order_lifecycle_events(event_type);
create index if not exists idx_marketing_order_lifecycle_events_occurred_at on marketing_order_lifecycle_events(occurred_at);
