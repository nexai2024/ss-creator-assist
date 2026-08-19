import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/auth";

const attachmentValidator = v.object({
  id: v.id("attachments"),
  file_name: v.string(),
  content_type: v.string(),
  size: v.number(),
  url: v.union(v.string(), v.null()),
  uploaded_by: v.union(v.string(), v.null()),
});

export const generateUploadUrl = mutation({
  args: { tenantId: v.id("tenants") },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: {
    tenantId: v.id("tenants"),
    entityType: v.union(v.literal("ticket"), v.literal("chat")),
    entityId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  returns: attachmentValidator,
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.tenantId);
    const user = await ctx.db.get(userId);
    if (args.entityType === "ticket") {
      const ticketId = ctx.db.normalizeId("tickets", args.entityId);
      const ticket = ticketId ? await ctx.db.get(ticketId) : null;
      if (!ticket || ticket.tenantId !== args.tenantId) throw new Error("Ticket not found");
    } else {
      const conversationId = ctx.db.normalizeId("chatConversations", args.entityId);
      const conv = conversationId ? await ctx.db.get(conversationId) : null;
      if (!conv || conv.tenantId !== args.tenantId) throw new Error("Conversation not found");
    }
    const id = await ctx.db.insert("attachments", {
      tenantId: args.tenantId,
      entityType: args.entityType,
      entityId: args.entityId,
      storageId: args.storageId,
      fileName: args.fileName.slice(0, 180),
      contentType: args.contentType.slice(0, 120),
      size: args.size,
      uploadedBy: user?.email ?? user?.name,
    });
    const url = await ctx.storage.getUrl(args.storageId);
    return {
      id,
      file_name: args.fileName.slice(0, 180),
      content_type: args.contentType,
      size: args.size,
      url,
      uploaded_by: user?.email ?? null,
    };
  },
});

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    entityType: v.union(v.literal("ticket"), v.literal("chat")),
    entityId: v.string(),
  },
  returns: v.array(attachmentValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db
      .query("attachments")
      .withIndex("by_entity", (q) => q.eq("entityType", args.entityType).eq("entityId", args.entityId))
      .take(40);
    const out = [];
    for (const row of rows) {
      if (row.tenantId !== args.tenantId) continue;
      out.push({
        id: row._id,
        file_name: row.fileName,
        content_type: row.contentType,
        size: row.size,
        url: await ctx.storage.getUrl(row.storageId),
        uploaded_by: row.uploadedBy ?? null,
      });
    }
    return out;
  },
});
