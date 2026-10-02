import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatSocket } from './chat-socket';
import { mapChatMessage, type BackendChatMessage } from '../api/mapper';
import { getApiErrorMessage } from '@/shared/api';
import { fetchChatPage, sendChatMessageRest } from '../api/gifted-api';
import type { Message } from '../data/types';

const PAGE_SIZE = 30;

const adapt = (raw: unknown): Message | null => {
  const doc = raw as BackendChatMessage | undefined;
  if (!doc?._id) return null;
  return mapChatMessage(doc);
};

export interface RealtimeChat {
  messages: Message[];
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

export function useRealtimeChat(peerUserId: string | undefined, myId: string | undefined): RealtimeChat {
  const [messages, setMessages] = useState<Message[]>([]);
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
        const page = await fetchChatPage(peerUserId, 1, PAGE_SIZE);
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
  }, [peerUserId]);

  useEffect(() => {
    if (!peerUserId) return undefined;
    const socket = getChatSocket();

    const push = (raw: unknown) => {
      const msg = adapt(raw);
      if (!msg) return;
      const belongs = msg.senderId === peerUserId || (myId != null && msg.senderId === myId);
      if (!belongs) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setLastIsMine(myId != null && msg.senderId === myId);
      setArrivalTick((t) => t + 1);
    };

    socket.on('receiveMessage', push);
    socket.on('messageSent', push);
    return () => {
      socket.off('receiveMessage', push);
      socket.off('messageSent', push);
    };
  }, [peerUserId, myId]);

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
    setError(null);
    try {
      const next = pageRef.current + 1;
      const page = await fetchChatPage(peerUserId, next, PAGE_SIZE);
      pageRef.current = next;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const older = page.messages.filter((m) => !seen.has(m.id));
        return [...older, ...prev];
      });
      setHasMore(page.hasMore);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Eski xabarlarni yuklab bo‘lmadi'));
    } finally {
      loadingRef.current = false;
      setLoadingOlder(false);
    }
  }, [peerUserId, hasMore]);

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
          const saved = await sendChatMessageRest(peerUserId, body);
          if (saved) {
            setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
            setLastIsMine(true);
            setArrivalTick((t) => t + 1);
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
    [peerUserId],
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
