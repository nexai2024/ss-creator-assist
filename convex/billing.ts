import { v } from "convex/values";
import { action, internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireCapability } from "./lib/auth";
import { planTier } from "./lib/validators";
import {
  createCheckoutUrl,
  createPlanSwitchPortalUrl,
  createPortalUrl,
  ensurePlanCatalog,
  ensurePortalConfiguration,
  findActiveSubscription,
  updateSubscriptionPlan,
} from "./lib/stripeCatalog";
import { PLAN_AMOUNT, PLAN_MAUS, type PlanTier } from "./lib/stripePlans";

async function findTenantByStripe(
  ctx: MutationCtx,
  args: {
    tenantId?: Id<"tenants">;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  },
): Promise<Doc<"tenants"> | null> {
  if (args.tenantId) {
    const tenant = await ctx.db.get(args.tenantId);
    if (tenant) return tenant;
  }
  if (args.stripeSubscriptionId) {
    const bySub = await ctx.db
      .query("tenants")
      .withIndex("by_stripe_subscription", (q) => q.eq("stripeSubscriptionId", args.stripeSubscriptionId))
      .unique();
    if (bySub) return bySub;
  }
  if (args.stripeCustomerId) {
    return await ctx.db
      .query("tenants")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .unique();
  }
  return null;
}

export const checkoutContext = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    email: v.string(),
    hasCustomer: v.boolean(),
    hasSubscription: v.boolean(),
    stripeConfigured: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireCapability(ctx, args.tenantId, "settings:manage_billing");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Workspace not found");
    const user = await ctx.db.get(userId);
    return {
      email: user?.email ?? "",
      hasCustomer: Boolean(tenant.stripeCustomerId),
      hasSubscription: Boolean(tenant.stripeSubscriptionId),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    };
  },
});

export const billingCustomer = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    stripeCustomerId: v.union(v.string(), v.null()),
    stripeSubscriptionId: v.union(v.string(), v.null()),
    email: v.string(),
    plan: planTier,
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireCapability(ctx, args.tenantId, "settings:manage_billing");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Workspace not found");
    const user = await ctx.db.get(userId);
    return {
      stripeCustomerId: tenant.stripeCustomerId ?? null,
      stripeSubscriptionId: tenant.stripeSubscriptionId ?? null,
      email: user?.email ?? "",
      plan: tenant.planTier,
    };
  },
});

export const applyPaidPlan = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    plan: planTier,
    stripeSessionId: v.string(),
    amount: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Workspace not found");
    await ctx.db.patch(args.tenantId, {
      planTier: args.plan,
      status: "active",
      includedMaus: PLAN_MAUS[args.plan],
      ...(args.stripeCustomerId ? { stripeCustomerId: args.stripeCustomerId } : {}),
      ...(args.stripeSubscriptionId ? { stripeSubscriptionId: args.stripeSubscriptionId } : {}),
    });
    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      action: "billing_plan_paid",
      entityType: "tenants",
      entityId: args.tenantId,
      details: `${args.amount ?? PLAN_AMOUNT[args.plan]}|paid|${args.stripeSessionId}|${args.plan}`,
      severity: "info",
    });
    return null;
  },
});

async function syncStripeSubscription(
  ctx: MutationCtx,
  args: {
    tenantId?: Id<"tenants">;
    stripeCustomerId?: string;
    stripeSubscriptionId: string;
    plan?: PlanTier;
    status: string;
  },
): Promise<null> {
  const tenant = await findTenantByStripe(ctx, args);
  if (!tenant) return null;
  const canceled = args.status === "canceled" || args.status === "unpaid" || args.status === "incomplete_expired";
  if (canceled) {
    await ctx.db.patch(tenant._id, { status: "trial" });
    await ctx.db.insert("auditLog", {
      tenantId: tenant._id,
      action: "billing_subscription_canceled",
      entityType: "tenants",
      entityId: tenant._id,
      details: `0|canceled|${args.stripeSubscriptionId}|${args.plan ?? tenant.planTier}`,
      severity: "warning",
    });
    return null;
  }
  await ctx.db.patch(tenant._id, {
    stripeSubscriptionId: args.stripeSubscriptionId,
    ...(args.stripeCustomerId ? { stripeCustomerId: args.stripeCustomerId } : {}),
    ...(args.plan ? { planTier: args.plan, includedMaus: PLAN_MAUS[args.plan] } : {}),
    ...(args.status === "active" || args.status === "trialing" ? { status: "active" as const } : {}),
  });
  await ctx.db.insert("auditLog", {
    tenantId: tenant._id,
    action: "billing_subscription_updated",
    entityType: "tenants",
    entityId: tenant._id,
    details: `${args.plan ? PLAN_AMOUNT[args.plan] : 0}|${args.status}|${args.stripeSubscriptionId}|${args.plan ?? tenant.planTier}`,
    severity: args.status === "past_due" ? "warning" : "info",
  });
  return null;
}

export const applySubscriptionUpdated = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.string(),
    plan: v.optional(planTier),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await syncStripeSubscription(ctx, args);
  },
});

export const applySubscriptionCanceled = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await syncStripeSubscription(ctx, { ...args, status: "canceled" });
  },
});

async function stripeSecrets(): Promise<{ secret: string; siteUrl: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL;
  if (!secret) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY on the Convex deployment.");
  if (!siteUrl) throw new Error("SITE_URL is not set");
  return { secret, siteUrl };
}

async function portalConfigurationId(
  secret: string,
  catalog: Awaited<ReturnType<typeof ensurePlanCatalog>>,
): Promise<string | undefined> {
  try {
    return await ensurePortalConfiguration(secret, catalog);
  } catch (err) {
    console.error("Stripe portal configuration unavailable", err);
    return undefined;
  }
}

export const createCheckoutSession = action({
  args: {
    tenantId: v.id("tenants"),
    plan: planTier,
  },
  returns: v.object({ url: v.string(), mode: v.union(v.literal("checkout"), v.literal("portal")) }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const billing = await ctx.runQuery(internal.billing.billingCustomer, { tenantId: args.tenantId });
    if (billing.plan === args.plan && billing.stripeSubscriptionId) {
      throw new Error("This workspace is already on that plan");
    }

    const { secret, siteUrl } = await stripeSecrets();
    const catalog = await ensurePlanCatalog(secret);
    const priceId = catalog[args.plan].priceId;

    if (billing.stripeCustomerId) {
      const subscription = await findActiveSubscription(
        secret,
        billing.stripeCustomerId,
        billing.stripeSubscriptionId,
      );
      if (subscription) {
        if (subscription.priceId === priceId) {
          throw new Error("This workspace is already on that plan");
        }
        const configurationId = await portalConfigurationId(secret, catalog);
        if (configurationId) {
          try {
            const url = await createPlanSwitchPortalUrl({
              secret,
              siteUrl,
              customerId: billing.stripeCustomerId,
              configurationId,
              subscription,
              priceId,
            });
            return { url, mode: "portal" as const };
          } catch (err) {
            console.error("Stripe portal plan switch failed", err);
          }
        }
        await updateSubscriptionPlan(secret, subscription, priceId, args.plan);
        return { url: `${siteUrl}/billing?portal=updated`, mode: "portal" as const };
      }
    }

    const url = await createCheckoutUrl({
      secret,
      siteUrl,
      tenantId: args.tenantId,
      plan: args.plan,
      priceId,
      customerId: billing.stripeCustomerId,
      email: billing.email,
    });
    return { url, mode: "checkout" as const };
  },
});

export const createPortalSession = action({
  args: { tenantId: v.id("tenants") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const billing = await ctx.runQuery(internal.billing.billingCustomer, { tenantId: args.tenantId });
    if (!billing.stripeCustomerId) {
      throw new Error("Complete a paid checkout first. Stripe needs a customer before the billing portal can open.");
    }

    const { secret, siteUrl } = await stripeSecrets();
    const catalog = await ensurePlanCatalog(secret);
    const configurationId = await portalConfigurationId(secret, catalog);
    const url = await createPortalUrl({
      secret,
      siteUrl,
      customerId: billing.stripeCustomerId,
      configurationId,
    });
    return { url };
  },
});

export const assertBillingAdmin = query({
  args: { tenantId: v.id("tenants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.tenantId, "settings:manage_billing");
    return null;
  },
});
