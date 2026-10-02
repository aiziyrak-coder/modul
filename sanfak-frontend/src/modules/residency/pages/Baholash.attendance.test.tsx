import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import type * as ResidencyApi from '../api/residency-api';
import Baholash from './Baholash';

const h = vi.hoisted(() => ({
  can: vi.fn<(key: string) => boolean>(),
  fetchOne: vi.fn<(url: string) => Promise<unknown>>(),
  grade: vi.fn<(p: unknown) => Promise<unknown>>(),
}));

vi.mock('@/app/session', () => ({ usePermission: () => h.can }));

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn() },
  fetchPaginated: vi.fn(),
  fetchOne: h.fetchOne,
  postJson: vi.fn(),
  putJson: vi.fn(),
  fetchList: vi.fn(),
  patchJson: vi.fn(),
  deleteData: vi.fn(),
  uploadMultipart: vi.fn(),
  getApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

interface Opt {
  value: string;
  label: string;
}

vi.mock('@/shared/ui', () => ({
  App: { useApp: () => ({ message: { success: vi.fn(), error: vi.fn() } }) },
  Input: (p: { value?: string; placeholder?: string; onChange?: (e: unknown) => void }) => (
    <input placeholder={p.placeholder} value={p.value} onChange={p.onChange} />
  ),
  Select: (p: { value?: string; options: Opt[]; onChange?: (v: string) => void }) => (
    <select
      aria-label={p.options[0]?.label}
      value={p.value}
      onChange={(e) => p.onChange?.(e.target.value)}
    >
      {p.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../components/common/NumberField', () => ({
  NumberField: (p: {
    placeholder?: string;
    value?: number | null;
    onChange?: (v: number | null) => void;
  }) => (
    <input
      placeholder={p.placeholder ?? 'Maksimal'}
      value={p.value ?? ''}
      onChange={(e) => p.onChange?.(e.target.value === '' ? null : Number(e.target.value))}
    />
  ),
}));

vi.mock('../lib/capabilities', () => ({
  useResidencyCapabilities: () => ({ isMentor: false }),
}));

const RESIDENTS = [
  { id: 'r1', fullName: 'Aliyev Vali', program: 'ordinatura' },
  { id: 'r2', fullName: 'Karimova Zarina', program: 'ordinatura' },
  { id: 'm1', fullName: 'Sobirov Jasur', program: 'magistratura' },
];

const ELIGIBILITY = {
  eligible: false,
  reasons: [],
  warningTriggered: false,
  expulsionTriggered: false,
  details: {
    attendance: { totalRecords: 4, unexcusedHours: 14 },
    dailyLog: { total: 4, approved: 2, approvalRatio: 0.5 },
    assessment: { interimCount: 1, avgScore: 80 },
  },
};

let eligibilityBody: object = ELIGIBILITY;

vi.mock('../api/residency-api', async (importOriginal) => ({
  ...(await importOriginal<typeof ResidencyApi>()),
  useResidents: (p: { program?: string }) => {
    const items = RESIDENTS.filter((r) => !p.program || r.program === p.program);
    return { data: { items, total: items.length } };
  },
  useMyResidents: () => ({ data: [] }),
  useSciences: () => ({ data: [{ id: 'sc1', title: 'Kardiologiya' }] }),
  useResidentAssessments: () => ({ data: [], isLoading: false }),
  useAttestationEligibility: (id: string | undefined) => ({
    data: id ? eligibilityBody : undefined,
  }),
  useGradeAssessment: () => ({ mutateAsync: h.grade, isPending: false }),
  useDeleteAssessment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

const contextBody = (hours: number) => ({
  resident: {
    _id: 'x',
    status: 'oquvda',
    totalUnexcusedHours: hours,
    warningIssued: hours >= 6,
    expulsionOrderCreated: false,
  },
  academicYear: '2026/2027',
  sessions: { total: 3, present: 1, absent: 1, excused: 1, unmeasured: 0, pending: 0 },
  coverage: { measured: 3, ratio: 1 },
});

const contextCalls = () =>
  h.fetchOne.mock.calls.filter(([url]) => String(url).includes('attendance-context'));

const PANEL_HEADING = /^Davomat — joriy o‘quv yili/;

function draw() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const Wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme as unknown as DefaultTheme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
  return render(<Baholash />, { wrapper: Wrap });
}

const pickResident = (id: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: '— Talabani tanlang —' }), {
    target: { value: id },
  });

const gradeButton = () => screen.getByRole('button', { name: /Ball qo‘yish/ });

function grantAll(withAttendance: boolean) {
  h.can.mockImplementation((key) =>
    key === 'residentAttendance:readAll' ? withAttendance : key === 'residentAssessment:score',
  );
}

beforeEach(() => {
  h.can.mockReset();
  h.fetchOne.mockReset();
  h.grade.mockReset();
  h.grade.mockResolvedValue({});
  eligibilityBody = ELIGIBILITY;
});

describe('Baholash — davomat paneli ruxsati (GCX-Q3)', () => {
  it('ruxsatsiz (ilmiy rahbar) — panel yo‘q, oynada qator yo‘q, so‘rov YUBORILMAYDI', async () => {
    grantAll(false);
    draw();
    pickResident('r1');
    fireEvent.click(gradeButton());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole('heading', { name: PANEL_HEADING })).toBeNull();
    expect(screen.queryByRole('note', { name: 'Davomat xulosasi' })).toBeNull();
    expect(contextCalls()).toHaveLength(0);
  });

  it('ruxsat bilan — rezident tanlanganda panel va raqamlar', async () => {
    grantAll(true);
    h.fetchOne.mockResolvedValue(contextBody(8));
    draw();
    expect(screen.queryByRole('heading', { name: PANEL_HEADING })).toBeNull();
    pickResident('r1');
    expect(
      await screen.findByRole('heading', { name: 'Davomat — joriy o‘quv yili (2026/2027)' }),
    ).toBeTruthy();
    expect(await screen.findByText('8 soat')).toBeTruthy();
    expect(contextCalls()).toEqual([['/residency-sessions/residents/r1/attendance-context']]);
  });

  it('magistrant — izoh, so‘rov YUBORILMAYDI (GCX-Q4)', async () => {
    grantAll(true);
    draw();
    pickResident('m1');
    expect(screen.getByText('Magistrantlar davomati tizimda kuzatilmaydi')).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(contextCalls()).toHaveLength(0);
  });

  it('magistrant piker filtri bilan ro‘yxatdan chiqsa ham so‘rov YUBORILMAYDI (GCX-Q4)', async () => {
    grantAll(true);
    draw();
    pickResident('m1');
    fireEvent.change(screen.getByRole('combobox', { name: 'Barcha dastur' }), {
      target: { value: 'ordinatura' },
    });
    expect(screen.queryByRole('option', { name: 'Sobirov Jasur' })).toBeNull();
    expect(screen.getByText('Magistrantlar davomati tizimda kuzatilmaydi')).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(contextCalls()).toHaveLength(0);
  });
});

describe('🔴 Baholash — panel ball qo‘yishni to‘smaydi (D-GRADE, GCX-Q3)', () => {
  it.each([
    [
      '403',
      () => Promise.reject(httpError(403, { reason: 'resident_out_of_scope' })),
      "Bu ma'lumotni ko'rish huquqingiz yo'q.",
      'Davomat: ko‘rish huquqi yo‘q',
    ],
    [
      '500',
      () => Promise.reject(httpError(500)),
      "Ma'lumotni yuklab bo'lmadi.",
      'Davomat: ma’lumotni yuklab bo‘lmadi',
    ],
    ['yuklanmoqda', () => new Promise<never>(() => {}), 'Yuklanmoqda…', 'Davomat: yuklanmoqda…'],
  ] as const)(
    'kontekst %s — tugma faol, oyna ochiladi, Saqlash ishlaydi',
    async (_k, reply, panel, line) => {
      grantAll(true);
      h.fetchOne.mockImplementation(reply);
      draw();
      pickResident('r1');
      expect(await screen.findByText(panel)).toBeTruthy();

      expect((gradeButton() as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(gradeButton());
      await waitFor(() =>
        expect(screen.getByRole('note', { name: 'Davomat xulosasi' }).textContent).toBe(line),
      );
      fireEvent.change(screen.getByPlaceholderText('Masalan: 85'), { target: { value: '85' } });
      const save = screen.getByRole('button', { name: 'Saqlash' }) as HTMLButtonElement;
      expect(save.disabled).toBe(false);
      fireEvent.click(save);

      await waitFor(() => expect(h.grade).toHaveBeenCalledTimes(1));
      expect(h.grade).toHaveBeenCalledWith({
        residentId: 'r1',
        scienceId: null,
        type: 'oraliq',
        score: 85,
        maxScore: 100,
      });
    },
  );
});

describe('Baholash — oyna qatori, rezident almashishi, ruxsat kartasi', () => {
  it('GradeModal ixcham qatori — sahifa bilan bir kalit, qo‘shimcha so‘rov yo‘q (GCX-Q1)', async () => {
    grantAll(true);
    h.fetchOne.mockResolvedValue(contextBody(8));
    draw();
    pickResident('r1');
    await screen.findByText('8 soat');
    fireEvent.click(gradeButton());
    expect(screen.getByRole('note', { name: 'Davomat xulosasi' }).textContent).toBe(
      'Davomat (2026/2027): sababsiz 8 soat · ogohlantirish berilgan · qamrov 100%',
    );
    expect(contextCalls()).toHaveLength(1);
  });

  it('rezident almashganda eski raqamlar KO‘RINMAYDI — yuklanmoqda (GCX-Q7)', async () => {
    grantAll(true);
    let releaseR2: (v: unknown) => void = () => {};
    h.fetchOne.mockImplementation((url) =>
      url.includes('/r2/')
        ? new Promise((resolve) => {
            releaseR2 = resolve;
          })
        : Promise.resolve(contextBody(8)),
    );
    draw();
    pickResident('r1');
    await screen.findByText('8 soat');

    pickResident('r2');
    await waitFor(() => expect(contextCalls()).toHaveLength(2));
    expect(screen.queryByText('8 soat')).toBeNull();
    expect(screen.getByText('Yuklanmoqda…')).toBeTruthy();

    await act(async () => {
      releaseR2(contextBody(2));
    });
    expect(await screen.findByText('2 soat')).toBeTruthy();
    expect(screen.queryByText('8 soat')).toBeNull();
  });

  it('ruxsat kartasidagi soat «barcha yillar» deb yoziladi (GCX-Q6)', () => {
    grantAll(true);
    h.fetchOne.mockResolvedValue(contextBody(8));
    draw();
    pickResident('r1');
    expect(document.body.textContent).toContain('Sababsiz soat (barcha yillar): 14');
  });

  it('`window` bilan (ATW backend) — «joriy o‘quv yili, 2026/2027» (ATW-Q7)', () => {
    grantAll(true);
    h.fetchOne.mockResolvedValue(contextBody(8));
    eligibilityBody = {
      ...ELIGIBILITY,
      details: {
        ...ELIGIBILITY.details,
        attendance: {
          ...ELIGIBILITY.details.attendance,
          window: {
            source: 'academicYear',
            academicYear: '2026/2027',
            from: '2026-09-01T00:00:00.000Z',
            to: '2027-08-31T23:59:59.000Z',
          },
        },
      },
    };
    draw();
    pickResident('r1');
    const text = document.body.textContent ?? '';
    expect(text).toContain('Sababsiz soat (joriy o‘quv yili, 2026/2027): 14');
    expect(text).not.toContain('barcha yillar');
  });
});
