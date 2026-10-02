import { useQuery } from '@tanstack/react-query';
import { apiClient, fetchList, fetchOne, fetchPaginated } from '@/shared/api';

const ROOT = '/audit-logs';
const KEY = 'admin-audit-logs';

export interface AuditLogUser {
  id: string;
  firstName?: string;
  lastName?: string;
}

export interface AuditLogEntry {
  id: string;
  createdAt: string | null;
  userName: string;
  user: AuditLogUser | null;
  action: string;
  module: string;
  method: string;
  path: string;
  statusCode: number | null;
  responseTime: number | null;
  files: string[];
  ip: string;
  userAgent: string;
}

export interface AuditLogFilter {
  page: number;
  limit: number;
  search?: string;
  module?: string;
  method?: string;
  dateFrom?: string;
  dateTo?: string;
  onlyMutations?: boolean;
}

interface BackendUser {
  _id?: string;
  firstName?: string;
  lastName?: string;
}

interface BackendAuditLog {
  _id?: string;
  createdAt?: string;
  userName?: string;
  user?: BackendUser | string | null;
  action?: string;
  module?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  responseTime?: number;
  files?: string[];
  ip?: string;
  userAgent?: string;
}

const mapUser = (u: BackendAuditLog['user']): AuditLogUser | null => {
  if (!u || typeof u === 'string') return null;
  return {
    id: u._id ?? '',
    firstName: u.firstName,
    lastName: u.lastName,
  };
};

export const mapAuditLog = (d: BackendAuditLog): AuditLogEntry => ({
  id: d._id ?? '',
  createdAt: d.createdAt ?? null,
  userName: d.userName ?? '',
  user: mapUser(d.user),
  action: d.action ?? '',
  module: d.module ?? '',
  method: d.method ?? '',
  path: d.path ?? '',
  statusCode: d.statusCode ?? null,
  responseTime: d.responseTime ?? null,
  files: d.files ?? [],
  ip: d.ip ?? '',
  userAgent: d.userAgent ?? '',
});

const cleanParams = (f: AuditLogFilter): Record<string, unknown> => {
  const out: Record<string, unknown> = { page: f.page, limit: f.limit };
  if (f.search) out.search = f.search;
  if (f.module) out.module = f.module;
  if (f.method) out.method = f.method;
  if (f.dateFrom) out.dateFrom = f.dateFrom;
  if (f.dateTo) out.dateTo = f.dateTo;
  if (f.onlyMutations) out.onlyMutations = true;
  return out;
};

export function useAuditLogs(filter: AuditLogFilter) {
  return useQuery({
    queryKey: [KEY, 'list', filter],
    queryFn: async () => {
      const res = await fetchPaginated<BackendAuditLog>(
        `${ROOT}/paginate`,
        cleanParams(filter) as { page: number; limit: number },
      );
      return {
        items: (res.docs ?? []).map(mapAuditLog),
        total: res.totalDocs ?? 0,
      };
    },
    placeholderData: (prev) => prev,
  });
}

export function useAuditLogModules() {
  return useQuery({
    queryKey: [KEY, 'modules'],
    queryFn: () => fetchList<string>(`${ROOT}/modules`),
    staleTime: 5 * 60 * 1000,
  });
}

interface GroupedNode {
  permissions?: { section?: string; title?: string }[];
}

interface GroupedResponse {
  groups?: GroupedNode[];
}

export function useSectionTitles() {
  return useQuery({
    queryKey: [KEY, 'section-titles'],
    queryFn: async () => {
      const raw = await fetchOne<GroupedResponse | GroupedNode[]>(
        '/roles/sections-grouped',
      );
      const groups: GroupedNode[] = Array.isArray(raw) ? raw : (raw?.groups ?? []);
      const map: Record<string, string> = {};
      groups.forEach((g) =>
        (g.permissions ?? []).forEach((p) => {
          if (p.section && p.title) map[p.section] = p.title;
        }),
      );
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });
}

async function downloadBlob(
  path: string,
  filter: AuditLogFilter,
  fileName: string,
): Promise<void> {
  const { page: _page, limit: _limit, ...rest } = cleanParams(filter) as Record<string, unknown>;
  const res = await apiClient.get(path, { params: rest, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const downloadAuditLogExcel = (filter: AuditLogFilter): Promise<void> =>
  downloadBlob(`${ROOT}/export`, filter, 'audit-log.xlsx');

export const downloadAuditLogPdf = (filter: AuditLogFilter): Promise<void> =>
  downloadBlob(`${ROOT}/export/pdf`, filter, 'audit-jurnali.pdf');
