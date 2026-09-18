import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { asTenantId, asTicketId } from "./httpApi";
import { corsHeaders } from "./lib/cors";
import { isPlanTier, planFromStripePrice } from "./lib/stripePlans";

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const ticketApi = httpAction(async (ctx, req) => {
  const previewCors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: previewCors });
  }

  const apiKey = req.headers.get("X-MSE-API-KEY");
  const tenantHeader = req.headers.get("X-MSE-Tenant-ID");
  if (!apiKey || !tenantHeader) {
    return json({ error: "X-MSE-API-KEY and X-MSE-Tenant-ID headers are required" }, 401, previewCors);
  }

  const integration = await ctx.runQuery(internal.httpApi.lookupIntegration, {
    apiKey,
    tenantId: tenantHeader,
  });
  const cors = corsHeaders(req, [integration?.customDomain]);
  if (!integration) return json({ error: "Invalid API key or tenant ID" }, 403, cors);
  if (integration.status === "inactive") return json({ error: "Integration is inactive" }, 403, cors);

  try {
    await ctx.runMutation(internal.httpApi.consumeLimit, {
      key: `ticket-api:${integration.id}`,
      limit: 60,
      windowMs: 60_000,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Rate limited" }, 429, cors);
  }

  const tenantId = asTenantId(tenantHeader);
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/ticket-api/, "") || "/";

  try {
    if (req.method === "GET" && (path === "/tickets" || path === "/")) {
      const tickets = await ctx.runQuery(internal.httpApi.listTickets, { tenantId });
      return json({ tickets }, 200, cors);
    }

    const single = path.match(/^\/tickets\/([^/]+)$/);
    if (req.method === "GET" && single?.[1]) {
      const data = await ctx.runQuery(internal.httpApi.getTicket, {
        tenantId,
        ticketId: asTicketId(single[1]),
      });
      if (!data) return json({ error: "Ticket not found" }, 404, cors);
      return json(data, 200, cors);
    }

    if (req.method === "POST" && (path === "/tickets" || path === "/")) {
      const body = await req.json() as {
        subject?: string;
        category?: string;
        priority?: "low" | "medium" | "high" | "urgent";
        customer?: { email?: string; name?: string };
        body?: string;
      };
      if (!body.subject || !body.customer?.email || !body.customer?.name) {
        return json({ error: "subject, customer.email, and customer.name are required" }, 400, cors);
      }
      const ticket = await ctx.runMutation(internal.httpApi.createTicket, {
        tenantId,
        subject: body.subject,
        category: body.category,
        priority: body.priority,
        customerName: body.customer.name,
        customerEmail: body.customer.email,
        body: body.body,
      });
      return json({ ticket }, 201, cors);
    }

    return json({ error: "Not found" }, 404, cors);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Request failed" }, 500, cors);
  }
});

async function stripeSignatureValid(payload: string, header: string, secret: string): Promise<boolean> {
  const items = Object.fromEntries(header.split(",").map((part) => {
    const [k, ...rest] = part.split("=");
    return [k.trim(), rest.join("=")];
  }));
  const timestamp = items.t;
  const expected = items.v1;
  if (!timestamp || !expected) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
  return hex === expected;
}

const stripeWebhook = httpAction(async (ctx, req) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Stripe webhook is not configured", { status: 500 });
  const payload = await req.text();
  const header = req.headers.get("Stripe-Signature") ?? "";
  if (!(await stripeSignatureValid(payload, header, secret))) {
    return new Response("Invalid signature", { status: 400 });
  }
  const event = JSON.parse(payload) as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        customer?: string | { id?: string };
        subscription?: string | { id?: string };
        status?: string;
        metadata?: { tenantId?: string; plan?: string };
        amount_total?: number;
        items?: {
          data?: Array<{
            price?: {
              lookup_key?: string | null;
              metadata?: { plan?: string };
            };
          }>;
        };
      };
    };
  };
  const object = event.data?.object;
  const customer = typeof object?.customer === "string"
    ? object.customer
    : object?.customer?.id;
  const subscriptionId = typeof object?.subscription === "string"
    ? object.subscription
    : object?.subscription?.id;
  if (event.type === "checkout.session.completed") {
    const tenantId = object?.metadata?.tenantId;
    const plan = object?.metadata?.plan;
    if (tenantId && (plan === "starter" || plan === "growth" || plan === "enterprise")) {
      await ctx.runMutation(internal.billing.applyPaidPlan, {
        tenantId: asTenantId(tenantId),
        plan,
        stripeSessionId: object?.id ?? "unknown",
        amount: object?.amount_total,
        stripeCustomerId: customer,
        stripeSubscriptionId: subscriptionId,
      });
    }
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const tenantId = object?.metadata?.tenantId;
    const metaPlan = object?.metadata?.plan;
    const plan = planFromStripePrice(object?.items?.data?.[0]?.price ?? {})
      ?? (isPlanTier(metaPlan) ? metaPlan : undefined);
    await ctx.runMutation(internal.billing.applySubscriptionUpdated, {
      tenantId: tenantId ? asTenantId(tenantId) : undefined,
      stripeCustomerId: customer,
      stripeSubscriptionId: object?.id ?? "unknown",
      plan,
      status: object?.status ?? "active",
    });
  }
  if (event.type === "customer.subscription.deleted") {
    const tenantId = object?.metadata?.tenantId;
    await ctx.runMutation(internal.billing.applySubscriptionCanceled, {
      tenantId: tenantId ? asTenantId(tenantId) : undefined,
      stripeCustomerId: customer,
      stripeSubscriptionId: object?.id ?? "unknown",
    });
  }
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

function emailField(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (value && typeof value === "object" && "address" in value && typeof (value as { address: unknown }).address === "string") {
    return (value as { address: string }).address;
  }
  if (value && typeof value === "object" && "email" in value && typeof (value as { email: unknown }).email === "string") {
    return (value as { email: string }).email;
  }
  return "";
}

const emailInbound = httpAction(async (ctx, req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json() as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400, corsHeaders(req));
  }
  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
  const to = emailField(data.to) || emailField(payload.to);
  const from = emailField(data.from) || emailField(payload.from);
  const subject = typeof data.subject === "string" ? data.subject : typeof payload.subject === "string" ? payload.subject : "(no subject)";
  const text = typeof data.text === "string"
    ? data.text
    : typeof data.html === "string"
      ? data.html.replace(/<[^>]+>/g, " ")
      : typeof payload.text === "string" ? payload.text : "";
  const fromName = typeof data.from === "string" && data.from.includes("<")
    ? data.from.replace(/<[^>]+>/, "").trim()
    : undefined;
  const messageId = typeof data.email_id === "string"
    ? data.email_id
    : typeof data.message_id === "string"
      ? data.message_id
      : typeof payload.id === "string" ? payload.id : undefined;
  if (!to || !from) {
    return json({ error: "from and to are required" }, 400, corsHeaders(req));
  }
  const ticket = await ctx.runMutation(internal.inbound.createFromEmail, {
    to,
    from,
    fromName,
    subject,
    text,
    messageId,
  });
  return json({ received: true, ticket_id: ticket?.id ?? null }, ticket ? 200 : 404, corsHeaders(req));
});

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({ path: "/ticket-api/tickets", method: "GET", handler: ticketApi });
http.route({ path: "/ticket-api/tickets", method: "POST", handler: ticketApi });
http.route({ path: "/ticket-api/tickets", method: "OPTIONS", handler: ticketApi });
http.route({ pathPrefix: "/ticket-api/tickets/", method: "GET", handler: ticketApi });
http.route({ pathPrefix: "/ticket-api/tickets/", method: "OPTIONS", handler: ticketApi });
http.route({ path: "/stripe/webhook", method: "POST", handler: stripeWebhook });
http.route({ path: "/email/inbound", method: "POST", handler: emailInbound });
http.route({ path: "/email/inbound", method: "OPTIONS", handler: emailInbound });

const whatsappWebhook = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    try {
      const payload = await req.json() as Record<string, unknown>;
      const entries = Array.isArray(payload?.entry) ? payload.entry : [];
      const entry = entries[0] as Record<string, unknown> | undefined;
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      const change = changes[0] as Record<string, unknown> | undefined;
      const value = change?.value as Record<string, unknown> | undefined;
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const message = messages[0] as Record<string, unknown> | undefined;
      if (message) {
        const senderId = String(message.from ?? "");
        const textObj = message.text as Record<string, unknown> | undefined;
        const text = String(textObj?.body ?? "(non-text message)");
        const metadata = value?.metadata as Record<string, unknown> | undefined;
        const phoneNumberId = metadata?.phone_number_id ? String(metadata.phone_number_id) : undefined;
        const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
        const contact = contacts[0] as Record<string, unknown> | undefined;
        const profile = contact?.profile as Record<string, unknown> | undefined;
        const contactName = profile?.name ? String(profile.name) : undefined;
        await ctx.runMutation(internal.inbound.createFromSocial, {
          channel: "whatsapp",
          senderId,
          senderName: contactName,
          text,
          phoneNumberId,
        });
      }
    } catch (err) {
      console.error("WhatsApp webhook error", err);
    }
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response("Method not allowed", { status: 405 });
});

const instagramWebhook = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    try {
      const payload = await req.json() as Record<string, unknown>;
      const entries = Array.isArray(payload?.entry) ? payload.entry : [];
      const entry = entries[0] as Record<string, unknown> | undefined;
      const accountId = entry?.id ? String(entry.id) : undefined;
      const messagings = Array.isArray(entry?.messaging) ? entry.messaging : [];
      const messaging = messagings[0] as Record<string, unknown> | undefined;
      if (messaging) {
        const senderObj = messaging.sender as Record<string, unknown> | undefined;
        const senderId = String(senderObj?.id ?? "");
        const messageObj = messaging.message as Record<string, unknown> | undefined;
        const text = String(messageObj?.text ?? "(non-text message)");
        await ctx.runMutation(internal.inbound.createFromSocial, {
          channel: "instagram",
          senderId,
          text,
          accountId,
        });
      }
    } catch (err) {
      console.error("Instagram webhook error", err);
    }
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response("Method not allowed", { status: 405 });
});

http.route({ path: "/whatsapp/webhook", method: "GET", handler: whatsappWebhook });
http.route({ path: "/whatsapp/webhook", method: "POST", handler: whatsappWebhook });
http.route({ path: "/instagram/webhook", method: "GET", handler: instagramWebhook });
http.route({ path: "/instagram/webhook", method: "POST", handler: instagramWebhook });

export default http;
