import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getChatSocket } from './chat-socket';
import { getApiErrorMessage } from '@/shared/api';
import { fetchChatPage, mapMessage, sendChatMessageRest, type BackendMessage } from '../api/chat-api';
import type { ChatMessage } from '../api/chat-types';

const PAGE_SIZE = 30;

export interface RealtimeChat {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  loadOlder: () => Promise<void>;
  hasMore: boolean;
  loadingOlder: boolean;
  anchorRef: React.MutableRefObject<number | null>;
  send: (text: string) => Promise<void>;
  sending: boolean;
  peerOnline: boolean;
  arrivalTick: number;
  lastIsMine: boolean;
}

export function useRealtimeChat(peerUserId: string | undefined, myId: string): RealtimeChat {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [arrivalTick, setArrivalTick] = useState(0);
  const [lastIsMine, setLastIsMine] = useState(false);

  const pageRef = useRef(1);
  const anchorRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    pageRef.current = 1;
    setMessages([]);
    setHasMore(false);
    setError(null);
    if (!peerUserId) return undefined;
    setLoading(true);
    void (async () => {
      try {
        const page = await fetchChatPage(peerUserId, myId, 1, PAGE_SIZE);
        if (!alive) return;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setArrivalTick((t) => t + 1);
        setLastIsMine(false);
      } catch (e) {
        if (alive) setError(getApiErrorMessage(e, 'Yozishmani yuklab bo‘lmadi'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [peerUserId, myId]);

  useEffect(() => {
    const socket = getChatSocket();

    const push = (raw: unknown) => {
      const doc = raw as BackendMessage | undefined;
      if (!doc?._id) return;
      const msg = mapMessage(doc, myId);
      void qc.invalidateQueries({ queryKey: ['residency-chat', 'conversations'] });

      const other = msg.mine ? msg.receiverId : msg.senderId;
      if (!peerUserId || String(other ?? '') !== String(peerUserId)) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setLastIsMine(msg.mine);
      setArrivalTick((t) => t + 1);
    };

    socket.on('receiveMessage', push);
    socket.on('messageSent', push);
    return () => {
      socket.off('receiveMessage', push);
      socket.off('messageSent', push);
    };
  }, [peerUserId, myId, qc]);

  useEffect(() => {
    if (!peerUserId) return undefined;
    const socket = getChatSocket();
    const onOnline = (ids: unknown) => {
      const list = Array.isArray(ids) ? ids.map(String) : [];
      setPeerOnline(list.includes(String(peerUserId)));
    };
    socket.on('onlineUsers', onOnline);
    socket.emit('getOnlineUsers');
    return () => {
      socket.off('onlineUsers', onOnline);
    };
  }, [peerUserId]);

  const loadOlder = useCallback(async () => {
    if (!peerUserId || loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingOlder(true);
    try {
      const next = pageRef.current + 1;
      const page = await fetchChatPage(peerUserId, myId, next, PAGE_SIZE);
      pageRef.current = next;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...page.messages.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMore(page.hasMore);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Eski xabarlarni yuklab bo‘lmadi'));
    } finally {
      loadingRef.current = false;
      setLoadingOlder(false);
    }
  }, [peerUserId, myId, hasMore]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !peerUserId || sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      setError(null);
      try {
        const socket = getChatSocket();
        if (socket.connected) {
          socket.emit('sendMessage', { receiverId: peerUserId, message: body });
        } else {
          const saved = await sendChatMessageRest(peerUserId, body, myId);
          if (saved) {
            setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
            setLastIsMine(true);
            setArrivalTick((t) => t + 1);
            void qc.invalidateQueries({ queryKey: ['residency-chat', 'conversations'] });
          }
        }
      } catch (e) {
        setError(getApiErrorMessage(e, 'Xabar yuborilmadi'));
        throw e;
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [peerUserId, myId, qc],
  );

  return {
    messages,
    loading,
    error,
    loadOlder,
    hasMore,
    loadingOlder,
    anchorRef,
    send,
    sending,
    peerOnline,
    arrivalTick,
    lastIsMine,
  };
}
