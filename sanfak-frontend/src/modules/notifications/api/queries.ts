import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@/shared/api';
import { useSessionStore } from '@/app/session';
import {
  fetchFeed,
  fetchPreferences,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  updatePreferences,
  type FeedParams,
} from './backend';
import { mapNotification } from './mapper';
import { getNotificationSocket } from '../lib/notification-socket';
import type { NotificationVM, PreferencesInput } from '../model/types';

export interface FeedFilters {
  read?: boolean;
  eventType?: string;
}

type FeedPage = Paginated<NotificationVM>;

export const notifKeys = {
  unread: ['notif', 'unread'] as const,
  feedRoot: ['notif', 'feed'] as const,
  feed: (filters: FeedFilters, page: number) => ['notif', 'feed', filters, page] as const,
  preferences: ['notif', 'preferences'] as const,
};

export function useUnreadCount() {
  const isAuthenticated = useSessionStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: notifKeys.unread,
    queryFn: fetchUnreadCount,
    enabled: isAuthenticated,
    refetchInterval: 600_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });
}

export function useFeed(filters: FeedFilters, page: number, limit: number) {
  return useQuery({
    queryKey: notifKeys.feed(filters, page),
    queryFn: async (): Promise<FeedPage> => {
      const params: FeedParams = { page, limit, ...filters };
      const res = await fetchFeed(params);
      return { ...res, docs: res.docs.map(mapNotification) };
    },
    refetchInterval: false,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });
}

interface InAppNotificationPush {
  eventType: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
}

export function useNotificationSocketSync(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    const socket = getNotificationSocket();
    const onNotification = (_payload: InAppNotificationPush) => {
      void qc.invalidateQueries({ queryKey: notifKeys.unread });
      void qc.invalidateQueries({ queryKey: notifKeys.feedRoot });
    };

    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
    };
  }, [enabled, qc]);
}

function markVmRead(vm: NotificationVM): NotificationVM {
  return vm.read ? vm : { ...vm, read: true, readAt: new Date() };
}

interface MutationSnapshot {
  prevUnread: number | undefined;
  prevFeeds: [readonly unknown[], FeedPage | undefined][];
}

async function snapshotAndCancel(qc: ReturnType<typeof useQueryClient>): Promise<MutationSnapshot> {
  await qc.cancelQueries({ queryKey: ['notif'] });
  return {
    prevUnread: qc.getQueryData<number>(notifKeys.unread),
    prevFeeds: qc.getQueriesData<FeedPage>({ queryKey: notifKeys.feedRoot }),
  };
}

function rollback(qc: ReturnType<typeof useQueryClient>, snapshot: MutationSnapshot | undefined) {
  if (!snapshot) return;
  qc.setQueryData(notifKeys.unread, snapshot.prevUnread);
  for (const [key, data] of snapshot.prevFeeds) qc.setQueryData(key, data);
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id: string) => {
      const snapshot = await snapshotAndCancel(qc);
      let wasUnread = false;

      qc.setQueriesData<FeedPage>({ queryKey: notifKeys.feedRoot }, (old) => {
        if (!old) return old;
        return {
          ...old,
          docs: old.docs.map((vm) => {
            if (vm.id !== id) return vm;
            if (!vm.read) wasUnread = true;
            return markVmRead(vm);
          }),
        };
      });
      if (wasUnread) {
        qc.setQueryData<number>(notifKeys.unread, (n) => Math.max(0, (n ?? 0) - 1));
      }

      return snapshot;
    },
    onError: (_err, _id, snapshot) => rollback(qc, snapshot),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['notif'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      const snapshot = await snapshotAndCancel(qc);

      qc.setQueriesData<FeedPage>({ queryKey: notifKeys.feedRoot }, (old) =>
        old ? { ...old, docs: old.docs.map(markVmRead) } : old,
      );
      qc.setQueryData(notifKeys.unread, 0);

      return snapshot;
    },
    onError: (_err, _vars, snapshot) => rollback(qc, snapshot),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['notif'] });
    },
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: notifKeys.preferences,
    queryFn: fetchPreferences,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PreferencesInput) => updatePreferences(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: notifKeys.preferences }),
  });
}
