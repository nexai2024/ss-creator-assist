import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { ticketCreatedMail, ticketReplyMail } from "./ticketEmail";

async function tenantName(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<string> {
  const tenant = await ctx.db.get(tenantId);
  return tenant?.name ?? "Support";
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
  await ctx.scheduler.runAfter(0, internal.email.send, { to, ...mail });
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
  await ctx.scheduler.runAfter(0, internal.email.send, { to, ...mail });
}
