import { describe, expect, it } from 'vitest';
import { mapAccountDefaults } from './teacher-profile-api';

describe('mapAccountDefaults — /auth/profile → yangi profil defaultlari (P-19)', () => {
  it('ism/familiya + fakultet (users.faculty ustun) + kafedra', () => {
    const out = mapAccountDefaults({
      firstName: 'Nilufar',
      lastName: 'Rahimova',
      faculty: 'fac-user',
      department: { _id: 'dep1', faculty: 'fac-dep' },
    });
    expect(out).toEqual({
      firstName: 'Nilufar',
      lastName: 'Rahimova',
      middleName: null,
      facultyId: 'fac-user',
      departmentId: 'dep1',
    });
  });

  it('users.faculty yo`q → kafedraning fakulteti (ADR-030 fallback), populate obyekt ham', () => {
    const out = mapAccountDefaults({
      department: { _id: 'dep1', faculty: { _id: 'fac-dep' } },
    });
    expect(out.facultyId).toBe('fac-dep');
    expect(out.departmentId).toBe('dep1');
  });

  it('kafedra xom id (populate qilinmagan) → departmentId, facultyId null', () => {
    const out = mapAccountDefaults({ department: 'dep1' });
    expect(out.departmentId).toBe('dep1');
    expect(out.facultyId).toBeNull();
  });

  it('bo`sh javob → hammasi null (sahifa «—»/sessiya fallback bilan davom etadi)', () => {
    expect(mapAccountDefaults({})).toEqual({
      firstName: null,
      lastName: null,
      middleName: null,
      facultyId: null,
      departmentId: null,
    });
  });
});
