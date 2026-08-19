import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireMember } from "./lib/auth";
import { articleSearchText } from "./lib/hosts";
import { chatComplete, embedText, hasOpenAiKey } from "./lib/openai";
import { encodeChatShare, excerptFrom } from "./lib/chatContent";
import { keywordArticles } from "./lib/retrieve";
import { shapeChatMessage } from "./lib/shape";
import { chatMessageValidator } from "./lib/validators";
import type { Id } from "./_generated/dataModel";

const articleCard = v.object({
  id: v.id("kbArticles"),
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(),
});

export const articleDoc = internalQuery({
  args: { articleId: v.id("kbArticles") },
  returns: v.union(
    v.object({
      _id: v.id("kbArticles"),
      title: v.string(),
      content: v.string(),
      status: v.union(v.literal("published"), v.literal("draft")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.articleId);
    if (!row) return null;
    return { _id: row._id, title: row.title, content: row.content, status: row.status };
  },
});

export const saveEmbedding = internalMutation({
  args: {
    articleId: v.id("kbArticles"),
    searchText: v.string(),
    embedding: v.optional(v.array(v.float64())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.articleId, {
      searchText: args.searchText,
      ...(args.embedding ? { embedding: args.embedding } : {}),
    });
    return null;
  },
});

export const embedArticle = internalAction({
  args: { articleId: v.id("kbArticles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const article = await ctx.runQuery(internal.ai.articleDoc, { articleId: args.articleId });
    if (!article || article.status !== "published") return null;
    const searchText = articleSearchText(article.title, article.content);
    const embedding = await embedText(`${article.title}\n${article.content}`);
    await ctx.runMutation(internal.ai.saveEmbedding, {
      articleId: args.articleId,
      searchText,
      embedding: embedding ?? undefined,
    });
    return null;
  },
});

export const memberTenant = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.object({ slug: v.string(), name: v.string() }),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Workspace not found");
    return { slug: tenant.slug, name: tenant.name };
  },
});

export const visitorConversation = internalQuery({
  args: {
    conversationId: v.id("chatConversations"),
    visitorToken: v.string(),
  },
  returns: v.union(
    v.object({ tenantId: v.id("tenants"), slug: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.visitorToken !== args.visitorToken) return null;
    const tenant = await ctx.db.get(conv.tenantId);
    return { tenantId: conv.tenantId, slug: tenant?.slug ?? "" };
  },
});

export const articlesByIds = internalQuery({
  args: { tenantId: v.id("tenants"), ids: v.array(v.id("kbArticles")) },
  returns: v.array(articleCard),
  handler: async (ctx, args) => {
    const cards: Array<{ id: Id<"kbArticles">; title: string; slug: string; excerpt: string }> = [];
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (!row || row.tenantId !== args.tenantId || row.status !== "published") continue;
      cards.push({
        id: row._id,
        title: row.title,
        slug: row.slug,
        excerpt: excerptFrom(row.content),
      });
    }
    return cards;
  },
});

export const keywordCards = internalQuery({
  args: { tenantId: v.id("tenants"), needle: v.string() },
  returns: v.array(articleCard),
  handler: async (ctx, args) => {
    const rows = await keywordArticles(ctx, args.tenantId, args.needle, 5);
    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      slug: row.slug,
      excerpt: excerptFrom(row.content),
    }));
  },
});

export const ticketCopilotContext = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    ticketId: v.optional(v.id("tickets")),
    conversationId: v.optional(v.id("chatConversations")),
  },
  returns: v.object({
    subject: v.string(),
    transcript: v.string(),
    similar: v.array(v.object({
      id: v.id("tickets"),
      subject: v.string(),
      status: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    let subject = "";
    const lines: string[] = [];
    if (args.ticketId) {
      const ticket = await ctx.db.get(args.ticketId);
      if (!ticket || ticket.tenantId !== args.tenantId) throw new Error("Ticket not found");
      subject = ticket.subject;
      const msgs = await ctx.db.query("ticketMessages").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId!)).take(40);
      for (const m of msgs) lines.push(`${m.senderName}: ${m.content}`);
    }
    if (args.conversationId) {
      const conv = await ctx.db.get(args.conversationId);
      if (!conv || conv.tenantId !== args.tenantId) throw new Error("Conversation not found");
      subject = subject || `Chat with ${conv.customerName}`;
      const msgs = await ctx.db.query("chatMessages").withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId!)).take(40);
      for (const m of msgs) lines.push(`${m.senderName}: ${m.content}`);
    }
    const similar = subject
      ? await ctx.db
        .query("tickets")
        .withSearchIndex("search_subject", (q) => q.search("subject", subject).eq("tenantId", args.tenantId))
        .take(6)
      : [];
    return {
      subject,
      transcript: lines.join("\n").slice(0, 8000),
      similar: similar
        .filter((t) => t._id !== args.ticketId)
        .slice(0, 5)
        .map((t) => ({ id: t._id, subject: t.subject, status: t.status })),
    };
  },
});

async function retrieveCards(
  ctx: ActionCtx,
  tenantId: Id<"tenants">,
  message: string,
): Promise<Array<{ id: Id<"kbArticles">; title: string; slug: string; excerpt: string }>> {
  const vector = await embedText(message);
  if (vector) {
    const hits = await ctx.vectorSearch("kbArticles", "by_embedding", {
      vector,
      limit: 8,
      filter: (q) => q.eq("tenantId", tenantId),
    });
    const ids = hits.filter((h) => h._score >= 0.28).map((h) => h._id);
    const cards = await ctx.runQuery(internal.ai.articlesByIds, { tenantId, ids });
    if (cards.length) return cards;
  }
  return await ctx.runQuery(internal.ai.keywordCards, { tenantId, needle: message });
}

function citedReply(
  text: string,
  cards: Array<{ id: Id<"kbArticles">; title: string; slug: string; excerpt: string }>,
  slug: string,
): string {
  const lead = text.trim() || "Here is what the docs say.";
  const first = cards[0];
  if (!first) return lead;
  return encodeChatShare({
    kind: "article",
    id: first.id,
    title: first.title,
    slug: first.slug,
    tenantSlug: slug,
    excerpt: first.excerpt,
  }, lead);
}

async function generateDeflection(
  message: string,
  cards: Array<{ id: Id<"kbArticles">; title: string; slug: string; excerpt: string }>,
): Promise<string> {
  if (cards.length === 0) {
    return "I could not find this in the published docs. An agent will follow up shortly.";
  }
  const sources = cards.map((c, i) => `[${i + 1}] ${c.title}: ${c.excerpt}`).join("\n");
  const llm = await chatComplete(
    "You are a support deflection assistant. Answer only from the cited articles. Name the article titles you used. If the docs do not answer the question, say you do not know and that an agent will follow up. Keep it under 120 words.",
    `Customer question:\n${message}\n\nPublished articles:\n${sources}`,
  );
  if (!llm || /do not know|don't know|not in the (docs|articles)/i.test(llm)) {
    if (!llm) {
      return `I found ${cards[0]!.title} in the docs. Open it if that matches what you need.`;
    }
    return llm;
  }
  return llm;
}

export const deflectChat = action({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("chatConversations"),
    message: v.string(),
  },
  returns: chatMessageValidator,
  handler: async (ctx, args): Promise<{
    id: Id<"chatMessages">;
    conversation_id: Id<"chatConversations">;
    sender_type: "end_user" | "agent" | "bot";
    sender_name: string;
    content: string;
    created_at: string;
  }> => {
    const tenant: { slug: string; name: string } = await ctx.runQuery(internal.ai.memberTenant, { tenantId: args.tenantId });
    const cards = await retrieveCards(ctx, args.tenantId, args.message);
    const text = await generateDeflection(args.message, cards);
    const content = cards.length
      ? citedReply(text, cards, tenant.slug)
      : text;
    return await ctx.runMutation(internal.chat.insertBotMessage, {
      tenantId: args.tenantId,
      conversationId: args.conversationId,
      content,
    });
  },
});

export const deflectVisitor = action({
  args: {
    conversationId: v.id("chatConversations"),
    visitorToken: v.string(),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conv = await ctx.runQuery(internal.ai.visitorConversation, {
      conversationId: args.conversationId,
      visitorToken: args.visitorToken,
    });
    if (!conv) throw new Error("Invalid conversation");
    const cards = await retrieveCards(ctx, conv.tenantId, args.message);
    const text = await generateDeflection(args.message, cards);
    const content = cards.length ? citedReply(text, cards, conv.slug) : text;
    await ctx.runMutation(internal.chat.insertBotMessage, {
      tenantId: conv.tenantId,
      conversationId: args.conversationId,
      content,
    });
    return null;
  },
});

export const copilot = action({
  args: {
    tenantId: v.id("tenants"),
    mode: v.union(v.literal("draft"), v.literal("summarize"), v.literal("similar")),
    ticketId: v.optional(v.id("tickets")),
    conversationId: v.optional(v.id("chatConversations")),
  },
  returns: v.object({
    text: v.string(),
    similar: v.array(v.object({
      id: v.id("tickets"),
      subject: v.string(),
      status: v.string(),
    })),
  }),
  handler: async (ctx, args): Promise<{
    text: string;
    similar: Array<{ id: Id<"tickets">; subject: string; status: string }>;
  }> => {
    const data: {
      subject: string;
      transcript: string;
      similar: Array<{ id: Id<"tickets">; subject: string; status: string }>;
    } = await ctx.runQuery(internal.ai.ticketCopilotContext, {
      tenantId: args.tenantId,
      ticketId: args.ticketId,
      conversationId: args.conversationId,
    });
    if (args.mode === "similar") {
      return { text: data.similar.length ? "Related tickets from full-text search." : "No similar tickets yet.", similar: data.similar };
    }
    if (!hasOpenAiKey()) {
      const fallback = args.mode === "summarize"
        ? (data.transcript.slice(0, 400) || "No thread yet to summarize.")
        : "OPENAI_API_KEY is not set. Draft from the thread manually, or add the key to enable copilot.";
      return { text: fallback, similar: data.similar };
    }
    const prompt = args.mode === "summarize"
      ? "Summarize this support thread in 4 bullets: customer ask, what was tried, current status, suggested next step."
      : "Draft a concise, professional agent reply. Do not invent policy. Use a helpful tone.";
    const text = await chatComplete(prompt, `Subject: ${data.subject}\n\n${data.transcript}`)
      ?? "Could not generate a suggestion right now.";
    return { text, similar: data.similar };
  },
});
