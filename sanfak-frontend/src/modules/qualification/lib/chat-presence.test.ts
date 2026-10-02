import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./chat-socket.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const src = Object.values(sources)[0] ?? '';

describe('chat-socket — onlayn ro`yxatni so`rab olish', () => {
  it('fayl topildi (bekorga o`tmasin)', () => {
    expect(src).toContain('getLastOnlineIds');
  });

  it('`getOnlineUsers` so`rovi yuboriladi', () => {
    expect(src).toContain("emit('getOnlineUsers')");
  });

  it('har (qayta)ulanishda so`raladi — `connect` ga bog`langan', () => {
    expect(src).toMatch(/socket\.on\('connect',\s*pullOnline\)/);
  });

  it('socket ALLAQACHON ulangan bo`lsa ham darhol so`raladi', () => {
    expect(src).toMatch(/if \(socket\.connected\) pullOnline\(\)/);
  });

  it('uzilganda ro`yxat tozalanadi (eskirgan "online" ko`rsatmasin)', () => {
    expect(src).toMatch(/socket\.on\('disconnect',\s*\(\)\s*=>\s*\{\s*lastOnlineIds = \[\];/);
  });
});
