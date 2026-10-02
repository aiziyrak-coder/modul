import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import { mapExpulsionOrder, type BackendExpulsionOrder } from '../api/expulsion-order-mapper';
import type { ExpulsionOrderListParams } from '../api/expulsion-order-api';
import ChetlatishBuyruqlari from './ChetlatishBuyruqlari';

interface QueryLike {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

const m = vi.hoisted(() => ({
  calls: [] as ExpulsionOrderListParams[],
  list: null as unknown as QueryLike,
  probe: null as unknown as QueryLike,
}));

vi.mock('../api/expulsion-order-api', () => ({
  useExpulsionOrders: (params: ExpulsionOrderListParams) => {
    m.calls.push(params);
    return params.limit === 100 ? m.probe : m.list;
  },
}));

const dto = (id: string, over: Partial<BackendExpulsionOrder> = {}): BackendExpulsionOrder => ({
  _id: id,
  resident: { _id: `r-${id}`, fullName: `Rezident ${id}`, program: 'ordinatura', courseNumber: 1, status: 'oquvda', totalUnexcusedHours: 75 },
  origin: 'tizim',
  status: 'loyiha',
  countingYear: '2026-2027',
  draftedAt: '2026-09-20T03:00:00.000Z',
  hoursAtDraft: 72,
  ...over,
});

const ok = (items: BackendExpulsionOrder[], totalPages = 1): QueryLike => ({
  data: { items: items.map(mapExpulsionOrder), total: items.length, page: 1, totalPages },
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

const failed = (status: number): QueryLike => ({
  data: undefined,
  isLoading: false,
  isError: true,
  error: new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  }),
  refetch: vi.fn(),
});

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{location.pathname}</div>
      <div data-testid="location-state">{JSON.stringify(location.state)}</div>
    </>
  );
}

function SearchProbe() {
  return <div data-testid="search">{useLocation().search}</div>;
}

function renderPage(url = '/residency/chetlatish-buyruqlari') {
  return render(
    <ConfigProvider>
      <AntdApp>
        <ThemeProvider theme={theme as unknown as DefaultTheme}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route
                path="/residency/chetlatish-buyruqlari"
                element={
                  <>
                    <ChetlatishBuyruqlari />
                    <SearchProbe />
                  </>
                }
              />
              <Route path="/residency/chetlatish-buyruqlari/:id" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </AntdApp>
    </ConfigProvider>,
  );
}

const listCalls = () => m.calls.filter((c) => c.limit === 20);
const lastListCall = () => listCalls()[listCalls().length - 1];

async function pickOrigin(label: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Manba' }));
  const option = await waitFor(() => {
    const el = document.querySelector<HTMLElement>(`.ant-select-item-option[title="${label}"]`);
    if (!el) throw new Error(`variant yo'q: ${label}`);
    return el;
  });
  fireEvent.click(option);
}

const RENDER_TIMEOUT_MS = 30_000;

beforeEach(() => {
  m.calls = [];
  m.list = ok([dto('o1')], 3);
  m.probe = ok([]);
});

describe('ChetlatishBuyruqlari', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('standart: 1-sahifa, 20 ta, «Qaror kutilmoqda» (loyiha)', () => {
    renderPage();
    expect(listCalls()[0]).toEqual({ page: 1, limit: 20, status: 'loyiha' });
    expect(screen.getByRole('tab', { name: 'Qaror kutilmoqda' })).toHaveAttribute('aria-selected', 'true');
  });

  it('yarim imzo tekshiruvi — imzolangan, 1-sahifa, 100 ta', () => {
    renderPage();
    expect(m.calls).toContainEqual({ page: 1, limit: 100, status: 'imzolangan' });
  });

  it('«Barchasi» — status olib tashlanadi va sahifa 1 ga qaytadi', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '2-sahifa' }));
    expect(lastListCall()).toEqual({ page: 2, limit: 20, status: 'loyiha' });

    fireEvent.click(screen.getByRole('tab', { name: 'Barchasi' }));
    expect(lastListCall()).toEqual({ page: 1, limit: 20 });
    expect('status' in (lastListCall() ?? {})).toBe(false);
  });

  it('manba filtri — origin ketadi va sahifa 1 ga qaytadi; «barchasi» uni olib tashlaydi', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '2-sahifa' }));
    expect(lastListCall()).toEqual({ page: 2, limit: 20, status: 'loyiha' });

    await pickOrigin('Meros');
    expect(lastListCall()).toEqual({ page: 1, limit: 20, status: 'loyiha', origin: 'meros' });

    await pickOrigin('Manba — barchasi');
    expect(lastListCall()).toEqual({ page: 1, limit: 20, status: 'loyiha' });
    expect('origin' in (lastListCall() ?? {})).toBe(false);
  });

  it('yarim imzolangan buyruqlar soni ogohlantirishda; tugma imzolangan tabga o‘tkazadi', () => {
    m.probe = ok([
      dto('s1', { status: 'imzolangan', needsResume: true }),
      dto('s2', { status: 'imzolangan', needsResume: true }),
      dto('s3', { status: 'imzolangan', needsResume: false }),
    ]);
    renderPage();
    expect(screen.getByText(/2 ta buyruqning imzosi yakunlanmagan/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ko.rsatish/ }));
    expect(lastListCall()).toEqual({ page: 1, limit: 20, status: 'imzolangan' });
  });

  it('yarim imzo yo‘q — ogohlantirish yo‘q', () => {
    renderPage();
    expect(screen.queryByText(/imzosi yakunlanmagan/)).toBeNull();
  });

  it('qator bosilsa — buyruq tafsilotiga', () => {
    renderPage();
    fireEvent.click(screen.getByText('Rezident o1'));
    expect(screen.getByTestId('location')).toHaveTextContent('/residency/chetlatish-buyruqlari/o1');
  });

  it('havola URL‘i — tab, manba va sahifa URL‘dan o‘qiladi', () => {
    renderPage('/residency/chetlatish-buyruqlari?status=imzolangan&origin=meros&page=3');
    expect(listCalls()[0]).toEqual({ page: 3, limit: 20, status: 'imzolangan', origin: 'meros' });
    expect(screen.getByRole('tab', { name: 'Imzolangan' })).toHaveAttribute('aria-selected', 'true');
  });

  it('noma‘lum URL qiymati — standart (loyiha, 1-sahifa)', () => {
    renderPage('/residency/chetlatish-buyruqlari?status=chetlatilgan&page=abc');
    expect(listCalls()[0]).toEqual({ page: 1, limit: 20, status: 'loyiha' });
  });

  it('tab/sahifa/manba o‘zgarishi URL‘ga yoziladi (standartlar yozilmaydi)', async () => {
    renderPage();
    expect(screen.getByTestId('search').textContent).toBe('');

    fireEvent.click(screen.getByRole('button', { name: '2-sahifa' }));
    expect(screen.getByTestId('search').textContent).toBe('?page=2');

    fireEvent.click(screen.getByRole('tab', { name: 'Imzolangan' }));
    expect(screen.getByTestId('search').textContent).toBe('?status=imzolangan');

    await pickOrigin('Meros');
    expect(screen.getByTestId('search').textContent).toBe('?status=imzolangan&origin=meros');
  });

  it('tafsilotga o‘tishda ro‘yxat holati `state` bilan uzatiladi', () => {
    renderPage('/residency/chetlatish-buyruqlari?status=all&page=2');
    fireEvent.click(screen.getByText('Rezident o1'));
    expect(screen.getByTestId('location-state').textContent).toBe('{"listSearch":"status=all&page=2"}');
  });

  it('asosi yo‘qolgan imzolangan buyruq (U-7) — qatorda «Soat 72 dan tushgan»', () => {
    m.list = ok([
      dto('o3', { status: 'imzolangan', basisLostAt: '2026-09-26T03:00:00.000Z', hoursAtBasisLost: 70 }),
      dto('o4', { status: 'imzolangan' }),
    ]);
    renderPage('/residency/chetlatish-buyruqlari?status=imzolangan');
    expect(screen.getAllByText('Soat 72 dan tushgan')).toHaveLength(1);
  });

  it('holat, «Imzo yakunlanmagan» va «Skan» belgilari qatorda', () => {
    m.list = ok([
      dto('o2', {
        status: 'imzolangan',
        needsResume: true,
        scan: { fileName: 's.pdf', sha256: 'c'.repeat(64), size: 10 },
      }),
    ]);
    renderPage();
    expect(screen.getAllByText('Imzolangan').length).toBeGreaterThan(0);
    expect(screen.getByText('Imzo yakunlanmagan')).toBeInTheDocument();
    expect(screen.getByText('Skan')).toBeInTheDocument();
    expect(screen.getByText('72 → 75')).toBeInTheDocument();
  });

  it('bo‘sh ro‘yxat — «Buyruqlar yo‘q»', () => {
    m.list = ok([]);
    renderPage();
    expect(screen.getByText(/Buyruqlar yo.q/)).toBeInTheDocument();
  });

  it('403 — ruxsat yo‘qligi aniq aytiladi (bo‘sh jadval emas)', () => {
    m.list = failed(403);
    renderPage();
    expect(screen.getByText(/ko.rish huquqingiz yo.q/i)).toBeInTheDocument();
    expect(screen.queryByText(/Buyruqlar yo.q/)).toBeNull();
  });
});
