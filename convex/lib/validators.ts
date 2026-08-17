import { type GenericValidator, v } from "convex/values";

export const planTier = v.union(v.literal("starter"), v.literal("growth"), v.literal("enterprise"));
export const roleTier = v.union(
  v.literal("admin"),
  v.literal("manager"),
  v.literal("senior_agent"),
  v.literal("junior_agent"),
  v.literal("read_only"),
);

export const tenantValidator = v.object({
  id: v.id("tenants"),
  name: v.string(),
  slug: v.string(),
  plan_tier: planTier,
  status: v.union(v.literal("active"), v.literal("trial"), v.literal("suspended")),
  monthly_active_users: v.number(),
  included_maus: v.number(),
  overage_rate: v.number(),
  sla_uptime: v.string(),
  created_at: v.string(),
});

export const ticketValidator = v.object({
  id: v.id("tickets"),
  tenant_id: v.id("tenants"),
  subject: v.string(),
  category: v.string(),
  priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
  status: v.union(v.literal("open"), v.literal("pending"), v.literal("resolved"), v.literal("closed")),
  customer_name: v.string(),
  customer_email: v.string(),
  customer_external_id: v.union(v.string(), v.null()),
  assigned_agent_id: v.union(v.id("agents"), v.null()),
  sla_deadline: v.union(v.string(), v.null()),
  created_at: v.string(),
  updated_at: v.string(),
  resolved_at: v.union(v.string(), v.null()),
  csat_score: v.union(v.number(), v.null()),
  deflection_suggested: v.boolean(),
  custom_fields: v.record(v.string(), v.string()),
  tags: v.array(v.string()),
});

export const ticketMessageValidator = v.object({
  id: v.id("ticketMessages"),
  ticket_id: v.id("tickets"),
  sender_type: v.union(v.literal("end_user"), v.literal("agent"), v.literal("system")),
  sender_name: v.string(),
  content: v.string(),
  created_at: v.string(),
});

export const conversationValidator = v.object({
  id: v.id("chatConversations"),
  tenant_id: v.id("tenants"),
  customer_name: v.string(),
  customer_email: v.string(),
  status: v.union(v.literal("active"), v.literal("waiting"), v.literal("closed")),
  assigned_agent_id: v.union(v.id("agents"), v.null()),
  created_at: v.string(),
  closed_at: v.union(v.string(), v.null()),
});

export const chatMessageValidator = v.object({
  id: v.id("chatMessages"),
  conversation_id: v.id("chatConversations"),
  sender_type: v.union(v.literal("end_user"), v.literal("agent"), v.literal("bot")),
  sender_name: v.string(),
  content: v.string(),
  created_at: v.string(),
});

export const articleValidator = v.object({
  id: v.id("kbArticles"),
  tenant_id: v.id("tenants"),
  category_id: v.union(v.id("kbCategories"), v.null()),
  title: v.string(),
  slug: v.string(),
  content: v.string(),
  status: v.union(v.literal("published"), v.literal("draft")),
  views: v.number(),
  helpful_votes: v.number(),
  unhelpful_votes: v.number(),
  created_at: v.string(),
  updated_at: v.string(),
});

export const categoryValidator = v.object({
  id: v.id("kbCategories"),
  tenant_id: v.id("tenants"),
  name: v.string(),
  slug: v.string(),
  description: v.union(v.string(), v.null()),
  created_at: v.string(),
});

export const agentValidator = v.object({
  id: v.id("agents"),
  tenant_id: v.id("tenants"),
  name: v.string(),
  email: v.string(),
  role: v.union(v.literal("admin"), v.literal("agent")),
  status: v.union(v.literal("online"), v.literal("away"), v.literal("offline")),
  avatar_color: v.string(),
  created_at: v.string(),
});

export const integrationValidator = v.object({
  id: v.id("integrationSettings"),
  tenant_id: v.id("tenants"),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  status: v.union(v.literal("active"), v.literal("inactive"), v.literal("draft")),
  api_key: v.union(v.string(), v.null()),
  api_key_hint: v.union(v.string(), v.null()),
  webhook_secret: v.union(v.string(), v.null()),
  webhook_secret_hint: v.union(v.string(), v.null()),
  widget_enabled: v.boolean(),
  widget_position: v.string(),
  widget_color: v.string(),
  widget_greeting: v.union(v.string(), v.null()),
  custom_domain: v.union(v.string(), v.null()),
  help_center_subdomain: v.union(v.string(), v.null()),
  branding_logo_url: v.union(v.string(), v.null()),
  branding_primary_color: v.string(),
  webhook_url: v.union(v.string(), v.null()),
  webhook_events: v.array(v.string()),
  sso_enabled: v.boolean(),
  sso_provider: v.union(v.string(), v.null()),
  sso_metadata_url: v.union(v.string(), v.null()),
  onboarding_completed: v.boolean(),
  onboarding_step: v.number(),
  created_at: v.string(),
  updated_at: v.string(),
});

export const paginationResult = (item: GenericValidator) =>
  v.object({
    page: v.array(item),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null()),
    ),
  });

export const auditValidator = v.object({
  id: v.id("auditLog"),
  tenant_id: v.union(v.id("tenants"), v.null()),
  action: v.string(),
  entity_type: v.string(),
  entity_id: v.union(v.string(), v.null()),
  details: v.union(v.string(), v.null()),
  user_id: v.union(v.id("users"), v.null()),
  ip_address: v.union(v.string(), v.null()),
  severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical"), v.null()),
  created_at: v.string(),
});

export const gdprRequestValidator = v.object({
  id: v.id("gdprRequests"),
  tenant_id: v.id("tenants"),
  subject_type: v.string(),
  external_user_id: v.string(),
  user_email: v.string(),
  reason: v.string(),
  status: v.union(v.literal("processing"), v.literal("completed"), v.literal("failed")),
  job_id: v.union(v.string(), v.null()),
  created_at: v.string(),
  completed_at: v.union(v.string(), v.null()),
});

export const routingRuleValidator = v.object({
  id: v.id("routingRules"),
  tenant_id: v.id("tenants"),
  name: v.string(),
  condition_field: v.union(v.literal("category"), v.literal("priority"), v.literal("subject_keyword")),
  condition_value: v.string(),
  action: v.union(v.literal("assign_agent"), v.literal("set_priority"), v.literal("add_tag")),
  action_value: v.string(),
  priority: v.number(),
  enabled: v.boolean(),
  created_at: v.string(),
  updated_at: v.string(),
});
