import { describe, expect, it } from 'vitest';
import { i18n } from '@/shared/lib/i18n';
import { SCOPE_LEVEL_OPTION_DEFS, scopeLevelLabelKey } from './scope-labels';
import type { ScopeLevel } from '../model/types';

const VALID_SCOPE_LEVELS: ScopeLevel[] = ['global', 'faculty', 'department', 'self'];

describe('SCOPE_LEVEL_OPTION_DEFS', () => {
  it('aynan 4 ta variant, TOR→KENG tartibda', () => {
    expect(SCOPE_LEVEL_OPTION_DEFS.map((o) => o.value)).toEqual([
      'self',
      'department',
      'faculty',
      'global',
    ]);
  });

  it('har `value` ScopeLevel union a`zosi, dublikat yo`q', () => {
    const values = SCOPE_LEVEL_OPTION_DEFS.map((o) => o.value);
    for (const v of values) {
      expect(VALID_SCOPE_LEVELS).toContain(v);
    }
    expect(new Set(values).size).toBe(values.length);
  });

  it('har `labelKey` va `hintKey` manifestda uz/ru/en`ga tarjima qilingan (raw kalit qaytmaydi)', () => {
    for (const o of SCOPE_LEVEL_OPTION_DEFS) {
      for (const lng of ['uz', 'ru', 'en'] as const) {
        expect(i18n.t(o.labelKey, { lng })).not.toBe(o.labelKey);
        expect(i18n.t(o.hintKey, { lng })).not.toBe(o.hintKey);
      }
    }
  });
});

describe('scopeLevelLabelKey', () => {
  it("'global' uchun tegishli i18n kalitini qaytaradi", () => {
    expect(scopeLevelLabelKey('global')).toBe('admin.role.scope.global.label');
    expect(i18n.t(scopeLevelLabelKey('global'), { lng: 'uz' })).toBe('Butun institut');
  });

  it('lug`atda yo`q qiymatda raw qaytaradi', () => {
    expect(scopeLevelLabelKey('nimadir')).toBe('nimadir');
  });
});
