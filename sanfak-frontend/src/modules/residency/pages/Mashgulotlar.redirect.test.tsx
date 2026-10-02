import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/session', () => ({
  usePermission: () => () => true,
  useSessionStore: { getState: () => ({ permissions: ['*'] }) },
}));
vi.mock('../components/LessonSession/SessionRoster', () => ({
  default: ({ id }: { id: string }) => <div data-testid="roster">{id}</div>,
}));

const { default: manifest } = await import('../residency.module');

const ROUTE_PATHS = [
  'davomat/mashgulot/:id',
  'davomat/mashgulot',
  'mashgulotlar',
  'mashgulotlar/:id',
];

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderAt(entry: string, { legacy = true } = {}) {
  const routes = manifest.routes.filter(
    (r): r is typeof r & { path: string } =>
      typeof r.path === 'string' && ROUTE_PATHS.includes(r.path),
  );
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {routes.map(({ path, element: Element }) =>
          !legacy && path.startsWith('mashgulotlar') ? (
            <Route key={path} path={`/residency/${path}`} element={<div data-testid="legacy" />} />
          ) : (
            <Route key={path} path={`/residency/${path}`} element={<Element />} />
          ),
        )}
        <Route path="/residency/davomat" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId('location').textContent;

describe('F1-Q10 — eski yo‘llar Jurnal’ga olib boradi (manifest route’lari)', () => {
  it('`/residency/mashgulotlar` → `/residency/davomat?tab=mashgulotlar`', async () => {
    renderAt('/residency/mashgulotlar');
    await vi.waitFor(() => expect(location()).toBe('/residency/davomat?tab=mashgulotlar'));
  });

  it('yalang’och `/residency/davomat/mashgulot` → tab (404 emas)', async () => {
    renderAt('/residency/davomat/mashgulot');
    await vi.waitFor(() => expect(location()).toBe('/residency/davomat?tab=mashgulotlar'));
  });

  it('`/residency/mashgulotlar/:id` → Jurnal ostidagi tafsilot, o‘sha mashg‘ulot', async () => {
    renderAt('/residency/mashgulotlar/s1');
    expect(await screen.findByTestId('roster')).toHaveTextContent('s1');
    expect(location()).toBe('/residency/davomat/mashgulot/s1');
  });

  it('tafsilotdagi «orqaga» — to‘g‘ridan-to‘g‘ri Jurnal tabiga, eski yo‘l orqali emas', async () => {
    renderAt('/residency/davomat/mashgulot/s1', { legacy: false });
    expect(await screen.findByTestId('roster')).toHaveTextContent('s1');

    fireEvent.click(screen.getByRole('button', { name: /Mashg‘ulotlar/ }));
    expect(location()).toBe('/residency/davomat?tab=mashgulotlar');
    expect(screen.queryByTestId('legacy')).toBeNull();
  });
});

describe('F1-Q10 — manifest', () => {
  it('menyuda «Mashg‘ulotlar» bandi va uning i18n kaliti yo‘q, «Jurnal» bor', () => {
    const paths = (manifest.menu ?? []).map((i) => i.path);
    expect(paths).not.toContain('/residency/mashgulotlar');
    expect(paths).toContain('/residency/davomat');
    for (const lang of ['uz', 'ru', 'en'] as const) {
      expect(manifest.i18n?.[lang]?.['residency.nav.mashgulotlar']).toBeUndefined();
    }
  });

  it('tafsilot `residentAttendance:create`, yo‘naltirishlar `permission`siz', () => {
    const byPath = (p: string) => manifest.routes.find((r) => r.path === p);
    expect(byPath('davomat/mashgulot/:id')?.permission).toBe('residentAttendance:create');
    for (const path of ['davomat/mashgulot', 'mashgulotlar', 'mashgulotlar/:id']) {
      expect(byPath(path)).toBeDefined();
      expect(byPath(path)?.permission).toBeUndefined();
    }
  });
});
