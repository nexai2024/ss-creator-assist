export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'item';
}

export const PLAN_INTEGRATION_LIMITS: Record<string, number> = {
  starter: 1,
  growth: 3,
  enterprise: -1,
};

export function canAddIntegration(planTier: string, currentCount: number): boolean {
  const limit = PLAN_INTEGRATION_LIMITS[planTier] ?? 1;
  if (limit < 0) return true;
  return currentCount < limit;
}

export function widgetSnippet(opts: {
  origin: string;
  integrationId: string;
  position: string;
  greeting: string;
  name?: string;
}): string {
  const label = opts.name ? `MSE Chat Widget: ${opts.name}` : 'MSE Chat Widget';
  return `<!-- ${label} -->
<script>
  window.MSE_CONFIG = {
    integrationId: ${JSON.stringify(opts.integrationId)},
    position: ${JSON.stringify(opts.position)},
    greeting: ${JSON.stringify(opts.greeting)},
    origin: ${JSON.stringify(opts.origin)}
  };
</script>
<script src="${opts.origin}/mse-widget.js" async></script>`;
}

export function ticketApiUrl(siteUrl: string, path = '/tickets'): string {
  const base = siteUrl.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}/ticket-api${suffix}`;
}

export function createTicketCurl(opts: {
  siteUrl: string;
  apiKey: string;
  tenantId: string;
}): string {
  const url = ticketApiUrl(opts.siteUrl, '/tickets');
  return `curl -X POST ${JSON.stringify(url)} \\
  -H "Content-Type: application/json" \\
  -H "X-MSE-API-KEY: ${opts.apiKey}" \\
  -H "X-MSE-Tenant-ID: ${opts.tenantId}" \\
  -d '{
    "subject": "Unable to export report",
    "category": "Technical",
    "priority": "high",
    "customer": {
      "email": "jane@example.com",
      "name": "Jane Doe"
    },
    "body": "I get a 500 error when clicking export."
  }'`;
}
