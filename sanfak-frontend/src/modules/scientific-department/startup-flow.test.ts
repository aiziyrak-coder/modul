import { describe, expect, it } from 'vitest';
import manifest from './scientific-department.module';
import { STARTUP_FILE_SLOTS } from './model/types';

const sources = import.meta.glob('./{pages,api}/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const read = (fragment: string) => {
  const entry = Object.entries(sources).find(([p]) => p.includes(fragment));
  expect(entry, `${fragment} topilmadi`).toBeDefined();
  return entry![1];
};

type Route = { path?: string; permission?: string };
type MenuItem = { path?: string; parent?: string; permission?: string; titleKey?: string };

describe('Startaplar — route va menyu', () => {
  const routes = (manifest.routes ?? []) as Route[];
  const menu = (manifest.menu ?? []) as MenuItem[];

  it('ikkala sahifa ham ro`yxatdan o`tgan', () => {
    expect(routes.find((r) => r.path === 'startups')?.permission).toBe('startup:read');
    expect(routes.find((r) => r.path === 'startup-types')?.permission).toBe('startupType:create');
  });

  it('detal sahifa ro`yxat yo`li OSTIDA (`startups/:id`)', () => {
    expect(routes.find((r) => r.path === 'startups/:id')?.permission).toBe('startup:read');
  });

  it('sidebar: guruh + ikkita bola (Monografiyalar naqshi)', () => {
    const group = menu.find((m) => m.path === '/scientific-department/startups-group');
    expect(group, 'guruh bandi yo`q').toBeDefined();
    expect(group?.permission).toBe('startupType:create');

    const children = menu.filter((m) => m.parent === '/scientific-department/startups-group');
    expect(children.map((c) => c.path)).toEqual([
      '/scientific-department/startups',
      '/scientific-department/startup-types',
    ]);
    expect(children[1]?.permission).toBe('startupType:create');
  });

  it('permission kalitlari e`lon qilingan, approve/reject YO`Q', () => {
    const keys = (manifest.permissions ?? []).map((p) => (p as { key: string }).key);
    ['startup:create', 'startup:read', 'startup:readAll', 'startup:update', 'startup:delete'].forEach(
      (k) => expect(keys).toContain(k),
    );
    expect(keys).toContain('startupType:create');
    expect(keys).toContain('startupType:readAll');
    expect(keys).toContain('startup:export');
    expect(keys).not.toContain('startup:approve');
    expect(keys).not.toContain('startup:reject');
  });
});

describe('Startaplar — forma va API', () => {
  it('F.I.Sh. formada so`ralmaydi (yuklovchidan olinadi)', () => {
    const src = read('/pages/startups/index.tsx');
    expect(src).toContain('name="title"');
    expect(src).not.toContain('name="fio"');
    expect(src).not.toContain('name="authorName"');
  });

  it('tasdiqlash oqimi yo`q — approve/reject hook`lari ham yo`q', () => {
    const api = read('/api/startup-api.ts');
    expect(api).toContain('useCreateStartup');
    expect(api).not.toContain('useApprove');
    expect(api).not.toContain('useReject');
    expect(read('/pages/startups/index.tsx')).not.toContain('StatusBadge');
  });

  it('fayllar slot tartibida `files[]` + `fileSlots` bilan yuboriladi', () => {
    const api = read('/api/startup-api.ts');
    expect(api).toContain('fileSlots: entries.length ? JSON.stringify');
  });

  it('qatorni bosish detal sahifaga olib boradi', () => {
    const src = read('/pages/startups/index.tsx');
    expect(src).toMatch(/onRowClick=\{\(row\) => navigate\(`\/scientific-department\/startups\/\$\{row\.id\}`\)\}/);
    expect(src).toContain('onClick={(e) => e.stopPropagation()}');
  });

  it('hujjatlarni ZIP qilib yuklash — arxivni BACKEND yig`adi', () => {
    const api = read('/api/startup-api.ts');
    expect(api).toContain('downloadStartupArchive');
    expect(api).toContain("/archive`, { responseType: 'blob' }");
    const detail = read('/pages/startup-detail/index.tsx');
    expect(detail).toContain('startups.downloadZip');
    expect(detail).toContain('downloadStartupArchive');
  });

  it('Excel eksport `startup:export` bilan gate qilingan va FILTRGA mos', () => {
    const src = read('/pages/startups/index.tsx');
    expect(src).toContain("can('startup:export')");
    expect(src).toMatch(/fetchStartupsForExport\(\{ search, type: typeFilter \}\)/);
    expect(read('/api/startup-api.ts')).toContain('fetchStartupsForExport');
  });
});

describe('Startap fayl slotlari', () => {
  it('TZ dagi to`rtta hujjat, backend tartibida', () => {
    expect(STARTUP_FILE_SLOTS.map((s) => s.slot)).toEqual([
      'passport',
      'application',
      'presentation',
      'certificate',
    ]);
  });

  it('taqdimot .ppt, sertifikat pdf yoki rasm qabul qiladi', () => {
    const bySlot = Object.fromEntries(STARTUP_FILE_SLOTS.map((s) => [s.slot, s]));
    expect(bySlot.presentation?.accept).toContain('.ppt');
    expect(bySlot.certificate?.accept).toContain('.pdf');
    expect(bySlot.certificate?.accept).toContain('.jpg');
  });

  it('har slot uchun uch tilda yorliq bor', () => {
    const i18n = manifest.i18n as Record<string, Record<string, string>> | undefined;
    for (const lang of ['uz', 'ru', 'en']) {
      STARTUP_FILE_SLOTS.forEach((s) => {
        expect(
          i18n?.[lang]?.[`scientificDepartment.${s.labelKey}`],
          `${lang}: ${s.labelKey} yo'q`,
        ).toBeDefined();
      });
    }
  });
});
