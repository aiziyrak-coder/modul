import { describe, expect, it } from 'vitest';
import { lessonScoreAverage, scoreAvgText } from './lesson-score';
import type { Attendance } from '../api/types';

type Row = Pick<Attendance, 'status' | 'score'>;
const r = (status: Row['status'], score: number | null): Row => ({ status, score });

describe('lessonScoreAverage — kelgan va ballangan darslar', () => {
  it('🔴 kelmagan / sababli / ballsiz dars maxrajga KIRMAYDI', () => {
    const rows = [
      r('present', 80),
      r('present', 65),
      r('present', null),
      r('absent', null),
      r('absent', 10),
      r('excused', 90),
    ];
    expect(lessonScoreAverage(rows)).toBe(72.5);
  });

  it('`0` — haqiqiy ball (maxrajga kiradi)', () => {
    expect(lessonScoreAverage([r('present', 0), r('present', 100)])).toBe(50);
  });

  it('ballangan dars yo‘q → null (0 EMAS)', () => {
    expect(lessonScoreAverage([])).toBeNull();
    expect(lessonScoreAverage([r('present', null), r('absent', null)])).toBeNull();
  });
});

describe('scoreAvgText', () => {
  it('bir xona kasr; null / NaN → «—»', () => {
    expect(scoreAvgText(72.5)).toBe('72.5');
    expect(scoreAvgText(80)).toBe('80.0');
    expect(scoreAvgText(0)).toBe('0.0');
    expect(scoreAvgText(null)).toBe('—');
    expect(scoreAvgText(Number.NaN)).toBe('—');
  });
});
