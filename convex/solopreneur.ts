import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { iso, isoReq } from "./lib/shape";

const savedReplyValidator = v.object({
  id: v.id("savedReplies"),
  tenant_id: v.id("tenants"),
  title: v.string(),
  content: v.string(),
  category: v.string(),
  shortcut: v.union(v.string(), v.null()),
  usage_count: v.number(),
  created_at: v.string(),
  updated_at: v.string(),
});

const profileValidator = v.object({
  id: v.id("customerProfiles"),
  tenant_id: v.id("tenants"),
  customer_email: v.string(),
  customer_name: v.union(v.string(), v.null()),
  is_vip: v.boolean(),
  personal_notes: v.union(v.string(), v.null()),
  lifetime_value: v.number(),
  total_tickets: v.number(),
  last_contact_at: v.union(v.string(), v.null()),
  created_at: v.string(),
  updated_at: v.string(),
});

export const savedReplies = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(savedReplyValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("savedReplies").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    return rows.map((r) => ({
      id: r._id,
      tenant_id: r.tenantId,
      title: r.title,
      content: r.content,
      category: r.category,
      shortcut: r.shortcut ?? null,
      usage_count: r.usageCount,
      created_at: isoReq(r._creationTime),
      updated_at: isoReq(r.updatedAt),
    }));
  },
});

export const createReply = mutation({
  args: {
    tenantId: v.id("tenants"),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    shortcut: v.optional(v.string()),
  },
  returns: v.id("savedReplies"),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const id = await ctx.db.insert("savedReplies", {
      tenantId: args.tenantId,
      title: args.title,
      content: args.content,
      category: args.category,
      shortcut: args.shortcut,
      usageCount: 0,
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const updateReply = mutation({
  args: {
    tenantId: v.id("tenants"),
    replyId: v.id("savedReplies"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db.get(args.replyId);
    if (!row || row.tenantId !== args.tenantId) throw new Error("Reply not found");
    await ctx.db.patch(args.replyId, {
      title: args.title ?? row.title,
      content: args.content ?? row.content,
      category: args.category ?? row.category,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const removeReply = mutation({
  args: { tenantId: v.id("tenants"), replyId: v.id("savedReplies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db.get(args.replyId);
    if (row && row.tenantId === args.tenantId) await ctx.db.delete(args.replyId);
    return null;
  },
});

export const incrementReply = mutation({
  args: { tenantId: v.id("tenants"), replyId: v.id("savedReplies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db.get(args.replyId);
    if (row && row.tenantId === args.tenantId) await ctx.db.patch(args.replyId, { usageCount: row.usageCount + 1 });
    return null;
  },
});

export const profile = query({
  args: { tenantId: v.id("tenants"), email: v.string() },
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db
      .query("customerProfiles")
      .withIndex("by_tenant_and_email", (q) => q.eq("tenantId", args.tenantId).eq("customerEmail", args.email))
      .unique();
    if (!row) return null;
    return {
      id: row._id,
      tenant_id: row.tenantId,
      customer_email: row.customerEmail,
      customer_name: row.customerName ?? null,
      is_vip: row.isVip,
      personal_notes: row.personalNotes ?? null,
      lifetime_value: row.lifetimeValue,
      total_tickets: row.totalTickets,
      last_contact_at: iso(row.lastContactAt),
      created_at: isoReq(row._creationTime),
      updated_at: isoReq(row.updatedAt),
    };
  },
});

export const upsertProfile = mutation({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    customerName: v.optional(v.string()),
    isVip: v.optional(v.boolean()),
    personalNotes: v.optional(v.string()),
    lifetimeValue: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const existing = await ctx.db
      .query("customerProfiles")
      .withIndex("by_tenant_and_email", (q) => q.eq("tenantId", args.tenantId).eq("customerEmail", args.email))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        customerName: args.customerName ?? existing.customerName,
        isVip: args.isVip ?? existing.isVip,
        personalNotes: args.personalNotes ?? existing.personalNotes,
        lifetimeValue: args.lifetimeValue ?? existing.lifetimeValue,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("customerProfiles", {
        tenantId: args.tenantId,
        customerEmail: args.email,
        customerName: args.customerName,
        isVip: args.isVip ?? false,
        personalNotes: args.personalNotes,
        lifetimeValue: args.lifetimeValue ?? 0,
        totalTickets: 0,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const timeEntries = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(v.object({
    id: v.id("timeEntries"),
    tenant_id: v.id("tenants"),
    entity_type: v.union(v.literal("ticket"), v.literal("chat")),
    entity_id: v.string(),
    minutes: v.number(),
    description: v.union(v.string(), v.null()),
    billable: v.boolean(),
    created_at: v.string(),
  })),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("timeEntries").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(200);
    return rows.map((r) => ({
      id: r._id,
      tenant_id: r.tenantId,
      entity_type: r.entityType,
      entity_id: r.entityId,
      minutes: r.minutes,
      description: r.description ?? null,
      billable: r.billable,
      created_at: isoReq(r._creationTime),
    }));
  },
});

export const addTime = mutation({
  args: {
    tenantId: v.id("tenants"),
    entityType: v.union(v.literal("ticket"), v.literal("chat")),
    entityId: v.string(),
    minutes: v.number(),
    description: v.optional(v.string()),
    billable: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    await ctx.db.insert("timeEntries", {
      tenantId: args.tenantId,
      entityType: args.entityType,
      entityId: args.entityId,
      minutes: args.minutes,
      description: args.description,
      billable: args.billable ?? false,
    });
    return null;
  },
});

export const followUps = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(v.object({
    id: v.id("followUps"),
    tenant_id: v.id("tenants"),
    entity_type: v.union(v.literal("ticket"), v.literal("chat")),
    entity_id: v.string(),
    customer_email: v.string(),
    customer_name: v.union(v.string(), v.null()),
    reminder_at: v.string(),
    completed: v.boolean(),
    note: v.union(v.string(), v.null()),
    created_at: v.string(),
  })),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("followUps").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(200);
    return rows.map((r) => ({
      id: r._id,
      tenant_id: r.tenantId,
      entity_type: r.entityType,
      entity_id: r.entityId,
      customer_email: r.customerEmail,
      customer_name: r.customerName ?? null,
      reminder_at: isoReq(r.reminderAt),
      completed: r.completed,
      note: r.note ?? null,
      created_at: isoReq(r._creationTime),
    }));
  },
});

export const createFollowUp = mutation({
  args: {
    tenantId: v.id("tenants"),
    entityType: v.union(v.literal("ticket"), v.literal("chat")),
    entityId: v.string(),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    reminderAt: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    await ctx.db.insert("followUps", {
      tenantId: args.tenantId,
      entityType: args.entityType,
      entityId: args.entityId,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      reminderAt: args.reminderAt,
      completed: false,
      note: args.note,
    });
    return null;
  },
});

export const removeFollowUp = mutation({
  args: { tenantId: v.id("tenants"), followUpId: v.id("followUps") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db.get(args.followUpId);
    if (row && row.tenantId === args.tenantId) await ctx.db.delete(args.followUpId);
    return null;
  },
});

export const updateHour = mutation({
  args: {
    tenantId: v.id("tenants"),
    hourId: v.id("businessHours"),
    isWorkingDay: v.optional(v.boolean()),
    openTime: v.optional(v.string()),
    closeTime: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db.get(args.hourId);
    if (!row || row.tenantId !== args.tenantId) throw new Error("Hours not found");
    await ctx.db.patch(args.hourId, {
      isWorkingDay: args.isWorkingDay ?? row.isWorkingDay,
      openTime: args.openTime ?? row.openTime,
      closeTime: args.closeTime ?? row.closeTime,
      timezone: args.timezone ?? row.timezone,
    });
    return null;
  },
});

export const completeFollowUp = mutation({
  args: { tenantId: v.id("tenants"), followUpId: v.id("followUps") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db.get(args.followUpId);
    if (row && row.tenantId === args.tenantId) await ctx.db.patch(args.followUpId, { completed: true });
    return null;
  },
});

export const hours = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(v.object({
    id: v.id("businessHours"),
    tenant_id: v.id("tenants"),
    day_of_week: v.number(),
    is_working_day: v.boolean(),
    open_time: v.string(),
    close_time: v.string(),
    timezone: v.string(),
  })),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("businessHours").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(7);
    return rows.map((r) => ({
      id: r._id,
      tenant_id: r.tenantId,
      day_of_week: r.dayOfWeek,
      is_working_day: r.isWorkingDay,
      open_time: r.openTime,
      close_time: r.closeTime,
      timezone: r.timezone,
    }));
  },
});

export const saveHours = mutation({
  args: {
    tenantId: v.id("tenants"),
    days: v.array(v.object({
      dayOfWeek: v.number(),
      isWorkingDay: v.boolean(),
      openTime: v.string(),
      closeTime: v.string(),
      timezone: v.string(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const existing = await ctx.db.query("businessHours").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(7);
    for (const row of existing) await ctx.db.delete(row._id);
    for (const day of args.days) {
      await ctx.db.insert("businessHours", { tenantId: args.tenantId, ...day });
    }
    return null;
  },
});

export const solo = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    solo_mode: v.boolean(),
    auto_responder_enabled: v.boolean(),
    auto_responder_message: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db.query("soloSettings").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).unique();
    return row
      ? { solo_mode: row.soloMode, auto_responder_enabled: row.autoResponderEnabled, auto_responder_message: row.autoResponderMessage }
      : { solo_mode: false, auto_responder_enabled: false, auto_responder_message: "We're away right now. We'll reply during business hours." };
  },
});

export const saveSolo = mutation({
  args: {
    tenantId: v.id("tenants"),
    soloMode: v.optional(v.boolean()),
    autoResponderEnabled: v.optional(v.boolean()),
    autoResponderMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const existing = await ctx.db.query("soloSettings").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        soloMode: args.soloMode ?? existing.soloMode,
        autoResponderEnabled: args.autoResponderEnabled ?? existing.autoResponderEnabled,
        autoResponderMessage: args.autoResponderMessage ?? existing.autoResponderMessage,
      });
    } else {
      await ctx.db.insert("soloSettings", {
        tenantId: args.tenantId,
        soloMode: args.soloMode ?? false,
        autoResponderEnabled: args.autoResponderEnabled ?? false,
        autoResponderMessage: args.autoResponderMessage ?? "We're away right now.",
      });
    }
    return null;
  },
});
