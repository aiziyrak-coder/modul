import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchPaginated,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import type { NotificationInput } from '../model/notification.types';
import { mapNotification, type BackendNotification } from './notification-mapper';

const KEY = 'qual-notification';
const ROOT = '/qualification-notifications';

export interface NotificationFilter {
  page: number;
  limit: number;
  [key: string]: unknown;
}

export function useNotificationsPaginated(filter: NotificationFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendNotification> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapNotification),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useNotifications() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'all'],
    queryFn: async () => (await fetchList<BackendNotification>(ROOT)).map(mapNotification),
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationInput) => postJson(ROOT, { title: input.text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: NotificationInput }) =>
      putJson(`${ROOT}/${v.id}`, { title: v.input.text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
