import { useState } from 'react';
import { Building2, Users, TrendingUp, Check, Star, Crown, Zap } from 'lucide-react';
import type { Tenant } from '@/types';
import { PlanBadge, StatusBadge } from '@/components/Badges';
import { LoadingSpinner, ErrorState } from '@/components/States';

const planDetails: Record<string, { price: string; includedMaus: number; overage: string; sla: string; features: string[]; icon: typeof Star; color: string }> = {
  starter: {
    price: '$149',
    includedMaus: 5000,
    overage: '$0.02/MAU',
    sla: '99.5% Uptime',
    features: ['Dynamic Tickets', 'Knowledge Base', 'Webhooks', 'Standard Analytics', 'Shared Database (RLS Isolation)', '24-hour email response'],
    icon: Star,
    color: 'neutral',
  },
  growth: {
    price: '$499',
    includedMaus: 25000,
    overage: '$0.015/MAU',
    sla: '99.9% Uptime',
    features: ['All Starter features', 'Live Chat Engine', 'AI Auto-Deflection Bot', 'Multi-Region Data Isolation', '4-hour priority support'],
    icon: Zap,
    color: 'accent',
  },
  enterprise: {
    price: '$1,999',
    includedMaus: 100000,
    overage: 'Volume discounts',
    sla: '99.99% Uptime',
    features: ['All Growth features', 'Whitelabel / Custom Domain', 'SSO & SAML', 'Audit Logs', 'Dedicated VPC option', '15-min dedicated support'],
    icon: Crown,
    color: 'violet',
  },
};

export function TenantsPage({ tenants, loading, error, onTenantClick }: { tenants: Tenant[]; loading: boolean; error: string | null; onTenantClick?: (t: Tenant) => void }) {
  const [planFilter, setPlanFilter] = useState<string>('all');

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;
  if (error) return <ErrorState message={error} />;

  const filtered = planFilter === 'all' ? tenants : tenants.filter((t) => t.plan_tier === planFilter);
  const totalMaus = tenants.reduce((sum, t) => sum + t.monthly_active_users, 0);
  const totalRevenue = tenants.reduce((sum, t) => {
    const plan = planDetails[t.plan_tier];
    const basePrice = parseInt(plan.price.replace(/[^0-9]/g, '')) || 0;
    const overage = Math.max(0, t.monthly_active_users - t.included_maus) * t.overage_rate;
    return sum + basePrice + overage;
  }, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Tenants & Pricing</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage customer tenants and view pricing tiers</p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary-600" /></div>
            <div><p className="text-2xl font-bold text-neutral-900">{tenants.length}</p><p className="text-sm text-neutral-500">Total Tenants</p></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center"><Users className="w-5 h-5 text-accent-600" /></div>
            <div><p className="text-2xl font-bold text-neutral-900">{totalMaus.toLocaleString()}</p><p className="text-sm text-neutral-500">Total MAUs</p></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-success-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-success-600" /></div>
            <div><p className="text-2xl font-bold text-neutral-900">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p><p className="text-sm text-neutral-500">Est. Monthly Revenue</p></div>
          </div>
        </div>
      </div>

      {/* Pricing tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(['starter', 'growth', 'enterprise'] as const).map((planKey) => {
          const plan = planDetails[planKey];
          const Icon = plan.icon;
          const tenantCount = tenants.filter((t) => t.plan_tier === planKey).length;
          const isGrowth = planKey === 'growth';
          return (
            <div key={planKey} className={`card p-6 relative ${isGrowth ? 'border-accent-300 ring-1 ring-accent-200' : ''}`}>
              {isGrowth && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent-500 text-white text-xs font-semibold shadow-sm">
                  Most Popular
                </div>
              )}
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  plan.color === 'neutral' ? 'bg-neutral-100 text-neutral-600' :
                  plan.color === 'accent' ? 'bg-accent-50 text-accent-600' :
                  'bg-violet-50 text-violet-600'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold capitalize text-neutral-900">{planKey}</p>
                  <p className="text-xs text-neutral-400">{tenantCount} {tenantCount === 1 ? 'tenant' : 'tenants'}</p>
                </div>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-neutral-900">{plan.price}</span>
                <span className="text-sm text-neutral-400">/month</span>
              </div>
              <p className="text-xs text-neutral-400 mb-1">{plan.includedMaus.toLocaleString()} included MAUs</p>
              <p className="text-xs text-neutral-400 mb-4">Overage: {plan.overage} · {plan.sla}</p>
              <div className="space-y-2 pt-3 border-t border-neutral-100">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      plan.color === 'neutral' ? 'text-neutral-400' :
                      plan.color === 'accent' ? 'text-accent-500' :
                      'text-violet-500'
                    }`} />
                    <span className="text-sm text-neutral-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenants table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-800">All Tenants</h3>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="input w-auto py-1.5 text-sm">
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-neutral-50/50 border-b border-neutral-100">
              <tr>
                <th className="table-header px-5 py-3">Tenant</th>
                <th className="table-header px-4 py-3">Plan</th>
                <th className="table-header px-4 py-3">Status</th>
                <th className="table-header px-4 py-3">MAUs</th>
                <th className="table-header px-4 py-3 hidden md:table-cell">Usage</th>
                <th className="table-header px-4 py-3 hidden lg:table-cell">SLA</th>
                <th className="table-header px-4 py-3 hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filtered.map((t) => {
                const usagePct = (t.monthly_active_users / t.included_maus) * 100;
                return (
                  <tr key={t.id} className="hover:bg-neutral-50/50 transition-colors cursor-pointer" onClick={() => onTenantClick?.(t)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-sm font-bold text-neutral-600">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-800">{t.name}</p>
                          <p className="text-xs text-neutral-400">{t.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><PlanBadge plan={t.plan_tier} /></td>
                    <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-neutral-700">{t.monthly_active_users.toLocaleString()}</p>
                      <p className="text-xs text-neutral-400">of {t.included_maus.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${usagePct > 90 ? 'bg-danger-500' : usagePct > 70 ? 'bg-warning-500' : 'bg-success-500'}`}
                            style={{ width: `${Math.min(100, usagePct)}%` }}
                          />
                        </div>
                        <span className="text-xs text-neutral-500">{usagePct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-neutral-500">{t.sla_uptime}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-neutral-500">{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
