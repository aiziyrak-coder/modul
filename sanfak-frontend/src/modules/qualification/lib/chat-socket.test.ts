import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeSocket(connected = true) {
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  return {
    connected,
    emit: vi.fn(),
    on(event: string, fn: (...a: unknown[]) => void) {
      (handlers[event] ??= []).push(fn);
      return this;
    },
    off: vi.fn(),
    fire(event: string, ...args: unknown[]) {
      for (const fn of handlers[event] ?? []) fn(...args);
    },
  };
}

let current: ReturnType<typeof makeSocket> | null = null;

vi.mock('@/shared/lib/socket', () => ({
  getAppSocket: () => {
    if (!current) current = makeSocket();
    return current;
  },
  disconnectAppSocket: () => {
    if (current) {
      current.connected = false;
      current.fire('disconnect');
    }
    current = null;
  },
}));

const load = async () => {
  vi.resetModules();
  return import('./chat-socket');
};

beforeEach(() => {
  current = null;
});

describe('chat-socket — online ro`yxati holati (MD-52)', () => {
  it('`onlineUsers` hodisasi ro`yxatga yoziladi', async () => {
    const m = await load();
    m.getChatSocket();
    current!.fire('onlineUsers', ['a', 'b']);
    expect(m.getLastOnlineIds()).toEqual(['a', 'b']);
  });

  it('🔴 UZILGANDA ro`yxat TOZALANADI — logout yo`li aynan shu', async () => {
    const m = await load();
    m.getChatSocket();
    current!.fire('onlineUsers', ['eski-user']);
    expect(m.getLastOnlineIds()).toEqual(['eski-user']);

    const shared = await import('@/shared/lib/socket');
    shared.disconnectAppSocket();

    expect(m.getLastOnlineIds()).toEqual([]);
  });

  it('qayta kirilganda YANGI socket kuzatiladi va ro`yxat bo`sh boshlanadi', async () => {
    const m = await load();
    m.getChatSocket();
    current!.fire('onlineUsers', ['eski-user']);

    const shared = await import('@/shared/lib/socket');
    shared.disconnectAppSocket();
    m.getChatSocket();

    expect(m.getLastOnlineIds()).toEqual([]);
    current!.fire('onlineUsers', ['yangi-user']);
    expect(m.getLastOnlineIds()).toEqual(['yangi-user']);
  });

  it('ulangan socket uchun joriy ro`yxat SO`RALADI (pull)', async () => {
    const m = await load();
    m.getChatSocket();
    expect(current!.emit).toHaveBeenCalledWith('getOnlineUsers');
  });

  it('`disconnectChatSocket()` ham ishlaydi (eksport saqlanadi)', async () => {
    const m = await load();
    m.getChatSocket();
    current!.fire('onlineUsers', ['x']);
    m.disconnectChatSocket();
    expect(m.getLastOnlineIds()).toEqual([]);
  });
});
