import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers: Record<string, Array<(p: unknown) => void>> = {};
const fakeSocket = {
  connected: true,
  emit: vi.fn(),
  on: vi.fn((ev: string, fn: (p: unknown) => void) => {
    (handlers[ev] ??= []).push(fn);
  }),
  off: vi.fn((ev: string, fn: (p: unknown) => void) => {
    handlers[ev] = (handlers[ev] ?? []).filter((h) => h !== fn);
  }),
};
const fire = (ev: string, payload: unknown) => (handlers[ev] ?? []).forEach((h) => h(payload));

vi.mock('./chat-socket', () => ({ getChatSocket: () => fakeSocket }));

const fetchChatPage = vi.fn();
const sendChatMessageRest = vi.fn();
vi.mock('../api/chat-api', () => ({
  fetchChatPage: (...a: unknown[]) => fetchChatPage(...a),
  sendChatMessageRest: (...a: unknown[]) => sendChatMessageRest(...a),
  mapMessage: (b: Record<string, unknown>, myId: string) => ({
    id: b._id as string,
    senderId: b.sender as string,
    senderName: null,
    receiverId: b.receiver as string,
    message: b.message as string,
    fileUrl: null,
    fileType: null,
    readAt: null,
    createdAt: null,
    mine: b.sender === myId,
  }),
}));

const { useRealtimeChat } = await import('./use-realtime-chat');

const PEER = 'peer-1';
const ME = 'me-1';
const doc = (id: string, sender: string, receiver: string, text = 'x') => ({
  _id: id,
  sender,
  receiver,
  message: text,
});

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    children,
  );

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  fakeSocket.connected = true;
  fakeSocket.emit.mockClear();
  fetchChatPage.mockReset().mockResolvedValue({ messages: [], hasMore: false });
  sendChatMessageRest.mockReset();
});

describe('4.5 useRealtimeChat — qabul qilish', () => {
  it('ochiq suhbat xabarini qo‘shadi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME), { wrapper });
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('receiveMessage', doc('m1', PEER, ME, 'salom')));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]?.message).toBe('salom');
    expect(result.current.lastIsMine).toBe(false);
  });

  it('BOSHQA suhbat xabarini o‘tkazmaydi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME), { wrapper });
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('receiveMessage', doc('m9', 'boshqa-talaba', ME)));
    expect(result.current.messages).toHaveLength(0);
  });

  it('de-dup: bir xil xabar ikki marta qo‘shilmaydi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME), { wrapper });
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('messageSent', doc('m1', ME, PEER)));
    act(() => fire('receiveMessage', doc('m1', ME, PEER)));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.lastIsMine).toBe(true);
  });
});

describe('4.5 useRealtimeChat — yuborish', () => {
  it('socket ULANGAN bo‘lsa `sendMessage` emit qiladi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME), { wrapper });
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    await act(async () => {
      await result.current.send('salom');
    });
    expect(fakeSocket.emit).toHaveBeenCalledWith('sendMessage', { receiverId: PEER, message: 'salom' });
    expect(sendChatMessageRest).not.toHaveBeenCalled();
  });

  it('socket UZILGAN bo‘lsa REST zaxirasiga tushadi', async () => {
    fakeSocket.connected = false;
    sendChatMessageRest.mockResolvedValue({ id: 'r1', message: 'oflayn', mine: true });
    const { result } = renderHook(() => useRealtimeChat(PEER, ME), { wrapper });
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    await act(async () => {
      await result.current.send('oflayn');
    });
    expect(sendChatMessageRest).toHaveBeenCalledWith(PEER, 'oflayn', ME);
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
  });
});

describe('4.5 useRealtimeChat — presence va sahifalash', () => {
  it('presence `onlineUsers` dan keladi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME), { wrapper });
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('onlineUsers', [PEER]));
    await waitFor(() => expect(result.current.peerOnline).toBe(true));
  });

  it('eski sahifa BOSHIGA qo‘shiladi', async () => {
    fetchChatPage
      .mockResolvedValueOnce({ messages: [{ id: 'new', message: 'yangi', mine: false }], hasMore: true })
      .mockResolvedValueOnce({
        messages: [
          { id: 'old', message: 'eski', mine: false },
          { id: 'new', message: 'yangi', mine: false },
        ],
        hasMore: false,
      });
    const { result } = renderHook(() => useRealtimeChat(PEER, ME), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.loadOlder();
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['old', 'new']);
  });
});
