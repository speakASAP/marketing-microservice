alter table marketing_campaigns
  add column if not exists catalog_metadata jsonb;

create index if not exists marketing_campaigns_catalog_family_idx on marketing_campaigns ((catalog_metadata->>$$campaignFamily$$));
create index if not exists marketing_campaigns_catalog_lifecycle_stage_idx on marketing_campaigns ((catalog_metadata->>$$lifecycleStage$$));
create index if not exists marketing_campaigns_catalog_audience_key_idx on marketing_campaigns ((catalog_metadata->>$$audienceKey$$));
create index if not exists marketing_campaigns_catalog_category_idx on marketing_campaigns ((catalog_metadata->>$$catalogCategory$$));
create index if not exists marketing_campaigns_catalog_source_blueprint_idx on marketing_campaigns ((catalog_metadata->>$$sourceBlueprintId$$));
create index if not exists marketing_campaigns_catalog_tags_idx on marketing_campaigns using gin ((catalog_metadata->$$catalogTags$$));
