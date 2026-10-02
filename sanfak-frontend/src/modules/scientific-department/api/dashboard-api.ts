import { useQuery } from '@tanstack/react-query';
import { fetchOne } from '@/shared/api';
import { useSessionStore } from '@/app/session';
import type { Article } from '../model/types';
import { mapArticle, type BackendArticle } from './article-api';

export interface EntityCounts {
  total: number;
  new: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface DashboardStats {
  role: string | null;
  article: EntityCounts;
  thesis: EntityCounts;
  methodical: EntityCounts;
  monograph: EntityCounts;
  workPlan: EntityCounts;
  annualReport: EntityCounts;
  economicContract: { total: number; new: number; approved: number; rejected: number };
  conference: { total: number };
  hIndex: { total: number };
  reportTotal: number;
  signaturePending: number;
  methodicalSignPending: number;
  monographSignPending: number;
  approvalPending: number;
  recentArticles: Article[];
}

type RawDashboardStats = Omit<DashboardStats, 'recentArticles'> & {
  recentArticles?: BackendArticle[];
};

export function useDashboardStats() {
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['sci-dashboard-stats', userId],
    queryFn: async (): Promise<DashboardStats> => {
      const raw = await fetchOne<RawDashboardStats>('/scientific-dashboard/stats');
      return { ...raw, recentArticles: (raw.recentArticles ?? []).map(mapArticle) };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
