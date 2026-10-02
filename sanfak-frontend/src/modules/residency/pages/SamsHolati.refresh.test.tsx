import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedApi from '@/shared/api';
import { theme } from '../styles/theme';
import { SAMS_QUERY_KEY } from '../api/sams-status-api';

type Query = Record<string, unknown> | undefined;
type Reply = (query: Query) => Promise<unknown>;

const h = vi.hoisted(() => ({
  routes: {} as Record<string, Reply>,
  fetchOne: vi.fn(),
  fetchPaginated: vi.fn(),
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  fetchOne: h.fetchOne,
  fetchPaginated: h.fetchPaginated,
}));

const can = vi.fn<(key: string) => boolean>();
vi.mock('@/app/session', () => ({
  usePermission: () => can,
  useSessionStore: { getState: () => ({ permissions: ['*'] }) },
}));

const { default: SamsHolati } = await import('./SamsHolati');

const OVERVIEW = {
  now: '2026-09-27T05:00:00.000Z',
  today: '2026-09-27',
  config: { tickMinutes: 15, staleAfterMinutes: 30, closeGraceHours: 6, resendMaxDays: 30 },
  liveness: {
    state: 'ok',
    lastPacket: { receivedAt: '2026-09-27T04:50:00.000Z', emittedAt: '2026-09-27T04:49:40.000Z' },
  },
  delivery: { deliveredThrough: '2026-09-26', resendFrom: null, gapDays: 0, oldestGap: null },
  clinics: [
    {
      dbname: 'klinika_a',
      orgTitle: 'Akfa klinikasi',
      live: true,
      firstDay: '2026-01-10',
      lastDay: '2026-09-27',
      lastPacketAt: '2026-09-27T04:50:00.000Z',
      deliveredThrough: '2026-09-26',
      gapCount: 0,
      today: { delivery: 'open', measured: true, expectedResidents: 5, scannedResidents: 3 },
    },
  ],
  warnings: {
    day: '2026-09-27',
    unresolved: 1,
    ambiguous: 0,
    noSchedule: 0,
    inactiveUser: 0,
    tenantSetChanged: null,
  },
};

const finalDay = (day: string, scanned: number) => ({
  day,
  delivery: 'final',
  measured: true,
  unmeasuredReason: null,
  expectedResidents: 5,
  scannedResidents: scanned,
  rosterScanCount: scanned,
  coverage: scanned / 5,
  coverageStatus: null,
  deviceMix: null,
  packetAt: `${day}T20:00:00.000Z`,
  receivedAt: `${day}T20:00:05.000Z`,
});

function days(from: string, to: string, rows: unknown[], lastPacketAt: string | null) {
  return {
    from,
    to,
    deliveredThrough: '2026-09-26',
    resendFrom: null,
    clinics: [
      {
        dbname: 'klinika_a',
        orgTitle: 'Akfa klinikasi',
        firstDay: '2026-01-10',
        gaps: [],
        days: rows,
        live: true,
        ...(lastPacketAt === null ? {} : { lastPacketAt }),
        deliveredThrough: '2026-09-26',
      },
    ],
  };
}

const GRID_DAYS = [finalDay('2026-09-25', 0), finalDay('2026-09-26', 5)];

const WARNINGS = {
  day: '2026-09-27',
  digestDay: '2026-09-26',
  unresolved: {
    count: 1,
    groups: [
      {
        dbname: 'klinika_a',
        orgTitle: 'Akfa klinikasi',
        residents: [
          { resident: 'r1', fullName: 'Aliyev Vali', jshshir: '30101990000011', isNew: true },
        ],
      },
    ],
  },
  ambiguous: { count: 0, items: [] },
  noSchedule: { count: 0, groups: [] },
  inactiveUser: { count: 0, groups: [] },
  tenantSetChanged: { changes: [] },
};

const OUTAGE = {
  _id: '66f0c0ffee0000000000abcd',
  from: '2026-09-20',
  to: '2026-09-21',
  dbname: 'klinika_a',
  orgTitle: 'Akfa klinikasi',
  reason: 'Tarmoq uzildi',
  createdBy: { firstName: 'Vali', lastName: 'Aliyev' },
  createdAt: '2026-09-22T05:00:00.000Z',
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
};
const page = (docs: unknown[]) => ({
  docs,
  totalDocs: docs.length,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
});

const never = () => new Promise<never>(() => undefined);
const fail = () => Promise.reject(new Error('502 Bad Gateway'));

function defaultRoutes(): Record<string, Reply> {
  return {
    overview: () => Promise.resolve(OVERVIEW),
    days: (q) =>
      Promise.resolve(days(String(q?.from), String(q?.to), GRID_DAYS, '2026-09-27T04:50:00.000Z')),
    warnings: () => Promise.resolve(WARNINGS),
    overlay: () => Promise.resolve(page([OUTAGE])),
    list: () => Promise.resolve(page([OUTAGE])),
  };
}

h.fetchOne.mockImplementation((url: string, query?: Query) => {
  const key = url.split('/').at(-1) as string;
  const reply = h.routes[key];
  return reply ? reply(query) : Promise.reject(new Error(`kutilmagan yo'l ${url}`));
});
h.fetchPaginated.mockImplementation((_url: string, query: Query) =>
  query?.limit === 100 ? h.routes.overlay?.(query) : h.routes.list?.(query),
);

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <ConfigProvider>
        <AntdApp>
          <ThemeProvider theme={theme as unknown as DefaultTheme}>
            <MemoryRouter>
              <SamsHolati />
            </MemoryRouter>
          </ThemeProvider>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>,
  );
  const refetch = (what: string) =>
    act(async () => {
      await qc.refetchQueries({ queryKey: [SAMS_QUERY_KEY, what] });
    });
  return { qc, refetch };
}

const SLOW = 20_000;
configure({ asyncUtilTimeout: 10_000 });
const REFRESH = /Yangilab bo.lmadi — ko.rsatilgan holat \d\d:\d\d dagi/;
const FULL_ERROR = /Ma.lumotni yuklab bo.lmadi/;
const zeroCell = (day: string) => new RegExp(`${day}: Hech kim skanerlanmadi`);
const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));
const suspectCard = () => screen.getByText('Shubhali kunlar').parentElement as HTMLElement;
const unmeasuredCard = () =>
  screen.getByText('O‘lchanmagan kunlar (oynada)').parentElement as HTMLElement;
const warningsCard = () => screen.getByText('Ogohlantirishlar').parentElement as HTMLElement;

beforeEach(() => {
  h.routes = defaultRoutes();
  h.fetchOne.mockClear();
  h.fetchPaginated.mockClear();
  can.mockReset();
  can.mockImplementation((k) => k === 'residencyLesson:update');
});

describe('🔴 overview qayta so‘rovi yiqildi — sahifa QOLADI', () => {
  it(
    'ochiq e’lon oynasi, yozilgan sabab va tab yo‘qolmaydi; izoh + qayta urinish',
    async () => {
      const { refetch } = renderPage();
      await screen.findByRole('tab', { name: /Uzilish oynalari/ });
      openTab(/Uzilish oynalari/);
      fireEvent.click(screen.getByRole('button', { name: /\+ Uzilish oynasi/ }));
      fireEvent.change(screen.getByLabelText('Sabab'), {
        target: { value: 'SAMS serveri ishlamadi' },
      });

      h.routes.overview = fail;
      await refetch('overview');

      expect(await screen.findByText(REFRESH)).toBeTruthy();
      expect(screen.queryByText(FULL_ERROR)).toBeNull();
      expect(screen.getByText(/Uzilish oynasini e.lon qilish/)).toBeTruthy();
      expect((screen.getByLabelText('Sabab') as HTMLTextAreaElement).value).toBe(
        'SAMS serveri ishlamadi',
      );
      expect(
        screen.getByRole('tab', { name: /Uzilish oynalari/ }).getAttribute('aria-selected'),
      ).toBe('true');

      h.routes.overview = defaultRoutes().overview as Reply;
      fireEvent.click(screen.getByText('Qayta urinish'));
      await waitFor(() => expect(screen.queryByText(REFRESH)).toBeNull());
    },
    SLOW,
  );

  it(
    'birinchi so‘rov yiqilsa (ma’lumot YO‘Q) — to‘liq sahifali xabar',
    async () => {
      h.routes.overview = fail;
      renderPage();
      expect(await screen.findByText(FULL_ERROR)).toBeTruthy();
      expect(screen.queryByRole('tab', { name: /Klinikalar/ })).toBeNull();
    },
    SLOW,
  );
});

describe('qayta so‘rov yiqildi — ro‘yxatlar QOLADI', () => {
  it(
    'jadval (/days) — kataklar qoladi, jadval ustida izoh',
    async () => {
      const { refetch } = renderPage();
      await screen.findByRole('button', { name: zeroCell('25\\.09\\.2026') });
      h.routes.days = fail;
      await refetch('days');
      expect(screen.getByRole('button', { name: zeroCell('25\\.09\\.2026') })).toBeTruthy();
      expect(await screen.findByText(REFRESH)).toBeTruthy();
      expect(screen.queryByText(FULL_ERROR)).toBeNull();
    },
    SLOW,
  );

  it(
    'ogohlantirishlar — ro‘yxat qoladi',
    async () => {
      const { refetch } = renderPage();
      await screen.findByRole('tab', { name: /Ogohlantirishlar/ });
      openTab(/Ogohlantirishlar/);
      expect(await screen.findByText('Aliyev Vali')).toBeTruthy();
      h.routes.warnings = fail;
      await refetch('warnings');
      expect(screen.getByText('Aliyev Vali')).toBeTruthy();
      expect(await screen.findByText(REFRESH)).toBeTruthy();
      expect(screen.queryByText(FULL_ERROR)).toBeNull();
    },
    SLOW,
  );

  it(
    'uzilish oynalari ro‘yxati — jadval qoladi',
    async () => {
      const { refetch } = renderPage();
      await screen.findByRole('tab', { name: /Uzilish oynalari/ });
      openTab(/Uzilish oynalari/);
      expect(await screen.findByText(/20\.09\.2026 – 21\.09\.2026/)).toBeTruthy();
      h.routes.list = fail;
      await refetch('outages');
      expect(screen.getByText(/20\.09\.2026 – 21\.09\.2026/)).toBeTruthy();
      expect(await screen.findByText(REFRESH)).toBeTruthy();
      expect(screen.queryByText(FULL_ERROR)).toBeNull();
    },
    SLOW,
  );
});

describe('🔴 birinchi so‘rov yiqildi (ma’lumot YO‘Q) — xato, «Yuklanmoqda…» EMAS (F4-Q20)', () => {
  it(
    'jadval (/days): xato + qayta urinish; kartalar «Jadvalni yuklab bo‘lmadi»',
    async () => {
      h.routes.days = fail;
      renderPage();
      expect(await screen.findByText(FULL_ERROR)).toBeTruthy();
      expect(screen.queryByText('Yuklanmoqda…')).toBeNull();
      expect(within(unmeasuredCard()).getByText('Jadvalni yuklab bo‘lmadi')).toBeTruthy();
      expect(within(suspectCard()).getByText('Jadvalni yuklab bo‘lmadi')).toBeTruthy();

      h.routes.days = defaultRoutes().days as Reply;
      fireEvent.click(screen.getByText('Qayta urinish'));
      expect(await screen.findByRole('button', { name: zeroCell('25\\.09\\.2026') })).toBeTruthy();
    },
    SLOW,
  );

  it(
    'ogohlantirishlar: xato + qayta urinish',
    async () => {
      h.routes.warnings = fail;
      renderPage();
      await screen.findByRole('tab', { name: /Ogohlantirishlar/ });
      openTab(/Ogohlantirishlar/);
      expect(await screen.findByText(FULL_ERROR)).toBeTruthy();
      expect(screen.getByText('Qayta urinish')).toBeTruthy();
      expect(screen.queryByText('Yuklanmoqda…')).toBeNull();
    },
    SLOW,
  );

  it(
    'uzilishlar ro‘yxati: xato + qayta urinish; tab soni «?» («…» EMAS)',
    async () => {
      h.routes.list = fail;
      renderPage();
      expect(await screen.findByRole('tab', { name: 'Uzilish oynalari (? faol)' })).toBeTruthy();
      openTab(/Uzilish oynalari/);
      expect(await screen.findByText(FULL_ERROR)).toBeTruthy();
      expect(screen.getByText('Qayta urinish')).toBeTruthy();
      expect(screen.queryByText('Yuklanmoqda…')).toBeNull();
    },
    SLOW,
  );
});

describe('🔴 uzilish qatlami noma’lum — qizil katak va «e’lon qilinmagan» soni yo‘q', () => {
  it(
    'qatlam yiqildi: 0 skan kun neytral, bosilmaydi; karta «—» + sababi',
    async () => {
      h.routes.overlay = fail;
      renderPage();
      const cell = await screen.findByRole('img', {
        name: /25\.09\.2026: Hech kim skanerlanmadi — uzilish oynalari yuklanmagan/,
      });
      expect(cell.textContent).toBe('0/5');
      expect(screen.queryByRole('button', { name: /Hech kim skanerlanmadi/ })).toBeNull();
      await waitFor(() =>
        expect(
          within(suspectCard()).getByText('Uzilish oynalarini yuklab bo‘lmadi — tekshirilmagan'),
        ).toBeTruthy(),
      );
      expect(within(suspectCard()).getByText('—')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Hech kim skanerlanmadi/ })).toBeNull();
    },
    SLOW,
  );

  it(
    'qatlam QAYTA so‘rovi yiqildi (ma’lumot bor): eski qatlam «ma’lum» emas — neytral, izoh, karta sababi',
    async () => {
      const { refetch } = renderPage();
      await screen.findByRole('button', { name: zeroCell('25\\.09\\.2026') });
      await waitFor(() => expect(within(suspectCard()).getByText('1')).toBeTruthy());

      h.routes.overlay = fail;
      await refetch('outages');

      expect(
        await screen.findByRole('img', {
          name: /25\.09\.2026: Hech kim skanerlanmadi — uzilish oynalari yuklanmagan/,
        }),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Hech kim skanerlanmadi/ })).toBeNull();
      expect(
        screen.getByText(/«0 skan» kunlari tekshirilmagan \(qizil emas\), kataklar bosilmaydi/),
      ).toBeTruthy();
      expect(
        within(suspectCard()).getByText('Uzilish oynalarini yuklab bo‘lmadi — tekshirilmagan'),
      ).toBeTruthy();
    },
    SLOW,
  );

  it(
    'qatlam hali yuklanmoqda: xuddi shunday, karta «tekshirilmoqda…»',
    async () => {
      h.routes.overlay = never;
      renderPage();
      expect(
        await screen.findByRole('img', { name: /25\.09\.2026: .*uzilish oynalari yuklanmagan/ }),
      ).toBeTruthy();
      expect(within(suspectCard()).getByText('Uzilish oynalari tekshirilmoqda…')).toBeTruthy();
    },
    SLOW,
  );

  it(
    '🔴 F4-Q18: qatlam to‘liq emas (hasNextPage) — «U» qoladi, 0 skan neytral, tugma yo‘q, karta «—»',
    async () => {
      h.routes.overlay = () =>
        Promise.resolve({ ...page([OUTAGE]), totalPages: 2, hasNextPage: true });
      renderPage();
      expect(
        await screen.findByText(/Uzilish qatlami to.liq emas \(oynada 100 tadan ko.p\) — /),
      ).toBeTruthy();
      expect(
        screen.getByRole('img', { name: /25\.09\.2026: .*uzilish oynalari yuklanmagan yoki/ }),
      ).toBeTruthy();
      expect(screen.getByRole('img', { name: /20\.09\.2026: Uzilish oynasi/ }).textContent).toBe(
        'U',
      );
      expect(screen.queryAllByRole('button', { name: /uzilish oynasini e.lon qilish/ })).toEqual(
        [],
      );
      expect(within(suspectCard()).getByText('—')).toBeTruthy();
      expect(
        within(suspectCard()).getByText('Uzilish qatlami to‘liq emas — tekshirilmagan'),
      ).toBeTruthy();
    },
    SLOW,
  );

  it(
    'qatlam ma’lum: o‘sha kun qizil tugma, karta 1',
    async () => {
      renderPage();
      expect(await screen.findByRole('button', { name: zeroCell('25\\.09\\.2026') })).toBeTruthy();
      await waitFor(() => expect(within(suspectCard()).getByText('1')).toBeTruthy());
    },
    SLOW,
  );
});

describe('oyna almashdi — oldingi oynaning ma’lumoti ishlatilmaydi', () => {
  async function pickSeptemberStart() {
    fireEvent.click(document.querySelector('.ant-picker-range input') as HTMLElement);
    fireEvent.click(await screen.findByTitle('2026-09-01'));
    fireEvent.click(screen.getByTitle('2026-09-10'));
  }
  const isNew = (q: Query) => q?.from === '2026-09-01';

  it(
    'yangi /days kelguncha eski kataklar yangi sarlavhalar ostida chizilmaydi',
    async () => {
      const base = h.routes.days as Reply;
      h.routes.days = (q) => (isNew(q) ? never() : base(q));
      renderPage();
      await screen.findByRole('button', { name: zeroCell('25\\.09\\.2026') });
      await pickSeptemberStart();
      await waitFor(() => expect(screen.getByText('Yuklanmoqda…')).toBeTruthy());
      expect(screen.queryByRole('button', { name: zeroCell('25\\.09\\.2026') })).toBeNull();
    },
    SLOW,
  );

  it(
    'yangi oynaning qatlami kelguncha (placeholder) — 0 skan kun qizil emas',
    async () => {
      const base = h.routes.days as Reply;
      h.routes.days = (q) =>
        isNew(q)
          ? Promise.resolve(days('2026-09-01', '2026-09-10', [finalDay('2026-09-05', 0)], null))
          : base(q);
      h.routes.overlay = (q) => (isNew(q) ? never() : Promise.resolve(page([OUTAGE])));
      renderPage();
      await screen.findByRole('button', { name: zeroCell('25\\.09\\.2026') });
      await pickSeptemberStart();
      expect(
        await screen.findByRole('img', { name: /05\.09\.2026: .*uzilish oynalari yuklanmagan/ }),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Hech kim skanerlanmadi/ })).toBeNull();
    },
    SLOW,
  );
});

describe('qator sarlavhasidagi oxirgi paket (F4-Q11)', () => {
  it(
    '/days `lastPacketAt` bermasa — overview’dagisi (dbname bo‘yicha)',
    async () => {
      h.routes.days = (q) => Promise.resolve(days(String(q?.from), String(q?.to), GRID_DAYS, null));
      renderPage();
      expect(await screen.findByText(/^Paket: 27\.09\.2026 09:50$/)).toBeTruthy();
    },
    SLOW,
  );

  it(
    '/days bersa — o‘shanisi ustun',
    async () => {
      h.routes.days = (q) =>
        Promise.resolve(
          days(String(q?.from), String(q?.to), GRID_DAYS, '2026-09-27T04:55:00.000Z'),
        );
      renderPage();
      expect(await screen.findByText(/^Paket: 27\.09\.2026 09:55$/)).toBeTruthy();
    },
    SLOW,
  );
});

describe('🔴 F4-Q19: `day: null` — SAMS ma’lumot kuni yo‘q', () => {
  const NO_DAY_WARNINGS = {
    day: null,
    digestDay: null,
    unresolved: { count: 0, groups: [] },
    ambiguous: { count: 0, items: [] },
    noSchedule: { count: 0, groups: [] },
    inactiveUser: { count: 0, groups: [] },
    tenantSetChanged: { changes: [] },
  };
  const NO_DAY_OVERVIEW = {
    ...OVERVIEW,
    liveness: { state: 'never', lastPacket: null },
    clinics: [],
    warnings: {
      day: null,
      unresolved: 0,
      ambiguous: 0,
      noSchedule: 0,
      inactiveUser: 0,
      tenantSetChanged: null,
    },
  };

  it(
    'tab «?», karta «—», 4 ta bo‘lim «Ma’lumot kelmagan» (0 / «Muammo yo‘q» EMAS)',
    async () => {
      h.routes.warnings = () => Promise.resolve(NO_DAY_WARNINGS);
      h.routes.overview = () => Promise.resolve(NO_DAY_OVERVIEW);
      h.routes.days = (q) =>
        Promise.resolve({ from: q?.from, to: q?.to, deliveredThrough: null, clinics: [] });
      renderPage();
      await screen.findByRole('tab', { name: 'Ogohlantirishlar (?)' });
      expect(within(warningsCard()).getByText('—')).toBeTruthy();
      expect(within(warningsCard()).getByText('Ma’lumot kelmagan')).toBeTruthy();

      openTab(/Ogohlantirishlar/);
      await screen.findByText(/Holat kuni: —/);
      for (const title of [/^1\. /, /^2\. /, /^3\. /, /^4\. /]) {
        const section = screen.getByText(title).closest('section') as HTMLElement;
        expect(within(section).getByText('Ma’lumot kelmagan')).toBeTruthy();
      }
      expect(screen.getAllByText('Muammo yo‘q')).toHaveLength(1);
    },
    SLOW,
  );
});
