import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireMember, requirePermission, writeAudit } from "./lib/auth";
import { shapeAgent, shapeIntegration } from "./lib/shape";
import { encryptSecret, hintFor, randomToken, sha256Hex } from "./lib/secrets";
import { agentValidator, integrationValidator, routingRuleValidator } from "./lib/validators";

function integrationWrite(row: Doc<"integrationSettings">) {
  return {
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    status: row.status,
    apiKeyHash: row.apiKeyHash,
    apiKeyHint: row.apiKeyHint,
    widgetEnabled: row.widgetEnabled,
    widgetPosition: row.widgetPosition,
    widgetColor: row.widgetColor,
    widgetGreeting: row.widgetGreeting,
    customDomain: row.customDomain,
    helpCenterSubdomain: row.helpCenterSubdomain,
    brandingLogoUrl: row.brandingLogoUrl,
    brandingPrimaryColor: row.brandingPrimaryColor,
    webhookUrl: row.webhookUrl,
    webhookSecretEnc: row.webhookSecretEnc,
    webhookSecretHint: row.webhookSecretHint,
    webhookEvents: row.webhookEvents,
    ssoEnabled: row.ssoEnabled,
    ssoProvider: row.ssoProvider,
    ssoMetadataUrl: row.ssoMetadataUrl,
    onboardingCompleted: row.onboardingCompleted,
    onboardingStep: row.onboardingStep,
    updatedAt: Date.now(),
  };
}

async function replaceIntegration(
  ctx: MutationCtx,
  row: Doc<"integrationSettings">,
  patch: Partial<ReturnType<typeof integrationWrite>>,
) {
  await ctx.db.replace(row._id, { ...integrationWrite(row), ...patch, updatedAt: Date.now() });
}

export const listAgents = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(agentValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("agents").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    return rows.map(shapeAgent);
  },
});

export const list = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(integrationValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("integrationSettings").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(50);
    return rows.map(shapeIntegration);
  },
});

export const get = query({
  args: { integrationId: v.id("integrationSettings") },
  returns: v.union(integrationValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.integrationId);
    if (!row) return null;
    await requireMember(ctx, row.tenantId);
    return shapeIntegration(row);
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: integrationValidator,
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin"]);
    const existing = await ctx.db.query("integrationSettings").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(50);
    const tenant = await ctx.db.get(args.tenantId);
    const limit = tenant?.planTier === "enterprise" ? Infinity : tenant?.planTier === "growth" ? 3 : 1;
    if (existing.length >= limit) throw new Error("Plan integration limit reached");
    const apiKey = randomToken("mse_live_", 24);
    const webhookSecret = randomToken("whsec_", 16);
    const id = await ctx.db.insert("integrationSettings", {
      tenantId: args.tenantId,
      name: args.name,
      description: args.description,
      status: "draft",
      apiKeyHash: await sha256Hex(apiKey),
      apiKeyHint: hintFor(apiKey),
      webhookSecretEnc: await encryptSecret(webhookSecret),
      webhookSecretHint: hintFor(webhookSecret),
      widgetEnabled: true,
      widgetPosition: "bottom-right",
      widgetColor: "#3b82f6",
      brandingPrimaryColor: "#3b82f6",
      webhookEvents: ["TicketCreated"],
      ssoEnabled: false,
      onboardingCompleted: false,
      onboardingStep: 0,
      updatedAt: Date.now(),
    });
    const row = await ctx.db.get(id);
    return {
      ...shapeIntegration(row!),
      api_key: apiKey,
      webhook_secret: webhookSecret,
    };
  },
});

export const update = mutation({
  args: {
    integrationId: v.id("integrationSettings"),
    patch: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("draft"))),
      apiKey: v.optional(v.string()),
      widgetEnabled: v.optional(v.boolean()),
      widgetPosition: v.optional(v.string()),
      widgetColor: v.optional(v.string()),
      widgetGreeting: v.optional(v.string()),
      customDomain: v.optional(v.string()),
      helpCenterSubdomain: v.optional(v.string()),
      brandingLogoUrl: v.optional(v.string()),
      brandingPrimaryColor: v.optional(v.string()),
      webhookUrl: v.optional(v.string()),
      webhookSecret: v.optional(v.string()),
      webhookEvents: v.optional(v.array(v.string())),
      ssoEnabled: v.optional(v.boolean()),
      ssoProvider: v.optional(v.string()),
      ssoMetadataUrl: v.optional(v.string()),
      onboardingCompleted: v.optional(v.boolean()),
      onboardingStep: v.optional(v.number()),
    }),
  },
  returns: integrationValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.integrationId);
    if (!row) throw new Error("Integration not found");
    await requireMember(ctx, row.tenantId);
    const next = integrationWrite(row);
    const map: Record<string, keyof typeof next> = {
      name: "name",
      description: "description",
      status: "status",
      widgetEnabled: "widgetEnabled",
      widgetPosition: "widgetPosition",
      widgetColor: "widgetColor",
      widgetGreeting: "widgetGreeting",
      customDomain: "customDomain",
      helpCenterSubdomain: "helpCenterSubdomain",
      brandingLogoUrl: "brandingLogoUrl",
      brandingPrimaryColor: "brandingPrimaryColor",
      webhookUrl: "webhookUrl",
      webhookEvents: "webhookEvents",
      ssoEnabled: "ssoEnabled",
      ssoProvider: "ssoProvider",
      ssoMetadataUrl: "ssoMetadataUrl",
      onboardingCompleted: "onboardingCompleted",
      onboardingStep: "onboardingStep",
    };
    for (const [k, v_] of Object.entries(args.patch)) {
      if (v_ === undefined) continue;
      if (k === "apiKey" && typeof v_ === "string") {
        next.apiKeyHash = await sha256Hex(v_);
        next.apiKeyHint = hintFor(v_);
        continue;
      }
      if (k === "webhookSecret" && typeof v_ === "string") {
        next.webhookSecretEnc = await encryptSecret(v_);
        next.webhookSecretHint = hintFor(v_);
        continue;
      }
      const field = map[k];
      if (field) Object.assign(next, { [field]: v_ });
    }
    await ctx.db.replace(args.integrationId, next);
    const updated = await ctx.db.get(args.integrationId);
    return shapeIntegration(updated!);
  },
});

export const rotateApiKey = mutation({
  args: { integrationId: v.id("integrationSettings") },
  returns: integrationValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.integrationId);
    if (!row) throw new Error("Integration not found");
    await requirePermission(ctx, row.tenantId, ["admin"]);
    const apiKey = randomToken("mse_live_", 24);
    await replaceIntegration(ctx, row, {
      apiKeyHash: await sha256Hex(apiKey),
      apiKeyHint: hintFor(apiKey),
    });
    const updated = await ctx.db.get(args.integrationId);
    return { ...shapeIntegration(updated!), api_key: apiKey };
  },
});

export const rotateWebhookSecret = mutation({
  args: { integrationId: v.id("integrationSettings") },
  returns: integrationValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.integrationId);
    if (!row) throw new Error("Integration not found");
    await requirePermission(ctx, row.tenantId, ["admin"]);
    const secret = randomToken("whsec_", 16);
    await replaceIntegration(ctx, row, {
      webhookSecretEnc: await encryptSecret(secret),
      webhookSecretHint: hintFor(secret),
    });
    const updated = await ctx.db.get(args.integrationId);
    return { ...shapeIntegration(updated!), webhook_secret: secret };
  },
});

export const remove = mutation({
  args: { integrationId: v.id("integrationSettings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.integrationId);
    if (!row) return null;
    await requirePermission(ctx, row.tenantId, ["admin"]);
    await ctx.db.delete(args.integrationId);
    return null;
  },
});

export const listRules = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(routingRuleValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("routingRules").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    return rows.map((r) => ({
      id: r._id,
      tenant_id: r.tenantId,
      name: r.name,
      condition_field: r.conditionField,
      condition_value: r.conditionValue,
      action: r.action,
      action_value: r.actionValue,
      priority: r.priority,
      enabled: r.enabled,
      created_at: new Date(r._creationTime).toISOString(),
      updated_at: new Date(r.updatedAt).toISOString(),
    }));
  },
});

export const createRule = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    conditionField: v.union(v.literal("category"), v.literal("priority"), v.literal("subject_keyword")),
    conditionValue: v.string(),
    action: v.union(v.literal("assign_agent"), v.literal("set_priority"), v.literal("add_tag")),
    actionValue: v.string(),
    priority: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    await ctx.db.insert("routingRules", {
      tenantId: args.tenantId,
      name: args.name,
      conditionField: args.conditionField,
      conditionValue: args.conditionValue,
      action: args.action,
      actionValue: args.actionValue,
      priority: args.priority,
      enabled: true,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const updateRule = mutation({
  args: {
    tenantId: v.id("tenants"),
    ruleId: v.id("routingRules"),
    enabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.tenantId !== args.tenantId) throw new Error("Rule not found");
    await ctx.db.patch(args.ruleId, { enabled: args.enabled ?? rule.enabled, updatedAt: Date.now() });
    return null;
  },
});

export const removeRule = mutation({
  args: { tenantId: v.id("tenants"), ruleId: v.id("routingRules") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.tenantId !== args.tenantId) return null;
    await ctx.db.delete(args.ruleId);
    return null;
  },
});

export const finishOnboarding = mutation({
  args: { integrationId: v.id("integrationSettings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.integrationId);
    if (!row) throw new Error("Integration not found");
    const { userId } = await requireMember(ctx, row.tenantId);
    await ctx.db.patch(args.integrationId, { onboardingCompleted: true, onboardingStep: 4, status: "active", updatedAt: Date.now() });
    await writeAudit(ctx, {
      tenantId: row.tenantId,
      action: "integration_created",
      entityType: "integration_settings",
      entityId: args.integrationId,
      details: `Integration ${row.name} activated`,
      userId,
    });
    return null;
  },
});
