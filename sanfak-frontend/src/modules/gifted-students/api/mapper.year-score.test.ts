import { describe, it, expect } from 'vitest';
import { mapStudent } from './mapper';
import { currentAcademicYear } from '../lib/academic-years';

const YIL = currentAcademicYear();

const student = (over: Record<string, unknown> = {}) =>
  mapStudent({ _id: 's1', fullName: 'Aliyev Sardor', ...over });

describe('mapStudent — yearScore', () => {
  it('joriy yil kalitini o‘qiydi', () => {
    expect(student({ totalScore: 392.5, scoresByYear: { [YIL]: 312.5 } }).yearScore).toBe(312.5);
  });

  it('🔴 o‘tgan yilgi ball joriy yilga SIZMAYDI', () => {
    const s = student({ totalScore: 999, scoresByYear: { '2025/2026': 999 } });
    expect(s.yearScore).toBe(0);
    expect(s.totalScore).toBe(999);
  });

  it('🔴 `totalScore` ga TUSHIB KETMAYDI (zaxira sifatida ham)', () => {
    expect(student({ totalScore: 500 }).yearScore).toBe(0);
  });

  it('xarita YO‘Q bo‘lsa 0 (eski yozuv, yiqilmaydi)', () => {
    expect(student({}).yearScore).toBe(0);
    expect(student({}).scoresByYear).toEqual({});
  });

  it('xom xarita ham uzatiladi (o‘tgan yillar hisoboti uchun)', () => {
    const map = { '2025/2026': 80, [YIL]: 312.5 };
    expect(student({ scoresByYear: map }).scoresByYear).toEqual(map);
  });

  it('`totalScore` ma’nosi O‘ZGARMADI — umrbod yig‘indi', () => {
    expect(student({ totalScore: 392.5, scoresByYear: { [YIL]: 312.5 } }).totalScore).toBe(392.5);
  });

  it('yil qoidasi `lib/academic-years` bilan BIR XIL manbadan', () => {
    const s = student({ scoresByYear: { [currentAcademicYear()]: 42 } });
    expect(s.yearScore).toBe(42);
  });
});
