import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { useSessionStore } from '@/app/session';
import { apiClient, fetchList } from '@/shared/api';
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

export const personName = (p?: ChatPerson): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ').trim() || '—' : '—';

export function useChatContacts() {
  return useQuery({
    queryKey: ['chat-contacts'],
    queryFn: () => fetchList<ChatPerson>('/qualification-chat/contacts'),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useConversations(enabled: boolean) {
  return useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => fetchList<Conversation>('/qualification-chat/conversations'),
    enabled,
    refetchInterval: enabled ? 7000 : false,
    refetchOnWindowFocus: false,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['chat-unread'],
    queryFn: async () =>
      (await apiClient.get<{ unreadCount: number }>('/chat/unread-count')).data
        .unreadCount,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
  });
}

export interface ThreadPage {
  docs: ChatMessage[];
}

export function useThread(userId?: string) {
  return useQuery({
    queryKey: ['chat-thread', userId],
    enabled: !!userId,
    queryFn: async () =>
      (
        await apiClient.get<ThreadPage>(`/chat/${userId}`, {
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
      apiClient.post('/chat/send', v, { timeout: 15000 }),
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ['chat-thread', v.receiver] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-unread'] });
    },
  });
}

export function useChatRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const restSend = useSendMessage();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const myId = useSessionStore((s) => s.user?.id);

  useEffect(() => {
    if (!enabled) return;
    const socket = getChatSocket();
    socketRef.current = socket;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['chat-thread'] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-unread'] });
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    setConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receiveMessage', refresh);
    socket.on('messageSent', refresh);
    socket.on('messagesRead', refresh);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receiveMessage', refresh);
      socket.off('messageSent', refresh);
      socket.off('messagesRead', refresh);
    };
  }, [enabled, qc]);

  const send = (receiverId: string, message: string) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit('sendMessage', { receiverId, message });
    } else {
      restSend.mutate({ receiver: receiverId, message });
    }

    const nowIso = new Date().toISOString();

    qc.setQueryData<ThreadPage>(['chat-thread', receiverId], (old) =>
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

    qc.setQueryData<Conversation[]>(['chat-conversations'], (old) => {
      if (!old) return old;
      const idx = old.findIndex((c) => String(c.user._id) === String(receiverId));
      if (idx < 0) return old;
      const updated: Conversation = {
        ...old[idx],
        lastMessage: { message, createdAt: nowIso, sender: myId ?? '', readAt: null },
      };
      return [updated, ...old.slice(0, idx), ...old.slice(idx + 1)];
    });
  };

  const markRead = useCallback(
    (senderId: string) => {
      const socket = socketRef.current;
      if (socket && socket.connected) socket.emit('markAsRead', { senderId });

      const convs = qc.getQueryData<Conversation[]>(['chat-conversations']);
      const prevUnread =
        convs?.find((c) => String(c.user._id) === String(senderId))?.unreadCount ?? 0;
      if (prevUnread > 0) {
        qc.setQueryData<Conversation[]>(['chat-conversations'], (old) =>
          (old ?? []).map((c) =>
            String(c.user._id) === String(senderId) ? { ...c, unreadCount: 0 } : c,
          ),
        );
        qc.setQueryData<number>(['chat-unread'], (old) =>
          Math.max(0, (old ?? 0) - prevUnread),
        );
      }
    },
    [qc],
  );

  return { send, markRead, isSending: connected ? false : restSend.isPending };
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
