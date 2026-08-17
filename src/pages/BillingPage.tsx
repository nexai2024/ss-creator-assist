import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Check, Zap, Star, Crown, Download, AlertCircle } from 'lucide-react';
import type { Tenant } from '@/types';
import { PlanBadge, StatusBadge } from '@/components/Badges';
import { LoadingSpinner, EmptyState } from '@/components/States';
import { useToast } from '@/components/Toast';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

const PLAN_PRICES: Record<string, number> = {
  starter: 149,
  growth: 499,
  enterprise: 1999,
};

export function BillingPage({ tenant }: { tenant: Tenant | null }) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [upgrading, setUpgrading] = useState(false);
  const checkout = useAction(api.billing.createCheckoutSession);
  const logs = useQuery(
    api.dashboard.billingAudit,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
  );
  const invoices = (logs ?? []).map((log) => {
    const parts = (log.details ?? '').split('|');
    return {
      id: log.entity_id ?? log.id,
      amount: Number(parts[0] ?? 0),
      date: log.created_at,
      status: parts[1] ?? 'paid',
    };
  });

  const handleUpgrade = async (newPlan: string) => {
    if (!tenant || newPlan === tenant.plan_tier) return;
    setUpgrading(true);
    try {
      const { url } = await checkout({
        tenantId: tenant.id as Id<'tenants'>,
        plan: newPlan as 'starter' | 'growth' | 'enterprise',
      });
      window.location.assign(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start Stripe checkout', 'error');
      setUpgrading(false);
    }
  };

  const checkoutStatus = searchParams.get('checkout');

  if (!tenant) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Billing</h1>
        <div className="card">
          <EmptyState icon={<CreditCard className="w-7 h-7" />} title="Select a tenant" description="Choose a tenant to view billing and subscription details." />
        </div>
      </div>
    );
  }

  const currentPrice = PLAN_PRICES[tenant.plan_tier] ?? 0;
  const overageMaus = Math.max(0, tenant.monthly_active_users - tenant.included_maus);
  const overageCost = overageMaus * Number(tenant.overage_rate);

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Billing & Subscription</h1>
        <p className="text-sm text-neutral-500 mt-1">Checkout runs on Stripe. Your plan updates after the paid webhook.</p>
      </div>

      {checkoutStatus === 'success' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-success-50 text-success-700 text-sm">
          Checkout completed. Your plan updates when Stripe confirms payment.
        </div>
      )}
      {checkoutStatus === 'cancel' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-50 text-warning-700 text-sm">
          Checkout was cancelled. No plan change was made.
        </div>
      )}

      {/* Current plan */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Current Plan</p>
            <div className="flex items-center gap-3">
              <PlanBadge plan={tenant.plan_tier} />
              <span className="text-2xl font-bold text-neutral-900">${currentPrice}<span className="text-sm text-neutral-400 font-normal">/mo</span></span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={tenant.status} />
              <span className="text-xs text-neutral-400">Renews on the 1st of each month</span>
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-100">
          <div>
            <p className="text-xs text-neutral-400">Monthly Active Users</p>
            <p className="text-lg font-bold text-neutral-800 mt-0.5">{tenant.monthly_active_users.toLocaleString()} / {tenant.included_maus.toLocaleString()}</p>
            <div className="mt-2 h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${tenant.monthly_active_users > tenant.included_maus ? 'bg-danger-500' : 'bg-primary-500'}`}
                style={{ width: `${Math.min(100, (tenant.monthly_active_users / tenant.included_maus) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Overage Cost</p>
            <p className="text-lg font-bold text-neutral-800 mt-0.5">${overageCost.toFixed(2)}</p>
            <p className="text-xs text-neutral-400 mt-1">{overageMaus > 0 ? `${overageMaus.toLocaleString()} users at $${Number(tenant.overage_rate).toFixed(3)}/user` : 'No overage'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">SLA Uptime</p>
            <p className="text-lg font-bold text-neutral-800 mt-0.5">{tenant.sla_uptime}</p>
          </div>
        </div>
      </div>

      {/* Plan options */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-neutral-800 mb-4">Change Plan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { tier: 'starter', name: 'Starter', price: 149, icon: Zap, features: ['5,000 MAUs', '1 integration', 'Email support'] },
            { tier: 'growth', name: 'Growth', price: 499, icon: Star, features: ['25,000 MAUs', '3 integrations', 'AI deflection'] },
            { tier: 'enterprise', name: 'Enterprise', price: 1999, icon: Crown, features: ['Unlimited MAUs', 'Unlimited integrations', 'SSO/SAML'] },
          ] as const).map((plan) => {
            const Icon = plan.icon;
            const isCurrent = tenant.plan_tier === plan.tier;
            return (
              <div key={plan.tier} className={`p-4 rounded-xl border-2 transition-all ${isCurrent ? 'border-primary-300 bg-primary-50/30' : 'border-neutral-200 hover:border-neutral-300'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${plan.tier === 'starter' ? 'text-neutral-400' : plan.tier === 'growth' ? 'text-primary-500' : 'text-amber-500'}`} />
                  <span className="text-sm font-semibold text-neutral-800">{plan.name}</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900">${plan.price}<span className="text-xs text-neutral-400 font-normal">/mo</span></p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-neutral-600">
                      <Check className="w-3 h-3 text-success-500" />{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={isCurrent || upgrading}
                  className={`mt-4 w-full text-sm py-2 rounded-lg font-medium transition-colors ${
                    isCurrent ? 'bg-neutral-100 text-neutral-400 cursor-default'
                    : upgrading ? 'bg-neutral-100 text-neutral-400'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : upgrading ? <LoadingSpinner size={16} /> : `Pay with Stripe — ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-warning-50/50 text-warning-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Checkout creates a Stripe subscription. planTier is patched only after the signed checkout.session.completed webhook. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and SITE_URL on the Convex deployment. Webhook URL: https://YOUR_DEPLOYMENT.convex.site/stripe/webhook</span>
        </div>
      </div>

      {/* Invoice history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-800">Invoice History</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-neutral-400">No invoices yet. Invoices appear after your first billing cycle.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-700">INV-{inv.id.slice(-6).toUpperCase()}</p>
                  <p className="text-xs text-neutral-400">{new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-700">${inv.amount.toFixed(2)}</span>
                  <span className="badge bg-success-50 text-success-700">{inv.status}</span>
                  <button onClick={() => toast('Invoice download started', 'success')} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
