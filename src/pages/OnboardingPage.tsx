import { useState, type ComponentType } from 'react';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Palette,
  Code2,
  Webhook,
  CheckCircle2,
  Building2,
  Globe,
  Lock,
  Zap,
  Copy,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import type { Tenant, IntegrationSettings } from '@/types';
import { useIntegrations, PLAN_INTEGRATION_LIMITS } from '@/hooks/useIntegrationSettings';
import { LoadingSpinner } from '@/components/States';
import { PlanBadge } from '@/components/Badges';
import { isLocalAppOrigin, publicAppOrigin, widgetSnippet } from '@/lib/public';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

const STEPS = [
  { id: 0, label: 'Name', icon: Building2 },
  { id: 1, label: 'Branding', icon: Palette },
  { id: 2, label: 'Widget', icon: Code2 },
  { id: 3, label: 'Webhooks', icon: Webhook },
  { id: 4, label: 'Review', icon: Rocket },
];

export function OnboardingPage({
  tenant,
  onCompleted,
  onCancel,
}: {
  tenant: Tenant | null;
  onCompleted: (integrationId: string) => void;
  onCancel: () => void;
}) {
  const { integrations, loading, create } = useIntegrations(tenant?.id ?? null);
  const updateIntegration = useMutation(api.integrations.update);
  const finishOnboarding = useMutation(api.integrations.finishOnboarding);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [newIntegration, setNewIntegration] = useState<IntegrationSettings | null>(null);

  // Form state for the new integration
  const [form, setForm] = useState({
    name: '',
    description: '',
    branding_primary_color: '#3b82f6',
    branding_logo_url: '',
    help_center_subdomain: '',
    custom_domain: '',
    widget_enabled: true,
    widget_position: 'bottom-right',
    widget_color: '#3b82f6',
    widget_greeting: 'Hi! How can we help you today?',
    webhook_url: '',
    webhook_secret: '',
    webhook_events: [] as string[],
  });

  if (!tenant) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg mx-auto mb-4">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Create New Integration</h1>
          <p className="text-sm text-neutral-500 mt-2">Select a tenant from the top bar to begin creating a new integration.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;

  const limit = PLAN_INTEGRATION_LIMITS[tenant.plan_tier] ?? 1;
  const atLimit = limit !== -1 && integrations.length >= limit;

  if (atLimit) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-warning-50 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-warning-600" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Integration Limit Reached</h2>
          <p className="text-sm text-neutral-500 mb-4">
            Your <span className="font-medium capitalize">{tenant.plan_tier}</span> plan allows {limit} {limit === 1 ? 'integration' : 'integrations'}.
            You currently have {integrations.length}. Upgrade your plan to create more integrations.
          </p>
          <div className="flex items-center justify-center gap-2">
            <PlanBadge plan={tenant.plan_tier} />
            <button onClick={onCancel} className="btn-secondary">Back to Integrations</button>
          </div>
        </div>
      </div>
    );
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreate = async (): Promise<IntegrationSettings | null> => {
    setSaving(true);
    const created = await create(form.name, form.description || undefined);
    if (created) {
      setNewIntegration(created);
      setForm((f) => ({
        ...f,
        webhook_secret: created.webhook_secret ?? f.webhook_secret,
      }));
    }
    setSaving(false);
    return created;
  };

  const handleNext = async () => {
    if (!newIntegration) {
      if (step === 0 && !form.name) return;
      // Create the integration and immediately advance to step 1
      const created = await handleCreate();
      if (created) setStep(1);
      return;
    }

    setSaving(true);
    const patch: Partial<IntegrationSettings> = {};

    if (step === 1) {
      patch.branding_primary_color = form.branding_primary_color;
      patch.branding_logo_url = form.branding_logo_url || null;
      patch.help_center_subdomain = form.help_center_subdomain || null;
      patch.custom_domain = form.custom_domain || null;
    } else if (step === 2) {
      patch.widget_enabled = form.widget_enabled;
      patch.widget_position = form.widget_position;
      patch.widget_color = form.widget_color;
      patch.widget_greeting = form.widget_greeting || null;
    } else if (step === 3) {
      patch.webhook_url = form.webhook_url || null;
      patch.webhook_secret = form.webhook_secret || null;
      patch.webhook_events = form.webhook_events;
    }

    if (Object.keys(patch).length > 0) {
      await updateIntegration({
        integrationId: newIntegration.id as Id<'integrationSettings'>,
        patch: {
          brandingPrimaryColor: patch.branding_primary_color,
          brandingLogoUrl: patch.branding_logo_url ?? undefined,
          helpCenterSubdomain: patch.help_center_subdomain ?? undefined,
          customDomain: patch.custom_domain ?? undefined,
          widgetEnabled: patch.widget_enabled,
          widgetPosition: patch.widget_position,
          widgetColor: patch.widget_color,
          widgetGreeting: patch.widget_greeting ?? undefined,
          webhookUrl: patch.webhook_url ?? undefined,
          webhookSecret:
            patch.webhook_secret && patch.webhook_secret !== newIntegration.webhook_secret
              ? patch.webhook_secret
              : undefined,
          webhookEvents: patch.webhook_events,
          onboardingStep: step + 1,
        },
      });
      setNewIntegration((prev) => prev ? { ...prev, ...patch, onboarding_step: step + 1 } : prev);
    } else {
      await updateIntegration({
        integrationId: newIntegration.id as Id<'integrationSettings'>,
        patch: { onboardingStep: step + 1 },
      });
    }

    const nextStep = step + 1;
    setStep(nextStep);
    setSaving(false);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onCancel();
  };

  const handleFinish = async () => {
    if (!newIntegration) return;
    setSaving(true);
    await finishOnboarding({ integrationId: newIntegration.id as Id<'integrationSettings'> });

    setSaving(false);
    onCompleted(newIntegration.id);
  };

  const apiKey = newIntegration?.api_key ?? 'mse_live_xxx';
  const widgetSnippetCode = newIntegration
    ? widgetSnippet({
        origin: publicAppOrigin(),
        integrationId: newIntegration.id,
        position: form.widget_position,
        greeting: form.widget_greeting,
        color: form.widget_color,
        name: form.name,
      })
    : '';

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <button onClick={onCancel} className="btn-ghost -ml-2 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Cancel
      </button>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Create New Integration</h1>
        <p className="text-sm text-neutral-500 mt-1">Set up a new integration for {tenant.name} in 5 quick steps</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isComplete = i < step;
          const isCurrent = i === step;
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isComplete ? 'bg-success-500 text-white shadow-sm'
                    : isCurrent ? 'bg-primary-600 text-white shadow-md ring-4 ring-primary-100'
                    : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-medium ${isCurrent ? 'text-primary-700' : isComplete ? 'text-success-600' : 'text-neutral-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all duration-500 ${i < step ? 'bg-success-400' : 'bg-neutral-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="card p-6 sm:p-8 animate-fade-in" key={step}>
        {step === 0 && (
          <StepName form={form} setForm={setForm} tenant={tenant} apiKey={apiKey} created={!!newIntegration} copied={copied} onCopy={copyToClipboard} />
        )}
        {step === 1 && (
          <StepBranding form={form} setForm={setForm} />
        )}
        {step === 2 && (
          <StepWidget form={form} setForm={setForm} tenantId={tenant.id} widgetSnippet={widgetSnippetCode} copied={copied} onCopy={copyToClipboard} />
        )}
        {step === 3 && (
          <StepWebhooks form={form} setForm={setForm} />
        )}
        {step === 4 && (
          <StepReview form={form} tenant={tenant} apiKey={apiKey} widgetSnippet={widgetSnippetCode} copied={copied} onCopy={copyToClipboard} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button onClick={handleBack} disabled={saving} className="btn-secondary">
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < 4 ? (
          <button onClick={handleNext} disabled={saving || (step === 0 && !form.name)} className="btn-primary">
            {saving ? <LoadingSpinner size={16} /> : <ChevronRight className="w-4 h-4" />}
            Continue
          </button>
        ) : (
          <button onClick={handleFinish} disabled={saving} className="btn-primary">
            {saving ? <LoadingSpinner size={16} /> : <CheckCircle2 className="w-4 h-4" />}
            Create & Activate
          </button>
        )}
      </div>
    </div>
  );
}

/* --- Step 0: Name & API Key --- */
function StepName({ form, setForm, tenant, apiKey, created, copied, onCopy }: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  tenant: Tenant;
  apiKey: string;
  created: boolean;
  copied: string | null;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Building2} title="Name Your Integration" description="Give this integration a name so you can identify it later. For example: 'Production Website' or 'Mobile App'." />

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Integration Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input"
          placeholder="e.g. Production Website"
          autoFocus
        />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Description (optional)</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input"
          placeholder="e.g. Support widget for the main marketing site"
        />
      </div>

      {created && (
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-2 block">Your API Key</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-lg bg-neutral-900 text-accent-300 font-mono text-sm overflow-x-auto scrollbar-thin">
              {apiKey}
            </div>
            <button onClick={() => onCopy(apiKey, 'apikey')} className="btn-secondary flex-shrink-0">
              {copied === 'apikey' ? <Check className="w-4 h-4 text-success-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Pass this as the <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono text-xs">X-MSE-API-KEY</code> header
            along with <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono text-xs">X-MSE-Tenant-ID: {tenant.id}</code> in all server-to-server calls.
          </p>
        </div>
      )}

      <div className="rounded-lg bg-primary-50/50 border border-primary-100 p-4">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-neutral-700">Each integration gets its own API key</p>
            <p className="text-xs text-neutral-500 mt-1">This lets you use separate keys for different apps or environments. If one key is compromised, only that integration is affected.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Step 1: Branding --- */
function StepBranding({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Palette} title="Branding & Help Center" description="Customize how the support center looks for your customers." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Primary Brand Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.branding_primary_color} onChange={(e) => setForm({ ...form, branding_primary_color: e.target.value })} className="w-12 h-10 rounded-lg border border-neutral-200 cursor-pointer" />
            <input type="text" value={form.branding_primary_color} onChange={(e) => setForm({ ...form, branding_primary_color: e.target.value })} className="input flex-1 font-mono" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Logo URL</label>
          <input type="url" value={form.branding_logo_url} onChange={(e) => setForm({ ...form, branding_logo_url: e.target.value })} className="input" placeholder="https://cdn.yourcompany.com/logo.png" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Help Center Subdomain</label>
          <div className="flex items-center">
            <input type="text" value={form.help_center_subdomain} onChange={(e) => setForm({ ...form, help_center_subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className="input rounded-r-none" placeholder="yourcompany" />
            <span className="px-3 py-2.5 bg-neutral-100 border border-l-0 border-neutral-200 rounded-r-lg text-sm text-neutral-400 whitespace-nowrap">.mse.help</span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Custom Domain (optional)</label>
          <input type="text" value={form.custom_domain} onChange={(e) => setForm({ ...form, custom_domain: e.target.value })} className="input" placeholder="help.yourcompany.com" />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Live Preview</p>
        </div>
        <div className="p-6" style={{ background: `linear-gradient(135deg, ${form.branding_primary_color}15, ${form.branding_primary_color}05)` }}>
          <div className="flex items-center gap-3 mb-4">
            {form.branding_logo_url ? (
              <img src={form.branding_logo_url} alt="Logo" className="h-8 w-auto rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: form.branding_primary_color }}>
                {(form.help_center_subdomain || 'Y').charAt(0).toUpperCase()}
              </div>
            )}
            <p className="text-sm font-semibold text-neutral-800">{form.help_center_subdomain || 'yourcompany'} Help Center</p>
          </div>
          <div className="space-y-2">
            <div className="h-3 rounded-full bg-neutral-200 w-3/4" />
            <div className="h-3 rounded-full bg-neutral-100 w-1/2" />
          </div>
          <button className="mt-4 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-sm" style={{ background: form.branding_primary_color }}>
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Step 2: Widget --- */
function StepWidget({ form, setForm, widgetSnippet, copied, onCopy }: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  tenantId: string;
  widgetSnippet: string;
  copied: string | null;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Code2} title="Chat Widget" description="Configure and embed the support chat widget on your website or app." />

      <div className="flex items-center justify-between p-4 rounded-lg bg-neutral-50">
        <div>
          <p className="text-sm font-medium text-neutral-700">Widget Enabled</p>
          <p className="text-xs text-neutral-400 mt-0.5">Show the chat widget on your site</p>
        </div>
        <button
          onClick={() => setForm({ ...form, widget_enabled: !form.widget_enabled })}
          className={`relative w-11 h-6 rounded-full transition-colors ${form.widget_enabled ? 'bg-primary-500' : 'bg-neutral-300'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${form.widget_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Widget Position</label>
          <select value={form.widget_position} onChange={(e) => setForm({ ...form, widget_position: e.target.value })} className="input">
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Widget Accent Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.widget_color} onChange={(e) => setForm({ ...form, widget_color: e.target.value })} className="w-12 h-10 rounded-lg border border-neutral-200 cursor-pointer" />
            <input type="text" value={form.widget_color} onChange={(e) => setForm({ ...form, widget_color: e.target.value })} className="input flex-1 font-mono" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Welcome Greeting</label>
        <input type="text" value={form.widget_greeting} onChange={(e) => setForm({ ...form, widget_greeting: e.target.value })} className="input" placeholder="Hi! How can we help you today?" />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-2 block">Embed Code</label>
        <p className="text-xs text-neutral-400 mb-3">Paste this snippet before the closing <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono text-xs">&lt;/body&gt;</code> tag on your website.</p>
        {isLocalAppOrigin(publicAppOrigin()) && (
          <div className="flex items-start gap-2 p-3 mb-3 rounded-lg bg-warning-50 text-warning-800 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              This snippet points at {publicAppOrigin()}. Another website cannot load localhost. Set VITE_PUBLIC_APP_URL to your public console URL, or test the embed on a local HTML file while this app is running.
            </span>
          </div>
        )}
        <div className="relative">
          <pre className="px-4 py-3.5 rounded-lg bg-neutral-900 text-neutral-200 font-mono text-xs overflow-x-auto scrollbar-thin leading-relaxed">
            {widgetSnippet || '<!-- API key will appear after step 1 -->'}
          </pre>
          {widgetSnippet && (
            <button onClick={() => onCopy(widgetSnippet, 'widget')} className="absolute top-3 right-3 btn-secondary py-1.5 px-2.5 text-xs">
              {copied === 'widget' ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'widget' ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Widget Preview</p>
        </div>
        <div className="relative h-64 bg-neutral-50">
          <div className={`absolute ${form.widget_position === 'bottom-right' ? 'bottom-4 right-4' : form.widget_position === 'bottom-left' ? 'bottom-4 left-4' : form.widget_position === 'top-right' ? 'top-4 right-4' : 'top-4 left-4'}`}>
            <div className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform" style={{ background: form.widget_color }}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <Globe className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">Your website</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Step 3: Webhooks --- */
function StepWebhooks({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const allEvents = [
    { id: 'TicketCreated', label: 'Ticket Created', description: 'Fired when a new ticket is submitted' },
    { id: 'TicketResolved', label: 'Ticket Resolved', description: 'Fired when a ticket is marked resolved' },
    { id: 'ChatMessageSent', label: 'Chat Message Sent', description: 'Fired on every new chat message' },
    { id: 'ArticleUpdated', label: 'KB Article Updated', description: 'Fired when a knowledge base article changes' },
    { id: 'GdprErasureCompleted', label: 'GDPR Erasure Completed', description: 'Fired when a data purge finishes' },
    { id: 'SlaBreached', label: 'SLA Breached', description: 'Fired when a ticket misses its SLA deadline' },
  ];

  const toggleEvent = (id: string) => {
    setForm((prev) => ({
      ...prev,
      webhook_events: prev.webhook_events.includes(id) ? prev.webhook_events.filter((e) => e !== id) : [...prev.webhook_events, id],
    }));
  };

  return (
    <div className="space-y-6">
      <StepHeader icon={Webhook} title="Webhook Configuration" description="Receive real-time event notifications at your endpoint. You can skip this and configure it later." />

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Webhook Endpoint URL</label>
        <input type="url" value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} className="input" placeholder="https://api.yourcompany.com/webhooks/mse" />
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Signing Secret</label>
        <input type="text" value={form.webhook_secret} readOnly className="input font-mono" placeholder="Generated on create — copy now" />
        <p className="text-xs text-neutral-400 mt-2">The signing secret is generated server-side and shown only during this wizard.</p>
        <p className="text-xs text-neutral-400 mt-2">We sign every webhook payload with HMAC-SHA256 using this secret.</p>
      </div>

      <div>
        <label className="text-sm font-medium text-neutral-700 mb-3 block">Subscribe to Events</label>
        <div className="space-y-2">
          {allEvents.map((evt) => {
            const checked = form.webhook_events.includes(evt.id);
            return (
              <button
                key={evt.id}
                onClick={() => toggleEvent(evt.id)}
                className={`w-full flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all ${
                  checked ? 'border-primary-300 bg-primary-50/50' : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${checked ? 'bg-primary-500' : 'border border-neutral-300'}`}>
                  {checked && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">{evt.label}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{evt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --- Step 4: Review --- */
function StepReview({ form, apiKey, widgetSnippet, copied, onCopy }: {
  form: FormState;
  tenant: Tenant;
  apiKey: string;
  widgetSnippet: string;
  copied: string | null;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Rocket} title="Review & Create" description="Review your settings and create the integration." />

      <div className="space-y-3">
        <ReviewRow icon={Building2} label="Name" value={form.name} />
        <ReviewRow icon={Lock} label="API Key" value={apiKey} mono />
        <ReviewRow icon={Palette} label="Brand Color" value={form.branding_primary_color} colorSwatch={form.branding_primary_color} />
        <ReviewRow icon={Globe} label="Help Center" value={form.custom_domain || `${form.help_center_subdomain || 'yourcompany'}.mse.help`} />
        <ReviewRow icon={Code2} label="Widget" value={form.widget_enabled ? `Enabled (${form.widget_position})` : 'Disabled'} />
        <ReviewRow icon={Webhook} label="Webhook" value={form.webhook_url || 'Not configured'} />
        <ReviewRow icon={Webhook} label="Events" value={form.webhook_events.length > 0 ? `${form.webhook_events.length} subscribed` : 'None'} />
      </div>

      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Embed Code</p>
          <button onClick={() => onCopy(widgetSnippet, 'review')} className="btn-secondary py-1 px-2 text-xs">
            {copied === 'review' ? <Check className="w-3 h-3 text-success-500" /> : <Copy className="w-3 h-3" />}
            {copied === 'review' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="px-4 py-3.5 bg-neutral-900 text-neutral-200 font-mono text-xs overflow-x-auto scrollbar-thin leading-relaxed">
          {widgetSnippet}
        </pre>
      </div>

      <div className="rounded-lg bg-success-50/50 border border-success-100 p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-neutral-700">Ready to create!</p>
          <p className="text-xs text-neutral-500 mt-1">Click "Create & Activate" to finalize. The integration will be active immediately and the widget will be live.</p>
        </div>
      </div>
    </div>
  );
}

/* --- Shared --- */
type FormState = {
  name: string;
  description: string;
  branding_primary_color: string;
  branding_logo_url: string;
  help_center_subdomain: string;
  custom_domain: string;
  widget_enabled: boolean;
  widget_position: string;
  widget_color: string;
  widget_greeting: string;
  webhook_url: string;
  webhook_secret: string;
  webhook_events: string[];
};

function StepHeader({ icon: Icon, title, description }: { icon: ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary-600" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ReviewRow({ icon: Icon, label, value, mono, colorSwatch }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
  colorSwatch?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-neutral-50/50">
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 text-neutral-400" />
        <span className="text-sm text-neutral-500">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {colorSwatch && <span className="w-4 h-4 rounded-full border border-neutral-200" style={{ background: colorSwatch }} />}
        <span className={`text-sm font-medium text-neutral-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
      </div>
    </div>
  );
}
