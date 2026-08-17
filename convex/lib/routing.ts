import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function applyRouting(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  ticketId: Id<"tickets">,
  subject: string,
  category: string,
  priority: string,
) {
  const rules = await ctx.db.query("routingRules").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(100);
  const updates: {
    assignedAgentId?: Id<"agents">;
    priority?: "low" | "medium" | "high" | "urgent";
    tags?: string[];
  } = {};
  const ticket = await ctx.db.get(ticketId);
  const tags = [...(ticket?.tags ?? [])];
  for (const rule of rules.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority)) {
    let matches = false;
    if (rule.conditionField === "category" && rule.conditionValue === category) matches = true;
    if (rule.conditionField === "priority" && rule.conditionValue === priority) matches = true;
    if (rule.conditionField === "subject_keyword" && subject.toLowerCase().includes(rule.conditionValue.toLowerCase())) matches = true;
    if (!matches) continue;
    if (rule.action === "assign_agent") updates.assignedAgentId = rule.actionValue as Id<"agents">;
    if (rule.action === "set_priority") updates.priority = rule.actionValue as "low" | "medium" | "high" | "urgent";
    if (rule.action === "add_tag") tags.push(rule.actionValue);
  }
  if (tags.length) updates.tags = tags;
  if (Object.keys(updates).length) await ctx.db.patch(ticketId, updates);
}
