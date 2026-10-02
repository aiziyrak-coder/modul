import { describe, expect, it } from 'vitest';
import catalogJson from '@/app/modules/backend-permission-catalog.json';
import {
  ACCENT,
  MODULE_CARDS,
  SITE_CARD,
  STAT_PERMISSIONS,
  chartsPermission,
  statPermission,
} from './registry';

describe('dashboard registry', () => {
  it('aksent ranglar dataviz validatoridan o\'tgan to\'plamdan chetga chiqmaydi', () => {
    expect(Object.values(ACCENT).map((a) => a.solid)).toEqual([
      '#34c18c',
      '#4a82c8',
      '#d6409f',
      '#e8833a',
    ]);
  });

  it('har bir kartada permission kaliti bor — filtrsiz karta chizilmasligi kerak', () => {
    for (const c of MODULE_CARDS) {
      expect(c.permission, `${c.key} permissionsiz`).toMatch(/^[a-zA-Z]+:[a-zA-Z]+$/);
    }
  });

  it('permission kaliti camelCase, segmentda "_" yo\'q', () => {
    for (const c of MODULE_CARDS) {
      expect(c.permission, `${c.key} kalitida "_" bor`).not.toContain('_');
    }
  });

  it('kalit va ichki manzil takrorlanmaydi', () => {
    const keys = MODULE_CARDS.map((c) => c.key);
    const paths = MODULE_CARDS.map((c) => c.path);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('har bir ichki manzil "/" bilan boshlanadi', () => {
    for (const c of MODULE_CARDS) expect(c.path.startsWith('/')).toBe(true);
  });

  it('sayt kartasi tashqi https havola', () => {
    expect(SITE_CARD.url).toMatch(/^https:\/\//);
  });

  it("har bir kartada vakolat tavsifi bor (stats ixtiyoriy — faqat jonli tekshirilganlar)", () => {
    for (const c of MODULE_CARDS) {
      expect(c.role.length, `${c.key} vakolatsiz`).toBeGreaterThan(0);
      expect(Array.isArray(c.stats)).toBe(true);
    }
  });

  it("kartalar ro'yxati — 12 modul (admin, dashboard, notifications kartaga chiqmaydi)", () => {
    expect(MODULE_CARDS.map((c) => c.key).sort()).toEqual(
      [
        'council', 'education-quality', 'foreign-admission',
        'gifted-students', 'practice', 'qualification', 'residency',
        'science-council', 'scientific-department', 'study-load',
        'task-management', 'teacher',
      ].sort(),
    );
  });
});

describe('dashboard registry — P-16 statistika vakolatlari', () => {
  const catalog = catalogJson as { modules: string[]; actions: string[] };

  it("har karta statistikasi (va grafik) uchun endpoint xaritada bor", () => {
    for (const c of MODULE_CARDS) {
      for (const s of c.stats) {
        expect(STAT_PERMISSIONS[s.url], `${c.key}: ${s.url} xaritada yo'q`).toBeDefined();
      }
      if (c.charts) {
        expect(c.stats.length, `${c.key}: charts bor, stats yo'q`).toBeGreaterThan(0);
      }
    }
  });

  it('xaritadagi har kalit backend katalogida mavjud (section:action)', () => {
    for (const [url, key] of Object.entries(STAT_PERMISSIONS)) {
      const [section, action] = key.split(':');
      expect(catalog.modules, `${url} → ${key}: section katalogda yo'q`).toContain(section);
      expect(catalog.actions, `${url} → ${key}: action katalogda yo'q`).toContain(action);
    }
  });

  it("statPermission — xaritada bo'lmasa karta kaliti", () => {
    expect(statPermission('/quality-statistics/overview', 'eqIndicator:read')).toBe(
      'indicatorSubmission:readAll',
    );
    expect(statPermission('/nomalum', 'x:read')).toBe('x:read');
  });

  it("chartsPermission — karta statistikasining birinchi endpointi bo'yicha", () => {
    const quality = MODULE_CARDS.find((c) => c.charts === 'quality');
    expect(quality && chartsPermission(quality)).toBe('indicatorSubmission:readAll');
  });
});
