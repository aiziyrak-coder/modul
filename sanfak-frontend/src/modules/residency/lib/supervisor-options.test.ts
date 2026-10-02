import { describe, expect, it } from 'vitest';
import { limitSupervisorOptions, supervisorDepartmentLimit } from './supervisor-options';

const DEP = 'dep-1';
const OTHER = 'dep-2';

const options = [
  { id: 'u1', name: 'Aliyev Sardor', departmentId: DEP },
  { id: 'u2', name: 'Valiyev Jasur', departmentId: OTHER },
  { id: 'u3', name: 'Kafedrasiz Ustoz', departmentId: null },
];

describe('supervisorDepartmentLimit', () => {
  it("bo'lim xodimi CHEKLANMAYDI — kafedralararo biriktira oladi", () => {
    expect(supervisorDepartmentLimit(true, { departmentId: DEP })).toBeNull();
  });

  it('boshqa rol — rezidentning kafedrasi bilan cheklanadi', () => {
    expect(supervisorDepartmentLimit(false, { departmentId: DEP })).toBe(DEP);
  });

  it('rezident tanlanmagan — cheklov yo‘q (modal hali ochilmagan)', () => {
    expect(supervisorDepartmentLimit(false, null)).toBeNull();
    expect(supervisorDepartmentLimit(false, undefined)).toBeNull();
  });

  it('rezidentning kafedrasi yo‘q — cheklov qo‘yilmaydi', () => {
    expect(supervisorDepartmentLimit(false, { departmentId: null })).toBeNull();
  });
});

describe('limitSupervisorOptions', () => {
  it('cheklov yo‘q — ro‘yxat o‘zgarmaydi', () => {
    expect(limitSupervisorOptions(options, null)).toBe(options);
  });

  it('cheklov bor — faqat o‘sha kafedra qoladi', () => {
    expect(limitSupervisorOptions(options, DEP).map((u) => u.id)).toEqual(['u1']);
  });

  it('kafedrasi belgilanmagan ustoz cheklovda CHIQMAYDI', () => {
    expect(limitSupervisorOptions(options, DEP).some((u) => u.id === 'u3')).toBe(false);
  });

  it('mos keluvchi yo‘q — bo‘sh ro‘yxat (piker «topilmadi» ko‘rsatadi)', () => {
    expect(limitSupervisorOptions(options, 'dep-9')).toEqual([]);
  });

  it('bo‘sh kirish', () => {
    expect(limitSupervisorOptions([], DEP)).toEqual([]);
  });
});
