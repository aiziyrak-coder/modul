import { describe, expect, it } from 'vitest';
import {
  isRealDay,
  SCAN_MAX_BYTES,
  signDateBounds,
  validateRejectReason,
  validateScanFile,
  validateSignInput,
} from './sign-input';

const bounds = { min: '2026-09-20', max: '2026-09-27' };

describe('validateSignInput — raqam', () => {
  it('bo‘sh yoki faqat bo‘shliq — xato', () => {
    expect(validateSignInput({ paperOrderNumber: '', paperOrderDate: '2026-09-25' }, bounds).paperOrderNumber).toBeTruthy();
    expect(validateSignInput({ paperOrderNumber: '   ', paperOrderDate: '2026-09-25' }, bounds).paperOrderNumber).toBeTruthy();
  });

  it('bosh/oxirgi bo‘shliq trim dan keyin hisoblanadi — 64 belgi chegarasi', () => {
    const ok64 = ` ${'a'.repeat(64)} `;
    expect(validateSignInput({ paperOrderNumber: ok64, paperOrderDate: '2026-09-25' }, bounds)).toEqual({});
    const bad65 = 'a'.repeat(65);
    expect(validateSignInput({ paperOrderNumber: bad65, paperOrderDate: '2026-09-25' }, bounds).paperOrderNumber).toMatch(/64/);
  });
});

describe('validateSignInput — sana', () => {
  const check = (paperOrderDate: string, b: { min: string | null; max: string } = bounds) =>
    validateSignInput({ paperOrderNumber: '12-ch', paperOrderDate }, b).paperOrderDate;

  it('bo‘sh, shakl noto‘g‘ri, mavjud bo‘lmagan kun — xato', () => {
    expect(check('')).toBeTruthy();
    expect(check('25.09.2026')).toBeTruthy();
    expect(check('2026-9-25')).toBeTruthy();
    expect(check('2026-02-30')).toBeTruthy();
  });

  it('chegaralar kiradi: min va max o‘zi ruxsat', () => {
    expect(check('2026-09-20')).toBeUndefined();
    expect(check('2026-09-27')).toBeUndefined();
  });

  it('min dan oldin yoki max dan keyin — xato', () => {
    expect(check('2026-09-19')).toMatch(/loyiha/);
    expect(check('2026-09-28')).toMatch(/bugundan/);
  });

  it('meros: quyi chegara yo‘q', () => {
    expect(check('2001-01-01', { min: null, max: '2026-09-27' })).toBeUndefined();
  });
});

describe('signDateBounds — backend assertPaperDate oralig‘i', () => {
  const now = new Date('2026-09-27T20:00:00Z');

  it('tizim: min = loyiha ochilgan UZ kuni, max = UZ bugun', () => {
    expect(signDateBounds({ origin: 'tizim', draftedAt: '2026-09-19T19:30:00Z' }, now)).toEqual({
      min: '2026-09-20',
      max: '2026-09-28',
    });
  });

  it('meros: quyi chegara yo‘q', () => {
    expect(signDateBounds({ origin: 'meros', draftedAt: '2026-09-19T19:30:00Z' }, now)).toEqual({
      min: null,
      max: '2026-09-28',
    });
  });
});

describe('isRealDay', () => {
  it('kabisa yili', () => {
    expect(isRealDay('2028-02-29')).toBe(true);
    expect(isRealDay('2027-02-29')).toBe(false);
  });
});

describe('validateRejectReason', () => {
  it('trim dan keyin 3..1000', () => {
    expect(validateRejectReason('ab')).toBeTruthy();
    expect(validateRejectReason('  ab  ')).toBeTruthy();
    expect(validateRejectReason('abc')).toBeNull();
    expect(validateRejectReason('a'.repeat(1000))).toBeNull();
    expect(validateRejectReason('a'.repeat(1001))).toBeTruthy();
  });
});

describe('validateScanFile', () => {
  const file = (name: string, size: number, type = '') => ({ name, size, type });

  it('10 MB gacha ruxsat, undan katta — xato', () => {
    expect(validateScanFile(file('a.pdf', SCAN_MAX_BYTES))).toBeNull();
    expect(validateScanFile(file('a.pdf', SCAN_MAX_BYTES + 1))).toMatch(/10 MB/);
  });

  it('bo‘sh fayl — xato', () => {
    expect(validateScanFile(file('a.pdf', 0))).toBeTruthy();
  });

  it('kengaytma yoki mime — PDF/JPG/JPEG/PNG', () => {
    expect(validateScanFile(file('skan.PDF', 10))).toBeNull();
    expect(validateScanFile(file('skan.jpeg', 10))).toBeNull();
    expect(validateScanFile(file('skan', 10, 'image/png'))).toBeNull();
    expect(validateScanFile(file('skan.docx', 10))).toMatch(/PDF/);
    expect(validateScanFile(file('skan.gif', 10, 'image/gif'))).toBeTruthy();
  });
});
