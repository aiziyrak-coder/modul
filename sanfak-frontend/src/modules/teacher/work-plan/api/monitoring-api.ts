import { useQuery } from '@tanstack/react-query';
import { apiClient, fetchPaginated, getApiErrorMessage, type Paginated } from '@/shared/api';
import { mapMonitoringRow, type BackendMonitoringRow } from './monitoring-mapper';
import type { MonitoringFilter } from '../model/monitoring-types';

const MONITORING_KEY = 'personalWorkPlanMonitoring';
const ROOT = '/personal-work-plans';

function buildFilterParams(filter: Omit<MonitoringFilter, 'page' | 'limit'>): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filter.search) params.search = filter.search;
  if (filter.academicYear) params.academicYear = filter.academicYear;
  if (filter.status) params.status = filter.status;
  return params;
}

export function useMonitoringRows(filter: MonitoringFilter) {
  return useQuery({
    queryKey: [MONITORING_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: { page: number; limit: number; [key: string]: unknown } = {
        page: filter.page,
        limit: filter.limit,
        ...buildFilterParams(filter),
      };
      const res: Paginated<BackendMonitoringRow> = await fetchPaginated(`${ROOT}/monitoring`, params);
      return {
        items: res.docs.map(mapMonitoringRow),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

export async function downloadMonitoringExport(
  filter: Omit<MonitoringFilter, 'page' | 'limit'>,
): Promise<void> {
  const params = { ...buildFilterParams(filter), format: 'excel' };
  const res = await apiClient.get(`${ROOT}/monitoring/export`, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'monitoring.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { getApiErrorMessage };
