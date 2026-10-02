import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_CATEGORIES } from './model/achievement-config';

describe("Himoya formasi — Fan tarmog'i", () => {
  const defense = ACHIEVEMENT_CATEGORIES.find((c) => c.key === 'defense');

  it('Himoya kategoriyasi mavjud', () => {
    expect(defense).toBeDefined();
  });

  it("Fan tarmog'i — ma'lumotnoma dropdown'i (erkin matn emas)", () => {
    const field = defense?.fields.find((f) => f.name === 'scienceBranch');
    expect(field?.kind).toBe('ref');
    expect(field?.refSource).toBe('scienceBranches');
  });
});

describe("Ixtisoslik — yagona ro'yxat (Uslubiy tavsiyanomalar ixtisosliklari)", () => {
  const withSpecialty = ['degrees', 'titles', 'defense'];

  it('uchala formada ham dropdown (erkin matn emas)', () => {
    withSpecialty.forEach((key) => {
      const cat = ACHIEVEMENT_CATEGORIES.find((c) => c.key === key);
      const field = cat?.fields.find((f) => f.name === 'specialty');
      expect({ key, kind: field?.kind, src: field?.refSource }).toEqual({
        key,
        kind: 'ref',
        src: 'specialties',
      });
    });
  });

  it("manba — /methodical-specialties, faqat FAOL yozuvlar", async () => {
    const src = (await import('./api/reference-api.ts?raw')).default as string;
    const hook = src.slice(src.indexOf('export function useSpecialties'));

    expect(hook).toContain("'/methodical-specialties'");
    expect(hook).toContain('active: true');
    expect(hook).not.toContain("'/exam-specialties'");
  });

  it("saqlanadigan qiymat — NOMI (eski yozuvlar manba almashsa ham ochiladi)", async () => {
    const src = (await import('./api/reference-api.ts?raw')).default as string;
    const hook = src.slice(src.indexOf('export function useSpecialties'));
    expect(hook).toContain('value: String(d.name)');
  });
});
