import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./use-auth.ts', { query: '?raw', import: 'default', eager: true });
const src = sources['./use-auth.ts'] as string;

describe('D-49 — app-shell ism tartibi', () => {
  it('kanonik tartib: familiya → ism → sharif', () => {
    expect(src).toContain(
      "fullName: [profile.lastName, profile.firstName, profile.middleName]",
    );
  });

  it('🔴 eski tartib QAYTIB KELMAGAN', () => {
    expect(src).not.toContain('[profile.firstName, profile.lastName]');
  });

  it('sharif yetishmasa ism buzilmaydi (`filter(Boolean)`)', () => {
    const line = src.slice(src.indexOf('fullName: [profile.lastName'));
    expect(line.slice(0, 200)).toContain('.filter(Boolean)');
  });
});
