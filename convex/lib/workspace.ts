import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { slugify, writeAudit } from "./auth";
import { shapeTenant } from "./shape";

export async function provisionWorkspace(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: string,
) {
  const existing = await ctx.db
    .query("tenantMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) {
    const tenant = await ctx.db.get(existing.tenantId);
    if (tenant) return shapeTenant(tenant);
  }

  const trimmed = name.trim() || "My workspace";
  let slug = slugify(trimmed);
  const clash = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const tenantId = await ctx.db.insert("tenants", {
    name: trimmed,
    slug,
    planTier: "starter",
    status: "trial",
    monthlyActiveUsers: 0,
    includedMaus: 5000,
    overageRate: 0.02,
    slaUptime: "99.5%",
  });
  await ctx.db.insert("tenantMembers", { tenantId, userId, role: "admin" });

  const user = await ctx.db.get(userId);
  await ctx.db.insert("agents", {
    tenantId,
    name: user?.name ?? user?.email ?? "Admin",
    email: user?.email ?? "admin@example.com",
    role: "admin",
    status: "online",
    avatarColor: "#3b82f6",
  });

  for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) {
    await ctx.db.insert("businessHours", {
      tenantId,
      dayOfWeek,
      isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
      openTime: "09:00",
      closeTime: "17:00",
      timezone: "America/New_York",
    });
  }

  await ctx.db.insert("soloSettings", {
    tenantId,
    soloMode: false,
    autoResponderEnabled: false,
    autoResponderMessage: "We're away right now. We'll reply during business hours.",
  });

  await writeAudit(ctx, {
    tenantId,
    action: "tenant_created",
    entityType: "tenants",
    entityId: tenantId,
    details: `Workspace ${trimmed} created`,
    userId,
  });

  const tenant = await ctx.db.get(tenantId);
  return shapeTenant(tenant!);
}

export async function acceptInviteForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  token: string,
) {
  const invite = await ctx.db
    .query("teamInvites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!invite) throw new Error("Invite not found");
  if (invite.usedAt) throw new Error("Invite already used");
  if (invite.expiresAt < Date.now()) throw new Error("Invite expired");

  const user = await ctx.db.get(userId);
  if (user?.email && user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(`This invite is for ${invite.email}`);
  }

  const existing = await ctx.db
    .query("tenantMembers")
    .withIndex("by_tenant_and_user", (q) =>
      q.eq("tenantId", invite.tenantId).eq("userId", userId),
    )
    .unique();
  if (!existing) {
    await ctx.db.insert("tenantMembers", {
      tenantId: invite.tenantId,
      userId,
      role: invite.role,
    });
  }
  await ctx.db.patch(invite._id, { usedAt: Date.now() });
}
