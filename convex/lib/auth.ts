import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { roleHasPermission, type RoleTier } from "./permissions";

export type { RoleTier };

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
): Promise<{ userId: Id<"users">; membership: Doc<"tenantMembers">; tenant: Doc<"tenants"> }> {
  const userId = await requireUserId(ctx);
  const membership = await ctx.db
    .query("tenantMembers")
    .withIndex("by_tenant_and_user", (q) => q.eq("tenantId", tenantId).eq("userId", userId))
    .unique();
  if (!membership) throw new Error("Not a member of this workspace");
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new Error("Workspace not found");
  return { userId, membership, tenant };
}

export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  allowed: RoleTier[],
): Promise<{ userId: Id<"users">; membership: Doc<"tenantMembers">; tenant: Doc<"tenants"> }> {
  const result = await requireMember(ctx, tenantId);
  if (!allowed.includes(result.membership.role)) {
    throw new Error("You do not have permission to do that");
  }
  return result;
}

export async function requireCapability(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  permission: string,
): Promise<{ userId: Id<"users">; membership: Doc<"tenantMembers">; tenant: Doc<"tenants"> }> {
  const result = await requireMember(ctx, tenantId);
  if (!roleHasPermission(result.membership.role, permission)) {
    throw new Error("You do not have permission to do that");
  }
  return result;
}

export async function writeAudit(
  ctx: MutationCtx,
  args: {
    tenantId?: Id<"tenants">;
    action: string;
    entityType: string;
    entityId?: string;
    details?: string;
    userId?: Id<"users">;
    severity?: "info" | "warning" | "critical";
  },
) {
  await ctx.db.insert("auditLog", {
    tenantId: args.tenantId,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    details: args.details,
    userId: args.userId,
    severity: args.severity ?? "info",
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
}
