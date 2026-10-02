import { describe, expect, it } from 'vitest';
import { HISTORY_SOURCE_LABEL, labelOf } from './expulsion-order-types';

const BACKEND_HISTORY_SOURCES = [
  'attendance',
  'cron',
  'application',
  'resident_delete',
  'migration',
  'office',
  'runbook',
  'sams',
] as const;

describe('HISTORY_SOURCE_LABEL — backend `HISTORY_SOURCES` nusxasi bilan bir xil', () => {
  it('kalitlar AYNAN nusxadagi ro‘yxat (yetishmagan ham, ortiqcha ham yo‘q)', () => {
    expect(Object.keys(HISTORY_SOURCE_LABEL).sort()).toEqual([...BACKEND_HISTORY_SOURCES].sort());
  });

  it('har manba o‘zbekcha yorliq bilan — xom kalit chiqmaydi', () => {
    for (const source of BACKEND_HISTORY_SOURCES) {
      const label = labelOf(HISTORY_SOURCE_LABEL, source);
      expect(label).not.toBe(source);
      expect(label.trim()).not.toBe('');
    }
  });

  it('`sams` — «SAMS davomati» (I3-Q14)', () => {
    expect(labelOf(HISTORY_SOURCE_LABEL, 'sams')).toBe('SAMS davomati');
  });
});
