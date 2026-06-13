alter table marketing_segments
  add column if not exists tenant_id text,
  add column if not exists app_id text,
  add column if not exists brand_id text,
  add column if not exists business_id text,
  add column if not exists environment text,
  add column if not exists default_locale text,
  add column if not exists timezone text,
  add column if not exists product_line text,
  add column if not exists lifecycle_scope text,
  add column if not exists legal_sender_identity text,
  add column if not exists policy_ref text;

update marketing_segments
set tenant_id = coalesce(tenant_id, 'legacy'),
    app_id = coalesce(app_id, 'legacy'),
    brand_id = coalesce(brand_id, 'legacy')
where tenant_id is null or app_id is null or brand_id is null;

alter table marketing_segments
  alter column tenant_id set not null,
  alter column app_id set not null,
  alter column brand_id set not null;

create index if not exists marketing_segments_scope_idx on marketing_segments(tenant_id, app_id, brand_id);
create index if not exists marketing_segments_scope_filters_idx on marketing_segments(tenant_id, app_id, brand_id, product_line, lifecycle_scope);

alter table marketing_campaigns
  add column if not exists tenant_id text,
  add column if not exists app_id text,
  add column if not exists brand_id text,
  add column if not exists business_id text,
  add column if not exists environment text,
  add column if not exists default_locale text,
  add column if not exists timezone text,
  add column if not exists product_line text,
  add column if not exists lifecycle_scope text,
  add column if not exists legal_sender_identity text,
  add column if not exists policy_ref text;

update marketing_campaigns
set tenant_id = coalesce(tenant_id, tenant),
    app_id = coalesce(app_id, 'legacy'),
    brand_id = coalesce(brand_id, 'legacy')
where tenant_id is null or app_id is null or brand_id is null;

alter table marketing_campaigns
  alter column tenant_id set not null,
  alter column app_id set not null,
  alter column brand_id set not null;

create index if not exists marketing_campaigns_scope_idx on marketing_campaigns(tenant_id, app_id, brand_id);
create index if not exists marketing_campaigns_scope_filters_idx on marketing_campaigns(tenant_id, app_id, brand_id, product_line, lifecycle_scope);
