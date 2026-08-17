import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { asTenantId, asTicketId } from "./httpApi";
import { corsHeaders } from "./lib/cors";

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
    data?: { object?: { id?: string; metadata?: { tenantId?: string; plan?: string }; amount_total?: number } };
  };
  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const tenantId = session?.metadata?.tenantId;
    const plan = session?.metadata?.plan;
    if (tenantId && (plan === "starter" || plan === "growth" || plan === "enterprise")) {
      await ctx.runMutation(internal.billing.applyPaidPlan, {
        tenantId: asTenantId(tenantId),
        plan,
        stripeSessionId: session?.id ?? "unknown",
        amount: session?.amount_total,
      });
    }
  }
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({ path: "/ticket-api/tickets", method: "GET", handler: ticketApi });
http.route({ path: "/ticket-api/tickets", method: "POST", handler: ticketApi });
http.route({ path: "/ticket-api/tickets", method: "OPTIONS", handler: ticketApi });
http.route({ pathPrefix: "/ticket-api/tickets/", method: "GET", handler: ticketApi });
http.route({ pathPrefix: "/ticket-api/tickets/", method: "OPTIONS", handler: ticketApi });
http.route({ path: "/stripe/webhook", method: "POST", handler: stripeWebhook });

export default http;
