import type {
  ContingentLanguageRow,
  ContingentStat,
  DocumentStatusCounts,
  DocumentsStat,
  ExecutionStat,
  ExecutionStep,
  FacultyRow,
  FacultyTotals,
  HoursStat,
  OubFaculties,
  OubOverview,
  OubTeachers,
  StudyPlansStat,
  TeacherDepartmentRow,
  TeachersOverviewStat,
  TeachersSummary,
  TeachersVacancies,
  VacanciesStat,
  VacancyDepartmentRow,
} from '../model/types';

interface BackendDocStatus {
  total: number;
  draft: number;
  new: number;
  in_review: number;
  approved: number;
  rejected: number;
}

export interface BackendOverview {
  filters: { academicYear: string | null; faculty: string | null; scopeLevel: string };
  studyPlans: { total: number; approved: number; percent: number } | null;
  contingent: {
    groups: number;
    students: number;
    byLanguage: { language: string; groups: number; students: number }[];
  } | null;
  execution: {
    steps: { key: string; total: number; done: number }[];
    percent: number;
  } | null;
  hours: {
    planTotalHour: number;
    planTotalCredit: number;
    distributedHour: number;
    residueHour: number;
    coverage: number;
  } | null;
  teachers: { total: number; assigned: number; unassigned: number; assignedPercent: number } | null;
  vacancies: { count: number; hours: number } | null;
  documents: {
    syllabus: BackendDocStatus;
    scienceProgram: BackendDocStatus;
    readiness: number;
  } | null;
}

export interface BackendFacultyRow {
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

export interface BackendOubFaculties {
  academicYear: string | null;
  rows: BackendFacultyRow[];
  totals: {
    directions: number;
    groups: number;
    students: number;
    totalCredit: number;
    totalHour: number;
    distributedHour: number;
    vacantHour: number;
    vacancies: number;
  };
}

export interface BackendTeacherDepartmentRow {
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

export interface BackendVacancyDepartmentRow {
  departmentId: string;
  department: string;
  count: number;
  hours: number;
}

export interface BackendOubTeachers {
  summary: {
    total: number;
    assigned: number;
    unassigned: number;
    assignedPercent: number;
    unknownFaculty: number;
  };
  byDepartment: BackendTeacherDepartmentRow[];
  vacancies: { count: number; hours: number; byDepartment: BackendVacancyDepartmentRow[] };
}

function mapDocStatus(d: BackendDocStatus): DocumentStatusCounts {
  return {
    total: d.total ?? 0,
    draft: d.draft ?? 0,
    new: d.new ?? 0,
    inReview: d.in_review ?? 0,
    approved: d.approved ?? 0,
    rejected: d.rejected ?? 0,
  };
}

function mapExecutionStep(s: { key: string; total: number; done: number }): ExecutionStep {
  return {
    key: s.key as ExecutionStep['key'],
    total: s.total ?? 0,
    done: s.done ?? 0,
  };
}

export function mapOverview(b: BackendOverview): OubOverview {
  const studyPlans: StudyPlansStat | null = b.studyPlans
    ? { total: b.studyPlans.total ?? 0, approved: b.studyPlans.approved ?? 0, percent: b.studyPlans.percent ?? 0 }
    : null;

  const contingent: ContingentStat | null = b.contingent
    ? {
        groups: b.contingent.groups ?? 0,
        students: b.contingent.students ?? 0,
        byLanguage: (b.contingent.byLanguage ?? []).map(
          (r): ContingentLanguageRow => ({
            language: r.language,
            groups: r.groups ?? 0,
            students: r.students ?? 0,
          }),
        ),
      }
    : null;

  const execution: ExecutionStat | null = b.execution
    ? { steps: (b.execution.steps ?? []).map(mapExecutionStep), percent: b.execution.percent ?? 0 }
    : null;

  const hours: HoursStat | null = b.hours
    ? {
        planTotalHour: b.hours.planTotalHour ?? 0,
        planTotalCredit: b.hours.planTotalCredit ?? 0,
        distributedHour: b.hours.distributedHour ?? 0,
        residueHour: b.hours.residueHour ?? 0,
        coverage: b.hours.coverage ?? 0,
      }
    : null;

  const teachers: TeachersOverviewStat | null = b.teachers
    ? {
        total: b.teachers.total ?? 0,
        assigned: b.teachers.assigned ?? 0,
        unassigned: b.teachers.unassigned ?? 0,
        assignedPercent: b.teachers.assignedPercent ?? 0,
      }
    : null;

  const vacancies: VacanciesStat | null = b.vacancies
    ? { count: b.vacancies.count ?? 0, hours: b.vacancies.hours ?? 0 }
    : null;

  const documents: DocumentsStat | null = b.documents
    ? {
        syllabus: mapDocStatus(b.documents.syllabus),
        scienceProgram: mapDocStatus(b.documents.scienceProgram),
        readiness: b.documents.readiness ?? 0,
      }
    : null;

  return {
    filters: {
      academicYear: b.filters?.academicYear ?? null,
      faculty: b.filters?.faculty ?? null,
      scopeLevel: b.filters?.scopeLevel ?? 'global',
    },
    studyPlans,
    contingent,
    execution,
    hours,
    teachers,
    vacancies,
    documents,
  };
}

function mapFacultyRow(r: BackendFacultyRow): FacultyRow {
  return {
    facultyId: r.facultyId,
    faculty: r.faculty,
    directions: r.directions ?? 0,
    groups: r.groups ?? 0,
    students: r.students ?? 0,
    totalCredit: r.totalCredit ?? 0,
    totalHour: r.totalHour ?? 0,
    distributedHour: r.distributedHour ?? 0,
    vacantHour: r.vacantHour ?? 0,
    vacancies: r.vacancies ?? 0,
  };
}

export function mapFaculties(b: BackendOubFaculties): OubFaculties {
  const totals: FacultyTotals = {
    directions: b.totals?.directions ?? 0,
    groups: b.totals?.groups ?? 0,
    students: b.totals?.students ?? 0,
    totalCredit: b.totals?.totalCredit ?? 0,
    totalHour: b.totals?.totalHour ?? 0,
    distributedHour: b.totals?.distributedHour ?? 0,
    vacantHour: b.totals?.vacantHour ?? 0,
    vacancies: b.totals?.vacancies ?? 0,
  };
  return {
    academicYear: b.academicYear ?? null,
    rows: (b.rows ?? []).map(mapFacultyRow),
    totals,
  };
}

function mapTeacherDepartmentRow(r: BackendTeacherDepartmentRow): TeacherDepartmentRow {
  return {
    departmentId: r.departmentId,
    department: r.department,
    faculty: r.faculty,
    teachers: r.teachers ?? 0,
    assigned: r.assigned ?? 0,
    unassigned: r.unassigned ?? 0,
    assignedHour: r.assignedHour ?? 0,
    vacancies: r.vacancies ?? 0,
    vacantHour: r.vacantHour ?? 0,
  };
}

function mapVacancyDepartmentRow(r: BackendVacancyDepartmentRow): VacancyDepartmentRow {
  return {
    departmentId: r.departmentId,
    department: r.department,
    count: r.count ?? 0,
    hours: r.hours ?? 0,
  };
}

export function mapTeachers(b: BackendOubTeachers): OubTeachers {
  const summary: TeachersSummary = {
    total: b.summary?.total ?? 0,
    assigned: b.summary?.assigned ?? 0,
    unassigned: b.summary?.unassigned ?? 0,
    assignedPercent: b.summary?.assignedPercent ?? 0,
    unknownFaculty: b.summary?.unknownFaculty ?? 0,
  };
  const vacancies: TeachersVacancies = {
    count: b.vacancies?.count ?? 0,
    hours: b.vacancies?.hours ?? 0,
    byDepartment: (b.vacancies?.byDepartment ?? []).map(mapVacancyDepartmentRow),
  };
  return {
    summary,
    byDepartment: (b.byDepartment ?? []).map(mapTeacherDepartmentRow),
    vacancies,
  };
}
