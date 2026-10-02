import type { BackendOubFaculties, BackendOubTeachers, BackendOverview } from './mapper';
import type { StatisticsFilters } from '../model/types';

const delay = <T>(value: T, ms = 250): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const OVERVIEW: BackendOverview = {
  filters: { academicYear: null, faculty: null, scopeLevel: 'global' },
  studyPlans: { total: 42, approved: 31, percent: 73.8 },
  contingent: {
    groups: 186,
    students: 4120,
    byLanguage: [
      { language: "O'zbek", groups: 140, students: 3200 },
      { language: 'Rus', groups: 46, students: 920 },
    ],
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
  hours: {
    planTotalHour: 128400,
    planTotalCredit: 4280,
    distributedHour: 96000,
    residueHour: 4200,
    coverage: 95.6,
  },
  teachers: { total: 612, assigned: 430, unassigned: 182, assignedPercent: 70.3 },
  vacancies: { count: 37, hours: 5120 },
  documents: {
    syllabus: { total: 40, draft: 3, new: 5, in_review: 9, approved: 21, rejected: 2 },
    scienceProgram: { total: 40, draft: 2, new: 4, in_review: 7, approved: 25, rejected: 2 },
    readiness: 61.2,
  },
};

const FACULTIES: BackendOubFaculties = {
  academicYear: null,
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
    {
      facultyId: 'f2',
      faculty: 'Pediatriya fakulteti',
      directions: 4,
      groups: 38,
      students: 890,
      totalCredit: 980,
      totalHour: 29400,
      distributedHour: 24100,
      vacantHour: 1120,
      vacancies: 8,
    },
    {
      facultyId: 'f3',
      faculty: 'Stomatologiya fakulteti',
      directions: 3,
      groups: 24,
      students: 560,
      totalCredit: 640,
      totalHour: 19200,
      distributedHour: 16800,
      vacantHour: 640,
      vacancies: 5,
    },
    {
      facultyId: 'f4',
      faculty: 'Farmatsiya fakulteti',
      directions: 8,
      groups: 70,
      students: 1390,
      totalCredit: 1240,
      totalHour: 37200,
      distributedHour: 23900,
      vacantHour: 1520,
      vacancies: 12,
    },
  ],
  totals: {
    directions: 21,
    groups: 186,
    students: 4120,
    totalCredit: 4280,
    totalHour: 128400,
    distributedHour: 96000,
    vacantHour: 5120,
    vacancies: 37,
  },
};

const TEACHERS: BackendOubTeachers = {
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
    {
      departmentId: 'd2',
      department: 'Pediatriya kafedrasi',
      faculty: 'Pediatriya',
      teachers: 28,
      assigned: 19,
      unassigned: 9,
      assignedHour: 12100,
      vacancies: 4,
      vacantHour: 780,
    },
    {
      departmentId: 'd3',
      department: 'Stomatologiya kafedrasi',
      faculty: 'Stomatologiya',
      teachers: 18,
      assigned: 14,
      unassigned: 4,
      assignedHour: 8600,
      vacancies: 2,
      vacantHour: 340,
    },
  ],
  vacancies: {
    count: 37,
    hours: 5120,
    byDepartment: [
      { departmentId: 'd2', department: 'Pediatriya kafedrasi', count: 4, hours: 780 },
      { departmentId: 'd1', department: 'Terapiya kafedrasi', count: 3, hours: 620 },
      { departmentId: 'd3', department: 'Stomatologiya kafedrasi', count: 2, hours: 340 },
    ],
  },
};

export function mockOverview(f: StatisticsFilters): Promise<BackendOverview> {
  return delay({ ...OVERVIEW, filters: { ...OVERVIEW.filters, academicYear: f.academicYear ?? null, faculty: f.faculty ?? null } });
}

export function mockFaculties(f: StatisticsFilters): Promise<BackendOubFaculties> {
  return delay({ ...FACULTIES, academicYear: f.academicYear ?? null });
}

export function mockTeachers(_f: StatisticsFilters): Promise<BackendOubTeachers> {
  return delay(TEACHERS);
}
