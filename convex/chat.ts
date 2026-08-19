import { v } from "convex/values";
import { mutation, query, internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireMember, writeAudit } from "./lib/auth";
import { classifyTicket, shapeConversation, shapeChatMessage, shapeTicket } from "./lib/shape";
import { encodeChatShare, excerptFrom } from "./lib/chatContent";
import { notifyTicketCreated } from "./lib/notifyTicket";
import { insertOpenTicket } from "./lib/insertTicket";
import { keywordArticles } from "./lib/retrieve";
import { chatMessageValidator, conversationValidator, ticketValidator } from "./lib/validators";

export const list = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(conversationValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db
      .query("chatConversations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(200);
    return rows.map(shapeConversation);
  },
});

export const messages = query({
  args: { tenantId: v.id("tenants"), conversationId: v.id("chatConversations") },
  returns: v.array(chatMessageValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.tenantId !== args.tenantId) return [];
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .take(400);
    return rows.map(shapeChatMessage);
  },
});

export const send = mutation({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("chatConversations"),
    content: v.string(),
    senderName: v.string(),
  },
  returns: chatMessageValidator,
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.tenantId !== args.tenantId) throw new Error("Conversation not found");
    const id = await ctx.db.insert("chatMessages", {
      conversationId: args.conversationId,
      senderType: "agent",
      senderName: args.senderName,
      content: args.content,
    });
    if (conv.status === "waiting") await ctx.db.patch(args.conversationId, { status: "active" });
    const msg = await ctx.db.get(id);
    return shapeChatMessage(msg!);
  },
});

export const close = mutation({
  args: { tenantId: v.id("tenants"), conversationId: v.id("chatConversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.tenantId !== args.tenantId) throw new Error("Conversation not found");
    await ctx.db.patch(args.conversationId, { status: "closed", closedAt: Date.now() });
    return null;
  },
});

export const assign = mutation({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("chatConversations"),
    agentId: v.id("agents"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.tenantId !== args.tenantId) throw new Error("Conversation not found");
    await ctx.db.patch(args.conversationId, { assignedAgentId: args.agentId });
    return null;
  },
});

export const addNote = mutation({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("chatConversations"),
    note: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.tenantId);
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "chat_internal_note",
      entityType: "chat_conversation",
      entityId: args.conversationId,
      details: args.note,
      userId,
    });
    return null;
  },
});

export const notes = query({
  args: { tenantId: v.id("tenants"), conversationId: v.id("chatConversations") },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const logs = await ctx.db.query("auditLog").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(200);
    return logs
      .filter((l) => l.action === "chat_internal_note" && l.entityId === args.conversationId)
      .map((l) => l.details ?? "");
  },
});

async function writeBotMessage(
  ctx: MutationCtx,
  args: { tenantId: Id<"tenants">; conversationId: Id<"chatConversations">; content: string },
) {
  const conv = await ctx.db.get(args.conversationId);
  if (!conv || conv.tenantId !== args.tenantId) throw new Error("Conversation not found");
  const id = await ctx.db.insert("chatMessages", {
    conversationId: args.conversationId,
    senderType: "bot" as const,
    senderName: "Webwi Assistant",
    content: args.content,
  });
  const msg = await ctx.db.get(id);
  return shapeChatMessage(msg!);
}

export const insertBotMessage = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("chatConversations"),
    content: v.string(),
  },
  returns: chatMessageValidator,
  handler: async (ctx, args) => {
    return await writeBotMessage(ctx, args);
  },
});

export const botReply = mutation({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("chatConversations"),
    message: v.string(),
  },
  returns: chatMessageValidator,
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    const matches = await keywordArticles(ctx, args.tenantId, args.message, 3);
    const match = matches[0];
    const content = match && tenant
      ? encodeChatShare({
        kind: "article",
        id: match._id,
        title: match.title,
        slug: match.slug,
        tenantSlug: tenant.slug,
        excerpt: excerptFrom(match.content),
      }, "I found an article that may help:")
      : "I could not find this in the published docs. An agent will follow up shortly.";
    return await writeBotMessage(ctx, {
      tenantId: args.tenantId,
      conversationId: args.conversationId,
      content,
    });
  },
});

export const escalate = mutation({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("chatConversations"),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    reason: v.string(),
  },
  returns: ticketValidator,
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.tenantId);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.tenantId !== args.tenantId) throw new Error("Conversation not found");
    const classified = classifyTicket(conv.customerName, args.reason);
    const ticketId = await insertOpenTicket(ctx, {
      tenantId: args.tenantId,
      subject: `Escalated from chat: ${conv.customerName}`,
      category: classified.category === "General" ? "Escalation" : classified.category,
      priority: args.priority,
      customerName: conv.customerName,
      customerEmail: conv.customerEmail,
      body: `Escalated from live chat. Reason: ${args.reason}. Conversation ID: ${args.conversationId}`,
      source: "chat",
      tags: ["escalated", "from-chat"],
    });
    await ctx.db.insert("chatMessages", {
      conversationId: args.conversationId,
      senderType: "agent",
      senderName: "System",
      content: encodeChatShare({
        kind: "ticket",
        id: ticketId,
        subject: `Escalated from chat: ${conv.customerName}`,
      }, "We've opened a support ticket so a specialist can follow up."),
    });
    if (conv.status === "waiting") {
      await ctx.db.patch(args.conversationId, { status: "active" });
    }
    await notifyTicketCreated(ctx, {
      tenantId: args.tenantId,
      ticketId,
      email: conv.customerEmail,
      customerName: conv.customerName,
      subject: `Escalated from chat: ${conv.customerName}`,
    });
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "chat_escalated",
      entityType: "chat_conversation",
      entityId: args.conversationId,
      details: `Escalated to ticket ${ticketId}`,
      userId,
    });
    const ticket = await ctx.db.get(ticketId);
    return shapeTicket(ticket!);
  },
});
