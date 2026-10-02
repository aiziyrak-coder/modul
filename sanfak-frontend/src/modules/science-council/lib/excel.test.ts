import { describe, it, expect } from 'vitest';
import { datedFileName } from './excel';

describe('datedFileName', () => {
  it('fayl nomiga sana va .xlsx kengaytmasini qo\'shadi', () => {
    expect(datedFileName('Ilmiy_ishlar', new Date(2026, 7, 23))).toBe('Ilmiy_ishlar_2026-08-23.xlsx');
  });

  it('bir xonali oy/kunni nol bilan to\'ldiradi (fayllar tartib bilan saralansin)', () => {
    expect(datedFileName('Seminarlar', new Date(2026, 0, 5))).toBe('Seminarlar_2026-01-05.xlsx');
  });

  it('MAHALLIY sanani oladi, UTC emas', () => {
    expect(datedFileName('X', new Date(2026, 7, 23, 0, 30))).toBe('X_2026-08-23.xlsx');
    expect(datedFileName('X', new Date(2026, 7, 23, 23, 30))).toBe('X_2026-08-23.xlsx');
  });
});
