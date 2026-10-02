import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const manifest = Object.entries(sources).find(([p]) =>
  p.includes('foreign-admission.module.tsx'),
);

const stripComments = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const s = l.trim();
      return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*') && !s.startsWith('{/*');
    })
    .join('\n');

describe('4.8 modul qamrovi', () => {
  it('manifest topildi (bekorga o`tmasin)', () => {
    expect(manifest).toBeDefined();
    expect(manifest![1]).toContain('defineModule');
  });

  it('`public: true` route YO`Q (abituriyent alohida site`da)', () => {
    expect(stripComments(manifest![1])).not.toContain('public: true');
  });

  it('ariza topshirish / holat tekshirish sahifalari o`chirilgan', () => {
    const paths = Object.keys(sources);
    expect(paths.some((p) => p.includes('apply-page'))).toBe(false);
    expect(paths.some((p) => p.includes('check-status-page'))).toBe(false);
    expect(paths.some((p) => p.includes('application-form-step'))).toBe(false);
  });

  it('har route permission bilan gate qilingan', () => {
    const code = stripComments(manifest![1]);
    const routesBlock = code.slice(code.indexOf('routes:'), code.indexOf('menu:'));
    const routeLines = routesBlock.split('\n').filter((l) => l.includes('element:'));

    expect(routeLines.length).toBeGreaterThanOrEqual(3);
    routeLines.forEach((l) => expect(l).toContain('permission:'));
  });

  it('hech bir menyu yo`li boshqasining PREFIKSI emas', () => {
    const code = stripComments(manifest![1]);
    const menuBlock = code.slice(code.indexOf('menu:'), code.indexOf('i18n:'));
    const paths = [...menuBlock.matchAll(/path: '(\/[^']+)'/g)]
      .map((m) => m[1])
      .filter((p): p is string => !!p);

    expect(paths.length).toBeGreaterThanOrEqual(10);
    expect(paths).toContain('/foreign-admission/dashboard');
    expect(paths).not.toContain('/foreign-admission');

    paths.forEach((a) => {
      paths.forEach((b) => {
        if (a === b) return;
        expect(b.startsWith(`${a}/`), `"${a}" — "${b}" ning prefiksi`).toBe(false);
      });
    });
  });

  it('v1.2 amallari uchun permission e`lon qilingan', () => {
    const code = manifest![1];
    expect(code).toContain('internationalAdmission:approve');
    expect(code).toContain('internationalAdmission:reject');
    expect(code).not.toContain('internationalAdmission:changeStatus');
  });
});
