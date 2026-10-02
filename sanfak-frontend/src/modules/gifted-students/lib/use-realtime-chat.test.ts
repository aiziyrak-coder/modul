import { act, renderHook, waitFor } from '@testing-library/react';
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
const fire = (ev: string, payload: unknown) => {
  (handlers[ev] ?? []).forEach((h) => h(payload));
};

vi.mock('./chat-socket', () => ({ getChatSocket: () => fakeSocket }));

const fetchChatPage = vi.fn();
const sendChatMessageRest = vi.fn();
vi.mock('../api/gifted-api', () => ({
  fetchChatPage: (...a: unknown[]) => fetchChatPage(...a),
  sendChatMessageRest: (...a: unknown[]) => sendChatMessageRest(...a),
}));

const { useRealtimeChat } = await import('./use-realtime-chat');

const PEER = '6a00000000000000000000p1';
const ME = '6a00000000000000000000m1';
const doc = (id: string, sender: string, text: string) => ({
  _id: id,
  sender,
  receiver: sender === ME ? PEER : ME,
  message: text,
  createdAt: '2026-08-31T10:00:00.000Z',
});

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  fakeSocket.connected = true;
  fakeSocket.emit.mockClear();
  fetchChatPage.mockReset().mockResolvedValue({ messages: [], hasMore: false });
  sendChatMessageRest.mockReset();
});

describe('useRealtimeChat — qabul qilish', () => {
  it('socketdan kelgan xabarni ro‘yxatga qo‘shadi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('receiveMessage', doc('m1', PEER, 'salom')));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]?.text).toBe('salom');
    expect(result.current.lastIsMine).toBe(false);
  });

  it('BIR XIL xabarni ikki marta qo‘shmaydi (de-dup)', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('messageSent', doc('m1', ME, 'mening xabarim')));
    act(() => fire('receiveMessage', doc('m1', ME, 'mening xabarim')));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
  });

  it('BEGONA suhbat xabarini o‘tkazmaydi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('receiveMessage', doc('m9', 'boshqa-talaba-id', 'begona')));
    expect(result.current.messages).toHaveLength(0);
  });

  it('o‘z xabarimda `lastIsMine` true bo‘ladi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('messageSent', doc('m2', ME, 'men')));
    await waitFor(() => expect(result.current.lastIsMine).toBe(true));
  });
});

describe('useRealtimeChat — yuborish', () => {
  it('socket ULANGAN bo‘lsa `sendMessage` emit qiladi (REST chaqirilmaydi)', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    await act(async () => {
      await result.current.send('salom');
    });
    expect(fakeSocket.emit).toHaveBeenCalledWith('sendMessage', {
      receiverId: PEER,
      message: 'salom',
    });
    expect(sendChatMessageRest).not.toHaveBeenCalled();
  });

  it('socket UZILGAN bo‘lsa REST zaxirasiga tushadi va xabar yo‘qolmaydi', async () => {
    fakeSocket.connected = false;
    sendChatMessageRest.mockResolvedValue({
      id: 'r1',
      senderId: ME,
      text: 'oflayn',
      timestamp: '2026-08-31T10:00:00.000Z',
      read: false,
      type: 'text',
    });
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    await act(async () => {
      await result.current.send('oflayn');
    });
    expect(sendChatMessageRest).toHaveBeenCalledWith(PEER, 'oflayn');
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
  });

  it('bo‘sh xabar yuborilmaydi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    await act(async () => {
      await result.current.send('   ');
    });
    expect(fakeSocket.emit).not.toHaveBeenCalledWith('sendMessage', expect.anything());
  });
});

describe('useRealtimeChat — onlayn holat va sahifalash', () => {
  it('`onlineUsers` ro‘yxatida hamsuhbat bo‘lsa onlayn deb belgilaydi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    act(() => fire('onlineUsers', [PEER, 'kimdir']));
    await waitFor(() => expect(result.current.peerOnline).toBe(true));

    act(() => fire('onlineUsers', ['kimdir']));
    await waitFor(() => expect(result.current.peerOnline).toBe(false));
  });

  it('eski sahifani BOSHIGA qo‘shadi va dublikat qilmaydi', async () => {
    fetchChatPage
      .mockResolvedValueOnce({
        messages: [{ id: 'new', senderId: PEER, text: 'yangi', timestamp: '', read: false, type: 'text' }],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        messages: [
          { id: 'old', senderId: PEER, text: 'eski', timestamp: '', read: false, type: 'text' },
          { id: 'new', senderId: PEER, text: 'yangi', timestamp: '', read: false, type: 'text' },
        ],
        hasMore: false,
      });
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.loadOlder();
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['old', 'new']);
    expect(result.current.hasMore).toBe(false);
  });

  it('`hasMore` false bo‘lsa eski sahifa so‘ralmaydi', async () => {
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.loadOlder();
    });
    expect(fetchChatPage).toHaveBeenCalledTimes(1);
  });
});

describe('useRealtimeChat — xato holati va qorovul', () => {
  it('tarix yuklanmasa XATO beradi (jim bo‘sh chat EMAS)', async () => {
    fetchChatPage.mockRejectedValueOnce(new Error('tarmoq'));
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });

  it('yuborish yiqilsa XATO qo‘yadi va xatoni QAYTA TASHLAYDI (draft saqlanishi uchun)', async () => {
    fakeSocket.connected = false;
    sendChatMessageRest.mockRejectedValueOnce(new Error('403'));
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    let threw = false;
    await act(async () => {
      await result.current.send('yiqiladi').catch(() => {
        threw = true;
      });
    });
    expect(threw).toBe(true);
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it('SINXRON qorovul: yuborish TUGAMASDAN ikkinchisi o‘tmaydi', async () => {
    fakeSocket.connected = false;
    let resolveSend: (v: unknown) => void = () => {};
    sendChatMessageRest.mockImplementation(
      () => new Promise((res) => {
        resolveSend = res;
      }),
    );
    const { result } = renderHook(() => useRealtimeChat(PEER, ME));
    await waitFor(() => expect(fetchChatPage).toHaveBeenCalled());

    await act(async () => {
      const first = result.current.send('bir');
      await result.current.send('ikki');
      resolveSend(null);
      await first;
    });
    expect(sendChatMessageRest).toHaveBeenCalledTimes(1);
  });
});
