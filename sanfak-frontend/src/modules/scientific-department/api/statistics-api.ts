import { useQuery } from '@tanstack/react-query';
import { fetchList, fetchOne } from '@/shared/api';
import { useSessionStore } from '@/app/session';

export interface StatusBlock {
  total: number;
  new: number;
  approved: number;
  rejected: number;
}

interface CrossRow {
  article?: number;
  thesis?: number;
  monograph?: number;
  patent?: number;
  defense?: number;
  total: number;
}

export interface FacultyRow extends CrossRow {
  faculty: string;
}

export interface DepartmentRow extends CrossRow {
  department: string;
}

export interface YearRow extends CrossRow {
  year: string;
}

export interface SpecialtyRow {
  specialty: string;
  defense?: number;
  degree?: number;
  title?: number;
  total: number;
}

export interface DirectionRow {
  direction: string;
  total: number;
}

export interface ScientificStatistics {
  byType: Record<string, StatusBlock>;
  byFaculty: FacultyRow[];
  byDepartment: DepartmentRow[];
  bySpecialty: SpecialtyRow[];
  byDirection: DirectionRow[];
  byYear: YearRow[];
  hIndex: {
    profiles: number;
    scopusLinked: number;
    scholarLinked: number;
    scopusAvg: number;
    scopusMax: number;
    scholarAvg: number;
    scholarMax: number;
    citations: number;
  };
  contracts: { count: number; totalAmount: number; approvedAmount: number };
  exam: {
    total: number;
    new?: number;
    approved?: number;
    rejected?: number;
    bySpecialty: { key: string; label?: string; count: number }[];
  };
  topAuthors: { name: string; count: number }[];
}

export function useScientificStatistics() {
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['sci-statistics', userId],
    queryFn: () => fetchOne<ScientificStatistics>('/scientific-dashboard/statistics'),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export type Granularity = 'day' | 'month' | 'year';

export interface ContractPoint {
  period: string;
  count: number;
  amount: number;
}

export function useContractsSeries(
  granularity: Granularity,
  range?: { from?: string; to?: string },
) {
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['sci-contracts-series', userId, granularity, range?.from, range?.to],
    queryFn: () => {
      const qs = new URLSearchParams({ granularity });
      if (range?.from) qs.set('from', range.from);
      if (range?.to) qs.set('to', range.to);
      return fetchList<ContractPoint>(`/scientific-dashboard/contracts-series?${qs.toString()}`);
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
