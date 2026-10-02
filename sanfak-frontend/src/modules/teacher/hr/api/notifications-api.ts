import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPaginated, getApiErrorMessage, putJson, type Paginated } from '@/shared/api';
import { mapNotification, type BackendNotification } from './notifications-mapper';

const NOTIFICATIONS_KEY = 'hrNotifications';
const ROOT = '/notifications';
const PAGE_SIZE = 20;

export function useHrNotifications(page: number) {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, 'paginate', page],
    queryFn: async () => {
      const res: Paginated<BackendNotification> = await fetchPaginated(ROOT, {
        page,
        limit: PAGE_SIZE,
      });
      return {
        items: res.docs.map(mapNotification),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => putJson(`${ROOT}/read-all`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
  });
}

export { getApiErrorMessage };
