import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const current = query({
  args: {},
  returns: v.union(
    v.object({
      id: v.id("users"),
      email: v.string(),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      id: user._id,
      email: user.email ?? "",
      name: user.name ?? user.email ?? "",
    };
  },
});

export const authMethods = query({
  args: {},
  returns: v.object({
    google: v.boolean(),
    oidc: v.boolean(),
    oidc_name: v.string(),
  }),
  handler: async () => {
    return {
      google: Boolean(process.env.AUTH_GOOGLE_ID),
      oidc: Boolean(process.env.AUTH_OIDC_ISSUER && process.env.AUTH_OIDC_ID && process.env.AUTH_OIDC_SECRET),
      oidc_name: process.env.AUTH_OIDC_NAME ?? "SSO",
    };
  },
});
