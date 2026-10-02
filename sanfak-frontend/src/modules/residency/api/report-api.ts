import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchOne } from '@/shared/api';
import type {
  AttendanceBreakdown,
  FullReport,
  FundingDistribution,
  MonthlyAttendance,
  ReportSummary,
  ScienceScore,
  ScoreDistribution,
  SpecialtyCount,
  StudyPeriodCount,
  ClinicalActivity,
  SupervisorLoad,
} from './report-types';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

interface RawFullReport {
  summary?: Partial<ReportSummary>;
  attendanceMonthly?: Array<Partial<MonthlyAttendance>>;
  attendanceBreakdown?: Partial<AttendanceBreakdown>;
  specialtyDistribution?: Array<{ specialtyId?: string | null; title?: string; count?: number }>;
  fundingDistribution?: Partial<FundingDistribution>;
  scoreByScience?: Array<{
    scienceId?: string | null;
    title?: string;
    avgScore?: number;
    count?: number;
  }>;
  scoreDistribution?: Partial<ScoreDistribution>;
  studyPeriodDistribution?: Array<{ years?: number | null; title?: string; count?: number }>;
  clinicalActivity?: Partial<ClinicalActivity> & { byStatus?: Partial<ClinicalActivity['byStatus']> };
  supervisorWorkload?: Array<Partial<SupervisorLoad>>;
}

const n = (v: number | undefined | null): number => (typeof v === 'number' ? v : 0);

const mapSummary = (s: Partial<ReportSummary> = {}): ReportSummary => ({
  totalStudents: n(s.totalStudents),
  magistrants: n(s.magistrants),
  rezidentlar: n(s.rezidentlar),
  byudjet: n(s.byudjet),
  shartnoma: n(s.shartnoma),
  avgAttendance: n(s.avgAttendance),
  avgScore: n(s.avgScore),
  completedAssessments: n(s.completedAssessments),
});

const mapReport = (b: RawFullReport): FullReport => ({
  summary: mapSummary(b.summary),
  attendanceMonthly: (b.attendanceMonthly ?? []).map((m) => ({
    year: n(m.year),
    month: n(m.month),
    label: m.label ?? '',
    present: n(m.present),
    absent: n(m.absent),
    excused: n(m.excused),
    percent: n(m.percent),
  })),
  attendanceBreakdown: {
    present: n(b.attendanceBreakdown?.present),
    absent: n(b.attendanceBreakdown?.absent),
    excused: n(b.attendanceBreakdown?.excused),
    total: n(b.attendanceBreakdown?.total),
  },
  specialtyDistribution: (b.specialtyDistribution ?? []).map(
    (s): SpecialtyCount => ({
      specialtyId: s.specialtyId ?? null,
      title: s.title ?? 'Belgilanmagan',
      count: n(s.count),
    }),
  ),
  fundingDistribution: {
    byudjet: n(b.fundingDistribution?.byudjet),
    shartnoma: n(b.fundingDistribution?.shartnoma),
  },
  scoreByScience: (b.scoreByScience ?? []).map(
    (s): ScienceScore => ({
      scienceId: s.scienceId ?? null,
      title: s.title ?? 'Belgilanmagan',
      avgScore: n(s.avgScore),
      count: n(s.count),
    }),
  ),
  scoreDistribution: {
    alo: n(b.scoreDistribution?.alo),
    yaxshi: n(b.scoreDistribution?.yaxshi),
    qoniqarli: n(b.scoreDistribution?.qoniqarli),
    qoniqarsiz: n(b.scoreDistribution?.qoniqarsiz),
  },
  studyPeriodDistribution: (b.studyPeriodDistribution ?? []).map(
    (r): StudyPeriodCount => ({
      years: typeof r.years === 'number' ? r.years : null,
      title: r.title ?? 'Belgilanmagan',
      count: n(r.count),
    }),
  ),
  clinicalActivity: {
    total: n(b.clinicalActivity?.total),
    byStatus: {
      kutilmoqda: n(b.clinicalActivity?.byStatus?.kutilmoqda),
      tasdiqlangan: n(b.clinicalActivity?.byStatus?.tasdiqlangan),
      qaytarilgan: n(b.clinicalActivity?.byStatus?.qaytarilgan),
    },
    activeResidents: n(b.clinicalActivity?.activeResidents),
    silentResidents: n(b.clinicalActivity?.silentResidents),
    avgPerResident: n(b.clinicalActivity?.avgPerResident),
  },
  supervisorWorkload: (b.supervisorWorkload ?? []).map(
    (r): SupervisorLoad => ({
      supervisorId: r.supervisorId ?? '',
      name: r.name ?? "Noma'lum",
      total: n(r.total),
      magistratura: n(r.magistratura),
      ordinatura: n(r.ordinatura),
    }),
  ),
});

const ROOT = '/residency-reports';
const KEY = 'residency-reports';

export interface ReportParams {
  academicYear?: string;
  academicYearRef?: string | null;
  specialty?: string;
  program?: 'magistratura' | 'ordinatura';
}

export function useReport(params: ReportParams = {}) {
  return useQuery({
    queryKey: [KEY, params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<FullReport> =>
      mapReport(await fetchOne<RawFullReport>(`${ROOT}${qs(params as Q)}`)),
  });
}
