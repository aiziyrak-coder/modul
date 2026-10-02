import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/shared/lib/i18n';
import { ACTION_LABEL_KEYS, actionLabelKey } from './action-labels';

const LEGACY_ALLOWED = new Set<string>(['verifyDoc', 'import', 'assign', 'publish', 'archive']);

function extractBlockValues(src: string, blockName: string): Set<string> {
  const noComments = src.replace(/\/\/[^\n]*/g, '');
  const start = noComments.indexOf(`${blockName}:`);
  if (start === -1) return new Set();
  const braceStart = noComments.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < noComments.length; i++) {
    if (noComments[i] === '{') depth++;
    else if (noComments[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = noComments.slice(braceStart, end);
  const values = new Set<string>();
  for (const m of block.matchAll(/"([^"]+)"/g)) {
    if (m[1]) values.add(m[1]);
  }
  return values;
}

const BACKEND_CONSTANTS = resolve(
  process.cwd(),
  '..',
  'sanfak_backend',
  'src',
  'config',
  'constants.js',
);

const backendAvailable = existsSync(BACKEND_CONSTANTS);
const constantsSrc = backendAvailable ? readFileSync(BACKEND_CONSTANTS, 'utf8') : '';
const ACTIONS = backendAvailable ? extractBlockValues(constantsSrc, 'ACTIONS') : new Set<string>();

describe('ACTION_LABEL_KEYS — backend bilan moslik', () => {
  it.runIf(backendAvailable)('har backend action`ining i18n kaliti bor VA manifestda uz/ru/en tarjima qilingan', () => {
    const missing = [...ACTIONS].filter((key) => {
      const labelKey = ACTION_LABEL_KEYS[key];
      if (!labelKey) return true;
      return (['uz', 'ru', 'en'] as const).some(
        (lng) => i18n.t(labelKey, { lng }) === labelKey,
      );
    });
    expect(missing, `Yorliqsiz/to'liqsiz action'lar: ${missing.join(', ')}`).toEqual([]);
  });

  it.runIf(backendAvailable)('o`lik yorliq yo`q (LEGACY_ALLOW dan tashqari)', () => {
    const dead = Object.keys(ACTION_LABEL_KEYS).filter(
      (key) => !ACTIONS.has(key) && !LEGACY_ALLOWED.has(key),
    );
    expect(dead, `Backend katalogida yo'q, allowlist'da ham yo'q kalitlar: ${dead.join(', ')}`).toEqual([]);
  });

  it('skip sababini ko`rsatadi (backend topilmaganda)', () => {
    if (!backendAvailable) {
      console.warn(`[action-labels] backend constants topilmadi: ${BACKEND_CONSTANTS} — moslik tekshiruvi skip qilindi`);
    }
    expect(true).toBe(true);
  });
});

describe('actionLabelKey', () => {
  it('lug`atdagi kalit uchun i18n kalitini qaytaradi (raw emas)', () => {
    expect(actionLabelKey('search')).toBe('admin.action.search');
  });

  it('lug`atda yo`q kalitda raw qaytaradi', () => {
    expect(actionLabelKey('yoqKalit')).toBe('yoqKalit');
  });

  it('i18n kaliti uz/ru/en uchtasida ham haqiqiy tarjimaga chiqadi', () => {
    const key = actionLabelKey('read');
    expect(i18n.t(key, { lng: 'uz' })).toBe("Ko'rish");
    expect(i18n.t(key, { lng: 'ru' })).toBe('Просмотр');
    expect(i18n.t(key, { lng: 'en' })).toBe('View');
  });
});
