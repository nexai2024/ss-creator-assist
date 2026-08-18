export const PLAN_TIERS = ["starter", "growth", "enterprise"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_AMOUNT: Record<PlanTier, number> = {
  starter: 14900,
  growth: 49900,
  enterprise: 199900,
};

export const PLAN_MAUS: Record<PlanTier, number> = {
  starter: 5000,
  growth: 25000,
  enterprise: 1_000_000,
};

export const PLAN_LABEL: Record<PlanTier, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

export const PLAN_LOOKUP_KEY: Record<PlanTier, string> = {
  starter: "mse_starter_monthly",
  growth: "mse_growth_monthly",
  enterprise: "mse_enterprise_monthly",
};

export const PORTAL_CONFIG_META = "mse_console_portal";

export function isPlanTier(value: string | undefined | null): value is PlanTier {
  return value === "starter" || value === "growth" || value === "enterprise";
}

export function planFromStripePrice(price: {
  lookup_key?: string | null;
  metadata?: { plan?: string } | null;
}): PlanTier | null {
  const fromMeta = price.metadata?.plan;
  if (isPlanTier(fromMeta)) return fromMeta;
  const key = price.lookup_key;
  if (!key) return null;
  const match = PLAN_TIERS.find((tier) => PLAN_LOOKUP_KEY[tier] === key);
  return match ?? null;
}
