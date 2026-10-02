import { describe, expect, it } from 'vitest';
import { mapFaculties, mapOverview, mapTeachers, type BackendOubFaculties, type BackendOubTeachers, type BackendOverview } from './mapper';

const FULL_OVERVIEW: BackendOverview = {
  filters: { academicYear: 'y1', faculty: null, scopeLevel: 'global' },
  studyPlans: { total: 42, approved: 31, percent: 73.8 },
  contingent: {
    groups: 186,
    students: 4120,
    byLanguage: [{ language: "O'zbek", groups: 140, students: 3200 }],
  },
  execution: {
    steps: [
      { key: 'learningProcess', total: 42, done: 31 },
      { key: 'workingSchedule', total: 40, done: 22 },
      { key: 'workload', total: 31, done: 18 },
      { key: 'distribution', total: 31, done: 12 },
    ],
    percent: 58.1,
  },
  hours: { planTotalHour: 128400, planTotalCredit: 4280, distributedHour: 96000, residueHour: 4200, coverage: 95.6 },
  teachers: { total: 612, assigned: 430, unassigned: 182, assignedPercent: 70.3 },
  vacancies: { count: 37, hours: 5120 },
  documents: {
    syllabus: { total: 40, draft: 3, new: 5, in_review: 9, approved: 21, rejected: 2 },
    scienceProgram: { total: 40, draft: 2, new: 4, in_review: 7, approved: 25, rejected: 2 },
    readiness: 61.2,
  },
};

describe('mapOverview kontrakti', () => {
  it("to'liq javobni FE tipiga to'g'ri o'tkazadi (_id yo'q, camelCase)", () => {
    const mapped = mapOverview(FULL_OVERVIEW);

    expect(mapped.studyPlans).toEqual({ total: 42, approved: 31, percent: 73.8 });
    expect(mapped.contingent?.byLanguage[0]).toEqual({ language: "O'zbek", groups: 140, students: 3200 });
    expect(mapped.execution?.steps).toHaveLength(4);
    expect(mapped.execution?.steps[0]).toEqual({ key: 'learningProcess', total: 42, done: 31 });
    expect(mapped.hours).toEqual({
      planTotalHour: 128400,
      planTotalCredit: 4280,
      distributedHour: 96000,
      residueHour: 4200,
      coverage: 95.6,
    });
    expect(mapped.documents?.syllabus.inReview).toBe(9);
    expect(mapped.documents?.syllabus).not.toHaveProperty('in_review');
  });

  it('F-10: blok `null` bo`lsa NATIJA HAM `null` — 0 EMAS (hisoblab bo`lmadi ≠ nol)', () => {
    const partial: BackendOverview = {
      ...FULL_OVERVIEW,
      studyPlans: null,
      hours: null,
      vacancies: null,
    };
    const mapped = mapOverview(partial);

    expect(mapped.studyPlans).toBeNull();
    expect(mapped.hours).toBeNull();
    expect(mapped.vacancies).toBeNull();
    expect(mapped.contingent).not.toBeNull();
  });

  it('`0` haqiqiy qiymat sifatida saqlanadi (`??`, `||` EMAS)', () => {
    const zeroed: BackendOverview = {
      ...FULL_OVERVIEW,
      studyPlans: { total: 0, approved: 0, percent: 0 },
      vacancies: { count: 0, hours: 0 },
    };
    const mapped = mapOverview(zeroed);

    expect(mapped.studyPlans).toEqual({ total: 0, approved: 0, percent: 0 });
    expect(mapped.vacancies).toEqual({ count: 0, hours: 0 });
  });
});

describe('mapFaculties kontrakti', () => {
  const backend: BackendOubFaculties = {
    academicYear: 'y1',
    rows: [
      {
        facultyId: 'f1',
        faculty: 'Davolash ishi fakulteti',
        directions: 6,
        groups: 54,
        students: 1280,
        totalCredit: 1420,
        totalHour: 42600,
        distributedHour: 31200,
        vacantHour: 1840,
        vacancies: 12,
      },
    ],
    totals: {
      directions: 6,
      groups: 54,
      students: 1280,
      totalCredit: 1420,
      totalHour: 42600,
      distributedHour: 31200,
      vacantHour: 1840,
      vacancies: 12,
    },
  };

  it('qatorlarni va jamini FE tipiga o`tkazadi', () => {
    const mapped = mapFaculties(backend);
    expect(mapped.rows).toHaveLength(1);
    expect(mapped.rows[0]?.faculty).toBe('Davolash ishi fakulteti');
    expect(mapped.totals.vacancies).toBe(12);
  });

  it('bo`sh rows[] — sahifa uchun `[]`, undefined EMAS', () => {
    const empty = mapFaculties({ ...backend, rows: [] });
    expect(empty.rows).toEqual([]);
  });
});

describe('mapTeachers kontrakti', () => {
  const backend: BackendOubTeachers = {
    summary: { total: 612, assigned: 430, unassigned: 182, assignedPercent: 70.3, unknownFaculty: 14 },
    byDepartment: [
      {
        departmentId: 'd1',
        department: 'Terapiya kafedrasi',
        faculty: 'Davolash ishi',
        teachers: 42,
        assigned: 31,
        unassigned: 11,
        assignedHour: 18400,
        vacancies: 3,
        vacantHour: 620,
      },
    ],
    vacancies: {
      count: 37,
      hours: 5120,
      byDepartment: [{ departmentId: 'd1', department: 'Terapiya kafedrasi', count: 3, hours: 620 }],
    },
  };

  it('summary + byDepartment + vacancies to`g`ri o`tkaziladi', () => {
    const mapped = mapTeachers(backend);
    expect(mapped.summary.unassigned).toBe(182);
    expect(mapped.byDepartment[0]?.department).toBe('Terapiya kafedrasi');
    expect(mapped.vacancies.byDepartment).toHaveLength(1);
  });
});
