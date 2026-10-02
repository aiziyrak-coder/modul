import { describe, expect, it } from 'vitest';
import { roleFromName, roleFromPermissions } from './role';

const checker = (granted: string[]) => {
  const has = (p: string) =>
    granted.some((g) => g === '*' || g === p || (g.endsWith(':*') && p.startsWith(g.slice(0, -1))));
  return Object.assign(has, { any: (ps: string[]) => ps.some(has) });
};

describe('roleFromName — kanonik nomlar', () => {
  it('4 ta aniq nomni o\'zgarishsiz qaytaradi', () => {
    expect(roleFromName('ilmiy_kengash_kotibi')).toBe('ilmiy_kengash_kotibi');
    expect(roleFromName('ilmiy_kengash_azosi')).toBe('ilmiy_kengash_azosi');
    expect(roleFromName('oqituvchi')).toBe('oqituvchi');
    expect(roleFromName('rektor')).toBe('rektor');
  });
});

describe('roleFromName — admin panelida yaratilgan nomlar (test4 regressiyasi)', () => {
  it('`kengash_oqituvchi` → oqituvchi (ilgari kotib bo\'lib ketardi)', () => {
    expect(roleFromName('kengash_oqituvchi')).toBe('oqituvchi');
  });

  it('apostrof variantlari ham tanildi', () => {
    for (const n of ["kengash_o'qituvchi", 'kengash_oʻqituvchi', 'kengash_o‘qituvchi']) {
      expect(roleFromName(n)).toBe('oqituvchi');
    }
    expect(roleFromName("kengash_a'zosi")).toBe('ilmiy_kengash_azosi');
  });

  it('registrga bog\'liq emas', () => {
    expect(roleFromName('KENGASH_OQITUVCHI')).toBe('oqituvchi');
    expect(roleFromName('Kengash_Kotibi')).toBe('ilmiy_kengash_kotibi');
  });

  it('kotib tekshiruvi birinchi — `kengash` so\'zi chalg\'itmaydi', () => {
    expect(roleFromName('kengash_kotibi')).toBe('ilmiy_kengash_kotibi');
    expect(roleFromName('kengash_rektori')).toBe('rektor');
  });

  it('notanish nom uchun null — chaqiruvchi ruxsatlarga o\'tadi', () => {
    expect(roleFromName('super_admin')).toBeNull();
    expect(roleFromName('kadrlar')).toBeNull();
    expect(roleFromName('')).toBeNull();
  });
});

describe('roleFromPermissions — nom notanish bo\'lganda', () => {
  it('super_admin (`*`) kotib bo\'lib qoladi — eski xulq buzilmaydi', () => {
    expect(roleFromPermissions(checker(['*']))).toBe('ilmiy_kengash_kotibi');
  });

  it('ariza tasdiqlash yoki a\'zo qo\'shish huquqi → kotib', () => {
    expect(roleFromPermissions(checker(['rankApplication:approve']))).toBe('ilmiy_kengash_kotibi');
    expect(roleFromPermissions(checker(['councilMember:create']))).toBe('ilmiy_kengash_kotibi');
  });

  it('faqat ariza yaratish huquqi → o\'qituvchi', () => {
    expect(roleFromPermissions(checker(['rankApplication:create', 'rankApplication:read']))).toBe(
      'oqituvchi',
    );
  });

  it('ovoz berish huquqi → kengash a\'zosi', () => {
    expect(roleFromPermissions(checker(['anonymousVote:create', 'councilTask:read']))).toBe(
      'ilmiy_kengash_azosi',
    );
  });

  it('faqat eksport huquqi → rektor', () => {
    expect(roleFromPermissions(checker(['votingSession:export', 'councilTask:readAll']))).toBe(
      'rektor',
    );
  });

  it('hech qanday belgi yo\'q → kotib (xavfsiz zaxira)', () => {
    expect(roleFromPermissions(checker([]))).toBe('ilmiy_kengash_kotibi');
  });
});
