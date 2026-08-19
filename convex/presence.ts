import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/auth";

const STALE_MS = 20_000;

export const heartbeat = mutation({
  args: {
    tenantId: v.id("tenants"),
    entityType: v.union(v.literal("ticket"), v.literal("chat")),
    entityId: v.string(),
    typing: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.tenantId);
    const user = await ctx.db.get(userId);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_entity", (q) =>
        q.eq("tenantId", args.tenantId).eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .take(20);
    const mine = existing.find((row) => row.userId === userId);
    const displayName = user?.name || user?.email || "Agent";
    if (mine) {
      await ctx.db.patch(mine._id, { typing: args.typing, lastSeenAt: Date.now(), displayName });
    } else {
      await ctx.db.insert("presence", {
        tenantId: args.tenantId,
        userId,
        displayName,
        entityType: args.entityType,
        entityId: args.entityId,
        typing: args.typing,
        lastSeenAt: Date.now(),
      });
    }
    return null;
  },
});

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    entityType: v.union(v.literal("ticket"), v.literal("chat")),
    entityId: v.string(),
    now: v.number(),
  },
  returns: v.array(v.object({
    user_id: v.id("users"),
    display_name: v.string(),
    typing: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.tenantId);
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_entity", (q) =>
        q.eq("tenantId", args.tenantId).eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .take(20);
    return rows
      .filter((row) => row.userId !== userId && args.now - row.lastSeenAt < STALE_MS)
      .map((row) => ({
        user_id: row.userId,
        display_name: row.displayName,
        typing: row.typing,
      }));
  },
});
