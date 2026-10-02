import { fireEvent, render, screen } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../../styles/theme';
import type * as SessionApi from '../../api/session-api';
import type { AttendanceContext } from '../../api/attendance-context';
import type { Program } from '../../api/types';
import AttendanceContextPanel from './index';

interface HookState {
  data?: AttendanceContext;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
}

const m = vi.hoisted(() => ({
  hook: vi.fn<(id: string | undefined, enabled?: boolean) => HookState>(),
}));

vi.mock('../../api/session-api', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionApi>()),
  useAttendanceContext: (id: string | undefined, enabled?: boolean) => m.hook(id, enabled),
}));

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

const CTX: AttendanceContext = {
  academicYear: '2026/2027',
  residentStatus: 'oquvda',
  unexcusedHours: 8,
  warningIssued: true,
  expulsionOrderCreated: true,
  sessions: { total: 8, present: 3, absent: 1, excused: 0, unmeasured: 2, pending: 2 },
  coverage: { measured: 4, denominator: 6, ratio: 4 / 6 },
};

const refetch = vi.fn(() => Promise.resolve());
const base: HookState = {
  isPending: false,
  isError: false,
  error: null,
  dataUpdatedAt: Date.parse('2026-10-01T05:00:00.000Z'),
  refetch,
};
const state = (over: Partial<HookState>) => m.hook.mockReturnValue({ ...base, ...over });
const withData = (over: Partial<AttendanceContext> = {}) => state({ data: { ...CTX, ...over } });

function draw(props: { program?: Program | null; compact?: boolean } = {}) {
  return render(
    <ThemeProvider theme={theme as unknown as DefaultTheme}>
      <AttendanceContextPanel
        residentId="r1"
        program={props.program ?? 'ordinatura'}
        compact={props.compact}
      />
    </ThemeProvider>,
  );
}

const text = () => document.body.textContent ?? '';

beforeEach(() => {
  m.hook.mockReset();
  refetch.mockClear();
});

describe('AttendanceContextPanel — holatlar', () => {
  it('yuklanmoqda', () => {
    state({ isPending: true });
    draw();
    expect(screen.getByRole('heading', { name: 'Davomat — joriy o‘quv yili' })).toBeTruthy();
    expect(text()).toContain('Yuklanmoqda…');
    expect(m.hook).toHaveBeenCalledWith('r1', true);
  });

  it('403 — ruxsat yo‘q (faqat panel ichida)', () => {
    state({ isError: true, error: httpError(403, { reason: 'resident_out_of_scope' }) });
    draw();
    expect(text()).toContain("Bu ma'lumotni ko'rish huquqingiz yo'q.");
  });

  it('404 resident_not_found — «Rezident topilmadi»', () => {
    state({ isError: true, error: httpError(404, { reason: 'resident_not_found' }) });
    draw();
    expect(screen.getByRole('status').textContent).toBe('Rezident topilmadi');
  });

  it('404 resident_not_found eski ma’lumotdan ustun — o‘chirilgan rezident raqami qolmaydi', () => {
    state({ data: CTX, isError: true, error: httpError(404, { reason: 'resident_not_found' }) });
    draw();
    expect(screen.getByRole('status').textContent).toBe('Rezident topilmadi');
    expect(text()).not.toContain('8 soat');
    expect(screen.queryByText('Ogohlantirish berilgan')).toBeNull();
  });

  it('xato — «Qayta urinish» refetch chaqiradi', () => {
    state({ isError: true, error: httpError(500) });
    draw();
    expect(text()).toContain("Ma'lumotni yuklab bo'lmadi.");
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('ma’lumot + qayta so‘rov xatosi — RefreshNotice, raqamlar qoladi (F4-Q9)', () => {
    state({ data: CTX, isError: true, error: httpError(500) });
    draw();
    expect(screen.getByRole('status').textContent).toMatch(/^Yangilab bo‘lmadi — /);
    expect(text()).toContain('8 soat');
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('AttendanceContextPanel — ma’lumot', () => {
  it('soat, ikkala server bayrog‘i, statik TZ matni, 5 holat sanog‘i, qamrov', () => {
    withData();
    draw();
    expect(
      screen.getByRole('heading', { name: 'Davomat — joriy o‘quv yili (2026/2027)' }),
    ).toBeTruthy();
    expect(text()).toContain('8 soat');
    expect(screen.getByText('Ogohlantirish berilgan')).toBeTruthy();
    expect(screen.getByText('Chetlatish loyihasi ochilgan')).toBeTruthy();
    expect(text()).toContain('6 soat — bildirgi, 72 soat — chetlatish buyrug‘i');
    for (const label of [
      'Keldi: 3',
      'Kelmadi: 1',
      'Sababli: 0',
      'O‘lchanmagan: 2',
      'Kutilmoqda: 2',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(text()).toContain('jami 8');
    expect(text()).toContain('67% (4 / 6)');
    expect(text()).toContain(
      'Barcha fanlar bo‘yicha · faqat ma’lumot — ball qo‘yishni cheklamaydi',
    );
  });

  it('bayroqlar FAQAT serverdan — 80 soat, bayroq false → nishon yo‘q (GCX-Q5)', () => {
    withData({ unexcusedHours: 80, warningIssued: false, expulsionOrderCreated: false });
    draw();
    expect(text()).toContain('80 soat');
    expect(screen.queryByText('Ogohlantirish berilgan')).toBeNull();
    expect(screen.queryByText('Chetlatish loyihasi ochilgan')).toBeNull();
  });

  it('ratio null → qamrov «—»', () => {
    withData({ coverage: { measured: 4, denominator: 6, ratio: null } });
    draw();
    expect(screen.getByText('Qamrov').nextElementSibling?.textContent).toBe('—');
  });

  it('jami 0 — «e’lon qilinmagan», lekin soat ko‘rinadi', () => {
    withData({
      sessions: { total: 0, present: 0, absent: 0, excused: 0, unmeasured: 0, pending: 0 },
      coverage: { measured: 0, denominator: 0, ratio: null },
    });
    draw();
    expect(text()).toContain('Joriy o‘quv yilida mashg‘ulot e’lon qilinmagan');
    expect(text()).toContain('8 soat');
    expect(screen.queryByText(/^Kelmadi:/)).toBeNull();
  });

  it('unmeasured > 0 — D-MODE izohi; 0 bo‘lsa yo‘q', () => {
    withData();
    const { unmount } = draw();
    expect(text()).toContain('O‘lchanmagan mashg‘ulot «kelmadi» hisoblanmaydi');
    unmount();
    withData({
      sessions: { total: 3, present: 1, absent: 1, excused: 1, unmeasured: 0, pending: 0 },
    });
    draw();
    expect(text()).not.toContain('O‘lchanmagan mashg‘ulot «kelmadi» hisoblanmaydi');
  });

  it('holat nishoni — faqat «o‘qimoqda» bo‘lmasa', () => {
    withData({ residentStatus: 'chetlatilgan' });
    const { unmount } = draw();
    expect(screen.getByText('Chetlatilgan')).toBeTruthy();
    unmount();
    withData();
    draw();
    expect(screen.queryByText("O'qimoqda")).toBeNull();
  });
});

describe('AttendanceContextPanel — magistrant va compact', () => {
  it('magistrant — izoh, hook enabled=false (so‘rov yo‘q)', () => {
    state({});
    draw({ program: 'magistratura' });
    expect(screen.getByRole('note').textContent).toBe(
      'Magistrantlar davomati tizimda kuzatilmaydi',
    );
    expect(m.hook).toHaveBeenCalledWith('r1', false);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('dastur noma’lum (null) — so‘rov yuboriladi', () => {
    state({ isPending: true });
    draw({ program: null });
    expect(m.hook).toHaveBeenCalledWith('r1', true);
  });

  it('compact — bitta qator xulosa, panel yo‘q', () => {
    withData();
    draw({ compact: true });
    expect(screen.getByRole('note', { name: 'Davomat xulosasi' }).textContent).toBe(
      'Davomat (2026/2027): sababsiz 8 soat · ogohlantirish berilgan · ' +
        'chetlatish loyihasi ochilgan · qamrov 67%',
    );
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it.each([
    [{ isPending: true }, 'Davomat: yuklanmoqda…'],
    [{ isError: true, error: httpError(403) }, 'Davomat: ko‘rish huquqi yo‘q'],
    [
      { isError: true, error: httpError(404, { reason: 'resident_not_found' }) },
      'Davomat: rezident topilmadi',
    ],
    [{ isError: true, error: httpError(502) }, 'Davomat: ma’lumotni yuklab bo‘lmadi'],
  ] as const)('compact holati %j → %s', (over, expected) => {
    state(over);
    draw({ compact: true });
    expect(screen.getByRole('note', { name: 'Davomat xulosasi' }).textContent).toBe(expected);
  });

  it('compact — ma’lumot + xato: xulosa qoladi, «yangilab bo‘lmadi» qo‘shiladi', () => {
    state({ data: CTX, isError: true, error: httpError(500) });
    draw({ compact: true });
    expect(screen.getByRole('note', { name: 'Davomat xulosasi' }).textContent).toMatch(
      /^Davomat \(2026\/2027\): sababsiz 8 soat .* \(yangilab bo‘lmadi\)$/,
    );
  });

  it('compact magistrant — izoh qatori', () => {
    state({});
    draw({ program: 'magistratura', compact: true });
    expect(screen.getByRole('note').textContent).toBe(
      'Magistrantlar davomati tizimda kuzatilmaydi',
    );
    expect(m.hook).toHaveBeenCalledWith('r1', false);
  });
});
