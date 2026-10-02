import { describe, it, expect } from 'vitest';
import { isTeacherActive, toDateKey } from './teacher-access';

const TODAY = new Date('2026-08-20T10:00:00Z');

describe('teacher-access — isTeacherActive', () => {
  it("active: true — sana ahamiyatsiz, doim faol", () => {
    expect(isTeacherActive({ active: true, activeFrom: null }, TODAY)).toBe(true);
    expect(isTeacherActive({ active: true, activeFrom: '2099-01-01' }, TODAY)).toBe(true);
  });

  it('nofaol va sana belgilanmagan — nofaol qoladi', () => {
    expect(isTeacherActive({ active: false, activeFrom: null }, TODAY)).toBe(false);
  });

  it('nofaol, sana KELAJAKDA — hali nofaol', () => {
    expect(isTeacherActive({ active: false, activeFrom: '2026-09-01' }, TODAY)).toBe(false);
  });

  it("nofaol, sana O'TGAN — avtomatik faol", () => {
    expect(isTeacherActive({ active: false, activeFrom: '2026-08-01' }, TODAY)).toBe(true);
  });

  it("nofaol, sana AYNAN BUGUN — faol (o'sha kundan boshlab)", () => {
    expect(isTeacherActive({ active: false, activeFrom: '2026-08-20' }, TODAY)).toBe(true);
  });
});

describe('teacher-access — toDateKey', () => {
  it("bir xonali oy/kunni ikki xonaga to'ldiradi", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
