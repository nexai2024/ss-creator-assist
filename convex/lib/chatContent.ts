export const SHARE_MARKER = "mse-share:";

export type ArticleShare = {
  kind: "article";
  id: string;
  title: string;
  slug: string;
  tenantSlug: string;
  excerpt: string;
};

export type TicketShare = {
  kind: "ticket";
  id: string;
  subject: string;
};

export type ChatShare = ArticleShare | TicketShare;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArticleShare(value: unknown): value is ArticleShare {
  return (
    isRecord(value)
    && value.kind === "article"
    && typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.slug === "string"
    && typeof value.tenantSlug === "string"
    && typeof value.excerpt === "string"
  );
}

function isTicketShare(value: unknown): value is TicketShare {
  return (
    isRecord(value)
    && value.kind === "ticket"
    && typeof value.id === "string"
    && typeof value.subject === "string"
  );
}

export function encodeChatShare(share: ChatShare, text?: string): string {
  const payload = SHARE_MARKER + JSON.stringify(share);
  return text ? `${text}\n\n${payload}` : payload;
}

export function parseChatShare(content: string): { text: string; share: ChatShare | null } {
  const idx = content.indexOf(SHARE_MARKER);
  if (idx === -1) return { text: content, share: null };
  const text = content.slice(0, idx).trim();
  try {
    const parsed: unknown = JSON.parse(content.slice(idx + SHARE_MARKER.length));
    if (isArticleShare(parsed) || isTicketShare(parsed)) {
      return { text, share: parsed };
    }
  } catch {
    return { text: content, share: null };
  }
  return { text: content, share: null };
}

export function articleHelpPath(tenantSlug: string, articleSlug: string): string {
  return `/help/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(articleSlug)}`;
}

export function ticketConsolePath(ticketId: string): string {
  return `/tickets/${ticketId}`;
}

export function ticketPublicPath(ticketId: string, email?: string): string {
  const path = `/ticket/${encodeURIComponent(ticketId)}`;
  if (!email) return path;
  return `${path}?email=${encodeURIComponent(email)}`;
}

export function absoluteTicketUrl(origin: string, ticketId: string, email: string): string {
  return `${origin.replace(/\/$/, "")}${ticketPublicPath(ticketId, email)}`;
}

export function excerptFrom(content: string, max = 160): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
