import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { applyRouting } from "./routing";
import { applyWorkflows } from "./workflows";
import { classifyTicket } from "./shape";
import { slaDeadlineMs, type BusinessHourRow } from "./businessSla";

export type TicketSource = "console" | "help_center" | "chat" | "email" | "api" | "whatsapp" | "instagram";

async function loadHours(ctx: MutationCtx, tenantId: Id<"tenants">): Promise<BusinessHourRow[]> {
  const rows = await ctx.db.query("businessHours").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(7);
  return rows.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    isWorkingDay: row.isWorkingDay,
    openTime: row.openTime,
    closeTime: row.closeTime,
    timezone: row.timezone,
  }));
}

export async function insertOpenTicket(
  ctx: MutationCtx,
  args: {
    tenantId: Id<"tenants">;
    subject: string;
    category?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    customerName: string;
    customerEmail: string;
    body?: string;
    source: TicketSource;
    tags?: string[];
    inboundMessageId?: string;
  },
): Promise<Id<"tickets">> {
  const classified = classifyTicket(args.subject, args.body ?? "");
  const category = args.category || classified.category;
  const priority = args.priority ?? "medium";
  const hours = await loadHours(ctx, args.tenantId);
  const ticketId = await ctx.db.insert("tickets", {
    tenantId: args.tenantId,
    subject: args.subject,
    category,
    priority,
    status: "open",
    customerName: args.customerName,
    customerEmail: args.customerEmail,
    deflectionSuggested: classified.deflectionSuggested,
    customFields: {},
    tags: args.tags ?? [],
    source: args.source,
    inboundMessageId: args.inboundMessageId,
    slaDeadline: slaDeadlineMs(Date.now(), priority, hours),
  });
  if (args.body?.trim()) {
    await ctx.db.insert("ticketMessages", {
      ticketId,
      senderType: "end_user",
      senderName: args.customerName,
      content: args.body.trim(),
    });
  }
  await applyRouting(ctx, args.tenantId, ticketId, args.subject, category, priority);
  await applyWorkflows(ctx, args.tenantId, ticketId, "ticket_created");

  const soloSettings = await ctx.db.query("soloSettings").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).unique();
  if (soloSettings && soloSettings.velocityThreshold && !soloSettings.autoResponderEnabled) {
    const oneHourAgo = Date.now() - 3600_000;
    const recentTickets = await ctx.db
      .query("tickets")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.gte(q.field("_creationTime"), oneHourAgo))
      .collect();
    
    if (recentTickets.length >= soloSettings.velocityThreshold) {
      await ctx.db.patch(soloSettings._id, {
        autoResponderEnabled: true,
      });
      // We could also notify the solopreneur here
    }
  }

  return ticketId;
}
