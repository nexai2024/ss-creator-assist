import { describe, expect, it } from 'vitest';
import { encodeChatShare, excerptFrom, parseChatShare, ticketConsolePath, ticketPublicPath, absoluteTicketUrl, articleHelpPath } from '../../convex/lib/chatContent';

describe('chat share payloads', () => {
  it('round-trips an article share without putting the title in quotes', () => {
    const encoded = encodeChatShare({
      kind: 'article',
      id: 'art_1',
      title: 'Reset your password',
      slug: 'reset-your-password',
      tenantSlug: 'acme',
      excerpt: 'Use the forgot password link…',
    }, 'Here is an article that might help:');
    const parsed = parseChatShare(encoded);
    expect(parsed.text).toBe('Here is an article that might help:');
    expect(parsed.text).not.toContain('"Reset your password"');
    expect(parsed.share).toEqual({
      kind: 'article',
      id: 'art_1',
      title: 'Reset your password',
      slug: 'reset-your-password',
      tenantSlug: 'acme',
      excerpt: 'Use the forgot password link…',
    });
  });

  it('round-trips a ticket share with a console path', () => {
    const encoded = encodeChatShare({
      kind: 'ticket',
      id: 'tkt_99',
      subject: 'Escalated from chat: Jane',
    }, "We've opened a support ticket so a specialist can follow up.");
    const parsed = parseChatShare(encoded);
    expect(parsed.share?.kind).toBe('ticket');
    if (parsed.share?.kind === 'ticket') {
      expect(ticketConsolePath(parsed.share.id)).toBe('/tickets/tkt_99');
      expect(ticketPublicPath(parsed.share.id, 'jane@example.com')).toBe(
        '/ticket/tkt_99?email=jane%40example.com',
      );
      expect(absoluteTicketUrl('https://app.example.com', parsed.share.id, 'jane@example.com')).toBe(
        'https://app.example.com/ticket/tkt_99?email=jane%40example.com',
      );
    }
    expect(articleHelpPath('acme', 'reset-your-password')).toBe('/help/acme/reset-your-password');
  });

  it('leaves plain messages unchanged', () => {
    expect(parseChatShare('Hello there')).toEqual({ text: 'Hello there', share: null });
  });

  it('truncates excerpts', () => {
    expect(excerptFrom('short')).toBe('short');
    expect(excerptFrom('a'.repeat(200)).endsWith('…')).toBe(true);
  });
});
