import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function applyWorkflows(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  ticketId: Id<"tickets">,
  trigger: "ticket_created" | "status_changed",
) {
  const ticket = await ctx.db.get(ticketId);
  if (!ticket) return;
  const rows = await ctx.db.query("workflows").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(50);
  const tags = [...ticket.tags];
  let assignedAgentId = ticket.assignedAgentId;
  let priority = ticket.priority;
  let status = ticket.status;
  let changed = false;
  for (const workflow of rows.filter((w) => w.enabled && w.trigger === trigger)) {
    for (const step of workflow.steps.slice(0, 8)) {
      if (step.type === "assign_agent") {
        const agentId = ctx.db.normalizeId("agents", step.value);
        if (agentId) {
          assignedAgentId = agentId;
          changed = true;
        }
      }
      if (step.type === "set_priority" && (step.value === "low" || step.value === "medium" || step.value === "high" || step.value === "urgent")) {
        priority = step.value;
        changed = true;
      }
      if (step.type === "add_tag" && step.value.trim() && !tags.includes(step.value.trim())) {
        tags.push(step.value.trim());
        changed = true;
      }
      if (step.type === "set_status" && (step.value === "open" || step.value === "pending" || step.value === "resolved" || step.value === "closed")) {
        status = step.value;
        changed = true;
      }
    }
  }
  if (!changed) return;
  await ctx.db.patch(ticketId, {
    assignedAgentId,
    priority,
    tags,
    status,
    resolvedAt: status === "resolved" || status === "closed" ? Date.now() : ticket.resolvedAt,
  });
}
