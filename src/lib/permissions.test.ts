import { describe, expect, it } from 'vitest';
import { hasPermission } from './permissions';

describe('hasPermission', () => {
  it('denies when role is missing', () => {
    expect(hasPermission(null, 'tickets:reply')).toBe(false);
  });

  it('grants admin ticket delete and denies read_only replies', () => {
    expect(hasPermission('admin', 'tickets:delete')).toBe(true);
    expect(hasPermission('read_only', 'tickets:reply')).toBe(false);
    expect(hasPermission('junior_agent', 'tickets:reply')).toBe(true);
  });
});
