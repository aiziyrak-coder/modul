import { describe, expect, it } from 'vitest';
import {
  formatDayKey,
  formatUzClock,
  formatUzDateTime,
  formatUzDay,
  uzDayKey,
  uzToday,
} from './uz-day';

describe('uzDayKey', () => {
  it('UTC kechqurun chegarasi: 18:59:59Z — o‘sha kun, 19:00:00Z — ertasi', () => {
    expect(uzDayKey('2026-09-26T18:59:59Z')).toBe('2026-09-26');
    expect(uzDayKey('2026-09-26T19:00:00Z')).toBe('2026-09-27');
  });

  it('Date va son ham qabul qilinadi', () => {
    expect(uzDayKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
    expect(uzDayKey(Date.parse('2025-12-31T19:30:00Z'))).toBe('2026-01-01');
  });

  it('null / bo‘sh / yaroqsiz — null', () => {
    expect(uzDayKey(null)).toBeNull();
    expect(uzDayKey(undefined)).toBeNull();
    expect(uzDayKey('')).toBeNull();
    expect(uzDayKey('x')).toBeNull();
    expect(uzDayKey(8.64e15)).toBeNull();
  });
});

describe('uzToday', () => {
  it('berilgan lahzaning UZ kuni', () => {
    expect(uzToday(new Date('2026-09-26T20:00:00Z'))).toBe('2026-09-27');
    expect(uzToday(new Date('2026-09-26T10:00:00Z'))).toBe('2026-09-26');
  });

  it('argumentsiz — joriy vaqt, YYYY-MM-DD shaklida', () => {
    expect(uzToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatlash', () => {
  it('kun kaliti → DD.MM.YYYY; boshqa shakl o‘zgarishsiz; bo‘sh → «—»', () => {
    expect(formatDayKey('2026-09-05')).toBe('05.09.2026');
    expect(formatDayKey('05.09.2026')).toBe('05.09.2026');
    expect(formatDayKey(null)).toBe('—');
  });

  it('lahza → UZ kuni va vaqti', () => {
    expect(formatUzDay('2026-09-26T19:30:00Z')).toBe('27.09.2026');
    expect(formatUzDateTime('2026-09-26T19:30:00Z')).toBe('27.09.2026 00:30');
    expect(formatUzDateTime(null)).toBe('—');
    expect(formatUzDay('x')).toBe('—');
  });
});

describe('formatUzClock', () => {
  it('qat’iy +5 soat: 03:05Z → 08:05, 19:30Z → 00:30 (ertasi kun)', () => {
    expect(formatUzClock('2026-09-27T03:05:00.000Z')).toBe('08:05');
    expect(formatUzClock('2026-09-26T19:30:00Z')).toBe('00:30');
  });

  it('brauzer/Node vaqt zonasiga bog‘liq EMAS', () => {
    const saved = process.env.TZ;
    try {
      for (const tz of ['America/New_York', 'Asia/Tashkent', 'UTC']) {
        process.env.TZ = tz;
        expect(formatUzClock('2026-09-27T03:05:00.000Z')).toBe('08:05');
      }
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  });

  it('bo‘sh / yaroqsiz — «—»', () => {
    expect(formatUzClock(null)).toBe('—');
    expect(formatUzClock('x')).toBe('—');
  });
});
