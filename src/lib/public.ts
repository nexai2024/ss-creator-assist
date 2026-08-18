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

export function publicAppOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  return window.location.origin;
}

export function isLocalAppOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local');
  } catch {
    return false;
  }
}

export function widgetSnippet(opts: {
  origin: string;
  integrationId: string;
  position: string;
  greeting: string;
  color?: string;
  name?: string;
}): string {
  const label = opts.name ? `MSE Chat Widget: ${opts.name}` : 'MSE Chat Widget';
  const origin = opts.origin.replace(/\/$/, '');
  const attrs = [
    `src="${origin}/mse-widget.js"`,
    `data-integration-id=${JSON.stringify(opts.integrationId)}`,
    `data-position=${JSON.stringify(opts.position)}`,
    `data-greeting=${JSON.stringify(opts.greeting)}`,
    `data-origin=${JSON.stringify(origin)}`,
  ];
  if (opts.color) attrs.push(`data-color=${JSON.stringify(opts.color)}`);
  return `<!-- ${label} — paste before </body> -->
<script ${attrs.join('\n        ')}
        defer></script>`;
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
