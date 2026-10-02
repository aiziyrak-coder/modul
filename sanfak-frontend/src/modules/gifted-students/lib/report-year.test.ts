import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { rankingScore, ALL_YEARS } from './report-year';

const ALIYEV = {
  totalScore: 392.5,
  scoresByYear: { '2025/2026': 80, '2026/2027': 312.5 },
};
const IQTIDOROV = { totalScore: 999, scoresByYear: { '2025/2026': 999 } };

describe('rankingScore — asos TANLANGAN yil', () => {
  it('joriy yil', () => {
    expect(rankingScore(ALIYEV, '2026/2027')).toBe(312.5);
  });

  it('o‘tgan yil — AYNI talaba, BOSHQA ball', () => {
    expect(rankingScore(ALIYEV, '2025/2026')).toBe(80);
  });

  it('🔴 shu yilda ball olmagan talaba 0 — ro‘yxatdan CHIQMAYDI', () => {
    expect(rankingScore(IQTIDOROV, '2026/2027')).toBe(0);
  });

  it('`all` — asos UMRBOD yig‘indi', () => {
    expect(rankingScore(ALIYEV, ALL_YEARS)).toBe(392.5);
    expect(rankingScore(IQTIDOROV, ALL_YEARS)).toBe(999);
  });

  it('🔴 `totalScore` ga TUSHIB KETMAYDI (zaxira sifatida ham)', () => {
    expect(rankingScore({ totalScore: 500 }, '2026/2027')).toBe(0);
  });

  it('xarita yo‘q / bo‘sh — 0, `undefined` emas', () => {
    expect(rankingScore({}, '2026/2027')).toBe(0);
    expect(rankingScore({ scoresByYear: {} }, '2026/2027')).toBe(0);
  });

  it('0 — haqiqiy qiymat', () => {
    expect(rankingScore({ scoresByYear: { '2026/2027': 0 } }, '2026/2027')).toBe(0);
  });
});

describe('Reports.tsx — yil filtri TALABANI kesmaydi', () => {
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'management', 'Reports.tsx'),
    'utf8',
  );

  it('🔴 reyting `s.academicYear === filterYear` bo‘yicha FILTRLANMAYDI', () => {
    expect(SRC).not.toMatch(/ranking\.filter\(\s*s\s*=>\s*s\.academicYear/);
  });

  it('reyting asosi `rankingScore` orqali (mahalliy nusxa emas)', () => {
    expect(SRC).toContain('rankingScore(s, filterYear)');
  });

  it('🔴 eksport HISOBOT yilini yuboradi, reyestr yilini emas', () => {
    expect(SRC).toContain('q.scoreYear = filterYear');
    expect(SRC).not.toContain('q.academicYear =');
  });

  it('arizalar yil bo‘yicha HAMON kesiladi (bu TO‘G‘RI)', () => {
    expect(SRC).toMatch(/allApplications\.filter\(\s*a\s*=>\s*a\.academicYear === filterYear/);
  });

  it('ustun sarlavhasi TANLANGAN yilni ko‘rsatadi', () => {
    expect(SRC).toContain('`Yil bali (${filterYear})`');
  });
});
