import {
  PLAN_AMOUNT,
  PLAN_LABEL,
  PLAN_LOOKUP_KEY,
  PLAN_TIERS,
  PORTAL_CONFIG_META,
  type PlanTier,
} from "./stripePlans";

export type CatalogPrice = { plan: PlanTier; priceId: string; productId: string };
export type PlanCatalog = Record<PlanTier, CatalogPrice>;

export type ActiveSubscription = {
  id: string;
  itemId: string;
  priceId: string;
};

type StripeList<T> = { data: T[] };
type StripePrice = {
  id: string;
  lookup_key?: string | null;
  product: string | { id: string };
};
type StripeProduct = { id: string };
type StripePortalConfig = { id: string; active?: boolean; metadata?: Record<string, string> | null };
type StripeSubscription = {
  id: string;
  status: string;
  items?: { data?: Array<{ id: string; price?: { id?: string } }> };
};
type StripeCheckoutSession = { url?: string };
type StripePortalSession = { url?: string };

function productIdOf(product: StripePrice["product"]): string {
  return typeof product === "string" ? product : product.id;
}

function stripeErrorMessage(json: unknown): string | null {
  if (typeof json !== "object" || json === null || !("error" in json)) return null;
  const error = json.error;
  if (typeof error !== "object" || error === null || !("message" in error)) return null;
  return typeof error.message === "string" ? error.message : null;
}

async function stripeFetch(secret: string, method: "GET" | "POST", path: string, params?: URLSearchParams): Promise<unknown> {
  const query = method === "GET" && params && [...params.keys()].length > 0 ? `?${params.toString()}` : "";
  const res = await fetch(`https://api.stripe.com/v1${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? params : undefined,
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = stripeErrorMessage(json) ?? `Stripe request failed (${res.status})`;
    console.error("Stripe error", path, message);
    throw new Error(message);
  }
  return json;
}

async function stripeGet<T>(secret: string, path: string, params?: URLSearchParams): Promise<T> {
  return await stripeFetch(secret, "GET", path, params) as T;
}

async function stripePost<T>(secret: string, path: string, params: URLSearchParams): Promise<T> {
  return await stripeFetch(secret, "POST", path, params) as T;
}

export async function ensurePlanCatalog(secret: string): Promise<PlanCatalog> {
  const catalog = {} as PlanCatalog;
  for (const plan of PLAN_TIERS) {
    const lookup = PLAN_LOOKUP_KEY[plan];
    const existing = await stripeGet<StripeList<StripePrice>>(
      secret,
      "/prices",
      new URLSearchParams({ "lookup_keys[0]": lookup }),
    );
    const price = existing.data[0];
    if (price) {
      catalog[plan] = { plan, priceId: price.id, productId: productIdOf(price.product) };
      continue;
    }
    const product = await stripePost<StripeProduct>(secret, "/products", new URLSearchParams({
      name: `MSE Console ${PLAN_LABEL[plan]}`,
      "metadata[plan]": plan,
    }));
    const created = await stripePost<StripePrice>(secret, "/prices", new URLSearchParams({
      product: product.id,
      currency: "usd",
      unit_amount: String(PLAN_AMOUNT[plan]),
      "recurring[interval]": "month",
      lookup_key: lookup,
      "metadata[plan]": plan,
    }));
    catalog[plan] = { plan, priceId: created.id, productId: product.id };
  }
  return catalog;
}

export async function ensurePortalConfiguration(secret: string, catalog: PlanCatalog): Promise<string> {
  const listed = await stripeGet<StripeList<StripePortalConfig>>(
    secret,
    "/billing_portal/configurations",
    new URLSearchParams({ limit: "20", active: "true" }),
  );
  const found = listed.data.find((row) => row.metadata?.[PORTAL_CONFIG_META] === "true");
  if (found) return found.id;

  const body = new URLSearchParams({
    "business_profile[headline]": "MSE Console billing",
    "features[invoice_history][enabled]": "true",
    "features[payment_method_update][enabled]": "true",
    "features[subscription_cancel][enabled]": "true",
    "features[subscription_cancel][mode]": "at_period_end",
    "features[subscription_update][enabled]": "true",
    "features[subscription_update][proration_behavior]": "create_prorations",
    "features[subscription_update][default_allowed_updates][0]": "price",
    [`metadata[${PORTAL_CONFIG_META}]`]: "true",
  });
  PLAN_TIERS.forEach((plan, index) => {
    body.set(`features[subscription_update][products][${index}][product]`, catalog[plan].productId);
    body.set(`features[subscription_update][products][${index}][prices][0]`, catalog[plan].priceId);
  });
  const created = await stripePost<StripePortalConfig>(secret, "/billing_portal/configurations", body);
  return created.id;
}

function subscriptionFromPayload(sub: StripeSubscription | undefined): ActiveSubscription | null {
  if (!sub) return null;
  if (sub.status !== "active" && sub.status !== "trialing" && sub.status !== "past_due") return null;
  const item = sub.items?.data?.[0];
  if (!item?.id || !item.price?.id) return null;
  return { id: sub.id, itemId: item.id, priceId: item.price.id };
}

export async function findActiveSubscription(
  secret: string,
  customerId: string,
  knownId?: string | null,
): Promise<ActiveSubscription | null> {
  if (knownId) {
    try {
      const sub = await stripeGet<StripeSubscription>(secret, `/subscriptions/${knownId}`);
      const active = subscriptionFromPayload(sub);
      if (active) return active;
    } catch (err) {
      console.error("Stripe subscription lookup failed", err);
    }
  }
    const listed = await stripeGet<StripeList<StripeSubscription>>(
      secret,
      "/subscriptions",
      new URLSearchParams({ customer: customerId, limit: "10" }),
    );
  for (const sub of listed.data) {
    const active = subscriptionFromPayload(sub);
    if (active) return active;
  }
  return null;
}

export async function createCheckoutUrl(opts: {
  secret: string;
  siteUrl: string;
  tenantId: string;
  plan: PlanTier;
  priceId: string;
  customerId?: string | null;
  email?: string | null;
}): Promise<string> {
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${opts.siteUrl}/billing?checkout=success`,
    cancel_url: `${opts.siteUrl}/billing?checkout=cancel`,
    "line_items[0][quantity]": "1",
    "line_items[0][price]": opts.priceId,
    "metadata[tenantId]": opts.tenantId,
    "metadata[plan]": opts.plan,
    "subscription_data[metadata][tenantId]": opts.tenantId,
    "subscription_data[metadata][plan]": opts.plan,
  });
  if (opts.customerId) body.set("customer", opts.customerId);
  else if (opts.email) body.set("customer_email", opts.email);

  const session = await stripePost<StripeCheckoutSession>(opts.secret, "/checkout/sessions", body);
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalUrl(opts: {
  secret: string;
  siteUrl: string;
  customerId: string;
  configurationId?: string;
  returnQuery?: string;
}): Promise<string> {
  const body = new URLSearchParams({
    customer: opts.customerId,
    return_url: `${opts.siteUrl}/billing?${opts.returnQuery ?? "portal=return"}`,
  });
  if (opts.configurationId) body.set("configuration", opts.configurationId);
  const session = await stripePost<StripePortalSession>(opts.secret, "/billing_portal/sessions", body);
  if (!session.url) throw new Error("Stripe did not return a portal URL");
  return session.url;
}

export async function createPlanSwitchPortalUrl(opts: {
  secret: string;
  siteUrl: string;
  customerId: string;
  configurationId: string;
  subscription: ActiveSubscription;
  priceId: string;
}): Promise<string> {
  const body = new URLSearchParams({
    customer: opts.customerId,
    configuration: opts.configurationId,
    "flow_data[type]": "subscription_update_confirm",
    "flow_data[subscription_update_confirm][subscription]": opts.subscription.id,
    "flow_data[subscription_update_confirm][items][0][id]": opts.subscription.itemId,
    "flow_data[subscription_update_confirm][items][0][price]": opts.priceId,
    "flow_data[after_completion][type]": "redirect",
    "flow_data[after_completion][redirect][return_url]": `${opts.siteUrl}/billing?portal=plan`,
  });
  const session = await stripePost<StripePortalSession>(opts.secret, "/billing_portal/sessions", body);
  if (!session.url) throw new Error("Stripe did not return a portal URL");
  return session.url;
}

export async function updateSubscriptionPlan(
  secret: string,
  subscription: ActiveSubscription,
  priceId: string,
  plan: PlanTier,
): Promise<void> {
  await stripePost(secret, `/subscriptions/${subscription.id}`, new URLSearchParams({
    "items[0][id]": subscription.itemId,
    "items[0][price]": priceId,
    proration_behavior: "create_prorations",
    "metadata[plan]": plan,
  }));
}
