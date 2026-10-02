import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MenuGroup, MenuNode } from '@/app/modules/build-menu';
import { firstReachablePath } from './first-reachable-path';

const node = (path: string, children: MenuNode[] = []): MenuNode => ({
  path,
  title: path,
  order: 0,
  children,
});

const group = (key: string, nodes: MenuNode[], order = 0): MenuGroup => ({
  key,
  title: key,
  order,
  nodes,
});

describe('firstReachablePath', () => {
  it('birinchi guruhning birinchi bargini qaytaradi', () => {
    const groups = [
      group('study-load', [node('/study-load/approval-inbox'), node('/study-load/workloads')]),
      group('admin', [node('/admin/users')]),
    ];
    expect(firstReachablePath(groups)).toBe('/study-load/approval-inbox');
  });

  it('bolali node — HEADER deb qaraladi, ichidagi bargga tushadi', () => {
    const groups = [
      group('x', [node('/x/group-header', [node('/x/real-page'), node('/x/other')])]),
    ];
    expect(firstReachablePath(groups)).toBe('/x/real-page');
  });

  it("bolasi bo'sh bo'lgan header o'tkazib yuboriladi va keyingisi olinadi", () => {
    const groups = [group('x', [node('/x/empty-header', []), node('/x/page')])];
    expect(firstReachablePath(groups)).toBe('/x/empty-header');
  });

  it("birinchi guruhda barg bo'lmasa — keyingi guruhga o'tadi", () => {
    const emptyHeader: MenuNode = { path: '/a/h', title: 'h', order: 0, children: [] };
    const groups = [
      group('a', [
        { ...emptyHeader, path: '/a/h', children: [{ ...emptyHeader, path: '', children: [] }] },
      ]),
      group('b', [node('/b/page')]),
    ];
    expect(firstReachablePath(groups)).toBe('/b/page');
  });

  it("menyu bo'sh bo'lsa null (chaqiruvchi 403 ko'rsatadi)", () => {
    expect(firstReachablePath([])).toBeNull();
    expect(firstReachablePath([group('x', [])])).toBeNull();
  });

  it("bo'sh `path` qaytarilmaydi", () => {
    const groups = [group('x', [node(''), node('/x/ok')])];
    expect(firstReachablePath(groups)).toBe('/x/ok');
  });

  it("deprioritised guruh oxiriga suriladi (admin O'UB ning uyi emas)", () => {
    const groups = [
      group('admin', [node('/admin/courses')], 0),
      group('study-load', [node('/study-load/approval-inbox')], 20),
    ];
    expect(firstReachablePath(groups, ['admin'])).toBe('/study-load/approval-inbox');
    expect(firstReachablePath(groups)).toBe('/admin/courses');
  });

  it("boshqa hech narsa bo'lmasa — deprioritised ham ISHLATILADI (403 dan yaxshiroq)", () => {
    const groups = [group('admin', [node('/admin/courses')], 0)];
    expect(firstReachablePath(groups, ['admin'])).toBe('/admin/courses');
  });

  it("4.2 roli (O'UB) — /admin/users EMAS, o'z sahifasi qaytadi", () => {
    const groups = [
      group('study-load', [
        node('/study-load/approval-inbox'),
        node('/study-load/study-plans'),
        node('/study-load/contingent'),
      ]),
    ];
    const target = firstReachablePath(groups);
    expect(target).toBe('/study-load/approval-inbox');
    expect(target).not.toBe('/admin/users');
  });
});

describe('app-router.tsx — fallback ulanishi', () => {
  const src = readFileSync(join(__dirname, 'app-router.tsx'), 'utf8');

  it('firstReachablePath import qilingan va ishlatilgan', () => {
    expect(src).toContain("from './first-reachable-path'");
    expect(src).toMatch(/firstReachablePath\(\s*buildAppMenu\(/);
  });

  it("DefaultLanding oxirgi fallback'i /admin/users EMAS", () => {
    const body = src.slice(
      src.indexOf('function DefaultLanding'),
      src.indexOf('export function AppRouter'),
    );
    expect(body.length).toBeGreaterThan(0);
    const returns = [...body.matchAll(/return <Navigate to="([^"]+)"/g)].map((m) => m[1]);
    expect(returns.length).toBeGreaterThan(1);
    expect(returns.at(-1)).not.toBe('/admin/users');
  });

  it("menyu fallback'i shartli returnlardan KEYIN turadi (tartib buzilmasin)", () => {
    const body = src.slice(
      src.indexOf('function DefaultLanding'),
      src.indexOf('export function AppRouter'),
    );
    const fallbackReturn = body.indexOf('if (menuFallback) return');
    expect(fallbackReturn).toBeGreaterThan(-1);
    expect(fallbackReturn).toBeGreaterThan(body.indexOf("can('user:create')"));
    expect(body.indexOf('useMemo')).toBeLessThan(body.indexOf("can('user:create')"));
  });
});

describe('app-router.tsx — /login, /403, /* endi lazy()', () => {
  const src = readFileSync(join(__dirname, 'app-router.tsx'), 'utf8');

  it('LoginPage/ForbiddenPage/NotFoundPage statik import qilinmaydi, lazy() orqali olinadi', () => {
    expect(src).not.toMatch(/^import\s*\{[^}]*\bLoginPage\b[^}]*\}\s*from\s*'@\/app\/auth'/m);
    expect(src).not.toMatch(
      /^import\s*\{[^}]*\b(ForbiddenPage|NotFoundPage)\b[^}]*\}\s*from\s*'@\/app\/errors'/m,
    );

    expect(src).toContain("const LoginPage = lazy(() => import('@/app/auth/login-page'));");
    expect(src).toContain('const ForbiddenPage = lazy(');
    expect(src).toContain('const NotFoundPage = lazy(');
    expect(src).toContain("import('@/app/errors').then((m) => ({ default: m.ForbiddenPage }))");
    expect(src).toContain("import('@/app/errors').then((m) => ({ default: m.NotFoundPage }))");
  });

  it('uchala route ham routing jadvalida bor', () => {
    expect(src).toMatch(/path:\s*'\/login'/);
    expect(src).toMatch(/path:\s*'403'/);
    expect(src).toMatch(/path:\s*'\*'/);
  });

  it("har bir lazy element o'zining Suspense ichida — `lazy()` Suspense'siz throw qiladi", () => {
    const routerBody = src.slice(src.indexOf('export function AppRouter'));
    const suspenseCount = (routerBody.match(/<Suspense fallback=/g) ?? []).length;
    expect(suspenseCount).toBe(3);
  });

  it("/login — full-page loader (shell yo'q), 403 va * — AppLayout ichidagi loader", () => {
    const loginBlock = src.slice(src.indexOf("path: '/login'"), src.indexOf("path: '/',"));
    expect(loginBlock).toContain('<PageLoader full />');

    const shellChildren = src.slice(src.indexOf('children: ['));
    const forbiddenBlock = shellChildren.slice(shellChildren.indexOf("path: '403'"));
    expect(forbiddenBlock).toContain('<PageLoader />');
    const notFoundBlock = shellChildren.slice(shellChildren.indexOf("path: '*'"));
    expect(notFoundBlock).toContain('<PageLoader />');
  });
});
