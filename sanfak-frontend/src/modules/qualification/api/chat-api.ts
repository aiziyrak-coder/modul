import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { useSessionStore } from '@/app/session';
import { apiClient, fetchList, fetchOne, postJson, putJson } from '@/shared/api';
import { getChatSocket, getLastOnlineIds } from '../lib/chat-socket';

export interface WorkSlot {
  day: number;
  from: string;
  to: string;
}

export interface ChatPerson {
  _id: string;
  firstName?: string;
  lastName?: string;
  photo?: string;
  online?: boolean;
  workingSchedule?: WorkSlot[];
  lastSeen?: string | null;
}

export interface ChatMessage {
  _id: string;
  sender: ChatPerson;
  receiver: ChatPerson;
  message: string;
  createdAt: string;
  readAt?: string | null;
}

export interface Conversation {
  user: ChatPerson;
  lastMessage?: {
    message?: string;
    createdAt?: string;
    fileType?: string;
    sender?: string;
    readAt?: string | null;
  };
  unreadCount: number;
}

export interface ThreadPage {
  docs: ChatMessage[];
}

export const personName = (p?: ChatPerson): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ').trim() || '—' : '—';

export interface MyProfile {
  firstName?: string;
  lastName?: string;
  photo?: string;
}

export function useMyProfile(enabled = true) {
  return useQuery({
    queryKey: ['qual-chat', 'me'],
    queryFn: () => fetchOne<MyProfile>('/auth/profile'),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useChatContacts(enabled = true) {
  return useQuery({
    queryKey: ['qual-chat', 'contacts'],
    queryFn: () => fetchList<ChatPerson>('/qualification-chat/contacts'),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConversations(enabled: boolean) {
  return useQuery({
    queryKey: ['qual-chat', 'conversations'],
    queryFn: () => fetchList<Conversation>('/qualification-chat/conversations'),
    enabled,
    refetchInterval: enabled ? 7000 : false,
    refetchOnWindowFocus: false,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: ['qual-chat', 'unread'],
    queryFn: async () =>
      (await apiClient.get<{ unreadCount: number }>('/qualification-chat/messages/unread-count')).data.unreadCount,
    enabled,
    refetchInterval: enabled ? 5000 : false,
    refetchOnWindowFocus: false,
  });
}

export function useThread(userId?: string) {
  return useQuery({
    queryKey: ['qual-chat', 'thread', userId],
    enabled: !!userId,
    queryFn: async () =>
      (
        await apiClient.get<ThreadPage>(`/qualification-chat/messages/${userId}`, {
          params: { page: 1, limit: 50 },
        })
      ).data,
    refetchInterval: userId ? 4000 : false,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { receiver: string; message: string }) =>
      postJson('/qualification-chat/messages', v),
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ['qual-chat', 'thread', v.receiver] });
      qc.invalidateQueries({ queryKey: ['qual-chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['qual-chat', 'unread'] });
    },
  });
}

export function useChatRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const restSend = useSendMessage();
  const socketRef = useRef<Socket | null>(null);
  const myId = useSessionStore((s) => s.user?.id);

  useEffect(() => {
    if (!enabled) return;
    const socket = getChatSocket();
    socketRef.current = socket;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['qual-chat', 'thread'] });
      qc.invalidateQueries({ queryKey: ['qual-chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['qual-chat', 'unread'] });
    };
    socket.on('receiveMessage', refresh);
    socket.on('messageSent', refresh);
    socket.on('messagesRead', refresh);
    return () => {
      socket.off('receiveMessage', refresh);
      socket.off('messageSent', refresh);
      socket.off('messagesRead', refresh);
    };
  }, [enabled, qc]);

  const send = (receiverId: string, message: string) => {
    restSend.mutate({ receiver: receiverId, message });

    const nowIso = new Date().toISOString();
    qc.setQueryData<ThreadPage>(['qual-chat', 'thread', receiverId], (old) =>
      old
        ? {
            ...old,
            docs: [
              {
                _id: `temp-${nowIso}`,
                sender: { _id: myId ?? '' },
                receiver: { _id: receiverId },
                message,
                createdAt: nowIso,
                readAt: null,
              },
              ...old.docs,
            ],
          }
        : old,
    );
    qc.setQueryData<Conversation[]>(['qual-chat', 'conversations'], (old) => {
      if (!old) return old;
      const idx = old.findIndex((c) => String(c.user._id) === String(receiverId));
      const base = idx >= 0 ? old[idx] : undefined;
      if (!base) return old;
      const updated: Conversation = {
        ...base,
        lastMessage: { message, createdAt: nowIso, sender: myId ?? '', readAt: null },
      };
      return [updated, ...old.slice(0, idx), ...old.slice(idx + 1)];
    });
  };

  const markRead = useCallback(
    (senderId: string) => {
      const convs = qc.getQueryData<Conversation[]>(['qual-chat', 'conversations']);
      const prevUnread =
        convs?.find((c) => String(c.user._id) === String(senderId))?.unreadCount ?? 0;
      if (prevUnread > 0) {
        qc.setQueryData<Conversation[]>(['qual-chat', 'conversations'], (old) =>
          (old ?? []).map((c) =>
            String(c.user._id) === String(senderId) ? { ...c, unreadCount: 0 } : c,
          ),
        );
        qc.setQueryData<number>(['qual-chat', 'unread'], (old) =>
          Math.max(0, (old ?? 0) - prevUnread),
        );
      }
    },
    [qc],
  );

  return { send, markRead, isSending: restSend.isPending };
}

export function useOnlineUsers(enabled: boolean): Set<string> {
  const [online, setOnline] = useState<Set<string>>(() => new Set(getLastOnlineIds()));
  useEffect(() => {
    if (!enabled) return;
    const socket = getChatSocket();
    const handler = (ids: string[]) => setOnline(new Set((ids ?? []).map(String)));
    setOnline(new Set(getLastOnlineIds()));
    socket.on('onlineUsers', handler);
    return () => {
      socket.off('onlineUsers', handler);
    };
  }, [enabled]);
  return online;
}

export interface TeacherProfile {
  firstName?: string;
  lastName?: string;
  photo?: string | null;
  workingSchedule: WorkSlot[];
}

export function useTeacherProfile(enabled: boolean) {
  return useQuery({
    queryKey: ['qual-chat', 'profile'],
    queryFn: () => fetchOne<TeacherProfile>('/qualification-chat/profile'),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTeacherProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workingSchedule: WorkSlot[]) =>
      putJson('/qualification-chat/profile', { workingSchedule }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qual-chat', 'profile'] }),
  });
}
