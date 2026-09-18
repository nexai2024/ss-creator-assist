import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { ticketCreatedMail, ticketReplyMail, ticketStatusMail } from "./ticketEmail";

async function tenantName(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<string> {
  const tenant = await ctx.db.get(tenantId);
  return tenant?.name ?? "Support";
}

async function wrapEmailHtml(ctx: MutationCtx, tenantId: Id<"tenants">, html: string): Promise<string> {
  const integration = await ctx.db.query("integrationSettings").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).first();
  const header = integration?.emailHeaderHtml ? `<div class="email-header">${integration.emailHeaderHtml}</div>` : "";
  const footer = integration?.emailFooterHtml ? `<div class="email-footer">${integration.emailFooterHtml}</div>` : "";
  return `${header}${html}${footer}`;
}

export async function notifyTicketCreated(
  ctx: MutationCtx,
  args: {
    tenantId: Id<"tenants">;
    ticketId: Id<"tickets">;
    email: string;
    customerName: string;
    subject: string;
  },
) {
  const to = args.email.trim();
  if (!to.includes("@")) return;
  const mail = ticketCreatedMail({
    customerName: args.customerName,
    tenantName: await tenantName(ctx, args.tenantId),
    subject: args.subject,
    ticketId: args.ticketId,
    email: to,
  });
  const html = await wrapEmailHtml(ctx, args.tenantId, mail.html);
  await ctx.scheduler.runAfter(0, internal.email.send, { to, subject: mail.subject, html });
}

export async function notifyTicketReply(
  ctx: MutationCtx,
  args: {
    tenantId: Id<"tenants">;
    ticketId: Id<"tickets">;
    email: string;
    senderName: string;
    subject: string;
    content: string;
  },
) {
  const to = args.email.trim();
  if (!to.includes("@")) return;
  const mail = ticketReplyMail({
    senderName: args.senderName,
    tenantName: await tenantName(ctx, args.tenantId),
    subject: args.subject,
    content: args.content,
    ticketId: args.ticketId,
    email: to,
  });
  const html = await wrapEmailHtml(ctx, args.tenantId, mail.html);
  await ctx.scheduler.runAfter(0, internal.email.send, { to, subject: mail.subject, html });
}

export async function notifyTicketStatusChange(
  ctx: MutationCtx,
  args: {
    tenantId: Id<"tenants">;
    ticketId: Id<"tickets">;
    email: string;
    customerName: string;
    subject: string;
    status: string;
  },
) {
  const to = args.email.trim();
  if (!to.includes("@")) return;
  const mail = ticketStatusMail({
    customerName: args.customerName,
    tenantName: await tenantName(ctx, args.tenantId),
    subject: args.subject,
    status: args.status,
    ticketId: args.ticketId,
    email: to,
  });
  const html = await wrapEmailHtml(ctx, args.tenantId, mail.html);
  await ctx.scheduler.runAfter(0, internal.email.send, { to, subject: mail.subject, html });
}
