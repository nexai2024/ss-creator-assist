import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { acceptInviteForUser, provisionWorkspace } from "./lib/workspace";

async function sendResendEmail(to: string, subject: string, html: string) {
  const key = process.env.AUTH_RESEND_KEY;
  const from = process.env.AUTH_EMAIL_FROM ?? "MSE Console <noreply@mse.local>";
  if (!key) {
    throw new Error("AUTH_RESEND_KEY is not set on the Convex deployment");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend error", res.status, body);
    throw new Error("Failed to send email");
  }
}

type SignupProfile = {
  email: string;
  name?: string;
  tenantName?: string;
  inviteToken?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  phone?: string;
  image?: string;
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: Email({
        id: "resend-reset",
        async sendVerificationRequest({ identifier, url }) {
          await sendResendEmail(
            identifier,
            "Reset your MSE Console password",
            `<p>Use this link to choose a new password:</p><p><a href="${url}">Reset password</a></p>`,
          );
        },
      }),
      profile(params) {
        const email = params.email;
        if (typeof email !== "string" || !email.includes("@")) {
          throw new Error("A valid email is required");
        }
        return {
          email,
          name: typeof params.name === "string" ? params.name : undefined,
          tenantName: typeof params.tenantName === "string" ? params.tenantName : undefined,
          inviteToken: typeof params.inviteToken === "string" ? params.inviteToken : undefined,
        } as { email: string; name?: string };
      },
    }),
  ],
  callbacks: {
    // Runs inside the signup mutation, before a JWT exists on the client.
    async createOrUpdateUser(ctx, args) {
      const profile = args.profile as SignupProfile;
      const userData = {
        email: profile.email,
        name: profile.name,
        image: profile.image,
        phone: profile.phone,
        ...(profile.emailVerified ? { emailVerificationTime: Date.now() } : {}),
        ...(profile.phoneVerified ? { phoneVerificationTime: Date.now() } : {}),
      };

      let userId = args.existingUserId;
      if (userId) {
        await ctx.db.patch(userId, userData);
      } else {
        userId = await ctx.db.insert("users", userData);
      }

      if (!args.existingUserId) {
        if (profile.inviteToken) {
          await acceptInviteForUser(ctx, userId, profile.inviteToken);
        } else if (profile.tenantName?.trim()) {
          await provisionWorkspace(ctx, userId, profile.tenantName);
        }
      }

      return userId;
    },
  },
});
