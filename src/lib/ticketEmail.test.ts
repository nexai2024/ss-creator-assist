import { describe, expect, it } from 'vitest';
import { escapeHtml, ticketCreatedMail, ticketReplyMail } from '../../convex/lib/ticketEmail';

describe('ticket customer emails', () => {
  it('escapes HTML in customer-facing copy', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('includes the public status link on create', () => {
    const mail = ticketCreatedMail({
      customerName: 'Jane',
      tenantName: 'Acme',
      subject: 'Export failed',
      ticketId: 'tkt_99',
      email: 'jane@example.com',
    });
    expect(mail.subject).toContain('Export failed');
    expect(mail.html).toContain('/ticket/tkt_99?email=jane%40example.com');
    expect(mail.html).toContain('View ticket status');
    expect(mail.html).not.toContain('<script>');
  });

  it('includes the reply and status link when an agent writes', () => {
    const mail = ticketReplyMail({
      senderName: 'Alex <agent>',
      tenantName: 'Acme',
      subject: 'Export failed',
      content: 'Try again.\nLet us know.',
      ticketId: 'tkt_99',
      email: 'jane@example.com',
    });
    expect(mail.html).toContain('Alex &lt;agent&gt;');
    expect(mail.html).toContain('Try again.<br/>Let us know.');
    expect(mail.html).toContain('View ticket and reply');
    expect(mail.html).toContain('/ticket/tkt_99?email=jane%40example.com');
  });
});
