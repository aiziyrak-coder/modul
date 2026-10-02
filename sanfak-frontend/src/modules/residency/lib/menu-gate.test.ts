import { describe, it, expect } from 'vitest';
import { applyExtraGates, EXTRA_MENU_GATES } from './menu-gate';

const CHAT = { path: '/residency/chat' };
const OTHER = { path: '/residency/kontingent' };
const ITEMS = [OTHER, CHAT, { path: '/residency/hisobotlar' }];

const paths = (granted: string[]) => applyExtraGates(ITEMS, granted).map((i) => i.path);

describe('applyExtraGates — «Chat» bandi (MD-29)', () => {
  it('`chat:readAll` YO\'Q -> band olib tashlanadi', () => {
    expect(paths(['resident:readAll', 'residencyReport:readAll'])).not.toContain(
      '/residency/chat',
    );
  });

  it('`chat:readAll` BOR -> band qoladi', () => {
    expect(paths(['resident:read', 'chat:readAll'])).toContain('/residency/chat');
  });

  it('`*` (super_admin) -> band qoladi', () => {
    expect(paths(['*'])).toContain('/residency/chat');
  });

  it('ruxsat umuman yo\'q -> band yo\'q', () => {
    expect(paths([])).not.toContain('/residency/chat');
  });
});

describe('applyExtraGates — qolgan bandlarga TEGMAYDI', () => {
  it('ro\'yxatda bo\'lmagan yo\'llar o\'zgarishsiz o\'tadi', () => {
    expect(paths([])).toEqual(['/residency/kontingent', '/residency/hisobotlar']);
  });

  it('tartib saqlanadi', () => {
    expect(paths(['chat:readAll'])).toEqual([
      '/residency/kontingent',
      '/residency/chat',
      '/residency/hisobotlar',
    ]);
  });

  it('bo\'sh ro\'yxat — bo\'sh natija', () => {
    expect(applyExtraGates([], ['*'])).toEqual([]);
  });
});

describe('EXTRA_MENU_GATES — jadval', () => {
  it('faqat «Chat» yo\'li qo\'shimcha shartga ega', () => {
    expect(Object.keys(EXTRA_MENU_GATES)).toEqual(['/residency/chat']);
  });

  it('talab qilinadigan kalit route bilan BIR XIL', () => {
    expect(EXTRA_MENU_GATES['/residency/chat']).toEqual(['chat:readAll']);
  });
});
