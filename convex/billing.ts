import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { requireCapability } from "./lib/auth";
import { planTier } from "./lib/validators";

const PLAN_AMOUNT: Record<"starter" | "growth" | "enterprise", number> = {
  starter: 14900,
  growth: 49900,
  enterprise: 199900,
};

export const applyPaidPlan = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    plan: planTier,
    stripeSessionId: v.string(),
    amount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Workspace not found");
    await ctx.db.patch(args.tenantId, { planTier: args.plan, status: "active" });
    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      action: "billing_plan_paid",
      entityType: "tenants",
      entityId: args.tenantId,
      details: `${args.amount ?? PLAN_AMOUNT[args.plan]}|paid|${args.stripeSessionId}|${args.plan}`,
      severity: "info",
    });
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
    await ctx.runQuery(api.billing.assertBillingAdmin, { tenantId: args.tenantId });

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

export const assertBillingAdmin = query({
  args: { tenantId: v.id("tenants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.tenantId, "settings:manage_billing");
    return null;
  },
});
