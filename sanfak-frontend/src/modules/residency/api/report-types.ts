export interface ReportSummary {
  totalStudents: number;
  magistrants: number;
  rezidentlar: number;
  byudjet: number;
  shartnoma: number;
  avgAttendance: number;
  avgScore: number;
  completedAssessments: number;
}

export interface MonthlyAttendance {
  year: number;
  month: number;
  label: string;
  present: number;
  absent: number;
  excused: number;
  percent: number;
}

export interface AttendanceBreakdown {
  present: number;
  absent: number;
  excused: number;
  total: number;
}

export interface SpecialtyCount {
  specialtyId: string | null;
  title: string;
  count: number;
}

export interface FundingDistribution {
  byudjet: number;
  shartnoma: number;
}

export interface ScienceScore {
  scienceId: string | null;
  title: string;
  avgScore: number;
  count: number;
}

export interface ScoreDistribution {
  alo: number;
  yaxshi: number;
  qoniqarli: number;
  qoniqarsiz: number;
}

export interface StudyPeriodCount {
  years: number | null;
  title: string;
  count: number;
}

export interface ClinicalActivity {
  total: number;
  byStatus: { kutilmoqda: number; tasdiqlangan: number; qaytarilgan: number };
  activeResidents: number;
  silentResidents: number;
  avgPerResident: number;
}

export interface SupervisorLoad {
  supervisorId: string;
  name: string;
  total: number;
  magistratura: number;
  ordinatura: number;
}

export interface FullReport {
  summary: ReportSummary;
  attendanceMonthly: MonthlyAttendance[];
  attendanceBreakdown: AttendanceBreakdown;
  specialtyDistribution: SpecialtyCount[];
  fundingDistribution: FundingDistribution;
  scoreByScience: ScienceScore[];
  scoreDistribution: ScoreDistribution;
  studyPeriodDistribution: StudyPeriodCount[];
  clinicalActivity: ClinicalActivity;
  supervisorWorkload: SupervisorLoad[];
}

export const SCORE_BANDS = [
  { key: 'alo', label: 'A’lo (86–100)', color: '#27AE60' },
  { key: 'yaxshi', label: 'Yaxshi (71–85)', color: '#2D9CDB' },
  { key: 'qoniqarli', label: 'Qoniqarli (56–70)', color: '#F2C94C' },
  { key: 'qoniqarsiz', label: 'Qoniqarsiz (0–55)', color: '#EB5757' },
] as const;

export const ATTENDANCE_BANDS = [
  { key: 'present', label: 'Kelganlar', color: '#27AE60' },
  { key: 'absent', label: 'Kelmaganlar', color: '#EB5757' },
  { key: 'excused', label: 'Sababli', color: '#F2C94C' },
] as const;

export const CHART_PALETTE = [
  '#27AE60',
  '#2D9CDB',
  '#F2C94C',
  '#EB5757',
  '#9B51E0',
  '#56CCF2',
  '#F2994A',
];
