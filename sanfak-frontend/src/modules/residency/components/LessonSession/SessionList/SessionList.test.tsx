import { fireEvent, render, screen } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../../../styles/theme';
import { mapLessonSession, type BackendSession } from '../../../api/session-api';
import type { SessionListParams } from '../../../api/session-types';
import type * as SessionApi from '../../../api/session-api';
import type * as SharedUi from '@/shared/ui';
import SessionList from './index';

interface QueryLike {
  data: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

const m = vi.hoisted(() => ({
  canAnnounceSession: true,
  calls: [] as SessionListParams[],
  list: null as unknown as QueryLike,
}));

vi.mock('../../../lib/capabilities', () => ({
  useResidencyCapabilities: () => ({ isOffice: false, canAnnounceSession: m.canAnnounceSession }),
}));
vi.mock('../../../api/residency-api', () => ({
  useSciences: () => ({ data: [] }),
}));
vi.mock('../../../lib/session-groups', () => ({
  useSessionGroupOptions: () => ({
    options: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock('../../../api/session-api', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionApi>()),
  useLessonSessions: (params: SessionListParams) => {
    m.calls.push(params);
    return m.list;
  },
}));
vi.mock('../AnnounceModal', () => ({
  default: ({ onAnnounced }: { onAnnounced: (id: string | null) => void }) => (
    <button type="button" onClick={() => onAnnounced('new1')}>
      stub-e’lon
    </button>
  ),
}));
vi.mock('@/shared/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUi>()),
  DatePicker: (p: {
    value?: string | null;
    onChange?: (v: string | null) => void;
    'aria-label'?: string;
  }) => (
    <input
      aria-label={p['aria-label']}
      value={p.value ?? ''}
      onChange={(e) => p.onChange?.(e.target.value || null)}
    />
  ),
}));

const dto = (id: string, over: Partial<BackendSession> = {}): BackendSession => ({
  _id: id,
  day: '2026-09-27',
  science: { _id: 'sc1', title: 'Kardiologiya' },
  group: { _id: 'g1', title: 'ORD-101' },
  lessonType: 'amaliy',
  hours: 2,
  announcedBy: { _id: 'u1', lastName: 'Sobirov', firstName: 'Jasur' },
  status: 'announced',
  framedCount: 12,
  ...over,
});

const ok = (items: BackendSession[], totalPages = 1): QueryLike => ({
  data: { items: items.map(mapLessonSession), total: items.length, page: 1, totalPages },
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

const forbidden = (): QueryLike => ({
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: true,
  error: new AxiosError('xato', 'ERR', undefined, undefined, {
    status: 403,
    statusText: '',
    data: {},
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  }),
  refetch: vi.fn(),
});

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderList() {
  return render(
    <ConfigProvider>
      <AntdApp>
        <ThemeProvider theme={theme as unknown as DefaultTheme}>
          <MemoryRouter initialEntries={['/residency/davomat?tab=mashgulotlar']}>
            <Routes>
              <Route path="/residency/davomat" element={<SessionList />} />
              <Route path="/residency/davomat/mashgulot/:id" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </AntdApp>
    </ConfigProvider>,
  );
}

const RENDER_TIMEOUT_MS = 30_000;

beforeEach(() => {
  m.canAnnounceSession = true;
  m.calls = [];
  m.list = ok(
    [dto('s1'), dto('s2', { status: 'cancelled', cancelReason: 'Xato guruh', framedCount: 0 })],
    3,
  );
});

describe('SessionList', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('qatorlar: sana, o‘qituvchi, freymlar soni va holat', () => {
    renderList();
    expect(screen.getAllByText('27.09.2026')).toHaveLength(2);
    expect(screen.getAllByText('Sobirov Jasur')).toHaveLength(2);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('E’lon qilingan')).toBeInTheDocument();
    expect(screen.getByText('Bekor qilingan')).toBeInTheDocument();
    expect(m.calls.at(-1)).toEqual({
      page: 1,
      limit: 10,
      day: undefined,
      science: undefined,
      lessonType: undefined,
      group: undefined,
      status: undefined,
    });
  });

  it('«Ochish» — tafsilot sahifasiga', () => {
    renderList();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ochish' })[0]!);
    expect(screen.getByTestId('location')).toHaveTextContent('/residency/davomat/mashgulot/s1');
  });

  it('e’lon tugmasi faqat canAnnounceSession bilan', () => {
    m.canAnnounceSession = false;
    renderList();
    expect(screen.queryByRole('button', { name: /Mashg‘ulot e’lon qilish/ })).toBeNull();
  });

  it('e’londan keyin yangi sessiya tafsiloti ochiladi', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /Mashg‘ulot e’lon qilish/ }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-e’lon' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/residency/davomat/mashgulot/new1');
  });

  it('sahifa 2 → kun filtri 1-sahifaga qaytaradi va kunni yuboradi', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: '2-sahifa' }));
    expect(m.calls.at(-1)?.page).toBe(2);
    fireEvent.change(screen.getByLabelText('Sana'), { target: { value: '2026-09-27' } });
    expect(m.calls.at(-1)).toMatchObject({ page: 1, day: '2026-09-27' });
  });

  it('bo‘sh ro‘yxat: filtrsiz — «Hali mashg‘ulot e’lon qilinmagan»', () => {
    m.list = ok([]);
    renderList();
    expect(screen.getByText('Hali mashg‘ulot e’lon qilinmagan')).toBeInTheDocument();
  });

  it('403 — ruxsat yo‘qligi aytiladi, jadval chizilmaydi', () => {
    m.list = forbidden();
    renderList();
    expect(screen.getByText(/ko.rish huquqingiz yo.q/i)).toBeInTheDocument();
    expect(screen.queryByText('Hali mashg‘ulot e’lon qilinmagan')).toBeNull();
  });
});
