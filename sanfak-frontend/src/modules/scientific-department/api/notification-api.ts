import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { fetchOne, fetchPaginated, putJson } from '@/shared/api';
import type { AppNotification } from '../model/types';

const ROOT = '/notifications';
const KEY = 'sci-notification';

interface BackendNotification {
  _id: string;
  eventType: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt?: string;
}

const dateTime = (d?: string): string =>
  d ? d.slice(0, 10) + ' ' + d.slice(11, 16) : '';

const mapNotification = (d: BackendNotification): AppNotification => ({
  id: d._id,
  eventType: d.eventType,
  title: d.title,
  body: d.body ?? null,
  link: d.link ?? null,
  read: d.read,
  date: dateTime(d.createdAt),
});

export function useNotifications(page: number, limit: number) {
  return useQuery({
    queryKey: [KEY, { page, limit }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendNotification>(ROOT, { page, limit });
      return { ...res, docs: res.docs.map(mapNotification) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [KEY, 'unread'],
    queryFn: () => fetchOne<{ count: number }>(`${ROOT}/unread-count`),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => putJson(`${ROOT}/read-all`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
