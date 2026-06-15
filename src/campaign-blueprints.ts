import { CampaignBlueprint } from "./types";

const DEFAULT_CAMPAIGN_BLUEPRINTS: CampaignBlueprint[] = [
  {
    blueprintId: "flipflop.abandoned-intent.default",
    appId: "flipflop",
    productLine: "marketplace",
    name: "Flipflop abandoned intent recovery",
    description: "Recover shoppers who viewed or started checkout without purchase.",
    campaignFamily: "abandoned_intent",
    lifecycleStage: "abandoned_intent",
    audienceKey: "flipflop-abandoned-intent",
    audienceLabel: "Flipflop shoppers with abandoned intent",
    catalogCategory: "recovery",
    catalogTags: ["flipflop", "marketplace", "abandoned_intent"],
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["telegram", "whatsapp"],
    templateRef: "flipflop.abandoned-intent.default",
    segment: {
      name: "Flipflop abandoned intent audience",
      sourceTypes: ["app_signals", "auth_users"],
      rules: { signalEventGroup: "abandoned_intent", signalLifecycleStage: "abandoned_intent", signalSourceService: "flipflop" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "abandoned_intent",
      lifecycleStage: "abandoned_intent",
      audienceKey: "flipflop-abandoned-intent",
      audienceLabel: "Flipflop shoppers with abandoned intent",
      catalogCategory: "recovery",
      catalogTags: ["flipflop", "marketplace", "abandoned_intent"],
      sourceBlueprintId: "flipflop.abandoned-intent.default"
    }
  },
  {
    blueprintId: "speakasap.activation.default",
    appId: "speakasap",
    productLine: "learning",
    name: "SpeakASap learner activation",
    description: "Activate trial learners after registration or language-interest signals.",
    campaignFamily: "activation",
    lifecycleStage: "activation",
    audienceKey: "speakasap-trial-learners",
    audienceLabel: "SpeakASap trial learners",
    catalogCategory: "learning_onboarding",
    catalogTags: ["speakasap", "learning", "activation"],
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    templateRef: "speakasap.activation.default",
    segment: {
      name: "SpeakASap activation audience",
      sourceTypes: ["app_signals", "auth_users", "leads"],
      rules: { signalEventGroup: "activation", signalLifecycleStage: "activation", signalSourceService: "speakasap" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "activation",
      lifecycleStage: "activation",
      audienceKey: "speakasap-trial-learners",
      audienceLabel: "SpeakASap trial learners",
      catalogCategory: "learning_onboarding",
      catalogTags: ["speakasap", "learning", "activation"],
      sourceBlueprintId: "speakasap.activation.default"
    }
  },
  {
    blueprintId: "marathon.onboarding.default",
    appId: "marathon",
    productLine: "events",
    name: "Marathon participant onboarding",
    description: "Guide newly registered participants into event preparation.",
    campaignFamily: "onboarding",
    lifecycleStage: "onboarding",
    audienceKey: "marathon-new-participants",
    audienceLabel: "New marathon participants",
    catalogCategory: "event_onboarding",
    catalogTags: ["marathon", "events", "onboarding"],
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    templateRef: "marathon.onboarding.default",
    segment: {
      name: "Marathon new participant audience",
      sourceTypes: ["app_signals", "auth_users", "leads"],
      rules: { signalEventType: "event.registration.created", signalLifecycleStage: "onboarding", signalSourceService: "marathon" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "onboarding",
      lifecycleStage: "onboarding",
      audienceKey: "marathon-new-participants",
      audienceLabel: "New marathon participants",
      catalogCategory: "event_onboarding",
      catalogTags: ["marathon", "events", "onboarding"],
      sourceBlueprintId: "marathon.onboarding.default"
    }
  },
  {
    blueprintId: "bazos.reactivation.default",
    appId: "bazos",
    productLine: "classifieds",
    name: "Bazos listing reactivation",
    description: "Reactivate sellers with expired or inactive listings.",
    campaignFamily: "reactivation",
    lifecycleStage: "reactivation",
    audienceKey: "bazos-inactive-sellers",
    audienceLabel: "Bazos inactive sellers",
    catalogCategory: "seller_reactivation",
    catalogTags: ["bazos", "classifieds", "reactivation"],
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["whatsapp"],
    templateRef: "bazos.reactivation.default",
    segment: {
      name: "Bazos inactive seller audience",
      sourceTypes: ["app_signals", "auth_users", "leads"],
      rules: { signalEventType: "listing.expired", signalLifecycleStage: "reactivation", signalSourceService: "bazos" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "reactivation",
      lifecycleStage: "reactivation",
      audienceKey: "bazos-inactive-sellers",
      audienceLabel: "Bazos inactive sellers",
      catalogCategory: "seller_reactivation",
      catalogTags: ["bazos", "classifieds", "reactivation"],
      sourceBlueprintId: "bazos.reactivation.default"
    }
  },
  {
    blueprintId: "rent-a-box.renewal.default",
    appId: "rent-a-box",
    productLine: "storage",
    name: "Rent-A-Box renewal reminder",
    description: "Prepare storage customers for renewal and capacity decisions.",
    campaignFamily: "renewal",
    lifecycleStage: "renewal",
    audienceKey: "rent-a-box-renewals",
    audienceLabel: "Rent-A-Box upcoming renewals",
    catalogCategory: "storage_lifecycle",
    catalogTags: ["rent-a-box", "storage", "renewal"],
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["whatsapp"],
    templateRef: "rent-a-box.renewal.default",
    segment: {
      name: "Rent-A-Box renewal audience",
      sourceTypes: ["app_signals", "auth_users", "leads"],
      rules: { signalEventGroup: "renewal", signalLifecycleStage: "renewal", signalSourceService: "rent-a-box" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "renewal",
      lifecycleStage: "renewal",
      audienceKey: "rent-a-box-renewals",
      audienceLabel: "Rent-A-Box upcoming renewals",
      catalogCategory: "storage_lifecycle",
      catalogTags: ["rent-a-box", "storage", "renewal"],
      sourceBlueprintId: "rent-a-box.renewal.default"
    }
  },
  {
    blueprintId: "runlayer.feature-adoption.default",
    appId: "runlayer",
    productLine: "b2b-workflows",
    name: "RunLayer feature adoption",
    description: "Nudge active tenants toward first successful workflow usage.",
    campaignFamily: "feature_adoption",
    lifecycleStage: "feature_adoption",
    audienceKey: "runlayer-low-adoption-tenants",
    audienceLabel: "RunLayer tenants needing workflow adoption",
    catalogCategory: "b2b_adoption",
    catalogTags: ["runlayer", "b2b", "feature_adoption"],
    purpose: "retention",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    templateRef: "runlayer.feature-adoption.default",
    segment: {
      name: "RunLayer workflow adoption audience",
      sourceTypes: ["app_signals", "auth_users"],
      rules: { signalEventGroup: "feature_adoption", signalLifecycleStage: "feature_adoption", signalSourceService: "runlayer" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "feature_adoption",
      lifecycleStage: "feature_adoption",
      audienceKey: "runlayer-low-adoption-tenants",
      audienceLabel: "RunLayer tenants needing workflow adoption",
      catalogCategory: "b2b_adoption",
      catalogTags: ["runlayer", "b2b", "feature_adoption"],
      sourceBlueprintId: "runlayer.feature-adoption.default"
    }
  },
  {
    blueprintId: "runlayer.crm-onboarding.default",
    appId: "runlayer",
    productLine: "b2b-workflows",
    name: "RunLayer account onboarding recovery",
    description: "Reach source-owned account contacts when CRM onboarding signals show blocked setup.",
    campaignFamily: "onboarding",
    lifecycleStage: "onboarding",
    audienceKey: "runlayer-crm-onboarding-blocked",
    audienceLabel: "RunLayer accounts blocked during onboarding",
    catalogCategory: "b2b_account_lifecycle",
    catalogTags: ["runlayer", "b2b", "crm_accounts", "onboarding"],
    purpose: "retention",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    templateRef: "runlayer.crm-onboarding.default",
    segment: {
      name: "RunLayer CRM onboarding recovery audience",
      sourceTypes: ["crm_accounts", "auth_users", "leads"],
      rules: { lifecycleStage: "onboarding", onboardingStatus: "blocked", healthStatus: "at_risk" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "onboarding",
      lifecycleStage: "onboarding",
      audienceKey: "runlayer-crm-onboarding-blocked",
      audienceLabel: "RunLayer accounts blocked during onboarding",
      catalogCategory: "b2b_account_lifecycle",
      catalogTags: ["runlayer", "b2b", "crm_accounts", "onboarding"],
      sourceBlueprintId: "runlayer.crm-onboarding.default"
    }
  },
  {
    blueprintId: "runlayer.crm-renewal.default",
    appId: "runlayer",
    productLine: "b2b-workflows",
    name: "RunLayer account renewal nurture",
    description: "Prepare source-owned account contacts for open renewal opportunities.",
    campaignFamily: "renewal",
    lifecycleStage: "renewal",
    audienceKey: "runlayer-crm-renewal-open",
    audienceLabel: "RunLayer accounts with open renewals",
    catalogCategory: "b2b_account_lifecycle",
    catalogTags: ["runlayer", "b2b", "crm_accounts", "renewal"],
    purpose: "retention",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    templateRef: "runlayer.crm-renewal.default",
    segment: {
      name: "RunLayer CRM renewal audience",
      sourceTypes: ["crm_accounts", "auth_users", "leads"],
      rules: { lifecycleStage: "renewal", opportunityType: "renewal", opportunityStatus: "open" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "renewal",
      lifecycleStage: "renewal",
      audienceKey: "runlayer-crm-renewal-open",
      audienceLabel: "RunLayer accounts with open renewals",
      catalogCategory: "b2b_account_lifecycle",
      catalogTags: ["runlayer", "b2b", "crm_accounts", "renewal"],
      sourceBlueprintId: "runlayer.crm-renewal.default"
    }
  },
  {
    blueprintId: "runlayer.crm-upsell.default",
    appId: "runlayer",
    productLine: "b2b-workflows",
    name: "RunLayer account upsell assist",
    description: "Support approved upsell campaigns for healthy expansion-stage accounts.",
    campaignFamily: "upsell",
    lifecycleStage: "upsell",
    audienceKey: "runlayer-crm-upsell-open",
    audienceLabel: "RunLayer accounts with open upsell opportunities",
    catalogCategory: "b2b_account_lifecycle",
    catalogTags: ["runlayer", "b2b", "crm_accounts", "upsell"],
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    templateRef: "runlayer.crm-upsell.default",
    segment: {
      name: "RunLayer CRM upsell audience",
      sourceTypes: ["crm_accounts", "auth_users", "leads"],
      rules: { lifecycleStage: "expansion", opportunityType: "upsell", opportunityStatus: "open", healthScoreMin: 70 },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "upsell",
      lifecycleStage: "upsell",
      audienceKey: "runlayer-crm-upsell-open",
      audienceLabel: "RunLayer accounts with open upsell opportunities",
      catalogCategory: "b2b_account_lifecycle",
      catalogTags: ["runlayer", "b2b", "crm_accounts", "upsell"],
      sourceBlueprintId: "runlayer.crm-upsell.default"
    }
  },
  {
    blueprintId: "runlayer.crm-winback.default",
    appId: "runlayer",
    productLine: "b2b-workflows",
    name: "RunLayer account winback",
    description: "Support approved winback campaigns for at-risk or returning B2B accounts.",
    campaignFamily: "winback",
    lifecycleStage: "winback",
    audienceKey: "runlayer-crm-winback-open",
    audienceLabel: "RunLayer accounts in winback lifecycle",
    catalogCategory: "b2b_account_lifecycle",
    catalogTags: ["runlayer", "b2b", "crm_accounts", "winback"],
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    templateRef: "runlayer.crm-winback.default",
    segment: {
      name: "RunLayer CRM winback audience",
      sourceTypes: ["crm_accounts", "auth_users", "leads"],
      rules: { lifecycleStage: "winback", opportunityType: "winback", opportunityStatus: "open", healthStatus: "at_risk" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "winback",
      lifecycleStage: "winback",
      audienceKey: "runlayer-crm-winback-open",
      audienceLabel: "RunLayer accounts in winback lifecycle",
      catalogCategory: "b2b_account_lifecycle",
      catalogTags: ["runlayer", "b2b", "crm_accounts", "winback"],
      sourceBlueprintId: "runlayer.crm-winback.default"
    }
  },
  {
    blueprintId: "shop-assistant.post-purchase.default",
    appId: "shop-assistant",
    productLine: "commerce-assistant",
    name: "Shop Assistant post-purchase recommendation",
    description: "Follow up after purchase or recommendation engagement with related offers.",
    campaignFamily: "post_purchase",
    lifecycleStage: "post_purchase",
    audienceKey: "shop-assistant-post-purchase",
    audienceLabel: "Shop Assistant post-purchase shoppers",
    catalogCategory: "commerce_follow_up",
    catalogTags: ["shop-assistant", "commerce", "post_purchase"],
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["whatsapp"],
    templateRef: "shop-assistant.post-purchase.default",
    segment: {
      name: "Shop Assistant post-purchase audience",
      sourceTypes: ["app_signals", "auth_users", "orders"],
      rules: { signalEventGroup: "post_purchase", signalLifecycleStage: "post_purchase", signalSourceService: "shop-assistant" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "post_purchase",
      lifecycleStage: "post_purchase",
      audienceKey: "shop-assistant-post-purchase",
      audienceLabel: "Shop Assistant post-purchase shoppers",
      catalogCategory: "commerce_follow_up",
      catalogTags: ["shop-assistant", "commerce", "post_purchase"],
      sourceBlueprintId: "shop-assistant.post-purchase.default"
    }
  },
  {
    blueprintId: "statics.retention.default",
    appId: "statics",
    productLine: "analytics",
    name: "Statics workspace retention",
    description: "Bring inactive analytics workspaces back to report and dashboard usage.",
    campaignFamily: "retention",
    lifecycleStage: "retention",
    audienceKey: "statics-inactive-workspaces",
    audienceLabel: "Statics inactive workspaces",
    catalogCategory: "workspace_retention",
    catalogTags: ["statics", "analytics", "retention"],
    purpose: "retention",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    templateRef: "statics.retention.default",
    segment: {
      name: "Statics inactive workspace audience",
      sourceTypes: ["app_signals", "auth_users"],
      rules: { signalEventType: "workspace.inactive", signalLifecycleStage: "retention", signalSourceService: "statics" },
      isDynamic: true
    },
    catalogMetadata: {
      campaignFamily: "retention",
      lifecycleStage: "retention",
      audienceKey: "statics-inactive-workspaces",
      audienceLabel: "Statics inactive workspaces",
      catalogCategory: "workspace_retention",
      catalogTags: ["statics", "analytics", "retention"],
      sourceBlueprintId: "statics.retention.default"
    }
  }
];

export type CampaignBlueprintFilter = Partial<Pick<CampaignBlueprint, "appId" | "productLine" | "purpose" | "campaignFamily" | "lifecycleStage" | "audienceKey" | "catalogCategory">> & { catalogTag?: string };

export function listDefaultCampaignBlueprints(filters: CampaignBlueprintFilter = {}): CampaignBlueprint[] {
  return DEFAULT_CAMPAIGN_BLUEPRINTS.filter((blueprint) => {
    return Object.entries(filters).every(([key, expected]) => {
      if (expected === undefined) return true;
      if (key === "catalogTag") return blueprint.catalogTags.includes(String(expected));
      return blueprint[key as keyof CampaignBlueprint] === expected;
    });
  });
}

export function getDefaultCampaignBlueprint(blueprintId: string): CampaignBlueprint | undefined {
  return DEFAULT_CAMPAIGN_BLUEPRINTS.find((blueprint) => blueprint.blueprintId === blueprintId);
}
