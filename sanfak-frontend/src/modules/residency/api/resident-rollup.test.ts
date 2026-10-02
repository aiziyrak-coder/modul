import { describe, expect, it } from 'vitest';
import { mapResidentRollup, type BackendResidentRollup } from './mapper';

const BASE: BackendResidentRollup = {
  _id: 'res-1',
  resident: {
    _id: 'res-1',
    fullName: 'Karimov Jasur',
    specialtyTitle: 'Kardiologiya',
    courseNumber: 1,
  },
  total: 12,
  present: 9,
  absent: 2,
  excused: 1,
  late: 0,
  scoreSum: 652.5,
  lastDate: '2026-09-29',
};

describe('mapResidentRollup — scoreAvg / scoredCount (LSC-Q6=A)', () => {
  it('yangi backend: qiymatlar o‘tadi, scoreSum saqlanadi', () => {
    const r = mapResidentRollup({ ...BASE, scoreAvg: 72.5, scoredCount: 9 });
    expect(r.scoreAvg).toBe(72.5);
    expect(r.scoredCount).toBe(9);
    expect(r.scoreSum).toBe(652.5);
  });

  it('🔴 eski backend (kalit yo‘q) → scoreAvg null («—»), 0 EMAS; scoredCount 0', () => {
    const r = mapResidentRollup(BASE);
    expect(r.scoreAvg).toBeNull();
    expect(r.scoredCount).toBe(0);
  });

  it('ballangan dars yo‘q (`$avg` → null) → null', () => {
    expect(mapResidentRollup({ ...BASE, scoreAvg: null, scoredCount: 0 }).scoreAvg).toBeNull();
  });

  it('buzuq qiymat (NaN / satr) → null', () => {
    expect(mapResidentRollup({ ...BASE, scoreAvg: Number.NaN }).scoreAvg).toBeNull();
    const raw = { ...BASE, scoreAvg: '72.5', scoredCount: '9' } as unknown as BackendResidentRollup;
    expect(mapResidentRollup(raw).scoreAvg).toBeNull();
    expect(mapResidentRollup(raw).scoredCount).toBe(0);
  });
});
