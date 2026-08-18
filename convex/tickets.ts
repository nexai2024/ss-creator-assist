import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCapability, requireMember, writeAudit } from "./lib/auth";
import { applyRouting } from "./lib/routing";
import { notifyTicketCreated, notifyTicketReply } from "./lib/notifyTicket";
import { classifyTicket, shapeTicket, shapeTicketMessage, slaHours } from "./lib/shape";
import { paginationResult, ticketMessageValidator, ticketValidator } from "./lib/validators";

export const list = query({
  args: { tenantId: v.id("tenants"), paginationOpts: paginationOptsValidator },
  returns: paginationResult(ticketValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const result = await ctx.db
      .query("tickets")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(shapeTicket) };
  },
});

export const get = query({
  args: { tenantId: v.id("tenants"), ticketId: v.id("tickets") },
  returns: v.union(ticketValidator, v.null()),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.tenantId !== args.tenantId) return null;
    return shapeTicket(ticket);
  },
});

export const messages = query({
  args: { tenantId: v.id("tenants"), ticketId: v.id("tickets") },
  returns: v.array(ticketMessageValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.tenantId !== args.tenantId) return [];
    const rows = await ctx.db
      .query("ticketMessages")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .take(200);
    return rows.map(shapeTicketMessage);
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    subject: v.string(),
    category: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    customerName: v.string(),
    customerEmail: v.string(),
    body: v.optional(v.string()),
  },
  returns: ticketValidator,
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.tenantId);
    const classified = classifyTicket(args.subject, args.body ?? "");
    const category = args.category || classified.category;
    const ticketId = await ctx.db.insert("tickets", {
      tenantId: args.tenantId,
      subject: args.subject,
      category,
      priority: args.priority,
      status: "open",
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      deflectionSuggested: classified.deflectionSuggested,
      customFields: {},
      tags: [],
      slaDeadline: Date.now() + slaHours(args.priority) * 3600000,
    });
    if (args.body) {
      await ctx.db.insert("ticketMessages", {
        ticketId,
        senderType: "end_user",
        senderName: args.customerName,
        content: args.body,
      });
    }
    await applyRouting(ctx, args.tenantId, ticketId, args.subject, category, args.priority);
    await notifyTicketCreated(ctx, {
      tenantId: args.tenantId,
      ticketId,
      email: args.customerEmail,
      customerName: args.customerName,
      subject: args.subject,
    });
    await ctx.scheduler.runAfter(0, internal.webhooks.deliver, {
      tenantId: args.tenantId,
      eventType: "TicketCreated",
      payload: JSON.stringify({ event: "TicketCreated", ticket_id: ticketId, subject: args.subject }),
    });
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "ticket_created",
      entityType: "ticket",
      entityId: ticketId,
      details: `New ticket: ${args.subject}`,
      userId,
    });
    const ticket = await ctx.db.get(ticketId);
    return shapeTicket(ticket!);
  },
});

export const addMessage = mutation({
  args: {
    tenantId: v.id("tenants"),
    ticketId: v.id("tickets"),
    content: v.string(),
    senderName: v.string(),
  },
  returns: ticketMessageValidator,
  handler: async (ctx, args) => {
    const { userId } = await requireCapability(ctx, args.tenantId, "tickets:reply");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.tenantId !== args.tenantId) throw new Error("Ticket not found");
    const id = await ctx.db.insert("ticketMessages", {
      ticketId: args.ticketId,
      senderType: "agent",
      senderName: args.senderName,
      content: args.content,
    });
    await notifyTicketReply(ctx, {
      tenantId: args.tenantId,
      ticketId: args.ticketId,
      email: ticket.customerEmail,
      senderName: args.senderName,
      subject: ticket.subject,
      content: args.content,
    });
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "ticket_replied",
      entityType: "ticket",
      entityId: args.ticketId,
      userId,
    });
    const msg = await ctx.db.get(id);
    return shapeTicketMessage(msg!);
  },
});

export const updateStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    ticketId: v.id("tickets"),
    status: v.union(v.literal("open"), v.literal("pending"), v.literal("resolved"), v.literal("closed")),
  },
  returns: ticketValidator,
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.tenantId !== args.tenantId) throw new Error("Ticket not found");
    await ctx.db.patch(args.ticketId, {
      status: args.status,
      resolvedAt: args.status === "resolved" || args.status === "closed" ? Date.now() : ticket.resolvedAt,
    });
    const updated = await ctx.db.get(args.ticketId);
    return shapeTicket(updated!);
  },
});

export const assign = mutation({
  args: {
    tenantId: v.id("tenants"),
    ticketId: v.id("tickets"),
    agentId: v.union(v.id("agents"), v.null()),
  },
  returns: ticketValidator,
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.tenantId !== args.tenantId) throw new Error("Ticket not found");
    await ctx.db.patch(args.ticketId, { assignedAgentId: args.agentId ?? undefined });
    const updated = await ctx.db.get(args.ticketId);
    return shapeTicket(updated!);
  },
});

export const feedback = query({
  args: { tenantId: v.id("tenants"), ticketId: v.id("tickets") },
  returns: v.union(
    v.object({
      id: v.id("ticketFeedback"),
      ticket_id: v.id("tickets"),
      rating: v.number(),
      comment: v.union(v.string(), v.null()),
      created_at: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const row = await ctx.db.query("ticketFeedback").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).first();
    if (!row) return null;
    return {
      id: row._id,
      ticket_id: row.ticketId,
      rating: row.rating,
      comment: row.comment ?? null,
      created_at: new Date(row._creationTime).toISOString(),
    };
  },
});

export const submitCsat = mutation({
  args: {
    tenantId: v.id("tenants"),
    ticketId: v.id("tickets"),
    rating: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.tenantId !== args.tenantId) throw new Error("Ticket not found");
    await ctx.db.insert("ticketFeedback", { ticketId: args.ticketId, rating: args.rating });
    await ctx.db.patch(args.ticketId, { csatScore: args.rating });
    return null;
  },
});

export const recordFinance = mutation({
  args: {
    tenantId: v.id("tenants"),
    ticketId: v.id("tickets"),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireCapability(ctx, args.tenantId, "finance:refund");
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "finance_refund",
      entityType: "ticket",
      entityId: args.ticketId,
      details: `Refund ${args.amount} recorded. ${args.note ?? ""}`,
      userId,
    });
    return null;
  },
});

export const remove = mutation({
  args: { tenantId: v.id("tenants"), ticketId: v.id("tickets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.tenantId, "tickets:delete");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.tenantId !== args.tenantId) throw new Error("Ticket not found");
    const msgs = await ctx.db.query("ticketMessages").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).take(200);
    for (const m of msgs) await ctx.db.delete(m._id);
    const fbs = await ctx.db.query("ticketFeedback").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).take(50);
    for (const f of fbs) await ctx.db.delete(f._id);
    await ctx.db.delete(args.ticketId);
    return null;
  },
});

