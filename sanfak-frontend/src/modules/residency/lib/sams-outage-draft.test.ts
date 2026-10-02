import { describe, expect, it } from 'vitest';
import type { SamsOutageDraft } from '../api/sams-status-types';
import {
  OUTAGE_ALL_CLINICS,
  OUTAGE_REASON_MAX,
  outageScopeLabel,
  outageSpanDays,
  toCreateOutagePayload,
  validateOutageDraft,
  validateOutageReason,
} from './sams-outage-draft';

const TODAY = '2026-09-27';

const draft = (over: Partial<SamsOutageDraft> = {}): SamsOutageDraft => ({
  from: '2026-09-20',
  to: '2026-09-22',
  dbname: 'klinika_a',
  reason: 'SAMS serveri ishlamadi',
  ...over,
});

describe('validateOutageDraft — qamrov', () => {
  it("🔴 qamrov tanlanmagan ('') — xato; «barcha klinikalar» standart EMAS", () => {
    expect(validateOutageDraft(draft({ dbname: '' }), TODAY)).toMatch(
      /Klinikani yoki «Barcha klinikalar»ni tanlang/,
    );
    expect(validateOutageDraft(draft({ dbname: OUTAGE_ALL_CLINICS }), TODAY)).toBeNull();
  });

  it('qamrov matni: tanlanmagan null, barcha, nom (yo‘q bo‘lsa dbname)', () => {
    const clinics = [{ dbname: 'klinika_a', orgTitle: 'Akfa klinikasi' }];
    expect(outageScopeLabel('', clinics)).toBeNull();
    expect(outageScopeLabel(OUTAGE_ALL_CLINICS, clinics)).toBe('barcha klinikalar');
    expect(outageScopeLabel('klinika_a', clinics)).toBe('Akfa klinikasi');
    expect(outageScopeLabel('klinika_x', clinics)).toBe('klinika_x');
  });
});

describe('validateOutageDraft — sanalar', () => {
  it('to‘g‘ri draft — xato yo‘q', () => {
    expect(validateOutageDraft(draft(), TODAY)).toBeNull();
  });

  it('bo‘sh sana — xato', () => {
    expect(validateOutageDraft(draft({ from: '' }), TODAY)).toMatch(/sanasini tanlang/);
    expect(validateOutageDraft(draft({ to: '' }), TODAY)).toMatch(/sanasini tanlang/);
  });

  it('noto‘g‘ri format yoki mavjud bo‘lmagan kun — xato', () => {
    expect(validateOutageDraft(draft({ from: '20.09.2026' }), TODAY)).toMatch(/YYYY-MM-DD/);
    expect(validateOutageDraft(draft({ from: '2026-02-30', to: '2026-03-01' }), TODAY)).toMatch(
      /YYYY-MM-DD/,
    );
  });

  it('from > to — xato', () => {
    expect(validateOutageDraft(draft({ from: '2026-09-23' }), TODAY)).toMatch(/keyin bo.lmasin/);
  });

  it('to > bugun — xato; to = bugun — o‘tadi', () => {
    expect(validateOutageDraft(draft({ to: '2026-09-28' }), TODAY)).toMatch(/kelajakka/);
    expect(validateOutageDraft(draft({ to: TODAY }), TODAY)).toBeNull();
  });

  it('server `today` bermasa (eski backend) — kelajak tekshiruvi serverga qoladi', () => {
    expect(validateOutageDraft(draft({ to: '2026-09-28' }), null)).toBeNull();
  });

  it('366 kun o‘tadi, 367 — xato', () => {
    expect(validateOutageDraft(draft({ from: '2025-09-27', to: '2026-09-27' }), TODAY)).toBeNull();
    expect(validateOutageDraft(draft({ from: '2025-09-26', to: '2026-09-27' }), TODAY)).toMatch(
      /366/,
    );
  });
});

describe('validateOutageReason — 3..500 (trim dan keyin)', () => {
  it('bo‘sh va 2 belgi — xato; bo‘shliqlar sanalmaydi', () => {
    expect(validateOutageReason('')).not.toBeNull();
    expect(validateOutageReason('ab')).not.toBeNull();
    expect(validateOutageReason('  ab   ')).not.toBeNull();
    expect(validateOutageDraft(draft({ reason: ' x ' }), TODAY)).toMatch(/kamida 3/);
  });

  it('3 va 500 belgi o‘tadi, 501 — xato', () => {
    expect(validateOutageReason('abc')).toBeNull();
    expect(validateOutageReason('a'.repeat(OUTAGE_REASON_MAX))).toBeNull();
    expect(validateOutageReason('a'.repeat(OUTAGE_REASON_MAX + 1))).toMatch(/500/);
  });
});

describe('toCreateOutagePayload', () => {
  it('kalitlar AYNAN from/to/dbname/reason — orgTitle yo‘q', () => {
    expect(Object.keys(toCreateOutagePayload(draft())).sort()).toEqual([
      'dbname',
      'from',
      'reason',
      'to',
    ]);
  });

  it("dbname '*' → null (barcha klinikalar), sabab trim", () => {
    const body = toCreateOutagePayload(
      draft({ dbname: OUTAGE_ALL_CLINICS, reason: '  Tarmoq uzildi  ' }),
    );
    expect(body).toEqual({
      from: '2026-09-20',
      to: '2026-09-22',
      dbname: null,
      reason: 'Tarmoq uzildi',
    });
  });

  it("🔴 tanlanmagan '' hech qachon null (barcha klinikalar) bo‘lmaydi", () => {
    expect(toCreateOutagePayload(draft({ dbname: '' })).dbname).toBe('');
  });

  it('klinika tanlangan bo‘lsa dbname o‘zgarmaydi', () => {
    expect(toCreateOutagePayload(draft()).dbname).toBe('klinika_a');
  });
});

describe('outageSpanDays', () => {
  it('ikkala chegara ham kiradi', () => {
    expect(outageSpanDays('2026-09-20', '2026-09-22')).toBe(3);
    expect(outageSpanDays('2026-09-20', '2026-09-20')).toBe(1);
    expect(outageSpanDays('2026-09-22', '2026-09-20')).toBeNull();
  });
});
