import { useQuery } from '@tanstack/react-query';
import { apiClient, fetchList } from '@/shared/api';

interface BackendStat {
  total: number;
  approved: number;
}

interface BackendSummary {
  academicYear: string | null;
  workloads: BackendStat;
  distributions: BackendStat;
  teachers: BackendStat;
  workPlans: BackendStat;
}

export interface StatCard {
  total: number;
  approved: number;
}

export interface StudyLoadSummary {
  academicYear: string | null;
  workloads: StatCard;
  distributions: StatCard;
  teachers: StatCard;
  workPlans: StatCard;
}

function mapStat(b: BackendStat): StatCard {
  return { total: b.total ?? 0, approved: b.approved ?? 0 };
}

function mapSummary(b: BackendSummary): StudyLoadSummary {
  return {
    academicYear: b.academicYear ?? null,
    workloads: mapStat(b.workloads),
    distributions: mapStat(b.distributions),
    teachers: mapStat(b.teachers),
    workPlans: mapStat(b.workPlans),
  };
}

export const DASHBOARD_SUMMARY_KEY = 'dashboardSummary';

export function useStudyLoadSummary(academicYear?: string, enabled = true) {
  return useQuery<StudyLoadSummary>({
    queryKey: [DASHBOARD_SUMMARY_KEY, academicYear ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (academicYear) params['academicYear'] = academicYear;
      const res = await apiClient.get<BackendSummary>('/reports/summary', { params });
      return mapSummary(res.data);
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export interface AcademicYearOption {
  id: string;
  title: string;
}

interface BackendAcademicYear {
  _id: string;
  title: string;
}

export function useAcademicYearsForDashboard() {
  return useQuery<AcademicYearOption[]>({
    queryKey: ['academicYears', 'dashboard-select'],
    queryFn: async () => {
      const docs = await fetchList<BackendAcademicYear>('/academic-years', { active: true });
      return docs.map((d) => ({ id: d._id, title: d.title }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
