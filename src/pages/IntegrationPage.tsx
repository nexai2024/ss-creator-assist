import { useState, useEffect, type ComponentType } from 'react';
import {
  Key,
  Code2,
  Webhook,
  Palette,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Lock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ArrowLeft,
  Trash2,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import type { IntegrationSettings } from '@/types';
import { useIntegration } from '@/hooks/useIntegrationSettings';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { createTicketCurl, ticketApiUrl, widgetSnippet } from '@/lib/public';
import { convexSiteUrl } from '@/lib/convex';

type Tab = 'api' | 'widget' | 'webhooks' | 'branding' | 'sso';

const TABS: { id: Tab; label: string; icon: typeof Key }[] = [
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'widget', label: 'Chat Widget', icon: Code2 },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'sso', label: 'SSO & Security', icon: ShieldCheck },
];

export function IntegrationPage({
  integrationId,
  onBack,
}: {
  integrationId: string | null;
  onBack: () => void;
}) {
  const { integration, loading, error, update, remove, rotateApiKey, rotateWebhookSecret } = useIntegration(integrationId);
  const [tab, setTab] = useState<Tab>('api');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  if (!integrationId) {
    return (
      <div className="animate-fade-in">
        <div className="card">
          <EmptyState icon={<Code2 className="w-7 h-7" />} title="No integration selected" description="Go back and select an integration to manage." />
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;
  if (error) return <ErrorState message={error} />;
  if (!integration) return <ErrorState message="Integration not found." />;

  const handleToggleStatus = async () => {
    const newStatus = integration.status === 'active' ? 'inactive' : 'active';
    await update({ status: newStatus });
    toast(`Integration ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await remove();
      toast('Integration deleted', 'success');
      onBack();
    } catch {
      toast('Failed to delete integration', 'error');
      setShowDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      {/* Back button */}
      <button onClick={onBack} className="btn-ghost -ml-2">
        <ArrowLeft className="w-4 h-4" />
        Back to integrations
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${integration.branding_primary_color}15` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: integration.branding_primary_color }}>
              <Code2 className="w-4 h-4 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{integration.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {integration.status === 'active' ? (
                <span className="badge bg-success-50 text-success-700"><CheckCircle2 className="w-3 h-3" /> Active</span>
              ) : integration.status === 'inactive' ? (
                <span className="badge bg-neutral-100 text-neutral-500"><PauseCircle className="w-3 h-3" /> Inactive</span>
              ) : (
                <span className="badge bg-warning-50 text-warning-700">Draft</span>
              )}
              {integration.description && <span className="text-xs text-neutral-400">{integration.description}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleStatus}
            className={integration.status === 'active' ? 'btn-secondary' : 'btn-primary'}
          >
            {integration.status === 'active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            {integration.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => setShowDelete(true)} className="btn-ghost text-danger-500 hover:bg-danger-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-neutral-200 overflow-x-auto scrollbar-thin">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                active ? 'border-primary-500 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'api' && <ApiTab integration={integration} update={update} rotateApiKey={rotateApiKey} />}
      {tab === 'widget' && <WidgetTab integration={integration} update={update} />}
      {tab === 'webhooks' && <WebhooksTab integration={integration} update={update} rotateWebhookSecret={rotateWebhookSecret} />}
      {tab === 'branding' && <BrandingTab integration={integration} update={update} />}
      {tab === 'sso' && <SsoTab integration={integration} update={update} />}

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Integration" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Are you sure you want to delete <span className="font-semibold">{integration.name}</span>? This will revoke the API key immediately and all widget embeds using this integration will stop working. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              {deleting ? <LoadingSpinner size={16} /> : <Trash2 className="w-4 h-4" />}
              Delete Integration
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* --- API Keys Tab --- */
function ApiTab({
  integration,
  update,
  rotateApiKey,
}: {
  integration: IntegrationSettings;
  update: (p: Partial<IntegrationSettings>) => Promise<void>;
  rotateApiKey: () => Promise<IntegrationSettings | null>;
}) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(integration.api_key);
  const [name, setName] = useState(integration.name);
  const debouncedName = useDebounce(name, 500);
  const { toast } = useToast();
  const siteUrl = convexSiteUrl;
  const displayKey = revealedKey ?? (integration.api_key_hint ? `mse_live_••••${integration.api_key_hint}` : 'No key shown');
  const curl = siteUrl
    ? createTicketCurl({
        siteUrl,
        apiKey: revealedKey ?? 'mse_live_xxx',
        tenantId: integration.tenant_id,
      })
    : 'Set VITE_CONVEX_URL (and optionally VITE_CONVEX_SITE_URL), then reload this page.';

  useEffect(() => {
    if (debouncedName !== integration.name) {
      update({ name: debouncedName });
    }
  }, [debouncedName]);

  const copy = () => {
    if (!revealedKey) {
      toast('The full key is shown only once. Rotate to copy a new key.', 'error');
      return;
    }
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    toast('API key copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const rotated = await rotateApiKey();
      if (rotated?.api_key) {
        setRevealedKey(rotated.api_key);
        setShowKey(true);
        toast('API key regenerated. Copy it now — it will not be shown again.', 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to rotate API key', 'error');
    }
    setRegenerating(false);
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={Key} title="Integration Name" description="A label to identify this integration in your dashboard.">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="My App Support"
        />
      </SectionCard>

      <SectionCard icon={Key} title="API Key" description="Use this key in the X-MSE-API-KEY header for server-to-server API calls.">
        <div className="flex items-center gap-2">
          <div className="flex-1 px-4 py-3 rounded-lg bg-neutral-900 text-accent-300 font-mono text-sm overflow-x-auto scrollbar-thin">
            {showKey ? displayKey : 'mse_live_••••••••••••••••••'}
          </div>
          <button onClick={() => setShowKey(!showKey)} className="btn-secondary flex-shrink-0">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={copy} className="btn-secondary flex-shrink-0">
            {copied ? <Check className="w-4 h-4 text-success-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <button onClick={regenerate} disabled={regenerating} className="btn-danger mt-3">
          {regenerating ? <LoadingSpinner size={16} /> : <RefreshCw className="w-4 h-4" />}
          Regenerate Key
        </button>
        <p className="text-xs text-danger-500 mt-2">Rotating invalidates the old key immediately. The new secret is shown only once.</p>
      </SectionCard>

      <SectionCard icon={Code2} title="Quick Start: Create a Ticket via API" description="This hits the Convex HTTP ticket API. Authenticate with X-MSE-API-KEY and X-MSE-Tenant-ID.">
        <CodeBlock language="bash" code={curl} />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={async () => {
              if (!siteUrl || !revealedKey) {
                toast('Rotate the API key to reveal it, then test.', 'error');
                return;
              }
              setTesting(true);
              setTestResult(null);
              try {
                const res = await fetch(ticketApiUrl(siteUrl, '/tickets'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-MSE-API-KEY': revealedKey,
                    'X-MSE-Tenant-ID': integration.tenant_id,
                  },
                  body: JSON.stringify({
                    subject: 'Unable to export report',
                    category: 'Technical',
                    priority: 'high',
                    customer: { email: 'jane@example.com', name: 'Jane Doe' },
                    body: 'I get a 500 error when clicking export.',
                  }),
                });
                const text = await res.text();
                let pretty = text;
                try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
                setTestOk(res.ok);
                if (res.status === 404) {
                  setTestResult(`${res.status} ${res.statusText}\n${pretty}\n\nRun npx convex dev so the HTTP ticket API is deployed.`);
                } else {
                  setTestResult(`${res.status} ${res.statusText}\n${pretty}`);
                }
                if (res.ok) toast('Test ticket created', 'success');
                else toast(`Test failed (${res.status})`, 'error');
              } catch (err) {
                setTestOk(false);
                setTestResult(err instanceof Error ? err.message : 'Request failed');
                toast('Test request failed', 'error');
              } finally {
                setTesting(false);
              }
            }}
            disabled={testing}
            className="btn-primary"
          >
            {testing ? <LoadingSpinner size={16} /> : <PlayCircle className="w-4 h-4" />}
            Send test request
          </button>
          <p className="text-xs text-neutral-400">Creates a sample ticket for Jane Doe. It will show up in Tickets.</p>
        </div>
        {testResult && (
          <pre className={`mt-3 px-4 py-3 rounded-lg font-mono text-xs overflow-x-auto scrollbar-thin whitespace-pre-wrap ${testOk ? 'bg-success-50 text-success-800' : 'bg-danger-50 text-danger-800'}`}>
            {testResult}
          </pre>
        )}
      </SectionCard>

      <SectionCard icon={Globe} title="API Endpoints" description="ticket-api is live. Other paths below are not implemented on this function.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EndpointMethod method="POST" path="/functions/v1/ticket-api/tickets" label="Create ticket" />
          <EndpointMethod method="GET" path="/functions/v1/ticket-api/tickets" label="List tickets" />
          <EndpointMethod method="GET" path="/functions/v1/ticket-api/tickets/{id}" label="Get ticket" />
          <EndpointMethod method="PUT" path="/functions/v1/ticket-api/tickets/{id}" label="Update ticket" />
        </div>
      </SectionCard>
    </div>
  );
}

/* --- Widget Tab --- */
function WidgetTab({ integration, update }: { integration: IntegrationSettings; update: (p: Partial<IntegrationSettings>) => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  const snippet = widgetSnippet({
    origin: window.location.origin,
    integrationId: integration.id,
    position: integration.widget_position,
    greeting: integration.widget_greeting ?? 'Hi! How can we help?',
    name: integration.name,
  });

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={Code2} title="Embed Code" description={`Paste this snippet before the closing </body> tag on the website for "${integration.name}".`}>
        <div className="relative">
          <pre className="px-4 py-3.5 rounded-lg bg-neutral-900 text-neutral-200 font-mono text-xs overflow-x-auto scrollbar-thin leading-relaxed">
            {snippet}
          </pre>
          <button onClick={copy} className="absolute top-3 right-3 btn-secondary py-1.5 px-2.5 text-xs">
            {copied ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </SectionCard>

      <SectionCard icon={Code2} title="Widget Configuration" description="Adjust how the chat widget appears on your site.">
        <div className="space-y-4">
          <ToggleRow
            label="Widget Enabled"
            description="Show or hide the chat widget on your website"
            value={integration.widget_enabled}
            onChange={(v) => update({ widget_enabled: v })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Position</label>
              <select value={integration.widget_position} onChange={(e) => update({ widget_position: e.target.value })} className="input">
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={integration.widget_color} onChange={(e) => update({ widget_color: e.target.value })} className="w-12 h-10 rounded-lg border border-neutral-200 cursor-pointer" />
                <input type="text" value={integration.widget_color} onChange={(e) => update({ widget_color: e.target.value })} className="input flex-1 font-mono" />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Welcome Greeting</label>
            <input type="text" value={integration.widget_greeting ?? ''} onChange={(e) => update({ widget_greeting: e.target.value })} className="input" placeholder="Hi! How can we help you today?" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

/* --- Webhooks Tab --- */
function WebhooksTab({
  integration,
  update,
  rotateWebhookSecret,
}: {
  integration: IntegrationSettings;
  update: (p: Partial<IntegrationSettings>) => Promise<void>;
  rotateWebhookSecret: () => Promise<IntegrationSettings | null>;
}) {
  const [url, setUrl] = useState(integration.webhook_url ?? '');
  const [revealedSecret, setRevealedSecret] = useState<string | null>(integration.webhook_secret);
  const [events, setEvents] = useState<string[]>(integration.webhook_events ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rotating, setRotating] = useState(false);
  const { toast } = useToast();

  const allEvents = [
    { id: 'TicketCreated', label: 'Ticket Created' },
    { id: 'TicketResolved', label: 'Ticket Resolved' },
    { id: 'ChatMessageSent', label: 'Chat Message Sent' },
    { id: 'ArticleUpdated', label: 'KB Article Updated' },
    { id: 'GdprErasureCompleted', label: 'GDPR Erasure Completed' },
    { id: 'SlaBreached', label: 'SLA Breached' },
  ];

  const toggleEvent = (id: string) => {
    setEvents((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await update({
      webhook_url: url || null,
      webhook_events: events,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={Webhook} title="Webhook Endpoint" description="We'll POST event payloads to this URL with an HMAC-SHA256 signature.">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Endpoint URL</label>
            <input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setSaved(false); }} className="input" placeholder="https://api.yourcompany.com/webhooks/mse" />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Signing Secret</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={revealedSecret ?? (integration.webhook_secret_hint ? `whsec_••••${integration.webhook_secret_hint}` : 'Rotate to reveal')}
                className="input font-mono"
              />
              <button
                type="button"
                className="btn-secondary flex-shrink-0"
                disabled={rotating}
                onClick={async () => {
                  setRotating(true);
                  try {
                    const rotated = await rotateWebhookSecret();
                    if (rotated?.webhook_secret) {
                      setRevealedSecret(rotated.webhook_secret);
                      toast('Webhook secret rotated. Copy it now — it will not be shown again.', 'success');
                    }
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Failed to rotate secret', 'error');
                  }
                  setRotating(false);
                }}
              >
                {rotating ? <LoadingSpinner size={16} /> : <RefreshCw className="w-4 h-4" />}
                Rotate
              </button>
            </div>
            <p className="text-xs text-neutral-400 mt-2">Verify the <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono text-xs">X-MSE-Signature</code> header using this secret. It is stored encrypted and shown only once.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Webhook} title="Event Subscriptions" description="Choose which events trigger a webhook delivery.">
        <div className="space-y-2">
          {allEvents.map((evt) => {
            const checked = events.includes(evt.id);
            return (
              <button
                key={evt.id}
                onClick={() => toggleEvent(evt.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all ${
                  checked ? 'border-primary-300 bg-primary-50/50' : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-primary-500' : 'border border-neutral-300'}`}>
                  {checked && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm font-medium text-neutral-700">{evt.label}</span>
                <span className="text-xs text-neutral-400 font-mono ml-auto">{evt.id}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <LoadingSpinner size={16} /> : saved ? <CheckCircle2 className="w-4 h-4 text-success-500" /> : <Check className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Webhook Settings'}
        </button>
      </div>
    </div>
  );
}

/* --- Branding Tab --- */
function BrandingTab({ integration, update }: { integration: IntegrationSettings; update: (p: Partial<IntegrationSettings>) => Promise<void> }) {
  return (
    <div className="space-y-5">
      <SectionCard icon={Palette} title="Brand Appearance" description="Customize the look of your help center and widget for this integration.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Primary Brand Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={integration.branding_primary_color} onChange={(e) => update({ branding_primary_color: e.target.value })} className="w-12 h-10 rounded-lg border border-neutral-200 cursor-pointer" />
                <input type="text" value={integration.branding_primary_color} onChange={(e) => update({ branding_primary_color: e.target.value })} className="input flex-1 font-mono" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Logo URL</label>
              <input type="url" value={integration.branding_logo_url ?? ''} onChange={(e) => update({ branding_logo_url: e.target.value || null })} className="input" placeholder="https://cdn.yourcompany.com/logo.png" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Help Center Subdomain</label>
              <div className="flex items-center">
                <input type="text" value={integration.help_center_subdomain ?? ''} onChange={(e) => update({ help_center_subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className="input rounded-r-none" placeholder="yourcompany" />
                <span className="px-3 py-2.5 bg-neutral-100 border border-l-0 border-neutral-200 rounded-r-lg text-sm text-neutral-400 whitespace-nowrap">.mse.help</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Custom Domain</label>
              <input type="text" value={integration.custom_domain ?? ''} onChange={(e) => update({ custom_domain: e.target.value || null })} className="input" placeholder="help.yourcompany.com" />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Globe} title="Help Center URL" description="Your help center for this integration is accessible at this address.">
        <div className="flex items-center gap-2">
          <div className="flex-1 px-4 py-3 rounded-lg bg-neutral-100 font-mono text-sm text-neutral-700">
            {integration.custom_domain ?? `${integration.help_center_subdomain ?? 'yourcompany'}.mse.help`}
          </div>
          <a
            href={`https://${integration.custom_domain ?? `${integration.help_center_subdomain ?? 'yourcompany'}.mse.help`}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            Visit
          </a>
        </div>
      </SectionCard>
    </div>
  );
}

/* --- SSO Tab --- */
function SsoTab({ integration, update }: { integration: IntegrationSettings; update: (p: Partial<IntegrationSettings>) => Promise<void> }) {
  return (
    <div className="space-y-5">
      <SectionCard icon={ShieldCheck} title="SAML 2.0 Single Sign-On" description="Configure SSO so your agents can sign in with your identity provider.">
        <ToggleRow
          label="SSO Enabled"
          description="Enable SAML 2.0 authentication for agent login"
          value={integration.sso_enabled}
          onChange={(v) => update({ sso_enabled: v })}
        />
        {integration.sso_enabled && (
          <div className="space-y-4 mt-4 pt-4 border-t border-neutral-100">
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Identity Provider</label>
              <select value={integration.sso_provider ?? ''} onChange={(e) => update({ sso_provider: e.target.value || null })} className="input">
                <option value="">Select provider</option>
                <option value="okta">Okta</option>
                <option value="azure-ad">Azure AD (Microsoft Entra)</option>
                <option value="google">Google Workspace</option>
                <option value="custom">Custom SAML</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">IdP Metadata URL</label>
              <input type="url" value={integration.sso_metadata_url ?? ''} onChange={(e) => update({ sso_metadata_url: e.target.value || null })} className="input" placeholder="https://your-idp.com/saml/metadata" />
              <p className="text-xs text-neutral-400 mt-2">Metadata is stored on this integration. SAML login is not wired yet — save the URL now so it can be connected later.</p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-50">
              {integration.sso_provider ? (
                <><CheckCircle2 className="w-4 h-4 text-success-500" /><span className="text-sm text-neutral-600">SSO configured with {integration.sso_provider}</span></>
              ) : (
                <><XCircle className="w-4 h-4 text-neutral-400" /><span className="text-sm text-neutral-400">No provider selected</span></>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Lock} title="Security Best Practices" description="Recommendations for keeping your integration secure.">
        <div className="space-y-2.5">
          <SecurityTip text="Store your API key in server environment variables — never in client-side code or git repos." />
          <SecurityTip text="Verify webhook signatures using your signing secret on every incoming request." />
          <SecurityTip text="Use short-lived ephemeral JWTs for end-user widget authentication, signed with your API key." />
          <SecurityTip text="Rotate your API key and webhook secret periodically (every 90 days recommended)." />
          <SecurityTip text="Each integration has its own API key — use separate integrations for separate environments." />
        </div>
      </SectionCard>
    </div>
  );
}

/* --- Shared --- */
function SectionCard({ icon: Icon, title, description, children }: { icon: ComponentType<{ className?: string }>; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4.5 h-4.5 text-primary-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
          <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-lg bg-neutral-50">
      <div>
        <p className="text-sm font-medium text-neutral-700">{label}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary-500' : 'bg-neutral-300'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative">
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="text-xs text-neutral-500 font-mono">{language}</span>
        <button onClick={copy} className="btn-secondary py-1 px-2 text-xs">
          {copied ? <Check className="w-3 h-3 text-success-500" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className="px-4 py-3.5 rounded-lg bg-neutral-900 text-neutral-200 font-mono text-xs overflow-x-auto scrollbar-thin leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function EndpointMethod({ method, path, label }: { method: string; path: string; label: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-50">
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${method === 'POST' ? 'bg-success-100 text-success-700' : 'bg-primary-100 text-primary-700'}`}>
        {method}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-mono text-neutral-600 truncate">{path}</p>
        <p className="text-xs text-neutral-400">{label}</p>
      </div>
    </div>
  );
}

function SecurityTip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-neutral-600">{text}</p>
    </div>
  );
}
