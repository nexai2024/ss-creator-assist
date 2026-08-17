function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function configuredOrigins(): string[] {
  return parseList(
    [process.env.SITE_URL, process.env.CORS_ALLOWED_ORIGINS].filter(Boolean).join(","),
  );
}

export function originFromDomain(domain: string | undefined | null): string | null {
  if (!domain) return null;
  const trimmed = domain.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export function corsHeaders(req: Request, extra: Array<string | null | undefined> = []): Record<string, string> {
  const allowed = new Set(
    [...configuredOrigins(), ...extra.map(originFromDomain)].filter((v): v is string => Boolean(v)),
  );
  const requestOrigin = req.headers.get("Origin");
  const allowOrigin =
    requestOrigin && allowed.has(requestOrigin.replace(/\/$/, ""))
      ? requestOrigin
      : [...allowed][0] ?? "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-MSE-API-KEY, X-MSE-Tenant-ID, Stripe-Signature",
    Vary: "Origin",
  };
}
