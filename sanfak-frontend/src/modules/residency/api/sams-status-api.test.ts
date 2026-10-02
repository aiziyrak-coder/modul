import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAMS_QUERY_KEY,
  fetchSamsGrid,
  fetchSamsOutages,
  useCancelSamsOutage,
  useCreateSamsOutage,
  useSamsGrid,
  useSamsOutages,
  useSamsOverview,
} from './sams-status-api';
import { OUTAGE_ALL_CLINICS } from '../lib/sams-outage-draft';

const h = vi.hoisted(() => ({
  fetchOne: vi.fn(),
  fetchPaginated: vi.fn(),
  postJson: vi.fn(),
  putJson: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn() },
  fetchOne: h.fetchOne,
  fetchPaginated: h.fetchPaginated,
  postJson: h.postJson,
  putJson: h.putJson,
  fetchList: vi.fn(),
  patchJson: vi.fn(),
  deleteData: vi.fn(),
  uploadMultipart: vi.fn(),
}));

const DTO = {
  _id: '66f0c0ffee0000000000abcd',
  from: '2026-09-20',
  to: '2026-09-22',
  dbname: null,
  orgTitle: null,
  reason: 'SAMS serveri ishlamadi',
  createdBy: { firstName: 'Vali', lastName: 'Aliyev' },
  createdAt: '2026-09-23T05:00:00.000Z',
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
};

const httpError = (status: number) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { invalidate, wrapper };
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
});

describe('o‘qish yo‘llari', () => {
  it('overview — `/residency-sams-status/overview`, parametrsiz', async () => {
    h.fetchOne.mockResolvedValue({ today: '2026-09-27' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSamsOverview(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.fetchOne).toHaveBeenCalledWith('/residency-sams-status/overview');
    expect(result.current.data?.today).toBe('2026-09-27');
  });

  it('jadval — `/days` from/to bilan; oyna yo‘q bo‘lsa so‘rov YO‘Q', async () => {
    h.fetchOne.mockResolvedValue({ clinics: [] });
    await fetchSamsGrid({ from: '2026-09-14', to: '2026-09-27' });
    expect(h.fetchOne).toHaveBeenCalledWith('/residency-sams-status/days', {
      from: '2026-09-14',
      to: '2026-09-27',
    });

    h.fetchOne.mockClear();
    const { wrapper } = setup();
    renderHook(() => useSamsGrid(null), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(h.fetchOne).not.toHaveBeenCalled();
  });

  it('403 qayta so‘ralmaydi', async () => {
    h.fetchOne.mockRejectedValue(httpError(403));
    const { wrapper } = setup();
    const { result } = renderHook(() => useSamsOverview(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(h.fetchOne).toHaveBeenCalledTimes(1);
  });
});

describe('60 s so‘rovi — faqat sahifa ko‘rinib turganda', () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  async function expectPolledWhileVisible(spy: typeof h.fetchOne, mount: () => void) {
    vi.useFakeTimers();
    mount();
    await vi.advanceTimersByTimeAsync(10);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(spy).toHaveBeenCalledTimes(2);
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(spy).toHaveBeenCalledTimes(2);
  }

  const RANGE = { from: '2026-09-14', to: '2026-09-27' };
  const EMPTY_PAGE = { docs: [], totalDocs: 0, page: 1, totalPages: 1, hasNextPage: false };

  it('overview — ko‘rinib turganda har 60 s; fonda (focus yo‘q) — so‘rov YO‘Q', async () => {
    h.fetchOne.mockResolvedValue({ today: '2026-09-27' });
    const { wrapper } = setup();
    await expectPolledWhileVisible(h.fetchOne, () =>
      renderHook(() => useSamsOverview(), { wrapper }),
    );
  });

  it('jadval (/days) — xuddi shunday', async () => {
    h.fetchOne.mockResolvedValue({ clinics: [] });
    const { wrapper } = setup();
    await expectPolledWhileVisible(h.fetchOne, () =>
      renderHook(() => useSamsGrid(RANGE), { wrapper }),
    );
  });

  it('F4-Q17: jadval ustidagi uzilish qatlami (`poll`) — xuddi shunday', async () => {
    h.fetchPaginated.mockResolvedValue(EMPTY_PAGE);
    const { wrapper } = setup();
    const params = { page: 1, limit: 100, status: 'active' as const, ...RANGE };
    await expectPolledWhileVisible(h.fetchPaginated, () =>
      renderHook(() => useSamsOutages(params, { poll: true }), { wrapper }),
    );
  });

  it('ro‘yxat tabi (`poll` yo‘q) — 60 s da so‘ralmaydi', async () => {
    vi.useFakeTimers();
    h.fetchPaginated.mockResolvedValue(EMPTY_PAGE);
    const { wrapper } = setup();
    renderHook(() => useSamsOutages({ page: 1, limit: 20, status: 'active' }), { wrapper });
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(h.fetchPaginated).toHaveBeenCalledTimes(1);
  });
});

describe('o‘qish — uzilish oynalari', () => {
  it('uzilishlar — `/paginate`, bo‘sh from/to yuborilmaydi, hasNextPage o‘tadi', async () => {
    h.fetchPaginated.mockResolvedValue({
      docs: [DTO],
      totalDocs: 1,
      page: 1,
      totalPages: 1,
      hasNextPage: true,
    });
    const page = await fetchSamsOutages({ page: 1, limit: 20, status: 'active' });
    expect(h.fetchPaginated).toHaveBeenCalledWith('/residency-sams-outages/paginate', {
      page: 1,
      limit: 20,
      status: 'active',
    });
    expect(page.hasNextPage).toBe(true);
    expect(page.items[0]?.id).toBe(DTO._id);

    await fetchSamsOutages({
      page: 1,
      limit: 100,
      status: 'active',
      from: '2026-09-14',
      to: '2026-09-27',
    });
    expect(h.fetchPaginated).toHaveBeenLastCalledWith('/residency-sams-outages/paginate', {
      page: 1,
      limit: 100,
      status: 'active',
      from: '2026-09-14',
      to: '2026-09-27',
    });
  });
});

describe('yozish', () => {
  it('e‘lon — POST tanasi AYNAN 4 kalit, keyin prefiks yangilanadi', async () => {
    h.postJson.mockResolvedValue(DTO);
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useCreateSamsOutage(), { wrapper });
    await result.current.mutateAsync({
      from: '2026-09-20',
      to: '2026-09-22',
      dbname: OUTAGE_ALL_CLINICS,
      reason: '  Uzildi  ',
    });
    expect(h.postJson).toHaveBeenCalledWith('/residency-sams-outages', {
      from: '2026-09-20',
      to: '2026-09-22',
      dbname: null,
      reason: 'Uzildi',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [SAMS_QUERY_KEY] });
  });

  function holdInvalidate(invalidate: ReturnType<typeof setup>['invalidate']) {
    let release: () => void = () => undefined;
    invalidate.mockImplementation(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    return () => release();
  }

  async function expectPending(p: Promise<unknown>) {
    let done = false;
    void p.then(
      () => (done = true),
      () => (done = true),
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(done).toBe(false);
  }

  it('e‘lon — `mutateAsync` yangilanish tugaguncha kutadi (modal eski qatlamda yopilmaydi)', async () => {
    h.postJson.mockResolvedValue(DTO);
    const { wrapper, invalidate } = setup();
    const release = holdInvalidate(invalidate);
    const { result } = renderHook(() => useCreateSamsOutage(), { wrapper });
    const draft = {
      from: '2026-09-20',
      to: '2026-09-22',
      dbname: OUTAGE_ALL_CLINICS,
      reason: 'Uzildi',
    };
    const p = result.current.mutateAsync(draft);
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    await expectPending(p);
    release();
    await expect(p).resolves.toBeTruthy();
  });

  it('bekor — xatoda ham yangilanish tugaguncha kutadi', async () => {
    h.putJson.mockRejectedValue(httpError(409));
    const { wrapper, invalidate } = setup();
    const release = holdInvalidate(invalidate);
    const { result } = renderHook(() => useCancelSamsOutage(), { wrapper });
    const p = result.current.mutateAsync({ id: 'o1', reason: 'Xato' });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    await expectPending(p);
    release();
    await expect(p).rejects.toBeTruthy();
  });

  it('bekor — PUT /:id/cancel {reason}; 409 da HAM yangilanadi', async () => {
    h.putJson.mockRejectedValue(httpError(409));
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useCancelSamsOutage(), { wrapper });
    await expect(result.current.mutateAsync({ id: 'o1', reason: ' Xato ' })).rejects.toBeTruthy();
    expect(h.putJson).toHaveBeenCalledWith('/residency-sams-outages/o1/cancel', { reason: 'Xato' });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: [SAMS_QUERY_KEY] }));
  });
});
