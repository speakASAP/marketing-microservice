alter table marketing_delivery_outcomes
  add column if not exists correlation_id text;

create index if not exists marketing_delivery_outcomes_correlation_idx
  on marketing_delivery_outcomes(correlation_id)
  where correlation_id is not null;
