import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapAttendanceContext } from './attendance-context';
import { useReviewApplication } from './residency-api';
import { SESSION_KEY, useAttendanceContext } from './session-api';

const h = vi.hoisted(() => ({ fetchOne: vi.fn(), putJson: vi.fn() }));

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn() },
  fetchPaginated: vi.fn(),
  fetchOne: h.fetchOne,
  postJson: vi.fn(),
  putJson: h.putJson,
  fetchList: vi.fn(),
  patchJson: vi.fn(),
  deleteData: vi.fn(),
  uploadMultipart: vi.fn(),
}));

const CONTRACT_SAMPLE = {
  resident: {
    _id: 'r1',
    status: 'oquvda',
    totalUnexcusedHours: 8,
    warningIssued: true,
    expulsionOrderCreated: false,
  },
  academicYear: '2026/2027',
  sessions: { total: 3, present: 1, absent: 1, excused: 1, unmeasured: 0, pending: 0 },
  coverage: { measured: 3, ratio: 1 },
};

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

describe('mapAttendanceContext — kontrakt namunasi', () => {
  it('API-CONTRACT §29.1 namunasi → domen', () => {
    expect(mapAttendanceContext(CONTRACT_SAMPLE)).toEqual({
      academicYear: '2026/2027',
      residentStatus: 'oquvda',
      unexcusedHours: 8,
      warningIssued: true,
      expulsionOrderCreated: false,
      sessions: { total: 3, present: 1, absent: 1, excused: 1, unmeasured: 0, pending: 0 },
      coverage: { measured: 3, denominator: 3, ratio: 1 },
    });
  });

  it('`resident._id` natijaga chiqmaydi', () => {
    const out = mapAttendanceContext(CONTRACT_SAMPLE);
    expect(JSON.stringify(out)).not.toContain('_id');
    expect(JSON.stringify(out)).not.toContain('"r1"');
  });

  it('maxraj = total − pending; `pending` bor bo‘lsa ham ratio server qiymati', () => {
    const out = mapAttendanceContext({
      ...CONTRACT_SAMPLE,
      sessions: { total: 8, present: 3, absent: 1, excused: 0, unmeasured: 2, pending: 2 },
      coverage: { measured: 4, ratio: 4 / 6 },
    });
    expect(out.coverage).toEqual({ measured: 4, denominator: 6, ratio: 4 / 6 });
  });

  it('`0` soat — haqiqiy qiymat (null emas)', () => {
    const out = mapAttendanceContext({
      ...CONTRACT_SAMPLE,
      resident: { ...CONTRACT_SAMPLE.resident, totalUnexcusedHours: 0 },
    });
    expect(out.unexcusedHours).toBe(0);
  });
});

describe('mapAttendanceContext — buzuq / yetishmagan kalitlar', () => {
  it.each([undefined, null, 'x', 42, [], {}])('tana %j → hamma narsa null/false', (body) => {
    expect(mapAttendanceContext(body)).toEqual({
      academicYear: null,
      residentStatus: null,
      unexcusedHours: null,
      warningIssued: false,
      expulsionOrderCreated: false,
      sessions: null,
      coverage: null,
    });
  });

  it.each(['total', 'present', 'absent', 'excused', 'unmeasured', 'pending'] as const)(
    'BIRORTA sanoq (%s) yo‘q → sessions null (nolga to‘ldirilmaydi)',
    (key) => {
      const sessions: Record<string, unknown> = { ...CONTRACT_SAMPLE.sessions };
      delete sessions[key];
      const out = mapAttendanceContext({ ...CONTRACT_SAMPLE, sessions });
      expect(out.sessions).toBeNull();
      expect(out.coverage).toBeNull();
    },
  );

  it.each([['2'], [-1], [1.5], [Number.NaN], [null]])(
    'sanoq %j (son emas / manfiy / kasr) → sessions null',
    (bad) => {
      const out = mapAttendanceContext({
        ...CONTRACT_SAMPLE,
        sessions: { ...CONTRACT_SAMPLE.sessions, absent: bad },
      });
      expect(out.sessions).toBeNull();
    },
  );

  it.each([[-0.1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], ['1'], [null]])(
    'ratio %j → null (measured saqlanadi)',
    (ratio) => {
      const out = mapAttendanceContext({ ...CONTRACT_SAMPLE, coverage: { measured: 3, ratio } });
      expect(out.coverage).toEqual({ measured: 3, denominator: 3, ratio: null });
    },
  );

  it('maxraj 0 (hammasi pending) → ratio null', () => {
    const out = mapAttendanceContext({
      ...CONTRACT_SAMPLE,
      sessions: { total: 2, present: 0, absent: 0, excused: 0, unmeasured: 0, pending: 2 },
      coverage: { measured: 0, ratio: 0 },
    });
    expect(out.coverage).toEqual({ measured: 0, denominator: 0, ratio: null });
  });

  it('measured yo‘q → coverage null', () => {
    const out = mapAttendanceContext({ ...CONTRACT_SAMPLE, coverage: { ratio: 1 } });
    expect(out.coverage).toBeNull();
  });

  it.each([['true'], [1], ['yes'], [null]])('bayroq %j → false (faqat aynan true)', (flag) => {
    const out = mapAttendanceContext({
      ...CONTRACT_SAMPLE,
      resident: { status: 'oquvda', warningIssued: flag, expulsionOrderCreated: flag },
    });
    expect(out.warningIssued).toBe(false);
    expect(out.expulsionOrderCreated).toBe(false);
  });

  it.each([[-2], [Number.NaN], ['8'], [Number.POSITIVE_INFINITY]])('soat %j → null', (v) => {
    const out = mapAttendanceContext({
      ...CONTRACT_SAMPLE,
      resident: { ...CONTRACT_SAMPLE.resident, totalUnexcusedHours: v },
    });
    expect(out.unexcusedHours).toBeNull();
  });

  it('bo‘sh o‘quv yili / holat satri → null', () => {
    const out = mapAttendanceContext({
      ...CONTRACT_SAMPLE,
      academicYear: '',
      resident: { ...CONTRACT_SAMPLE.resident, status: 7 },
    });
    expect(out.academicYear).toBeNull();
    expect(out.residentStatus).toBeNull();
  });
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

const contextCalls = () =>
  h.fetchOne.mock.calls.filter(([url]) => String(url).includes('attendance-context'));

describe('useAttendanceContext — yagona seam va darvoza (GCX-Q3/Q7)', () => {
  beforeEach(() => {
    h.fetchOne.mockReset();
  });

  it('yo‘l `/residency-sessions/residents/:id/attendance-context`, natija mapperdan', async () => {
    h.fetchOne.mockResolvedValue(CONTRACT_SAMPLE);
    const { wrapper } = setup();
    const { result } = renderHook(() => useAttendanceContext('r1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.fetchOne).toHaveBeenCalledTimes(1);
    expect(h.fetchOne).toHaveBeenCalledWith('/residency-sessions/residents/r1/attendance-context');
    expect(result.current.data?.unexcusedHours).toBe(8);
    expect(JSON.stringify(result.current.data)).not.toContain('_id');
  });

  it('enabled=false → so‘rov YUBORILMAYDI', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAttendanceContext('r1', false), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe('idle');
    expect(h.fetchOne).not.toHaveBeenCalled();
  });

  it('residentId yo‘q → so‘rov YUBORILMAYDI', async () => {
    const { wrapper } = setup();
    renderHook(() => useAttendanceContext(undefined), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(h.fetchOne).not.toHaveBeenCalled();
  });

  it.each([
    [403, { reason: 'resident_out_of_scope' }],
    [404, { reason: 'resident_not_found' }],
  ])('%i → aynan bitta so‘rov (qayta urinilmaydi)', async (status, data) => {
    h.fetchOne.mockRejectedValue(httpError(status, data));
    const { wrapper } = setup();
    const { result } = renderHook(() => useAttendanceContext('r1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(contextCalls()).toHaveLength(1);
  });

  it('500 → bir marta qayta uriniladi (jami 2 so‘rov)', async () => {
    h.fetchOne.mockRejectedValue(httpError(500));
    const { wrapper } = setup();
    const { result } = renderHook(() => useAttendanceContext('r1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(contextCalls()).toHaveLength(2);
  });

  it('kalit `SESSION_KEY` ostida — sessiya invalidatsiyasi uni ham yangilaydi', async () => {
    h.fetchOne.mockResolvedValue(CONTRACT_SAMPLE);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useAttendanceContext('r1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.unexcusedHours).toBe(8);
    expect(client.getQueryData([SESSION_KEY, 'attendance-context', 'r1'])).toBeDefined();

    h.fetchOne.mockResolvedValue({
      ...CONTRACT_SAMPLE,
      resident: { ...CONTRACT_SAMPLE.resident, totalUnexcusedHours: 2 },
    });
    await client.invalidateQueries({ queryKey: [SESSION_KEY] });
    await waitFor(() => expect(result.current.data?.unexcusedHours).toBe(2));
    expect(contextCalls()).toHaveLength(2);
  });

  it('ariza ko‘rib chiqilgach kontekst qayta o‘qiladi (useReviewApplication)', async () => {
    h.fetchOne.mockResolvedValue(CONTRACT_SAMPLE);
    h.putJson.mockResolvedValue({});
    const { wrapper } = setup();
    const ctx = renderHook(() => useAttendanceContext('r1'), { wrapper });
    await waitFor(() => expect(ctx.result.current.data?.unexcusedHours).toBe(8));

    h.fetchOne.mockResolvedValue({
      ...CONTRACT_SAMPLE,
      resident: { ...CONTRACT_SAMPLE.resident, totalUnexcusedHours: 2 },
    });
    const review = renderHook(() => useReviewApplication(), { wrapper });
    await act(() =>
      review.result.current.mutateAsync({ id: 'a1', data: { status: 'tasdiqlangan' } }),
    );
    await waitFor(() => expect(ctx.result.current.data?.unexcusedHours).toBe(2));
    expect(contextCalls()).toHaveLength(2);
  });
});
