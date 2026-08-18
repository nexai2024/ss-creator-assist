import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const roleTier = v.union(
  v.literal("admin"),
  v.literal("manager"),
  v.literal("senior_agent"),
  v.literal("junior_agent"),
  v.literal("read_only"),
);

export default defineSchema({
  ...authTables,

  tenants: defineTable({
    name: v.string(),
    slug: v.string(),
    planTier: v.union(v.literal("starter"), v.literal("growth"), v.literal("enterprise")),
    status: v.union(v.literal("active"), v.literal("trial"), v.literal("suspended")),
    monthlyActiveUsers: v.number(),
    includedMaus: v.number(),
    overageRate: v.number(),
    slaUptime: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  tenantMembers: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    role: roleTier,
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_tenant_and_user", ["tenantId", "userId"]),

  agents: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("agent")),
    status: v.union(v.literal("online"), v.literal("away"), v.literal("offline")),
    avatarColor: v.string(),
  }).index("by_tenant", ["tenantId"]),

  tickets: defineTable({
    tenantId: v.id("tenants"),
    subject: v.string(),
    category: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    status: v.union(v.literal("open"), v.literal("pending"), v.literal("resolved"), v.literal("closed")),
    customerName: v.string(),
    customerEmail: v.string(),
    customerExternalId: v.optional(v.string()),
    assignedAgentId: v.optional(v.id("agents")),
    slaDeadline: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    csatScore: v.optional(v.number()),
    deflectionSuggested: v.boolean(),
    customFields: v.record(v.string(), v.string()),
    tags: v.array(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_status", ["tenantId", "status"])
    .index("by_tenant_and_email", ["tenantId", "customerEmail"]),

  ticketMessages: defineTable({
    ticketId: v.id("tickets"),
    senderType: v.union(v.literal("end_user"), v.literal("agent"), v.literal("system")),
    senderName: v.string(),
    content: v.string(),
  }).index("by_ticket", ["ticketId"]),

  chatConversations: defineTable({
    tenantId: v.id("tenants"),
    customerName: v.string(),
    customerEmail: v.string(),
    status: v.union(v.literal("active"), v.literal("waiting"), v.literal("closed")),
    assignedAgentId: v.optional(v.id("agents")),
    visitorToken: v.optional(v.string()),
    closedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_visitor_token", ["visitorToken"])
    .index("by_tenant_and_email", ["tenantId", "customerEmail"]),

  chatMessages: defineTable({
    conversationId: v.id("chatConversations"),
    senderType: v.union(v.literal("end_user"), v.literal("agent"), v.literal("bot")),
    senderName: v.string(),
    content: v.string(),
  }).index("by_conversation", ["conversationId"]),

  kbCategories: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"]),

  kbArticles: defineTable({
    tenantId: v.id("tenants"),
    categoryId: v.optional(v.id("kbCategories")),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    status: v.union(v.literal("published"), v.literal("draft")),
    views: v.number(),
    helpfulVotes: v.number(),
    unhelpfulVotes: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_slug", ["tenantId", "slug"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

  gdprRequests: defineTable({
    tenantId: v.id("tenants"),
    subjectType: v.string(),
    externalUserId: v.string(),
    userEmail: v.string(),
    reason: v.string(),
    status: v.union(v.literal("processing"), v.literal("completed"), v.literal("failed")),
    jobId: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  }).index("by_tenant", ["tenantId"]),

  auditLog: defineTable({
    tenantId: v.optional(v.id("tenants")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    severity: v.optional(v.union(v.literal("info"), v.literal("warning"), v.literal("critical"))),
  }).index("by_tenant", ["tenantId"]),

  integrationSettings: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("draft")),
    apiKey: v.optional(v.string()),
    apiKeyHash: v.optional(v.string()),
    apiKeyHint: v.optional(v.string()),
    widgetEnabled: v.boolean(),
    widgetPosition: v.string(),
    widgetColor: v.string(),
    widgetGreeting: v.optional(v.string()),
    customDomain: v.optional(v.string()),
    helpCenterSubdomain: v.optional(v.string()),
    brandingLogoUrl: v.optional(v.string()),
    brandingPrimaryColor: v.string(),
    webhookUrl: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
    webhookSecretEnc: v.optional(v.string()),
    webhookSecretHint: v.optional(v.string()),
    webhookEvents: v.array(v.string()),
    ssoEnabled: v.boolean(),
    ssoProvider: v.optional(v.string()),
    ssoMetadataUrl: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    onboardingStep: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_api_key", ["apiKey"])
    .index("by_api_key_hash", ["apiKeyHash"]),

  routingRules: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    conditionField: v.union(v.literal("category"), v.literal("priority"), v.literal("subject_keyword")),
    conditionValue: v.string(),
    action: v.union(v.literal("assign_agent"), v.literal("set_priority"), v.literal("add_tag")),
    actionValue: v.string(),
    priority: v.number(),
    enabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  pricingExperiments: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    variantALabel: v.string(),
    variantAValue: v.string(),
    variantBLabel: v.string(),
    variantBValue: v.string(),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),

  experimentAssignments: defineTable({
    experimentId: v.id("pricingExperiments"),
    sessionId: v.string(),
    variant: v.union(v.literal("A"), v.literal("B")),
  }).index("by_experiment_and_session", ["experimentId", "sessionId"]),

  ticketFeedback: defineTable({
    ticketId: v.id("tickets"),
    rating: v.number(),
    comment: v.optional(v.string()),
    submittedBy: v.optional(v.string()),
  }).index("by_ticket", ["ticketId"]),

  webhookDeliveries: defineTable({
    tenantId: v.id("tenants"),
    eventType: v.string(),
    payload: v.string(),
    responseStatus: v.optional(v.number()),
    responseBody: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"]),

  teamInvites: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    role: roleTier,
    token: v.string(),
    invitedBy: v.optional(v.id("users")),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_token", ["token"]),

  savedReplies: defineTable({
    tenantId: v.id("tenants"),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    shortcut: v.optional(v.string()),
    usageCount: v.number(),
    updatedAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  customerProfiles: defineTable({
    tenantId: v.id("tenants"),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    isVip: v.boolean(),
    personalNotes: v.optional(v.string()),
    lifetimeValue: v.number(),
    totalTickets: v.number(),
    lastContactAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_tenant_and_email", ["tenantId", "customerEmail"]),

  timeEntries: defineTable({
    tenantId: v.id("tenants"),
    entityType: v.union(v.literal("ticket"), v.literal("chat")),
    entityId: v.string(),
    minutes: v.number(),
    description: v.optional(v.string()),
    billable: v.boolean(),
  }).index("by_tenant", ["tenantId"]),

  followUps: defineTable({
    tenantId: v.id("tenants"),
    entityType: v.union(v.literal("ticket"), v.literal("chat")),
    entityId: v.string(),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    reminderAt: v.number(),
    completed: v.boolean(),
    note: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"]),

  businessHours: defineTable({
    tenantId: v.id("tenants"),
    dayOfWeek: v.number(),
    isWorkingDay: v.boolean(),
    openTime: v.string(),
    closeTime: v.string(),
    timezone: v.string(),
  }).index("by_tenant", ["tenantId"]),

  soloSettings: defineTable({
    tenantId: v.id("tenants"),
    soloMode: v.boolean(),
    autoResponderEnabled: v.boolean(),
    autoResponderMessage: v.string(),
  }).index("by_tenant", ["tenantId"]),

  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),
});
