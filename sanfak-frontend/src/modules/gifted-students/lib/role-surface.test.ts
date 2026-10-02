import { describe, expect, it } from 'vitest';
import { surfaceFromPermissions } from './role-surface';

const DEPARTMENT = ['giftedStudent:create', 'giftedStudent:readAll', 'chat:create', 'studentAchievement:create', 'studentAchievement:approve'];
const JUDGE = ['scholarshipApplication:readAll', 'scholarshipApplication:score', 'giftedStudent:read'];
const STUDENT = ['giftedStudent:read', 'studentAchievement:create', 'chat:create'];
const ADVISOR = ['giftedStudent:read', 'giftedStudent:readAll', 'chat:create'];
const MANAGEMENT = ['giftedStudent:read', 'giftedStudent:readAll', 'documentType:readAll'];

describe('surfaceFromPermissions', () => {
  it("ro'yxat egasi → department", () => {
    expect(surfaceFromPermissions(DEPARTMENT)).toBe('department');
  });

  it('hakam → judge', () => {
    expect(surfaceFromPermissions(JUDGE)).toBe('judge');
  });

  it('talaba → student', () => {
    expect(surfaceFromPermissions(STUDENT)).toBe('student');
  });

  it('maslahatchi → advisor (readAll + chat)', () => {
    expect(surfaceFromPermissions(ADVISOR)).toBe('advisor');
  });

  it('kuzatuvchi rahbariyat → management (chat YO\'Q)', () => {
    expect(surfaceFromPermissions(MANAGEMENT)).toBe('management');
  });

  it("super_admin kabi to'liq ruxsatli rol → department (tartib muhim)", () => {
    const all = [...DEPARTMENT, ...JUDGE, ...ADVISOR];
    expect(surfaceFromPermissions(all)).toBe('department');
  });

  it("hech bir profilga tushmasa null (chaqiruvchi path'ga qaytadi)", () => {
    expect(surfaceFromPermissions(['faculty:readAll'])).toBeNull();
  });

  it("ruxsatlar hali yuklanmagan bo'lsa null", () => {
    expect(surfaceFromPermissions(undefined)).toBeNull();
    expect(surfaceFromPermissions([])).toBeNull();
  });
});
