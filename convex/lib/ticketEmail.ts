import { absoluteTicketUrl } from "./chatContent";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ticketStatusOrigin(): string {
  return (process.env.SITE_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

function statusLink(ticketId: string, email: string): string {
  return absoluteTicketUrl(ticketStatusOrigin(), ticketId, email);
}

function wrap(body: string): string {
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.5;color:#171717;max-width:560px">
${body}
</div>`;
}

function cta(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>
<p style="font-size:12px;color:#737373">If the button does not work, copy this link:<br/>${escapeHtml(href)}</p>`;
}

export function ticketCreatedMail(opts: {
  customerName: string;
  tenantName: string;
  subject: string;
  ticketId: string;
  email: string;
}): { subject: string; html: string } {
  const url = statusLink(opts.ticketId, opts.email);
  const greeting = opts.customerName.trim() ? `Hi ${escapeHtml(opts.customerName)},` : "Hi,";
  return {
    subject: `Ticket opened: ${opts.subject}`,
    html: wrap(`
<p>${greeting}</p>
<p>${escapeHtml(opts.tenantName)} opened a support ticket for <strong>${escapeHtml(opts.subject)}</strong>.</p>
<p>You can check status and reply from this link — no sign-in required, just the email on the ticket.</p>
${cta(url, "View ticket status")}
`),
  };
}

export function ticketReplyMail(opts: {
  senderName: string;
  tenantName: string;
  subject: string;
  content: string;
  ticketId: string;
  email: string;
}): { subject: string; html: string } {
  const url = statusLink(opts.ticketId, opts.email);
  const quoted = escapeHtml(opts.content).replace(/\n/g, "<br/>");
  return {
    subject: `Re: ${opts.subject}`,
    html: wrap(`
<p>${escapeHtml(opts.senderName)} from ${escapeHtml(opts.tenantName)} replied to <strong>${escapeHtml(opts.subject)}</strong>:</p>
<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #d4d4d4;background:#fafafa;color:#404040">${quoted}</blockquote>
${cta(url, "View ticket and reply")}
`),
  };
}
