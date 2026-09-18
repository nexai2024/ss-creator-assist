import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { insertOpenTicket } from "./lib/insertTicket";
import { notifyTicketCreated } from "./lib/notifyTicket";
import { normalizeEmail } from "./lib/hosts";
import { shapeTicket } from "./lib/shape";
import { ticketValidator } from "./lib/validators";

export const createFromEmail = internalMutation({
  args: {
    to: v.string(),
    from: v.string(),
    fromName: v.optional(v.string()),
    subject: v.string(),
    text: v.string(),
    messageId: v.optional(v.string()),
  },
  returns: v.union(ticketValidator, v.null()),
  handler: async (ctx, args) => {
    const address = normalizeEmail(args.to);
    const integration = await ctx.db
      .query("integrationSettings")
      .withIndex("by_inbound_email", (q) => q.eq("inboundEmailAddress", address))
      .first();
    if (!integration || integration.status === "inactive") return null;
    if (args.messageId) {
      const dup = await ctx.db
        .query("tickets")
        .withIndex("by_inbound_message", (q) => q.eq("inboundMessageId", args.messageId))
        .first();
      if (dup) return shapeTicket(dup);
    }
    const fromEmail = normalizeEmail(args.from);
    const fromName = args.fromName?.trim() || fromEmail.split("@")[0] || "Email customer";
    const ticketId = await insertOpenTicket(ctx, {
      tenantId: integration.tenantId,
      subject: args.subject.trim() || "(no subject)",
      customerName: fromName,
      customerEmail: fromEmail,
      body: args.text.trim() || args.subject,
      source: "email",
      tags: ["email"],
      inboundMessageId: args.messageId,
    });
    await notifyTicketCreated(ctx, {
      tenantId: integration.tenantId,
      ticketId,
      email: fromEmail,
      customerName: fromName,
      subject: args.subject.trim() || "(no subject)",
    });
    const ticket = await ctx.db.get(ticketId);
    return ticket ? shapeTicket(ticket) : null;
  },
});

export const createFromSocial = internalMutation({
  args: {
    channel: v.union(v.literal("whatsapp"), v.literal("instagram")),
    senderId: v.string(),
    senderName: v.optional(v.string()),
    text: v.string(),
    phoneNumberId: v.optional(v.string()),
    accountId: v.optional(v.string()),
  },
  returns: v.union(ticketValidator, v.null()),
  handler: async (ctx, args) => {
    let integration = null;
    if (args.channel === "whatsapp" && args.phoneNumberId) {
      const rows = await ctx.db.query("integrationSettings").take(100);
      integration = rows.find((r) => r.status === "active" && r.whatsappPhoneNumberId === args.phoneNumberId) ?? null;
    } else if (args.channel === "instagram" && args.accountId) {
      const rows = await ctx.db.query("integrationSettings").take(100);
      integration = rows.find((r) => r.status === "active" && r.instagramAccountId === args.accountId) ?? null;
    }
    if (!integration) {
      const rows = await ctx.db.query("integrationSettings").take(10);
      integration = rows.find((r) => r.status === "active") ?? null;
    }
    if (!integration) return null;

    const customerEmail = `${args.channel}_${args.senderId}@messaging.social`;
    const customerName = args.senderName?.trim() || `${args.channel.toUpperCase()} User (${args.senderId})`;
    const subject = `${args.channel.toUpperCase()} message from ${customerName}`;

    const ticketId = await insertOpenTicket(ctx, {
      tenantId: integration.tenantId,
      subject,
      customerName,
      customerEmail,
      body: args.text,
      source: args.channel,
      tags: [args.channel, "social"],
    });

    const ticket = await ctx.db.get(ticketId);
    return ticket ? shapeTicket(ticket) : null;
  },
});
