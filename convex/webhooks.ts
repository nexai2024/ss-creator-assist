import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const getDest = internalQuery({
  args: { tenantId: v.id("tenants"), eventType: v.string() },
  returns: v.union(
    v.object({ url: v.string(), secret: v.string(), secretEnc: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("integrationSettings").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(20);
    const match = rows.find((r) => r.status === "active" && r.webhookUrl && r.webhookEvents.includes(args.eventType));
    if (!match?.webhookUrl) return null;
    return {
      url: match.webhookUrl,
      secret: match.webhookSecret ?? "",
      secretEnc: match.webhookSecretEnc ?? "",
    };
  },
});

export const record = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    eventType: v.string(),
    payload: v.string(),
    responseStatus: v.optional(v.number()),
    responseBody: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookDeliveries", args);
    return null;
  },
});

export const deliver = internalAction({
  args: {
    tenantId: v.id("tenants"),
    eventType: v.string(),
    payload: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dest = await ctx.runQuery(internal.webhooks.getDest, {
      tenantId: args.tenantId,
      eventType: args.eventType,
    });
    if (!dest) return;

    let hmacSecret = dest.secret;
    if (dest.secretEnc) {
      const { decryptSecret } = await import("./lib/secrets");
      hmacSecret = await decryptSecret(dest.secretEnc);
    }

    let signature = "";
    if (hmacSecret) {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(hmacSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(args.payload));
      signature = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(dest.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(signature ? { "X-MSE-Signature": signature } : {}),
          },
          body: args.payload,
        });
        lastStatus = res.status;
        lastBody = (await res.text()).slice(0, 500);
        if (res.ok) break;
      } catch (err) {
        lastStatus = 0;
        lastBody = err instanceof Error ? err.message : "fetch failed";
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }

    await ctx.runMutation(internal.webhooks.record, {
      tenantId: args.tenantId,
      eventType: args.eventType,
      payload: args.payload,
      responseStatus: lastStatus,
      responseBody: lastBody,
    });
    return null;
  },
});
