import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember, writeAudit } from "./lib/auth";
import { shapeAudit } from "./lib/shape";
import { auditValidator, gdprRequestValidator } from "./lib/validators";

export const list = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(gdprRequestValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("gdprRequests").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(100);
    return rows.map((r) => ({
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
    }));
  },
});

export const audit = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(auditValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("auditLog").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(50);
    return rows.filter((r) => r.action.startsWith("gdpr")).map(shapeAudit);
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.tenantId);
    const id = await ctx.db.insert("gdprRequests", {
      tenantId: args.tenantId,
      subjectType: "customer",
      externalUserId: args.email,
      userEmail: args.email.toLowerCase(),
      reason: args.reason,
      status: "processing",
    });
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "gdpr_erasure_requested",
      entityType: "gdpr_requests",
      entityId: id,
      details: `GDPR erasure request for ${args.email}`,
      userId,
    });
    return null;
  },
});

export const execute = mutation({
  args: { tenantId: v.id("tenants"), requestId: v.id("gdprRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.tenantId);
    const req = await ctx.db.get(args.requestId);
    if (!req || req.tenantId !== args.tenantId) throw new Error("Request not found");
    const email = req.userEmail.toLowerCase();

    const tickets = await ctx.db.query("tickets").withIndex("by_tenant_and_email", (q) => q.eq("tenantId", args.tenantId).eq("customerEmail", email)).take(200);
    for (const t of tickets) {
      const msgs = await ctx.db.query("ticketMessages").withIndex("by_ticket", (q) => q.eq("ticketId", t._id)).take(200);
      for (const m of msgs) await ctx.db.delete(m._id);
      const fbs = await ctx.db.query("ticketFeedback").withIndex("by_ticket", (q) => q.eq("ticketId", t._id)).take(50);
      for (const f of fbs) await ctx.db.delete(f._id);
      await ctx.db.delete(t._id);
    }

    const chats = await ctx.db.query("chatConversations").withIndex("by_tenant_and_email", (q) => q.eq("tenantId", args.tenantId).eq("customerEmail", email)).take(200);
    for (const c of chats) {
      const msgs = await ctx.db.query("chatMessages").withIndex("by_conversation", (q) => q.eq("conversationId", c._id)).take(400);
      for (const m of msgs) await ctx.db.delete(m._id);
      await ctx.db.delete(c._id);
    }

    const profile = await ctx.db.query("customerProfiles").withIndex("by_tenant_and_email", (q) => q.eq("tenantId", args.tenantId).eq("customerEmail", email)).unique();
    if (profile) await ctx.db.delete(profile._id);

    await ctx.db.patch(args.requestId, { status: "completed", completedAt: Date.now() });
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "gdpr_erasure_completed",
      entityType: "gdpr_requests",
      entityId: args.requestId,
      details: `Erased data for ${email}`,
      userId,
    });
    return null;
  },
});
