import type { Doc } from "../_generated/dataModel";

export type RoleTier = Doc<"tenantMembers">["role"];

export const ROLE_PERMISSIONS: Record<RoleTier, string[]> = {
  admin: [
    "tickets:read", "tickets:reply", "tickets:assign", "tickets:escalate", "tickets:delete", "tickets:resolve", "tickets:manage_all",
    "notes:create", "notes:read",
    "finance:refund", "finance:apply_credit",
    "kb:read", "kb:edit", "kb:publish",
    "settings:manage_integrations", "settings:manage_webhooks", "settings:manage_roles", "settings:manage_billing", "settings:manage_routing",
    "team:invite", "team:revoke", "team:view",
    "audit:read",
    "chat:reply", "chat:close", "chat:escalate",
  ],
  manager: [
    "tickets:read", "tickets:reply", "tickets:assign", "tickets:escalate", "tickets:resolve", "tickets:manage_all",
    "notes:create", "notes:read",
    "finance:refund", "finance:apply_credit",
    "kb:read", "kb:edit", "kb:publish",
    "settings:manage_routing",
    "team:view",
    "audit:read",
    "chat:reply", "chat:close", "chat:escalate",
  ],
  senior_agent: [
    "tickets:read", "tickets:reply", "tickets:assign", "tickets:escalate", "tickets:resolve",
    "notes:create", "notes:read",
    "finance:refund",
    "kb:read", "kb:edit",
    "chat:reply", "chat:close", "chat:escalate",
  ],
  junior_agent: [
    "tickets:read", "tickets:reply",
    "notes:create", "notes:read",
    "tickets:escalate",
    "kb:read",
    "chat:reply", "chat:escalate",
  ],
  read_only: [
    "tickets:read",
    "notes:read",
    "kb:read",
    "team:view",
    "audit:read",
  ],
};

export function roleHasPermission(role: RoleTier | null, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
