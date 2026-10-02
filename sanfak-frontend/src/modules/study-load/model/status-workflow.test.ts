import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { ALL_STATUS_KEYS, getApprovalStepLabel, getStatusMeta } from './status-workflow';
import manifest from '../study-load.module';
import StatusBadge from '../components/status-badge';

const ALL_STEPS = [
  'teacher',
  'kafedra',
  'arm',
  'methodical',
  'financial',
  'dean',
  'prorektor',
  'rektor',
];

const identityT = (key: string) => key;

describe('getApprovalStepLabel', () => {
  it.each(ALL_STEPS)('"%s" bosqichi i18n kalitiga o\'giriladi (xom slug EMAS)', (step) => {
    expect(getApprovalStepLabel(step, identityT)).toBe(`studyLoad.approval.step.${step}`);
  });

  it('noma\'lum bosqich (backend yangi slug qo\'shsa) slugning o\'zini qaytaradi', () => {
    expect(getApprovalStepLabel('kengash', identityT)).toBe('kengash');
  });

  it('bo\'sh slug — bo\'sh string (i18n kaliti sizib chiqmaydi)', () => {
    expect(getApprovalStepLabel('', identityT)).toBe('');
  });
});

describe('bosqich yorliqlari manifestda (uz/ru/en) to\'liq', () => {
  const locales = ['uz', 'ru', 'en'] as const;

  it.each(locales)('%s — 8 ta bosqich kaliti ham mavjud va bo\'sh emas', (lang) => {
    const dict = manifest.i18n?.[lang];
    expect(dict).toBeDefined();

    const missing = ALL_STEPS.filter((step) => {
      const value = dict?.[`studyLoad.approval.step.${step}`];
      return typeof value !== 'string' || value.trim() === '';
    });

    expect(missing).toEqual([]);
  });
});

describe('status yorliqlari (labelKey) — har status uchun mavjud', () => {
  it.each(ALL_STATUS_KEYS)('"%s" statusining labelKey bo\'sh emas', (key) => {
    const labelKey = getStatusMeta(key).labelKey;
    expect(typeof labelKey).toBe('string');
    expect(labelKey.trim()).not.toBe('');
  });
});

describe('status yorliqlari manifestda (uz/ru/en) to\'liq', () => {
  const locales = ['uz', 'ru', 'en'] as const;
  const allLabelKeys = Array.from(new Set(ALL_STATUS_KEYS.map((key) => getStatusMeta(key).labelKey)));

  it.each(locales)('%s — har statusning labelKey kaliti ham mavjud va bo\'sh emas', (lang) => {
    const dict = manifest.i18n?.[lang];
    expect(dict).toBeDefined();

    const missing = allLabelKeys.filter((labelKey) => {
      const value = dict?.[labelKey];
      return typeof value !== 'string' || value.trim() === '';
    });

    expect(missing).toEqual([]);
  });
});

describe('getStatusMeta — pending regressiyasi (teacherLeave)', () => {
  it('"pending" studyLoad.approval.status.pending kalitiga bog\'langan', () => {
    expect(getStatusMeta('pending').labelKey).toBe('studyLoad.approval.status.pending');
  });

  it('"pending" "yangi" fallback\'ga tushmaydi', () => {
    expect(getStatusMeta('pending').key).not.toBe('yangi');
  });
});

describe('getStatusMeta — noma\'lum status', () => {
  it('noma\'lum kalit "yangi" meta\'siga fallback qiladi (mavjud xulq buzilmagan)', () => {
    expect(getStatusMeta('nomalum-status').key).toBe('yangi');
  });
});

describe('StatusBadge — xom i18n kalit ekranga sizib chiqmaydi', () => {
  it('status="approved" render qilinganda tarjima qilingan matn ko\'rinadi, xom kalit emas', () => {
    renderWithProviders(createElement(StatusBadge, { status: 'approved' }));

    expect(screen.queryByText(/^studyLoad\./)).not.toBeInTheDocument();
  });
});

describe('ADR-043 — superseded (yuklama / taqsimot)', () => {
  it("neytral kulrang teg, «Almashtirilgan» yorlig'i (noma'lum emas)", () => {
    const meta = getStatusMeta('superseded');
    expect(meta.key).toBe('superseded');
    expect(meta.color).toBe('default');
    expect(meta.label).toBe('Almashtirilgan');
    expect(meta.labelKey).toBe('studyLoad.summary.status.superseded');
  });
});
