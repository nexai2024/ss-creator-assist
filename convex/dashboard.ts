import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { shapeArticle, shapeAudit, shapeConversation, shapeTicket } from "./lib/shape";
import { articleValidator, auditValidator, conversationValidator, gdprRequestValidator, ticketValidator } from "./lib/validators";

export const snapshot = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    tickets: v.array(ticketValidator),
    chatConversations: v.array(conversationValidator),
    kbArticles: v.array(articleValidator),
    gdprRequests: v.array(gdprRequestValidator),
    auditLog: v.array(auditValidator),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const tickets = await ctx.db.query("tickets").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(200);
    const chats = await ctx.db.query("chatConversations").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(200);
    const articles = await ctx.db.query("kbArticles").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    const gdpr = await ctx.db.query("gdprRequests").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(50);
    const audit = await ctx.db.query("auditLog").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(20);
    return {
      tickets: tickets.map(shapeTicket),
      chatConversations: chats.map(shapeConversation),
      kbArticles: articles.map(shapeArticle),
      gdprRequests: gdpr.map((r) => ({
        id: r._id,
        tenant_id: r.tenantId,
        subject_type: r.subjectType,
        external_user_id: r.externalUserId,
        user_email: r.userEmail,
        reason: r.reason,
        status: r.status,
        job_id: r.jobId ?? null,
        created_at: new Date(r._creationTime).toISOString(),
        completed_at: r.completedAt ? new Date(r.completedAt).toISOString() : null,
      })),
      auditLog: audit.map(shapeAudit),
    };
  },
});

export const inbox = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    tickets: v.array(ticketValidator),
    chats: v.array(conversationValidator),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const tickets = await ctx.db.query("tickets").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(50);
    const chats = await ctx.db.query("chatConversations").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(50);
    return { tickets: tickets.map(shapeTicket), chats: chats.map(shapeConversation) };
  },
});

export const customerHistory = query({
  args: { tenantId: v.id("tenants"), email: v.string() },
  returns: v.object({
    tickets: v.array(ticketValidator),
    chats: v.array(conversationValidator),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const tickets = await ctx.db.query("tickets").withIndex("by_tenant_and_email", (q) => q.eq("tenantId", args.tenantId).eq("customerEmail", args.email)).take(50);
    const chats = await ctx.db.query("chatConversations").withIndex("by_tenant_and_email", (q) => q.eq("tenantId", args.tenantId).eq("customerEmail", args.email)).take(50);
    return { tickets: tickets.map(shapeTicket), chats: chats.map(shapeConversation) };
  },
});

export const billingAudit = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(auditValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("auditLog").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(50);
    return rows.filter((r) => r.action.startsWith("billing")).map(shapeAudit);
  },
});
