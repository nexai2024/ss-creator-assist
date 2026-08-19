import { describe, expect, it } from 'vitest';
import { parseLocale, t } from './i18n';

describe('i18n', () => {
  it('falls back to English for unknown locales', () => {
    expect(parseLocale('zz')).toBe('en');
    expect(t('zz', 'help')).toBe('Help Center');
  });

  it('translates widget chrome', () => {
    expect(t('es', 'startChat')).toBe('Iniciar chat');
    expect(t('ja', 'help')).toBe('ヘルプセンター');
  });
});
