import { useState, useMemo } from 'react';
import { Check, Star, Crown, Zap, FlaskConical, TrendingUp } from 'lucide-react';
import { usePricingExperiments, useExperimentVariant } from '@/hooks/usePricingExperiments';
import { LoadingSpinner } from '@/components/States';
import { PlanBadge } from '@/components/Badges';
import { useNavigate } from 'react-router-dom';

export function PricingPage() {
  const navigate = useNavigate();
  const { experiments, loading } = usePricingExperiments();
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('mse_session_id');
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem('mse_session_id', id);
    return id;
  });

  const activeExperiment = experiments[0] ?? null;
  const variant = useExperimentVariant(activeExperiment?.id ?? null, sessionId);

  const plans = useMemo(() => {
    if (!activeExperiment || !variant) {
      // Default flat-rate pricing
      return [
        { tier: 'starter', name: 'Starter', price: 149, period: '/mo', features: ['5,000 MAUs', '1 integration', 'Email support', '99.5% SLA'] },
        { tier: 'growth', name: 'Growth', price: 499, period: '/mo', features: ['25,000 MAUs', '3 integrations', 'AI deflection bot', 'Priority support', '99.9% SLA'] },
        { tier: 'enterprise', name: 'Enterprise', price: 1999, period: '/mo', features: ['Unlimited MAUs', 'Unlimited integrations', 'SSO/SAML', 'Dedicated CSM', '99.99% SLA'] },
      ];
    }

    const prices = variant === 'A'
      ? JSON.parse(activeExperiment.variant_a_value)
      : JSON.parse(activeExperiment.variant_b_value);

    return [
      { tier: 'starter', name: 'Starter', price: prices.starter, period: variant === 'A' ? '/mo' : '/mo base', features: ['5,000 MAUs included', '1 integration', 'Email support', '99.5% SLA', variant === 'B' ? '$0.02/MAU overage' : 'No overage fees'] },
      { tier: 'growth', name: 'Growth', price: prices.growth, period: variant === 'A' ? '/mo' : '/mo base', features: ['25,000 MAUs included', '3 integrations', 'AI deflection bot', 'Priority support', '99.9% SLA', variant === 'B' ? '$0.015/MAU overage' : 'No overage fees'] },
      { tier: 'enterprise', name: 'Enterprise', price: prices.enterprise, period: variant === 'A' ? '/mo' : '/mo base', features: ['Unlimited MAUs', 'Unlimited integrations', 'SSO/SAML', 'Dedicated CSM', '99.99% SLA', 'Custom overage rates'] },
    ];
  }, [activeExperiment, variant]);

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-neutral-900">Pricing</h1>
        <p className="text-sm text-neutral-500 mt-2 max-w-lg mx-auto">
          Transparent pricing that scales with your support operations. No hidden fees.
        </p>
        {activeExperiment && variant && (
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
            <FlaskConical className="w-3.5 h-3.5" />
            You're viewing variant {variant}: {variant === 'A' ? activeExperiment.variant_a_label : activeExperiment.variant_b_label}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isGrowth = plan.tier === 'growth';
          return (
            <div
              key={plan.tier}
              className={`card p-6 flex flex-col relative ${isGrowth ? 'border-primary-300 ring-2 ring-primary-500/10' : ''}`}
            >
              {isGrowth && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary-500 text-white text-xs font-semibold">
                  Most Popular
                </div>
              )}
              <div className="flex items-center gap-2 mb-4">
                {plan.tier === 'starter' && <Zap className="w-5 h-5 text-neutral-400" />}
                {plan.tier === 'growth' && <Star className="w-5 h-5 text-primary-500" />}
                {plan.tier === 'enterprise' && <Crown className="w-5 h-5 text-amber-500" />}
                <h3 className="text-lg font-bold text-neutral-900">{plan.name}</h3>
              </div>
              <div className="mb-1">
                <span className="text-4xl font-bold text-neutral-900">${plan.price}</span>
                <span className="text-sm text-neutral-400 ml-1">{plan.period}</span>
              </div>
              <div className="mb-5">
                <PlanBadge plan={plan.tier as 'starter' | 'growth' | 'enterprise'} />
              </div>
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                    <Check className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/billing')}
                className={`mt-6 w-full ${isGrowth ? 'btn-primary' : 'btn-secondary'}`}
              >
                Choose {plan.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* Experiment results preview (admin insight) */}
      {activeExperiment && (
        <div className="card p-5 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-neutral-800">A/B Test: {activeExperiment.name}</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-4">{activeExperiment.description}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 ${variant === 'A' ? 'border-primary-300 bg-primary-50/30' : 'border-neutral-200'}`}>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Variant A</p>
              <p className="text-sm font-medium text-neutral-800 mt-1">{activeExperiment.variant_a_label}</p>
              <p className="text-xs text-neutral-400 mt-1">{activeExperiment.variant_a_value}</p>
            </div>
            <div className={`p-4 rounded-lg border-2 ${variant === 'B' ? 'border-primary-300 bg-primary-50/30' : 'border-neutral-200'}`}>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Variant B</p>
              <p className="text-sm font-medium text-neutral-800 mt-1">{activeExperiment.variant_b_label}</p>
              <p className="text-xs text-neutral-400 mt-1">{activeExperiment.variant_b_value}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
