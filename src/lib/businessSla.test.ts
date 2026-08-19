import { describe, expect, it } from 'vitest';
import { slaBreached, slaDeadlineMs } from '../../convex/lib/businessSla';

describe('business-hours SLA', () => {
  it('uses wall clock when no working days are configured', () => {
    const now = Date.parse('2026-08-19T12:00:00Z');
    expect(slaDeadlineMs(now, 'urgent', [])).toBe(now + 4 * 3600000);
  });

  it('counts only minutes inside working hours', () => {
    const hours = [{
      dayOfWeek: 3,
      isWorkingDay: true,
      openTime: '09:00',
      closeTime: '17:00',
      timezone: 'UTC',
    }];
    const now = Date.parse('2026-08-19T15:00:00Z');
    const deadline = slaDeadlineMs(now, 'urgent', hours);
    expect(deadline).toBeGreaterThan(now + 4 * 3600000);
  });

  it('flags open tickets past the deadline as breached', () => {
    expect(slaBreached({ nowMs: 200, slaDeadline: 100, status: 'open' })).toBe(true);
    expect(slaBreached({ nowMs: 200, slaDeadline: 300, status: 'open' })).toBe(false);
    expect(slaBreached({ nowMs: 400, slaDeadline: 300, status: 'resolved', resolvedAt: 250 })).toBe(false);
  });
});
