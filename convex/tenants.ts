import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember, requireUserId } from "./lib/auth";
import { shapeTenant } from "./lib/shape";
import { provisionWorkspace } from "./lib/workspace";
import { planTier, roleTier, tenantValidator } from "./lib/validators";

export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      ...tenantValidator.fields,
      role: roleTier,
      membership_id: v.id("tenantMembers"),
    }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const memberships = await ctx.db
      .query("tenantMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(50);
    const tenants = [];
    for (const m of memberships) {
      const tenant = await ctx.db.get(m.tenantId);
      if (tenant) tenants.push({ ...shapeTenant(tenant), role: m.role, membership_id: m._id });
    }
    return tenants;
  },
});

export const myMembership = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    id: v.id("tenantMembers"),
    user_id: v.id("users"),
    tenant_id: v.id("tenants"),
    role: roleTier,
    created_at: v.string(),
    updated_at: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { membership } = await requireMember(ctx, args.tenantId);
    return {
      id: membership._id,
      user_id: membership.userId,
      tenant_id: membership.tenantId,
      role: membership.role,
      created_at: new Date(membership._creationTime).toISOString(),
      updated_at: null,
    };
  },
});

export const createForSignup = mutation({
  args: { name: v.string() },
  returns: tenantValidator,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await provisionWorkspace(ctx, userId, args.name);
  },
});

export const updatePlan = mutation({
  args: {
    tenantId: v.id("tenants"),
    plan: planTier,
  },
  returns: v.null(),
  handler: async () => {
    throw new Error("Plan changes require a paid Stripe checkout");
  },
});
