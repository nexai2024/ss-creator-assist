import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireMember, requirePermission, requireUserId, writeAudit } from "./lib/auth";
import { acceptInviteForUser } from "./lib/workspace";
import { roleTier } from "./lib/validators";

const role = roleTier;

const memberValidator = v.object({
  user_id: v.id("users"),
  email: v.string(),
  role,
  created_at: v.string(),
  updated_at: v.union(v.string(), v.null()),
});

const inviteValidator = v.object({
  id: v.id("teamInvites"),
  tenant_id: v.id("tenants"),
  email: v.string(),
  role,
  token: v.string(),
  invited_by: v.union(v.id("users"), v.null()),
  expires_at: v.string(),
  used_at: v.union(v.string(), v.null()),
  created_at: v.string(),
});

export const members = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(memberValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("tenantMembers").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    const out = [];
    for (const m of rows) {
      const user = await ctx.db.get(m.userId);
      out.push({
        user_id: m.userId,
        email: user?.email ?? "unknown",
        role: m.role,
        created_at: new Date(m._creationTime).toISOString(),
        updated_at: null,
      });
    }
    return out;
  },
});

export const invites = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(inviteValidator),
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    const rows = await ctx.db.query("teamInvites").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    return rows.map((i) => ({
      id: i._id,
      tenant_id: i.tenantId,
      email: i.email,
      role: i.role,
      token: i.token,
      invited_by: i.invitedBy ?? null,
      expires_at: new Date(i.expiresAt).toISOString(),
      used_at: i.usedAt ? new Date(i.usedAt).toISOString() : null,
      created_at: new Date(i._creationTime).toISOString(),
    }));
  },
});

export const invite = mutation({
  args: { tenantId: v.id("tenants"), email: v.string(), role },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, ["admin"]);
    const token = crypto.randomUUID();
    await ctx.db.insert("teamInvites", {
      tenantId: args.tenantId,
      email: args.email.toLowerCase(),
      role: args.role,
      token,
      invitedBy: userId,
      expiresAt: Date.now() + 14 * 24 * 3600000,
    });
    await writeAudit(ctx, {
      tenantId: args.tenantId,
      action: "team_invite_created",
      entityType: "team_invites",
      details: `Invited ${args.email} as ${args.role}`,
      userId,
    });
    const site = process.env.SITE_URL ?? "http://localhost:5173";
    await ctx.scheduler.runAfter(0, internal.email.send, {
      to: args.email.toLowerCase(),
      subject: "You're invited to MSE Console",
      html: `<p>You've been invited as ${args.role}.</p><p><a href="${site}/login?invite=${token}&email=${encodeURIComponent(args.email)}">Accept invite</a></p><p>Already signed in? <a href="${site}/create-workspace?invite=${token}">Join from your account</a>.</p>`,
    });
    return token;
  },
});

export const peekInvite = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      email: v.string(),
      role,
      tenant_name: v.string(),
      expires_at: v.number(),
      used: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("teamInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite) return null;
    const tenant = await ctx.db.get(invite.tenantId);
    return {
      email: invite.email,
      role: invite.role,
      tenant_name: tenant?.name ?? "Workspace",
      expires_at: invite.expiresAt,
      used: Boolean(invite.usedAt),
    };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await acceptInviteForUser(ctx, userId, args.token);
    return null;
  },
});

export const changeRole = mutation({
  args: { tenantId: v.id("tenants"), userId: v.id("users"), role },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin"]);
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_tenant_and_user", (q) => q.eq("tenantId", args.tenantId).eq("userId", args.userId))
      .unique();
    if (!membership) throw new Error("Member not found");
    await ctx.db.patch(membership._id, { role: args.role });
    return null;
  },
});

export const revoke = mutation({
  args: { tenantId: v.id("tenants"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin"]);
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_tenant_and_user", (q) => q.eq("tenantId", args.tenantId).eq("userId", args.userId))
      .unique();
    if (membership) await ctx.db.delete(membership._id);
    return null;
  },
});

export const deleteInvite = mutation({
  args: { tenantId: v.id("tenants"), inviteId: v.id("teamInvites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, ["admin"]);
    const invite = await ctx.db.get(args.inviteId);
    if (invite && invite.tenantId === args.tenantId) await ctx.db.delete(args.inviteId);
    return null;
  },
});
