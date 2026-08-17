import { type ComponentType } from 'react';
import {
  Plus,
  Code2,
  Globe,
  Webhook,
  ShieldCheck,
  CheckCircle2,
  PauseCircle,
  Lock,
  ArrowRight,
  Layers,
} from 'lucide-react';
import type { Tenant, IntegrationSettings } from '@/types';
import { useIntegrations, PLAN_INTEGRATION_LIMITS } from '@/hooks/useIntegrationSettings';
import { PlanBadge } from '@/components/Badges';
import { ErrorState, EmptyState, CardGridSkeleton } from '@/components/States';

export function IntegrationsPage({
  tenant,
  onOpenIntegration,
  onCreateIntegration,
}: {
  tenant: Tenant | null;
  onOpenIntegration: (integrationId: string) => void;
  onCreateIntegration: () => void;
}) {
  const { integrations, loading, error } = useIntegrations(tenant?.id ?? null);

  if (!tenant) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Integrations</h1>
        <div className="card">
          <EmptyState
            icon={<Layers className="w-7 h-7" />}
            title="Select a tenant"
            description="Choose a tenant from the selector in the top bar to view and manage their integrations."
          />
        </div>
      </div>
    );
  }

  if (loading) return <CardGridSkeleton />;
  if (error) return <ErrorState message={error} />;

  const limit = PLAN_INTEGRATION_LIMITS[tenant.plan_tier] ?? 1;
  const atLimit = limit !== -1 && integrations.length >= limit;
  const activeCount = integrations.filter((i) => i.status === 'active').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Integrations</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {tenant.name} · {integrations.length} {integrations.length === 1 ? 'integration' : 'integrations'}
            {limit === -1 ? ' · Unlimited plan' : ` of ${limit} allowed`}
          </p>
        </div>
        <button
          onClick={onCreateIntegration}
          disabled={atLimit}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Integration
        </button>
      </div>

      {/* Plan limit banner */}
      <div className={`card p-4 flex items-center justify-between ${atLimit ? 'bg-warning-50/50 border-warning-100' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${atLimit ? 'bg-warning-100' : 'bg-primary-50'}`}>
            {atLimit ? <Lock className="w-4.5 h-4.5 text-warning-600" /> : <Layers className="w-4.5 h-4.5 text-primary-600" />}
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700">
              {limit === -1
                ? 'Unlimited integrations on Enterprise plan'
                : `${integrations.length} / ${limit} integrations used`}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {atLimit
                ? 'Upgrade your plan to create more integrations'
                : `${activeCount} active · ${integrations.length - activeCount} inactive`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PlanBadge plan={tenant.plan_tier} />
          {atLimit && (
            <span className="text-xs font-medium text-warning-600">Limit reached</span>
          )}
        </div>
      </div>

      {/* Integration cards */}
      {integrations.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Code2 className="w-7 h-7" />}
            title="No integrations yet"
            description="Create your first integration to embed the support widget, configure API access, and set up webhooks for your app."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onClick={() => onOpenIntegration(integration.id)}
            />
          ))}

          {/* Add new card */}
          {!atLimit && (
            <button
              onClick={onCreateIntegration}
              className="card card-hover p-5 flex flex-col items-center justify-center text-center min-h-[200px] border-dashed border-2 border-neutral-200 hover:border-primary-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-primary-500" />
              </div>
              <p className="text-sm font-semibold text-neutral-700">Add Integration</p>
              <p className="text-xs text-neutral-400 mt-1">
                {limit === -1
                  ? 'No limit on your plan'
                  : `${limit - integrations.length} remaining`}
              </p>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({
  integration,
  onClick,
}: {
  integration: IntegrationSettings;
  onClick: () => void;
}) {
  const features: { icon: ComponentType<{ className?: string }>; label: string; enabled: boolean }[] = [
    { icon: Code2, label: 'Chat Widget', enabled: integration.widget_enabled },
    { icon: Globe, label: 'Help Center', enabled: !!(integration.custom_domain || integration.help_center_subdomain) },
    { icon: Webhook, label: 'Webhooks', enabled: !!integration.webhook_url },
    { icon: ShieldCheck, label: 'SSO', enabled: integration.sso_enabled },
  ];

  return (
    <button
      onClick={onClick}
      className="card card-hover p-5 text-left group flex flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${integration.branding_primary_color}15` }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: integration.branding_primary_color }}>
            <Code2 className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {integration.status === 'active' ? (
            <span className="badge bg-success-50 text-success-700">
              <CheckCircle2 className="w-3 h-3" />
              Active
            </span>
          ) : integration.status === 'inactive' ? (
            <span className="badge bg-neutral-100 text-neutral-500">
              <PauseCircle className="w-3 h-3" />
              Inactive
            </span>
          ) : (
            <span className="badge bg-warning-50 text-warning-700">
              Draft
            </span>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-neutral-800 mb-1 group-hover:text-primary-700 transition-colors">
        {integration.name}
      </h3>
      {integration.description && (
        <p className="text-xs text-neutral-400 line-clamp-2 mb-4">{integration.description}</p>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <span
              key={f.label}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                f.enabled
                  ? 'bg-primary-50 text-primary-600'
                  : 'bg-neutral-50 text-neutral-300'
              }`}
            >
              <Icon className="w-3 h-3" />
              {f.label}
            </span>
          );
        })}
      </div>

      <div className="mt-auto pt-3 border-t border-neutral-50 flex items-center justify-between">
        <span className="text-xs text-neutral-400 font-mono truncate">
          {integration.api_key_hint ? `••••${integration.api_key_hint}` : 'Key hashed'}
        </span>
        <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}
