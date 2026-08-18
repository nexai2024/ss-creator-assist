import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCapability } from "./lib/auth";
import { planTier } from "./lib/validators";

const PLAN_AMOUNT: Record<"starter" | "growth" | "enterprise", number> = {
  starter: 14900,
  growth: 49900,
  enterprise: 199900,
};

const PLAN_MAUS: Record<"starter" | "growth" | "enterprise", number> = {
  starter: 5000,
  growth: 25000,
  enterprise: 1_000_000,
};

export const checkoutContext = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    email: v.string(),
    hasCustomer: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireCapability(ctx, args.tenantId, "settings:manage_billing");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Workspace not found");
    const user = await ctx.db.get(userId);
    return {
      email: user?.email ?? "",
      hasCustomer: Boolean(tenant.stripeCustomerId),
    };
  },
});

export const billingCustomer = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    stripeCustomerId: v.union(v.string(), v.null()),
    email: v.string(),
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireCapability(ctx, args.tenantId, "settings:manage_billing");
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Workspace not found");
    const user = await ctx.db.get(userId);
    return {
      stripeCustomerId: tenant.stripeCustomerId ?? null,
      email: user?.email ?? "",
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

export const applySubscriptionCanceled = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let tenant = args.tenantId ? await ctx.db.get(args.tenantId) : null;
    if (!tenant && args.stripeCustomerId) {
      tenant = await ctx.db
        .query("tenants")
        .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
        .unique();
    }
    if (!tenant) return null;
    await ctx.db.patch(tenant._id, { status: "trial" });
    await ctx.db.insert("auditLog", {
      tenantId: tenant._id,
      action: "billing_subscription_canceled",
      entityType: "tenants",
      entityId: tenant._id,
      details: `0|canceled|${args.stripeSubscriptionId}|${tenant.planTier}`,
      severity: "warning",
    });
    return null;
  },
});

export const createCheckoutSession = action({
  args: {
    tenantId: v.id("tenants"),
    plan: planTier,
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const billing = await ctx.runQuery(internal.billing.billingCustomer, { tenantId: args.tenantId });

    const secret = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.SITE_URL;
    if (!secret) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY on the Convex deployment.");
    if (!siteUrl) throw new Error("SITE_URL is not set");

    const body = new URLSearchParams({
      mode: "subscription",
      success_url: `${siteUrl}/billing?checkout=success`,
      cancel_url: `${siteUrl}/billing?checkout=cancel`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(PLAN_AMOUNT[args.plan]),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": `MSE Console ${args.plan}`,
      "metadata[tenantId]": args.tenantId,
      "metadata[plan]": args.plan,
      "subscription_data[metadata][tenantId]": args.tenantId,
      "subscription_data[metadata][plan]": args.plan,
    });
    if (billing.stripeCustomerId) {
      body.set("customer", billing.stripeCustomerId);
    } else if (billing.email) {
      body.set("customer_email", billing.email);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Stripe checkout error", text);
      throw new Error("Unable to start Stripe checkout");
    }
    const session = await res.json() as { url?: string };
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
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

    const secret = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.SITE_URL;
    if (!secret) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY on the Convex deployment.");
    if (!siteUrl) throw new Error("SITE_URL is not set");

    const body = new URLSearchParams({
      customer: billing.stripeCustomerId,
      return_url: `${siteUrl}/billing?portal=return`,
    });

    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Stripe portal error", text);
      throw new Error("Unable to open the Stripe billing portal");
    }
    const session = await res.json() as { url?: string };
    if (!session.url) throw new Error("Stripe did not return a portal URL");
    return { url: session.url };
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
