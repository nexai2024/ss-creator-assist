import { describe, expect, it } from 'vitest';
import { isPlanTier, planFromStripePrice, PLAN_LOOKUP_KEY } from '../../convex/lib/stripePlans';

describe('stripe plan catalog', () => {
  it('accepts known plan tiers', () => {
    expect(isPlanTier('growth')).toBe(true);
    expect(isPlanTier('pro')).toBe(false);
    expect(isPlanTier(undefined)).toBe(false);
  });

  it('reads the plan from price metadata first', () => {
    expect(planFromStripePrice({
      lookup_key: PLAN_LOOKUP_KEY.starter,
      metadata: { plan: 'enterprise' },
    })).toBe('enterprise');
  });

  it('falls back to lookup keys created for the Customer Portal', () => {
    expect(planFromStripePrice({ lookup_key: PLAN_LOOKUP_KEY.growth })).toBe('growth');
    expect(planFromStripePrice({ lookup_key: 'other' })).toBeNull();
  });
});
