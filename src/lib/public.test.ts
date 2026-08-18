import { describe, expect, it } from 'vitest';
import { canAddIntegration, createTicketCurl, isLocalAppOrigin, slugify, ticketApiUrl, widgetSnippet } from './public';

describe('slugify', () => {
  it('turns titles into url slugs', () => {
    expect(slugify('Reset Your Password')).toBe('reset-your-password');
  });

  it('falls back when empty', () => {
    expect(slugify('***')).toBe('item');
  });
});

describe('canAddIntegration', () => {
  it('enforces starter and growth caps', () => {
    expect(canAddIntegration('starter', 0)).toBe(true);
    expect(canAddIntegration('starter', 1)).toBe(false);
    expect(canAddIntegration('growth', 2)).toBe(true);
    expect(canAddIntegration('growth', 3)).toBe(false);
  });

  it('allows unlimited enterprise integrations', () => {
    expect(canAddIntegration('enterprise', 50)).toBe(true);
  });
});

describe('widgetSnippet', () => {
  it('does not embed the secret API key', () => {
    const html = widgetSnippet({
      origin: 'https://app.example.com',
      integrationId: 'int_123',
      position: 'bottom-right',
      greeting: 'Hello',
    });
    expect(html).toContain('/mse-widget.js');
    expect(html).toContain('data-integration-id="int_123"');
    expect(html).toContain('defer');
    expect(html).not.toContain('mse_live_');
    expect(html).not.toContain('window.MSE_CONFIG');
  });
});

describe('isLocalAppOrigin', () => {
  it('flags localhost console URLs', () => {
    expect(isLocalAppOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalAppOrigin('https://app.example.com')).toBe(false);
  });
});

describe('ticket API helpers', () => {
  it('builds the Convex HTTP URL', () => {
    expect(ticketApiUrl('https://abc.convex.site', '/tickets')).toBe(
      'https://abc.convex.site/ticket-api/tickets',
    );
  });

  it('points curl at ticket-api instead of api.mse.io', () => {
    const curl = createTicketCurl({
      siteUrl: 'https://abc.convex.site',
      apiKey: 'mse_live_test',
      tenantId: 'tnt_1',
    });
    expect(curl).toContain('https://abc.convex.site/ticket-api/tickets');
    expect(curl).toContain('X-MSE-API-KEY: mse_live_test');
    expect(curl).toContain('X-MSE-Tenant-ID: tnt_1');
    expect(curl).not.toContain('api.mse.io');
    expect(curl).not.toContain('Authorization:');
  });
});
