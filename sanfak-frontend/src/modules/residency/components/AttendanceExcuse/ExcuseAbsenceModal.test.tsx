import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import { AxiosError, AxiosHeaders } from 'axios';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedApi from '@/shared/api';
import { theme } from '../../styles/theme';
import type { Attendance } from '../../api/types';

const h = vi.hoisted(() => ({ putJson: vi.fn(), grants: [] as string[] }));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  putJson: h.putJson,
}));
vi.mock('@/app/session', () => ({
  usePermission: () => (key: string) => h.grants.includes(key),
}));

const { ExcuseAbsenceButton } = await import('./index');

const OFFICE = [
  'resident:read',
  'resident:readAll',
  'resident:create',
  'residencyReport:readAll',
  'residentAttendance:create',
  'residentAttendance:approve',
];
const KLINIK_USTOZ_PRE_A1 = [
  'resident:read',
  'resident:readAll',
  'resident:create',
  'residencyNotice:create',
  'residentAttendance:create',
  'residentAttendance:approve',
];

const REC: Attendance = {
  id: 'att-1',
  residentId: 'res-1',
  resident: {
    id: 'res-1',
    fullName: 'Karimov Jasur',
    program: 'ordinatura',
    specialtyTitle: 'Kardiologiya',
    departmentTitle: null,
    courseNumber: 1,
    groupId: null,
    groupTitle: null,
  },
  date: '2026-09-25T00:00:00.000Z',
  scienceId: 'sci-1',
  scienceTitle: 'Kardiologiya',
  lessonType: 'amaliy',
  teacherId: null,
  teacherName: null,
  groupId: null,
  status: 'absent',
  hours: 4,
  score: null,
  samsVerified: false,
  manualVerified: false,
  checkInTime: null,
  checkOutTime: null,
  late: false,
  lateMinutes: null,
  excuseReason: null,
  fromDate: null,
  toDate: null,
  application: null,
};

const BUTTON = { name: 'Karimov Jasur — 2026-09-25 — sababli qilish' };
const CONFIRM = { name: 'Sababli deb tasdiqlash' };
const DIALOG_TITLE = 'Darsni «Sababli» qilish';

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

function draw(record: Attendance = REC) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <ConfigProvider>
        <AntdApp>
          <ThemeProvider theme={theme as unknown as DefaultTheme}>
            <ExcuseAbsenceButton record={record} />
          </ThemeProvider>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const keys = (spy: ReturnType<typeof draw>['invalidate']) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);

const EXPECTED_KEYS = [
  ['residency-attendance'],
  ['residency-residents'],
  ['residency-assessments'],
  ['residency-sessions'],
  ['residency-expulsion-orders'],
  ['residency-notices', 'absence-streak'],
];

const reasonBox = () => screen.getByLabelText('Sabab *');
const type = (v: string) => fireEvent.change(reasonBox(), { target: { value: v } });

function openWith(reason: string) {
  fireEvent.click(screen.getByRole('button', BUTTON));
  type(reason);
  fireEvent.click(screen.getByRole('button', CONFIRM));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.grants = OFFICE;
});

describe('EXC — «Sababli qilish» tugmasi ko‘rinishi', () => {
  it('bo‘lim xodimi + «Kelmadi» qatori — tugma bor', () => {
    draw();
    expect(screen.getByRole('button', BUTTON)).toHaveAttribute('title', 'Sababli qilish');
  });

  it.each([
    ['present', 'Keldi'],
    ['excused', 'Sababli'],
  ] as const)('%s qatorida tugma yo‘q (%s)', (status, _label) => {
    draw({ ...REC, status });
    expect(screen.queryByRole('button', BUTTON)).toBeNull();
  });

  it.each([
    ['ruxsatsiz bo‘lim xodimi', OFFICE.filter((g) => g !== 'residentAttendance:approve')],
    ['klinik ustoz (A1 gacha `approve` bilan)', KLINIK_USTOZ_PRE_A1],
    ['faqat `approve`', ['residentAttendance:approve']],
  ])('%s — tugma yo‘q', (_label, grants) => {
    h.grants = grants;
    draw();
    expect(screen.queryByRole('button', BUTTON)).toBeNull();
  });

  it('oyna tugma bosilgandagina chiziladi', () => {
    draw();
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    fireEvent.click(screen.getByRole('button', BUTTON));
    expect(screen.getByText(DIALOG_TITLE)).toBeInTheDocument();
    expect(
      screen.getByText(/Karimov Jasur · 2026-09-25 · Kardiologiya · Amaliy · 4 soat/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tasdiqlangandan keyin tizimda qaytarib bo‘lmaydi/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sabab rezidentga ham ko‘rinadi/)).toBeInTheDocument();
  });
});

describe('EXC — sabab majburiy (2..500, bo‘shliqsiz)', () => {
  it.each(['', '   ', ' a '])('«%s» — tasdiq o‘chiq', (v) => {
    draw();
    fireEvent.click(screen.getByRole('button', BUTTON));
    type(v);
    expect(screen.getByRole('button', CONFIRM)).toBeDisabled();
  });

  it('2 belgi (bo‘shliqsiz) — tasdiq yoniq', () => {
    draw();
    fireEvent.click(screen.getByRole('button', BUTTON));
    type('  ab  ');
    expect(screen.getByRole('button', CONFIRM)).toBeEnabled();
  });
});

describe('EXC — yuborish', () => {
  it('PUT tanasi AYNAN {reason} (kesilgan); muvaffaqiyat — toast, yopiladi, 6 kalit yangilanadi', async () => {
    h.putJson.mockResolvedValueOnce({ message: 'Sabab tasdiqlandi' });
    const { invalidate } = draw();
    openWith('  Kasallik  ');

    expect(await screen.findByText('Dars «Sababli» deb belgilandi')).toBeInTheDocument();
    expect(h.putJson).toHaveBeenCalledTimes(1);
    expect(h.putJson).toHaveBeenCalledWith('/attendance/att-1/approve-excuse', {
      reason: 'Kasallik',
    });
    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).toBeNull());
    expect(keys(invalidate)).toEqual(expect.arrayContaining(EXPECTED_KEYS));
    expect(keys(invalidate)).toHaveLength(EXPECTED_KEYS.length);
  });

  it('kutish paytida tasdiq va «Yopish» o‘chiq — ikkinchi bosish ikkinchi PUT yubormaydi', async () => {
    h.putJson.mockReturnValueOnce(new Promise(() => {}));
    draw();
    openWith('Kasallik');

    await waitFor(() => expect(screen.getByRole('button', CONFIRM)).toBeDisabled());
    expect(screen.getByText('Yopish').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', CONFIRM));
    expect(h.putJson).toHaveBeenCalledTimes(1);
  });

  it('409 session_row_not_absent — maxsus matn, oyna yopiladi, keshlar baribir yangilanadi', async () => {
    h.putJson.mockRejectedValueOnce(
      httpError(409, {
        message: "Mashg'ulot yozuvi «kelmadi» holatida emas — sababli qilib bo'lmaydi",
        reason: 'session_row_not_absent',
      }),
    );
    const { invalidate } = draw();
    openWith('Kasallik');

    expect(
      await screen.findByText('Bu dars endi «Kelmadi» holatida emas — jadval yangilandi'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).toBeNull());
    expect(keys(invalidate)).toEqual(expect.arrayContaining(EXPECTED_KEYS));
  });

  it('403 — huquq matni, oyna OCHIQ qoladi (sabab saqlanadi)', async () => {
    h.putJson.mockRejectedValueOnce(httpError(403, { message: 'Forbidden' }));
    draw();
    openWith('Kasallik');

    expect(await screen.findByText('Sababli qilish huquqingiz yo‘q')).toBeInTheDocument();
    expect(screen.getByText(DIALOG_TITLE)).toBeInTheDocument();
    expect(reasonBox()).toHaveValue('Kasallik');
    expect(screen.getByRole('button', CONFIRM)).toBeEnabled();
  });
});
