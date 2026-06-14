create table if not exists marketing_journeys (
  journey_id text primary key,
  tenant_id text not null,
  app_id text not null,
  brand_id text not null,
  business_id text,
  environment text,
  default_locale text,
  timezone text,
  product_line text,
  lifecycle_scope text,
  legal_sender_identity text,
  policy_ref text,
  name text not null,
  description text,
  trigger jsonb not null,
  steps jsonb not null,
  exit_rules jsonb not null default $$[]$$::jsonb,
  suppression_rules jsonb not null default $$[]$$::jsonb,
  status text not null default $$draft$$,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists marketing_journeys_scope_idx on marketing_journeys(tenant_id, app_id, brand_id);
create index if not exists marketing_journeys_scope_filters_idx on marketing_journeys(tenant_id, app_id, brand_id, product_line, lifecycle_scope);
create index if not exists marketing_journeys_status_idx on marketing_journeys(status);
create index if not exists marketing_journeys_trigger_type_idx on marketing_journeys ((trigger->>$$type$$));
