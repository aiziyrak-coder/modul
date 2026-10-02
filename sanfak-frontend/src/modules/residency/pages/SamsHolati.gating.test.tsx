import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import {
  mapGrid,
  mapOutage,
  mapOverview,
  mapWarnings,
  type BackendSamsOverview,
} from '../api/sams-status-mapper';

const SAMS_KEY = 'residencyLesson:update';

const can = vi.fn<(key: string) => boolean>();
vi.mock('@/app/session', () => ({
  usePermission: () => can,
  useSessionStore: { getState: () => ({ permissions: ['*'] }) },
}));

const ok = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  isSuccess: true,
  isPlaceholderData: false,
  error: null,
  dataUpdatedAt: Date.parse('2026-09-27T05:00:00.000Z'),
  refetch: vi.fn(),
});

const OVERVIEW: BackendSamsOverview = {
  now: '2026-09-27T05:00:00.000Z',
  today: '2026-09-27',
  liveness: { state: 'ok', lastPacket: { receivedAt: '2026-09-27T04:50:00.000Z' } },
  delivery: { deliveredThrough: '2026-09-25', gapDays: 0 },
  clinics: [{ dbname: 'klinika_a', orgTitle: 'Akfa klinikasi', live: true }],
  warnings: { day: '2026-09-27', unresolved: 0, ambiguous: 0, noSchedule: 0, inactiveUser: null },
};

const GRID = mapGrid(
  {
    clinics: [
      {
        dbname: 'klinika_a',
        orgTitle: 'Akfa klinikasi',
        live: true,
        days: [
          {
            day: '2026-09-25',
            delivery: 'final',
            measured: true,
            expectedResidents: 5,
            scannedResidents: 0,
          },
          {
            day: '2026-09-26',
            delivery: 'final',
            measured: true,
            expectedResidents: 5,
            scannedResidents: 5,
          },
        ],
      },
    ],
  },
  { from: '2026-09-14', to: '2026-09-27' },
);

const OUTAGES = {
  items: [
    mapOutage({
      _id: 'o1',
      from: '2026-09-01',
      to: '2026-09-02',
      dbname: null,
      reason: 'Server ishlamadi',
    }),
  ],
  total: 1,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
};

const WARNINGS = mapWarnings({
  day: '2026-09-27',
  digestDay: '2026-09-27',
  unresolved: { count: 0, groups: [] },
  ambiguous: { count: 0, items: [] },
  noSchedule: { count: 0, groups: [] },
  tenantSetChanged: { changes: [] },
});

const m = vi.hoisted(() => ({
  overview: null as unknown,
  mutateAsync: vi.fn(),
  gridCalls: [] as unknown[],
  outageCalls: [] as unknown[],
  outageOpts: [] as unknown[],
}));

vi.mock('../api/sams-status-api', () => ({
  useSamsOverview: () => m.overview,
  useSamsGrid: (range: unknown) => {
    m.gridCalls.push(range);
    return ok(GRID);
  },
  useSamsOutages: (params: unknown, opts?: unknown) => {
    m.outageCalls.push(params);
    m.outageOpts.push([params, opts]);
    return ok(OUTAGES);
  },
  useSamsWarnings: () => ok(WARNINGS),
  useCreateSamsOutage: () => ({ mutateAsync: m.mutateAsync, isPending: false }),
  useCancelSamsOutage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { default: SamsHolati } = await import('./SamsHolati');
const { default: manifest } = await import('../residency.module');

function renderPage() {
  return render(
    <ConfigProvider>
      <AntdApp>
        <ThemeProvider theme={theme as unknown as DefaultTheme}>
          <MemoryRouter>
            <SamsHolati />
          </MemoryRouter>
        </ThemeProvider>
      </AntdApp>
    </ConfigProvider>,
  );
}

const grant = (...keys: string[]) => can.mockImplementation((k) => keys.includes(k));
const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => {
  can.mockReset();
  m.overview = ok(mapOverview(OVERVIEW));
  m.gridCalls.length = 0;
  m.outageCalls.length = 0;
  m.outageOpts.length = 0;
});

describe('yozish huquqi BOR (`residencyLesson:update`)', () => {
  it('«+ Uzilish oynasi» ko‘rinadi, shubhali katak — tugma', () => {
    grant(SAMS_KEY);
    renderPage();
    expect(screen.getByRole('button', { name: /\+ Uzilish oynasi/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /25\.09\.2026: Hech kim skanerlanmadi/ }),
    ).toBeTruthy();
  });

  it('katak bosilsa — e’lon oynasi klinika va kun bilan oldindan to‘ldiriladi', () => {
    grant(SAMS_KEY);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /25\.09\.2026: Hech kim skanerlanmadi/ }));
    expect(screen.getByText(/Uzilish oynasini e.lon qilish/)).toBeTruthy();
    expect(screen.getAllByDisplayValue('2026-09-25')).toHaveLength(2);
    expect(document.querySelector('.ant-select-selection-item')?.textContent).toBe(
      'Akfa klinikasi',
    );
    expect(
      screen.getByRole('button', { name: /E.lon qilish — Akfa klinikasi, 1 kun/ }),
    ).toBeTruthy();
    expect(screen.getByText(/Bu davomatni «sababli» qilmaydi/)).toBeTruthy();
  });

  it('«+ Uzilish oynasi» — klinika TANLANMAGAN (placeholder), «Barcha klinikalar» standart emas', () => {
    grant(SAMS_KEY);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /\+ Uzilish oynasi/ }));
    expect(document.querySelector('.ant-select-selection-item')).toBeNull();
    expect(screen.getByText('Klinikani yoki «Barcha klinikalar»ni tanlang')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^E.lon qilish$/ })).toBeTruthy();
  });

  it('uzilishlar tabida faol oynada «Bekor qilish» bor', () => {
    grant(SAMS_KEY);
    renderPage();
    openTab(/Uzilish oynalari/);
    expect(screen.getByRole('button', { name: 'Bekor qilish' })).toBeTruthy();
  });
});

describe('yozish huquqi YO‘Q', () => {
  it('«+ Uzilish oynasi» yo‘q, katak tugma emas', () => {
    grant('residentAttendance:readAll');
    renderPage();
    expect(screen.queryByRole('button', { name: /\+ Uzilish oynasi/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hech kim skanerlanmadi/ })).toBeNull();
    expect(screen.getByRole('img', { name: /25\.09\.2026: Hech kim skanerlanmadi/ })).toBeTruthy();
  });

  it('uzilishlar tabida «Bekor qilish» yo‘q', () => {
    grant('residentAttendance:readAll');
    renderPage();
    openTab(/Uzilish oynalari/);
    expect(screen.queryByRole('button', { name: 'Bekor qilish' })).toBeNull();
  });
});

describe('D-MODE ko‘rinishi', () => {
  it('stale — banner «o‘lchanmagan» so‘zi bilan', () => {
    grant(SAMS_KEY);
    m.overview = ok(
      mapOverview({ ...OVERVIEW, liveness: { ...OVERVIEW.liveness, state: 'stale' } }),
    );
    renderPage();
    const banner = screen.getByText(/paket kelmayapti \(oxirgi:/);
    expect(banner).toBeTruthy();
    expect(screen.getByText(/Bu vaqt «o.lchanmagan» hisoblanadi/)).toBeTruthy();
  });

  it('ogohlantirishlar: null → «Ma’lumot kelmagan», bo‘sh → «Muammo yo‘q»', () => {
    grant(SAMS_KEY);
    renderPage();
    openTab(/Ogohlantirishlar/);
    const inactive = screen.getByText(/4\. SAMS.da nofaol xodim/).closest('section') as HTMLElement;
    expect(within(inactive).getByText(/Ma.lumot kelmagan/)).toBeTruthy();
    const noSchedule = screen
      .getByText(/3\. Smena biriktirilmagan/)
      .closest('section') as HTMLElement;
    expect(within(noSchedule).getByText(/Muammo yo.q/)).toBeTruthy();
  });

  it('overview 403 — sahifa «ruxsat yo‘q» (bo‘sh jadval EMAS)', async () => {
    grant(SAMS_KEY);
    const { AxiosError, AxiosHeaders } = await import('axios');
    const error = new AxiosError('x', 'ERR', undefined, undefined, {
      status: 403,
      statusText: '',
      data: {},
      headers: {} as InstanceType<typeof AxiosHeaders>,
      config: { headers: new AxiosHeaders() },
    });
    m.overview = { data: undefined, isLoading: false, isError: true, error, refetch: vi.fn() };
    renderPage();
    expect(screen.getByText(/ko.rish huquqingiz yo.q/)).toBeTruthy();
  });
});

describe('jadval oynasi va uzilish qatlami', () => {
  it('qatlam AYNAN jadval oynasi bilan: faol, 100 tagacha, from/to (server today’dan 14 kun)', () => {
    grant(SAMS_KEY);
    renderPage();
    const overlay = { page: 1, limit: 100, status: 'active', from: '2026-09-14', to: '2026-09-27' };
    expect(m.outageCalls).toContainEqual(overlay);
    expect(m.gridCalls).toContainEqual({ from: '2026-09-14', to: '2026-09-27' });
    expect(m.outageOpts).toContainEqual([overlay, { poll: true }]);
    expect(m.outageOpts).toContainEqual([{ page: 1, limit: 1, status: 'active' }, undefined]);
  });

  it('32 kunlik oyna — ogohlantirish, so‘rov YO‘Q, piker qo‘llangan oynaga qaytadi', async () => {
    grant(SAMS_KEY);
    renderPage();
    const inputs = () =>
      [...document.querySelectorAll<HTMLInputElement>('.ant-picker-range input')].map(
        (i) => i.value,
      );
    expect(inputs()).toEqual(['2026-09-14', '2026-09-27']);
    fireEvent.click(document.querySelector('.ant-picker-range input') as HTMLElement);
    fireEvent.click(document.querySelector('.ant-picker-header-prev-btn') as HTMLElement);
    fireEvent.click(await screen.findByTitle('2026-08-26'));
    fireEvent.click(screen.getByTitle('2026-09-26'));
    expect(await screen.findByText(/Oyna 31 kundan oshmasin \(tanlangan: 32 kun\)/)).toBeTruthy();
    expect(m.gridCalls).not.toContainEqual({ from: '2026-08-26', to: '2026-09-26' });
    await waitFor(() => expect(inputs()).toEqual(['2026-09-14', '2026-09-27']));
  });
});

describe('manifest — kalit sahifa bilan bir xil', () => {
  it('route `sams-holati` va menyu bandi `residencyLesson:update` bilan', () => {
    const route = manifest.routes.find((r) => r.path === 'sams-holati');
    expect(route?.permission).toBe(SAMS_KEY);
    const item = (manifest.menu ?? []).find((i) => i.path === '/residency/sams-holati');
    expect(item?.permission).toBe(SAMS_KEY);
    expect(item?.titleKey).toBe('residency.nav.samsHolati');
    expect(manifest.i18n?.uz?.['residency.nav.samsHolati']).toBe('SAMS holati');
  });

  it('kalit BIR marta e’lon qilingan (dublikat build-catalog’da throw)', () => {
    const keys = (manifest.permissions ?? []).map((p) => p.key);
    expect(keys.filter((k) => k === SAMS_KEY)).toHaveLength(1);
    expect(keys.filter((k) => k === 'resident:changeStatus')).toHaveLength(1);
  });
});
