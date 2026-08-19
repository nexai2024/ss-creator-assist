import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function keywordArticles(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  needle: string,
  limit = 5,
): Promise<Doc<"kbArticles">[]> {
  const articles = await ctx.db
    .query("kbArticles")
    .withIndex("by_tenant_and_status", (q) => q.eq("tenantId", tenantId).eq("status", "published"))
    .take(80);
  const n = needle.toLowerCase().slice(0, 80);
  if (!n.trim()) return articles.slice(0, limit);
  const terms = n.split(/\s+/).filter((t) => t.length > 2);
  const scored = articles
    .map((article) => {
      const hay = `${article.title}\n${article.content}`.toLowerCase();
      let score = 0;
      if (hay.includes(n)) score += 5;
      for (const term of terms) {
        if (article.title.toLowerCase().includes(term)) score += 3;
        if (hay.includes(term)) score += 1;
      }
      return { article, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return (scored.length ? scored.map((s) => s.article) : []).slice(0, limit);
}

export async function searchArticles(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  needle: string,
  status?: "published" | "draft",
  limit = 12,
): Promise<Doc<"kbArticles">[]> {
  const q = needle.trim();
  if (q.length < 2) return [];
  try {
    const query = ctx.db.query("kbArticles").withSearchIndex("search_body", (s) => {
      const search = s.search("searchText", q).eq("tenantId", tenantId);
      return status ? search.eq("status", status) : search;
    });
    const hits = await query.take(limit);
    if (hits.length > 0) return hits;
  } catch {
    // Search index may be empty until articles are re-saved.
  }
  const fallback = await keywordArticles(ctx, tenantId, q, limit);
  if (status) return fallback.filter((a) => a.status === status);
  return fallback;
}
