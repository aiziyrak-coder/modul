import { describe, expect, it } from 'vitest';
import {
  isReviewPassed,
  isActiveApplication,
  pickVisibleApplication,
  REVIEW_PASSED,
} from './application-status';

describe('isReviewPassed', () => {
  it('🔴 FE tokeni — mapper aynan shuni beradi', () => {
    expect(isReviewPassed('recommended')).toBe(true);
  });

  it('backend tokeni ham qabul qilinadi (mapper chetlab o\u2018tilgan yo\u2018l)', () => {
    expect(isReviewPassed('approved')).toBe(true);
  });

  it('qolgan holatlar — false', () => {
    expect(isReviewPassed('pending')).toBe(false);
    expect(isReviewPassed('rejected')).toBe(false);
    expect(isReviewPassed('')).toBe(false);
    expect(isReviewPassed(undefined)).toBe(false);
    expect(isReviewPassed(null)).toBe(false);
  });

  it('FE tokeni `approved` EMAS — D-74 ning ildizi shu', () => {
    expect(REVIEW_PASSED).not.toBe('approved');
  });
});

describe('isActiveApplication', () => {
  it('yangi ariza topshirishni bloklaydigan holatlar', () => {
    expect(isActiveApplication('pending')).toBe(true);
    expect(isActiveApplication('recommended')).toBe(true);
    expect(isActiveApplication('approved')).toBe(true);
  });

  it('rad etilgan bloklamaydi — qayta topshirish RUXSAT etilgan (UF \u00a75.3)', () => {
    expect(isActiveApplication('rejected')).toBe(false);
  });
});

describe('pickVisibleApplication', () => {
  const app = (status: string, id: string) => ({ status, id });

  it('ariza yo\u2018q — null', () => {
    expect(pickVisibleApplication([])).toBeNull();
  });

  it('🔴 rad etilgan va kutilayotgan birga — KUTILAYOTGANi ko\u2018rsatiladi', () => {
    const picked = pickVisibleApplication([app('pending', 'yangi'), app('rejected', 'eski')]);
    expect(picked?.id).toBe('yangi');
  });

  it('tartib teskari bo\u2018lsa ham natija bir xil', () => {
    const picked = pickVisibleApplication([app('rejected', 'eski'), app('pending', 'yangi')]);
    expect(picked?.id).toBe('yangi');
  });

  it('faqat rad etilganlar bo\u2018lsa — oxirgisi (qayta topshirish mumkin)', () => {
    const picked = pickVisibleApplication([app('rejected', 'birinchi'), app('rejected', 'ikkinchi')]);
    expect(picked?.id).toBe('ikkinchi');
  });

  it('bitta hujjat — o\u2018sha (tuzatishdan KEYINGI odatiy holat)', () => {
    expect(pickVisibleApplication([app('rejected', 'yagona')])?.id).toBe('yagona');
  });
});
