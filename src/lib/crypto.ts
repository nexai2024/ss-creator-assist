/**
 * Generate a cryptographically secure random API key.
 * Uses crypto.getRandomValues instead of Math.random.
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `mse_live_${hex}`;
}

/**
 * Generate a cryptographically secure random webhook secret.
 */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `whsec_${hex}`;
}

/**
 * Generate a prefixed unique ID using crypto.randomUUID.
 */
export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
