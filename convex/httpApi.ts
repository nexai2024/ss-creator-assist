import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { classifyTicket, shapeTicket, shapeTicketMessage, slaHours } from "./lib/shape";
import { applyRouting } from "./lib/routing";
import { consumeRateLimit } from "./lib/rateLimit";
import { notifyTicketCreated } from "./lib/notifyTicket";
import { sha256Hex } from "./lib/secrets";
import { ticketMessageValidator, ticketValidator } from "./lib/validators";
import type { Id } from "./_generated/dataModel";

export const lookupIntegration = internalQuery({
  args: { apiKey: v.string(), tenantId: v.string() },
  returns: v.union(
    v.object({
      id: v.id("integrationSettings"),
      tenantId: v.id("tenants"),
      status: v.union(v.literal("active"), v.literal("inactive"), v.literal("draft")),
      customDomain: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const hash = await sha256Hex(args.apiKey);
    let row = await ctx.db
      .query("integrationSettings")
      .withIndex("by_api_key_hash", (q) => q.eq("apiKeyHash", hash))
      .first();
    if (!row) {
      row = await ctx.db
        .query("integrationSettings")
        .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
        .first();
    }
    if (!row || row.tenantId !== args.tenantId) return null;
    return {
      id: row._id,
      tenantId: row.tenantId,
      status: row.status,
      customDomain: row.customDomain ?? null,
    };
  },
});

export const consumeLimit = internalMutation({
  args: { key: v.string(), limit: v.number(), windowMs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await consumeRateLimit(ctx, args.key, args.limit, args.windowMs);
    return null;
  },
});

export const listTickets = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.array(ticketValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("tickets").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(50);
    return rows.map(shapeTicket);
  },
});

export const getTicket = internalQuery({
  args: { tenantId: v.id("tenants"), ticketId: v.id("tickets") },
  returns: v.union(
    v.object({ ticket: ticketValidator, messages: v.array(ticketMessageValidator) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.tenantId !== args.tenantId) return null;
    const messages = await ctx.db.query("ticketMessages").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).take(200);
    return { ticket: shapeTicket(ticket), messages: messages.map(shapeTicketMessage) };
  },
});

export const createTicket = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    subject: v.string(),
    category: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    customerName: v.string(),
    customerEmail: v.string(),
    body: v.optional(v.string()),
  },
  returns: ticketValidator,
  handler: async (ctx, args) => {
    const classified = classifyTicket(args.subject, args.body ?? "");
    const category = args.category || classified.category;
    const priority = args.priority ?? "medium";
    const ticketId = await ctx.db.insert("tickets", {
      tenantId: args.tenantId,
      subject: args.subject,
      category,
      priority,
      status: "open",
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      deflectionSuggested: classified.deflectionSuggested,
      customFields: {},
      tags: ["api"],
      slaDeadline: Date.now() + slaHours(priority) * 3600000,
    });
    if (args.body) {
      await ctx.db.insert("ticketMessages", {
        ticketId,
        senderType: "end_user",
        senderName: args.customerName,
        content: args.body,
      });
    }
    await applyRouting(ctx, args.tenantId, ticketId, args.subject, category, priority);
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
      payload: JSON.stringify({
        event: "TicketCreated",
        ticket_id: ticketId,
        subject: args.subject,
        priority,
        category,
      }),
    });
    const ticket = await ctx.db.get(ticketId);
    return shapeTicket(ticket!);
  },
});

export function asTenantId(id: string): Id<"tenants"> {
  return id as Id<"tenants">;
}

export function asTicketId(id: string): Id<"tickets"> {
  return id as Id<"tickets">;
}
