import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isoReq, shapeArticle, shapeChatMessage } from "./lib/shape";
import { consumeRateLimit } from "./lib/rateLimit";
import { notifyTicketCreated } from "./lib/notifyTicket";
import { insertOpenTicket } from "./lib/insertTicket";
import { searchArticles } from "./lib/retrieve";
import { normalizeHost } from "./lib/hosts";
import { articleValidator, chatMessageValidator } from "./lib/validators";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const helpCenter = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      tenant: v.object({ id: v.id("tenants"), name: v.string(), slug: v.string() }),
      branding: v.object({
        logo_url: v.union(v.string(), v.null()),
        primary_color: v.string(),
        help_center_subdomain: v.union(v.string(), v.null()),
      }),
      articles: v.array(v.object({
        id: v.id("kbArticles"),
        title: v.string(),
        slug: v.string(),
        content: v.string(),
        category_id: v.union(v.id("kbCategories"), v.null()),
        views: v.number(),
        helpful_votes: v.number(),
        updated_at: v.string(),
      })),
      categories: v.array(v.object({
        id: v.id("kbCategories"),
        name: v.string(),
        slug: v.string(),
        description: v.union(v.string(), v.null()),
      })),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    if (!tenant) return null;
    const articles = await ctx.db
      .query("kbArticles")
      .withIndex("by_tenant_and_status", (q) => q.eq("tenantId", tenant._id).eq("status", "published"))
      .take(100);
    const categories = await ctx.db.query("kbCategories").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).take(50);
    const integration = await ctx.db.query("integrationSettings").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).first();
    return {
      tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug },
      branding: {
        logo_url: integration?.brandingLogoUrl ?? null,
        primary_color: integration?.brandingPrimaryColor ?? "#3b82f6",
        help_center_subdomain: integration?.helpCenterSubdomain ?? null,
      },
      articles: articles.map((a) => ({
        id: a._id,
        title: a.title,
        slug: a.slug,
        content: a.content,
        category_id: a.categoryId ?? null,
        views: a.views,
        helpful_votes: a.helpfulVotes,
        updated_at: new Date(a.updatedAt).toISOString(),
      })),
      categories: categories.map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
      })),
    };
  },
});

export const helpCenterByHost = query({
  args: { host: v.string() },
  returns: v.union(
    v.object({
      slug: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const host = normalizeHost(args.host);
    if (!host) return null;
    const integration = await ctx.db
      .query("integrationSettings")
      .withIndex("by_custom_domain", (q) => q.eq("customDomain", host))
      .first();
    if (!integration || integration.status === "inactive") return null;
    const tenant = await ctx.db.get(integration.tenantId);
    return tenant ? { slug: tenant.slug } : null;
  },
});

export const searchArticlesPublic = query({
  args: { slug: v.string(), needle: v.string() },
  returns: v.array(v.object({
    id: v.id("kbArticles"),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    category_id: v.union(v.id("kbCategories"), v.null()),
    views: v.number(),
    helpful_votes: v.number(),
    updated_at: v.string(),
  })),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    if (!tenant) return [];
    const rows = await searchArticles(ctx, tenant._id, args.needle, "published", 20);
    return rows.map((a) => ({
      id: a._id,
      title: a.title,
      slug: a.slug,
      content: a.content,
      category_id: a.categoryId ?? null,
      views: a.views,
      helpful_votes: a.helpfulVotes,
      updated_at: new Date(a.updatedAt).toISOString(),
    }));
  },
});

export const article = mutation({
  args: { tenantSlug: v.string(), articleSlug: v.string() },
  returns: v.union(
    v.object({
      id: v.id("kbArticles"),
      title: v.string(),
      slug: v.string(),
      content: v.string(),
      views: v.number(),
      helpful_votes: v.number(),
      unhelpful_votes: v.number(),
      updated_at: v.string(),
      category: v.union(v.object({ id: v.id("kbCategories"), name: v.string() }), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug)).unique();
    if (!tenant) return null;
    const row = await ctx.db
      .query("kbArticles")
      .withIndex("by_tenant_and_slug", (q) => q.eq("tenantId", tenant._id).eq("slug", args.articleSlug))
      .unique();
    if (!row || row.status !== "published") return null;
    await ctx.db.patch(row._id, { views: row.views + 1 });
    const category = row.categoryId ? await ctx.db.get(row.categoryId) : null;
    return {
      id: row._id,
      title: row.title,
      slug: row.slug,
      content: row.content,
      views: row.views + 1,
      helpful_votes: row.helpfulVotes,
      unhelpful_votes: row.unhelpfulVotes,
      updated_at: new Date(row.updatedAt).toISOString(),
      category: category ? { id: category._id, name: category.name } : null,
    };
  },
});

export const voteArticle = mutation({
  args: { articleId: v.id("kbArticles"), helpful: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await consumeRateLimit(ctx, `vote:${args.articleId}`, 10, 10 * 60_000);
    const row = await ctx.db.get(args.articleId);
    if (!row) return null;
    await ctx.db.patch(args.articleId, args.helpful
      ? { helpfulVotes: row.helpfulVotes + 1 }
      : { unhelpfulVotes: row.unhelpfulVotes + 1 });
    return null;
  },
});

export const submitTicket = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
  },
  returns: v.object({ ticket_id: v.id("tickets") }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    if (!tenant) throw new Error("Help center not found");
    await consumeRateLimit(ctx, `submitTicket:${tenant._id}:${args.email.toLowerCase()}`, 5, 10 * 60_000);
    const ticketId = await insertOpenTicket(ctx, {
      tenantId: tenant._id,
      subject: args.subject,
      category: args.category,
      customerName: args.name,
      customerEmail: args.email,
      body: args.body,
      source: "help_center",
      tags: ["help-center"],
    });
    await notifyTicketCreated(ctx, {
      tenantId: tenant._id,
      ticketId,
      email: args.email,
      customerName: args.name,
      subject: args.subject,
    });
    return { ticket_id: ticketId };
  },
});

const publicTicketMessage = v.object({
  id: v.id("ticketMessages"),
  sender_type: v.union(v.literal("end_user"), v.literal("agent"), v.literal("system")),
  sender_name: v.string(),
  content: v.string(),
  created_at: v.string(),
});

const publicTicketValidator = v.object({
  ticket_id: v.id("tickets"),
  subject: v.string(),
  status: v.union(v.literal("open"), v.literal("pending"), v.literal("resolved"), v.literal("closed")),
  category: v.string(),
  created_at: v.string(),
  tenant_name: v.string(),
  tenant_slug: v.string(),
  branding_color: v.string(),
  can_reply: v.boolean(),
  csat_score: v.union(v.number(), v.null()),
  can_csat: v.boolean(),
  messages: v.array(publicTicketMessage),
});

function emailsMatch(stored: string, provided: string): boolean {
  return stored.trim().toLowerCase() === provided.trim().toLowerCase();
}

async function publicTicketView(
  ctx: MutationCtx,
  ticket: Doc<"tickets">,
) {
  const tenant = await ctx.db.get(ticket.tenantId);
  const integration = tenant
    ? await ctx.db.query("integrationSettings").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).first()
    : null;
  const rows = await ctx.db
    .query("ticketMessages")
    .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
    .take(200);
  return {
    ticket_id: ticket._id,
    subject: ticket.subject,
    status: ticket.status,
    category: ticket.category,
    created_at: isoReq(ticket._creationTime),
    tenant_name: tenant?.name ?? "Support",
    tenant_slug: tenant?.slug ?? "",
    branding_color: integration?.brandingPrimaryColor ?? "#3b82f6",
    can_reply: ticket.status !== "closed",
    csat_score: ticket.csatScore ?? null,
    can_csat: (ticket.status === "resolved" || ticket.status === "closed") && ticket.csatScore === undefined,
    messages: rows.map((m) => ({
      id: m._id,
      sender_type: m.senderType,
      sender_name: m.senderName,
      content: m.content,
      created_at: isoReq(m._creationTime),
    })),
  };
}

async function ticketForCustomer(
  ctx: MutationCtx,
  ticketId: string,
  email: string,
): Promise<Doc<"tickets"> | null> {
  const id = ctx.db.normalizeId("tickets", ticketId);
  if (!id) return null;
  const ticket = await ctx.db.get(id);
  if (!ticket || !emailsMatch(ticket.customerEmail, email)) return null;
  return ticket;
}

export const lookupTicket = mutation({
  args: {
    ticketId: v.string(),
    email: v.string(),
  },
  returns: v.union(publicTicketValidator, v.null()),
  handler: async (ctx, args) => {
    await consumeRateLimit(ctx, `lookupTicket:${args.ticketId.slice(0, 48)}`, 8, 10 * 60_000);
    const ticket = await ticketForCustomer(ctx, args.ticketId, args.email);
    if (!ticket) return null;
    return await publicTicketView(ctx, ticket);
  },
});

export const replyToTicket = mutation({
  args: {
    ticketId: v.string(),
    email: v.string(),
    content: v.string(),
  },
  returns: publicTicketValidator,
  handler: async (ctx, args) => {
    await consumeRateLimit(ctx, `replyTicket:${args.ticketId.slice(0, 48)}`, 8, 10 * 60_000);
    const ticket = await ticketForCustomer(ctx, args.ticketId, args.email);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status === "closed") throw new Error("This ticket is closed");
    const body = args.content.trim();
    if (!body) throw new Error("Message is required");
    await ctx.db.insert("ticketMessages", {
      ticketId: ticket._id,
      senderType: "end_user",
      senderName: ticket.customerName,
      content: body,
    });
    if (ticket.status === "resolved") {
      await ctx.db.patch(ticket._id, { status: "pending" });
    }
    const updated = await ctx.db.get(ticket._id);
    return await publicTicketView(ctx, updated!);
  },
});

export const submitCsat = mutation({
  args: {
    ticketId: v.string(),
    email: v.string(),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  returns: publicTicketValidator,
  handler: async (ctx, args) => {
    await consumeRateLimit(ctx, `csat:${args.ticketId.slice(0, 48)}`, 5, 10 * 60_000);
    const ticket = await ticketForCustomer(ctx, args.ticketId, args.email);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "resolved" && ticket.status !== "closed") {
      throw new Error("Rate the ticket after it is resolved");
    }
    if (ticket.csatScore !== undefined) throw new Error("This ticket already has a rating");
    const rating = Math.max(1, Math.min(5, Math.round(args.rating)));
    await ctx.db.insert("ticketFeedback", {
      ticketId: ticket._id,
      rating,
      comment: args.comment,
      submittedBy: args.email.trim().toLowerCase(),
    });
    await ctx.db.patch(ticket._id, { csatScore: rating });
    const updated = await ctx.db.get(ticket._id);
    return await publicTicketView(ctx, updated!);
  },
});

export const widgetConfig = query({
  args: { integrationId: v.string() },
  returns: v.union(
    v.object({
      integration_id: v.id("integrationSettings"),
      tenant_id: v.id("tenants"),
      tenant_slug: v.string(),
      tenant_name: v.string(),
      position: v.string(),
      color: v.string(),
      greeting: v.union(v.string(), v.null()),
      is_open: v.boolean(),
      auto_responder_enabled: v.boolean(),
      auto_responder_message: v.string(),
      locale: v.string(),
      campaign: v.union(
        v.object({
          id: v.id("campaigns"),
          title: v.string(),
          body: v.string(),
        }),
        v.null(),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const integrationId = ctx.db.normalizeId("integrationSettings", args.integrationId);
    if (!integrationId) return null;
    const integration = await ctx.db.get(integrationId);
    if (!integration || integration.status === "inactive" || !integration.widgetEnabled) return null;
    const tenant = await ctx.db.get(integration.tenantId);
    if (!tenant) return null;
    const solo = await ctx.db.query("soloSettings").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).unique();
    const campaigns = await ctx.db.query("campaigns").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).take(20);
    const campaign = campaigns.find((c) => c.enabled && (!c.integrationId || c.integrationId === integration._id)) ?? null;
    return {
      integration_id: integration._id,
      tenant_id: tenant._id,
      tenant_slug: tenant.slug,
      tenant_name: tenant.name,
      position: integration.widgetPosition,
      color: integration.widgetColor,
      greeting: integration.widgetGreeting ?? null,
      is_open: true,
      auto_responder_enabled: solo?.autoResponderEnabled ?? false,
      auto_responder_message: solo?.autoResponderMessage ?? "",
      locale: integration.locale ?? "en",
      campaign: campaign ? { id: campaign._id, title: campaign.title, body: campaign.body } : null,
    };
  },
});

export const startChat = mutation({
  args: {
    integrationId: v.id("integrationSettings"),
    name: v.string(),
    email: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.object({
    conversation_id: v.id("chatConversations"),
    visitor_token: v.string(),
  }),
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration || !integration.widgetEnabled) throw new Error("Widget is offline");
    await consumeRateLimit(ctx, `startChat:${integration._id}:${args.email.toLowerCase()}`, 8, 10 * 60_000);
    const visitorToken = crypto.randomUUID();
    const conversationId = await ctx.db.insert("chatConversations", {
      tenantId: integration.tenantId,
      customerName: args.name,
      customerEmail: args.email,
      status: "waiting",
      visitorToken,
    });
    const greeting = integration.widgetGreeting ?? "Hi! How can we help?";
    await ctx.db.insert("chatMessages", {
      conversationId,
      senderType: "bot",
      senderName: "Assistant",
      content: greeting,
    });
    const solo = await ctx.db.query("soloSettings").withIndex("by_tenant", (q) => q.eq("tenantId", integration.tenantId)).unique();
    if (solo?.autoResponderEnabled && solo.autoResponderMessage) {
      await ctx.db.insert("chatMessages", {
        conversationId,
        senderType: "bot",
        senderName: "Assistant",
        content: solo.autoResponderMessage,
      });
    }
    if (args.message?.trim()) {
      await ctx.db.insert("chatMessages", {
        conversationId,
        senderType: "end_user",
        senderName: args.name,
        content: args.message.trim(),
      });
    }
    return { conversation_id: conversationId, visitor_token: visitorToken };
  },
});

export const sendChatMessage = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    visitorToken: v.string(),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.visitorToken !== args.visitorToken) throw new Error("Invalid conversation");
    await ctx.db.insert("chatMessages", {
      conversationId: args.conversationId,
      senderType: "end_user",
      senderName: conv.customerName,
      content: args.content,
    });
    return null;
  },
});

export const chatMessages = query({
  args: {
    conversationId: v.id("chatConversations"),
    visitorToken: v.string(),
  },
  returns: v.array(chatMessageValidator),
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.visitorToken !== args.visitorToken) return [];
    const rows = await ctx.db.query("chatMessages").withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId)).take(400);
    return rows.map(shapeChatMessage);
  },
});

export const experiments = query({
  args: {},
  returns: v.array(v.object({
    id: v.id("pricingExperiments"),
    name: v.string(),
    description: v.union(v.string(), v.null()),
    variant_a_label: v.string(),
    variant_a_value: v.string(),
    variant_b_label: v.string(),
    variant_b_value: v.string(),
    is_active: v.boolean(),
    created_at: v.string(),
  })),
  handler: async (ctx) => {
    const rows = await ctx.db.query("pricingExperiments").withIndex("by_active", (q) => q.eq("isActive", true)).take(10);
    return rows.map((e) => ({
      id: e._id,
      name: e.name,
      description: e.description ?? null,
      variant_a_label: e.variantALabel,
      variant_a_value: e.variantAValue,
      variant_b_label: e.variantBLabel,
      variant_b_value: e.variantBValue,
      is_active: e.isActive,
      created_at: new Date(e._creationTime).toISOString(),
    }));
  },
});

export const assignExperiment = mutation({
  args: { experimentId: v.id("pricingExperiments"), sessionId: v.string() },
  returns: v.union(v.literal("A"), v.literal("B")),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("experimentAssignments")
      .withIndex("by_experiment_and_session", (q) => q.eq("experimentId", args.experimentId).eq("sessionId", args.sessionId))
      .unique();
    if (existing) return existing.variant;
    const variant = Math.random() < 0.5 ? "A" as const : "B" as const;
    await ctx.db.insert("experimentAssignments", { experimentId: args.experimentId, sessionId: args.sessionId, variant });
    return variant;
  },
});

export const suggestedArticles = query({
  args: { tenantId: v.id("tenants"), needle: v.string() },
  returns: v.array(articleValidator),
  handler: async (ctx, args) => {
    const rows = await searchArticles(ctx, args.tenantId, args.needle, "published", 3);
    return rows.map(shapeArticle);
  },
});
