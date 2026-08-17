import type { Doc } from "../_generated/dataModel";

export function iso(ts: number | undefined | null): string | null {
  if (ts === undefined || ts === null) return null;
  return new Date(ts).toISOString();
}

export function isoReq(ts: number): string {
  return new Date(ts).toISOString();
}

export function shapeTenant(t: Doc<"tenants">) {
  return {
    id: t._id,
    name: t.name,
    slug: t.slug,
    plan_tier: t.planTier,
    status: t.status,
    monthly_active_users: t.monthlyActiveUsers,
    included_maus: t.includedMaus,
    overage_rate: t.overageRate,
    sla_uptime: t.slaUptime,
    created_at: isoReq(t._creationTime),
  };
}

export function shapeAgent(a: Doc<"agents">) {
  return {
    id: a._id,
    tenant_id: a.tenantId,
    name: a.name,
    email: a.email,
    role: a.role,
    status: a.status,
    avatar_color: a.avatarColor,
    created_at: isoReq(a._creationTime),
  };
}

export function shapeTicket(t: Doc<"tickets">) {
  return {
    id: t._id,
    tenant_id: t.tenantId,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    customer_name: t.customerName,
    customer_email: t.customerEmail,
    customer_external_id: t.customerExternalId ?? null,
    assigned_agent_id: t.assignedAgentId ?? null,
    sla_deadline: iso(t.slaDeadline),
    created_at: isoReq(t._creationTime),
    updated_at: isoReq(t._creationTime),
    resolved_at: iso(t.resolvedAt),
    csat_score: t.csatScore ?? null,
    deflection_suggested: t.deflectionSuggested,
    custom_fields: t.customFields,
    tags: t.tags,
  };
}

export function shapeTicketMessage(m: Doc<"ticketMessages">) {
  return {
    id: m._id,
    ticket_id: m.ticketId,
    sender_type: m.senderType,
    sender_name: m.senderName,
    content: m.content,
    created_at: isoReq(m._creationTime),
  };
}

export function shapeConversation(c: Doc<"chatConversations">) {
  return {
    id: c._id,
    tenant_id: c.tenantId,
    customer_name: c.customerName,
    customer_email: c.customerEmail,
    status: c.status,
    assigned_agent_id: c.assignedAgentId ?? null,
    created_at: isoReq(c._creationTime),
    closed_at: iso(c.closedAt),
  };
}

export function shapeChatMessage(m: Doc<"chatMessages">) {
  return {
    id: m._id,
    conversation_id: m.conversationId,
    sender_type: m.senderType,
    sender_name: m.senderName,
    content: m.content,
    created_at: isoReq(m._creationTime),
  };
}

export function shapeArticle(a: Doc<"kbArticles">) {
  return {
    id: a._id,
    tenant_id: a.tenantId,
    category_id: a.categoryId ?? null,
    title: a.title,
    slug: a.slug,
    content: a.content,
    status: a.status,
    views: a.views,
    helpful_votes: a.helpfulVotes,
    unhelpful_votes: a.unhelpfulVotes,
    created_at: isoReq(a._creationTime),
    updated_at: isoReq(a.updatedAt),
  };
}

export function shapeCategory(c: Doc<"kbCategories">) {
  return {
    id: c._id,
    tenant_id: c.tenantId,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    created_at: isoReq(c._creationTime),
  };
}

export function shapeIntegration(i: Doc<"integrationSettings">) {
  return {
    id: i._id,
    tenant_id: i.tenantId,
    name: i.name,
    description: i.description ?? null,
    status: i.status,
    api_key: null as string | null,
    api_key_hint: i.apiKeyHint ?? null,
    webhook_secret: null as string | null,
    webhook_secret_hint: i.webhookSecretHint ?? null,
    widget_enabled: i.widgetEnabled,
    widget_position: i.widgetPosition,
    widget_color: i.widgetColor,
    widget_greeting: i.widgetGreeting ?? null,
    custom_domain: i.customDomain ?? null,
    help_center_subdomain: i.helpCenterSubdomain ?? null,
    branding_logo_url: i.brandingLogoUrl ?? null,
    branding_primary_color: i.brandingPrimaryColor,
    webhook_url: i.webhookUrl ?? null,
    webhook_events: i.webhookEvents,
    sso_enabled: i.ssoEnabled,
    sso_provider: i.ssoProvider ?? null,
    sso_metadata_url: i.ssoMetadataUrl ?? null,
    onboarding_completed: i.onboardingCompleted,
    onboarding_step: i.onboardingStep,
    created_at: isoReq(i._creationTime),
    updated_at: isoReq(i.updatedAt),
  };
}

export function shapeAudit(a: Doc<"auditLog">) {
  return {
    id: a._id,
    tenant_id: a.tenantId ?? null,
    action: a.action,
    entity_type: a.entityType,
    entity_id: a.entityId ?? null,
    details: a.details ?? null,
    user_id: a.userId ?? null,
    ip_address: null,
    severity: a.severity ?? null,
    created_at: isoReq(a._creationTime),
  };
}

export function slaHours(priority: string): number {
  if (priority === "urgent") return 4;
  if (priority === "high") return 8;
  if (priority === "medium") return 24;
  return 48;
}

export function classifyTicket(subject: string, body: string): { category: string; deflectionSuggested: boolean } {
  const text = `${subject} ${body}`.toLowerCase();
  const map: Record<string, string[]> = {
    Billing: ["invoice", "charge", "payment", "refund", "billing", "subscription", "credit card"],
    Technical: ["bug", "error", "crash", "broken", "not working", "500", "timeout", "api"],
    Account: ["login", "password", "access", "account", "sign in", "reset", "2fa"],
    "Feature Request": ["feature", "request", "wish", "could you add", "suggestion"],
  };
  for (const [cat, keywords] of Object.entries(map)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return { category: cat, deflectionSuggested: cat === "Technical" };
    }
  }
  return { category: "General", deflectionSuggested: false };
}
