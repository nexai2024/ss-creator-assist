import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { slaBreached } from "./lib/businessSla";

export const summary = query({
  args: {
    tenantId: v.id("tenants"),
    now: v.number(),
    rangeStart: v.number(),
    rangeEnd: v.number(),
  },
  returns: v.object({
    volume: v.number(),
    volume_by_source: v.record(v.string(), v.number()),
    volume_by_channel_status: v.record(v.string(), v.number()),
    csat_count: v.number(),
    csat_average: v.union(v.number(), v.null()),
    first_response_count: v.number(),
    first_response_avg_ms: v.union(v.number(), v.null()),
    sla_breaches: v.number(),
    open_sla_breaches: v.number(),
    rows: v.array(v.object({
      id: v.id("tickets"),
      subject: v.string(),
      source: v.string(),
      status: v.string(),
      csat: v.union(v.number(), v.null()),
      first_response_ms: v.union(v.number(), v.null()),
      sla_breached: v.boolean(),
      created_at: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const tickets = await ctx.db.query("tickets").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(400);
    const inRange = tickets.filter((t) => t._creationTime >= args.rangeStart && t._creationTime <= args.rangeEnd);
    const volumeBySource: Record<string, number> = {};
    const volumeByStatus: Record<string, number> = {};
    const rows = [];
    let csatSum = 0;
    let csatCount = 0;
    let frSum = 0;
    let frCount = 0;
    let slaBreaches = 0;
    let openSla = 0;
    for (const ticket of inRange) {
      const source = ticket.source ?? "console";
      volumeBySource[source] = (volumeBySource[source] ?? 0) + 1;
      volumeByStatus[ticket.status] = (volumeByStatus[ticket.status] ?? 0) + 1;
      const breached = slaBreached({
        nowMs: args.now,
        slaDeadline: ticket.slaDeadline,
        status: ticket.status,
        resolvedAt: ticket.resolvedAt,
      });
      if (breached) slaBreaches += 1;
      if (breached && (ticket.status === "open" || ticket.status === "pending")) openSla += 1;
      if (ticket.csatScore !== undefined) {
        csatSum += ticket.csatScore;
        csatCount += 1;
      }
      const firstResponseMs = ticket.firstRespondedAt !== undefined
        ? ticket.firstRespondedAt - ticket._creationTime
        : null;
      if (firstResponseMs !== null && firstResponseMs >= 0) {
        frSum += firstResponseMs;
        frCount += 1;
      }
      rows.push({
        id: ticket._id,
        subject: ticket.subject,
        source,
        status: ticket.status,
        csat: ticket.csatScore ?? null,
        first_response_ms: firstResponseMs,
        sla_breached: breached,
        created_at: ticket._creationTime,
      });
    }
    return {
      volume: inRange.length,
      volume_by_source: volumeBySource,
      volume_by_channel_status: volumeByStatus,
      csat_count: csatCount,
      csat_average: csatCount ? csatSum / csatCount : null,
      first_response_count: frCount,
      first_response_avg_ms: frCount ? frSum / frCount : null,
      sla_breaches: slaBreaches,
      open_sla_breaches: openSla,
      rows,
    };
  },
});
