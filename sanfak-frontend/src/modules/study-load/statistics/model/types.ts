export interface StatisticsFilters {
  academicYear?: string;
  faculty?: string;
}

export interface StudyPlansStat {
  total: number;
  approved: number;
  percent: number;
}

export interface ContingentLanguageRow {
  language: string;
  groups: number;
  students: number;
}

export interface ContingentStat {
  groups: number;
  students: number;
  byLanguage: ContingentLanguageRow[];
}

export type ExecutionStepKey = 'learningProcess' | 'workingSchedule' | 'workload' | 'distribution';

export interface ExecutionStep {
  key: ExecutionStepKey;
  total: number;
  done: number;
}

export interface ExecutionStat {
  steps: ExecutionStep[];
  percent: number;
}

export interface HoursStat {
  planTotalHour: number;
  planTotalCredit: number;
  distributedHour: number;
  residueHour: number;
  coverage: number;
}

export interface TeachersOverviewStat {
  total: number;
  assigned: number;
  unassigned: number;
  assignedPercent: number;
}

export interface VacanciesStat {
  count: number;
  hours: number;
}

export interface DocumentStatusCounts {
  total: number;
  draft: number;
  new: number;
  inReview: number;
  approved: number;
  rejected: number;
}

export interface DocumentsStat {
  syllabus: DocumentStatusCounts;
  scienceProgram: DocumentStatusCounts;
  readiness: number;
}

export interface OubOverview {
  filters: { academicYear: string | null; faculty: string | null; scopeLevel: string };
  studyPlans: StudyPlansStat | null;
  contingent: ContingentStat | null;
  execution: ExecutionStat | null;
  hours: HoursStat | null;
  teachers: TeachersOverviewStat | null;
  vacancies: VacanciesStat | null;
  documents: DocumentsStat | null;
}

export interface FacultyRow {
  facultyId: string;
  faculty: string;
  directions: number;
  groups: number;
  students: number;
  totalCredit: number;
  totalHour: number;
  distributedHour: number;
  vacantHour: number;
  vacancies: number;
}

export interface FacultyTotals {
  directions: number;
  groups: number;
  students: number;
  totalCredit: number;
  totalHour: number;
  distributedHour: number;
  vacantHour: number;
  vacancies: number;
}

export interface OubFaculties {
  academicYear: string | null;
  rows: FacultyRow[];
  totals: FacultyTotals;
}

export interface TeacherDepartmentRow {
  departmentId: string;
  department: string;
  faculty: string;
  teachers: number;
  assigned: number;
  unassigned: number;
  assignedHour: number;
  vacancies: number;
  vacantHour: number;
}

export interface VacancyDepartmentRow {
  departmentId: string;
  department: string;
  count: number;
  hours: number;
}

export interface TeachersSummary {
  total: number;
  assigned: number;
  unassigned: number;
  assignedPercent: number;
  unknownFaculty: number;
}

export interface TeachersVacancies {
  count: number;
  hours: number;
  byDepartment: VacancyDepartmentRow[];
}

export interface OubTeachers {
  summary: TeachersSummary;
  byDepartment: TeacherDepartmentRow[];
  vacancies: TeachersVacancies;
}

export interface RefOption {
  id: string;
  title: string;
}
