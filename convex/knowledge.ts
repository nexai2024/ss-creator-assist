import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCapability, requireMember, slugify, writeAudit } from "./lib/auth";
import { shapeArticle, shapeCategory } from "./lib/shape";
import { articleValidator, categoryValidator } from "./lib/validators";

export const list = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    articles: v.array(articleValidator),
    categories: v.array(categoryValidator),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const articles = await ctx.db.query("kbArticles").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(200);
    const categories = await ctx.db.query("kbCategories").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    return { articles: articles.map(shapeArticle), categories: categories.map(shapeCategory) };
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    title: v.string(),
    content: v.string(),
    categoryId: v.optional(v.id("kbCategories")),
    status: v.union(v.literal("published"), v.literal("draft")),
  },
  returns: articleValidator,
  handler: async (ctx, args) => {
    const { userId } = args.status === "published"
      ? await requireCapability(ctx, args.tenantId, "kb:publish")
      : await requireCapability(ctx, args.tenantId, "kb:edit");
    const id = await ctx.db.insert("kbArticles", {
      tenantId: args.tenantId,
      title: args.title,
      content: args.content,
      categoryId: args.categoryId,
      slug: slugify(args.title),
      status: args.status,
      views: 0,
      helpfulVotes: 0,
      unhelpfulVotes: 0,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "kb_article_created",
      entityType: "kb_articles",
      entityId: id,
      details: args.title,
      userId,
    });
    const article = await ctx.db.get(id);
    return shapeArticle(article!);
  },
});

export const suggested = query({
  args: { tenantId: v.id("tenants"), needle: v.string() },
  returns: v.array(articleValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const articles = await ctx.db
      .query("kbArticles")
      .withIndex("by_tenant_and_status", (q) => q.eq("tenantId", args.tenantId).eq("status", "published"))
      .take(50);
    const n = args.needle.toLowerCase().slice(0, 40);
    return articles.filter((a) => a.title.toLowerCase().includes(n) || a.content.toLowerCase().includes(n)).slice(0, 3).map(shapeArticle);
  },
});

export const update = mutation({
  args: {
    tenantId: v.id("tenants"),
    articleId: v.id("kbArticles"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    categoryId: v.optional(v.union(v.id("kbCategories"), v.null())),
    status: v.optional(v.union(v.literal("published"), v.literal("draft"))),
  },
  returns: articleValidator,
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article || article.tenantId !== args.tenantId) throw new Error("Article not found");
    const publishing = args.status === "published" && article.status !== "published";
    if (publishing) await requireCapability(ctx, args.tenantId, "kb:publish");
    else await requireCapability(ctx, args.tenantId, "kb:edit");
    await ctx.db.patch(args.articleId, {
      title: args.title ?? article.title,
      content: args.content ?? article.content,
      status: args.status ?? article.status,
      categoryId: args.categoryId === undefined ? article.categoryId : args.categoryId ?? undefined,
      slug: args.title ? slugify(args.title) : article.slug,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(args.articleId);
    return shapeArticle(updated!);
  },
});
