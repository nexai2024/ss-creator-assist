import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember, requirePermission } from "./lib/auth";

const campaignValidator = v.object({
  id: v.id("campaigns"),
  title: v.string(),
  body: v.string(),
  enabled: v.boolean(),
  integration_id: v.union(v.id("integrationSettings"), v.null()),
});

export const list = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(campaignValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("campaigns").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(20);
    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      body: row.body,
      enabled: row.enabled,
      integration_id: row.integrationId ?? null,
    }));
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    title: v.string(),
    body: v.string(),
    integrationId: v.optional(v.id("integrationSettings")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    await ctx.db.insert("campaigns", {
      tenantId: args.tenantId,
      title: args.title.trim() || "In-app message",
      body: args.body.trim(),
      enabled: true,
      integrationId: args.integrationId,
    });
    return null;
  },
});

export const update = mutation({
  args: {
    tenantId: v.id("tenants"),
    campaignId: v.id("campaigns"),
    enabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    const row = await ctx.db.get(args.campaignId);
    if (!row || row.tenantId !== args.tenantId) throw new Error("Campaign not found");
    await ctx.db.patch(args.campaignId, { enabled: args.enabled ?? row.enabled });
    return null;
  },
});

export const remove = mutation({
  args: { tenantId: v.id("tenants"), campaignId: v.id("campaigns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    const row = await ctx.db.get(args.campaignId);
    if (!row || row.tenantId !== args.tenantId) return null;
    await ctx.db.delete(args.campaignId);
    return null;
  },
});
