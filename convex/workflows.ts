import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember, requirePermission } from "./lib/auth";

const stepValidator = v.object({
  type: v.union(
    v.literal("assign_agent"),
    v.literal("set_priority"),
    v.literal("add_tag"),
    v.literal("set_status"),
  ),
  value: v.string(),
});

const workflowValidator = v.object({
  id: v.id("workflows"),
  name: v.string(),
  trigger: v.union(v.literal("ticket_created"), v.literal("status_changed")),
  enabled: v.boolean(),
  steps: v.array(stepValidator),
});

export const list = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(workflowValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("workflows").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(50);
    return rows.map((row) => ({
      id: row._id,
      name: row.name,
      trigger: row.trigger,
      enabled: row.enabled,
      steps: row.steps,
    }));
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    trigger: v.union(v.literal("ticket_created"), v.literal("status_changed")),
    steps: v.array(stepValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    await ctx.db.insert("workflows", {
      tenantId: args.tenantId,
      name: args.name.trim() || "Untitled workflow",
      trigger: args.trigger,
      enabled: true,
      steps: args.steps.slice(0, 8),
    });
    return null;
  },
});

export const update = mutation({
  args: {
    tenantId: v.id("tenants"),
    workflowId: v.id("workflows"),
    enabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    const row = await ctx.db.get(args.workflowId);
    if (!row || row.tenantId !== args.tenantId) throw new Error("Workflow not found");
    await ctx.db.patch(args.workflowId, {
      enabled: args.enabled ?? row.enabled,
    });
    return null;
  },
});

export const remove = mutation({
  args: { tenantId: v.id("tenants"), workflowId: v.id("workflows") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin", "manager"]);
    const row = await ctx.db.get(args.workflowId);
    if (!row || row.tenantId !== args.tenantId) return null;
    await ctx.db.delete(args.workflowId);
    return null;
  },
});
