import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttestationEligibility, useReviewApplication } from './residency-api';

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

const WINDOW = {
  source: 'academicYear',
  academicYear: '2026/2027',
  from: '2026-09-01T00:00:00.000Z',
  to: '2027-08-31T23:59:59.000Z',
};

const body = (unexcusedHours: number) => ({
  eligible: unexcusedHours < 72,
  reasons: [],
  warningTriggered: unexcusedHours >= 6,
  expulsionTriggered: unexcusedHours >= 72,
  details: {
    attendance: { totalRecords: 4, unexcusedHours, window: WINDOW },
    dailyLog: { total: 4, approved: 2, approvalRatio: 0.5 },
    assessment: { interimCount: 1, avgScore: 80 },
  },
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

const eligibilityCalls = () =>
  h.fetchOne.mock.calls.filter(([url]) => String(url).endsWith('/eligibility'));

beforeEach(() => {
  h.fetchOne.mockReset();
  h.putJson.mockReset();
});

describe('useAttestationEligibility — yo‘l va xom javob (ATW-Q5)', () => {
  it('yo‘l `/assessments/resident/:id/eligibility`, `window` saqlanadi', async () => {
    h.fetchOne.mockResolvedValue(body(14));
    const { wrapper } = setup();
    const { result } = renderHook(() => useAttestationEligibility('r1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.fetchOne).toHaveBeenCalledWith('/assessments/resident/r1/eligibility');
    expect(result.current.data?.details.attendance.window).toEqual(WINDOW);
  });

  it('residentId yo‘q → so‘rov YUBORILMAYDI', async () => {
    const { wrapper } = setup();
    renderHook(() => useAttestationEligibility(undefined), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(h.fetchOne).not.toHaveBeenCalled();
  });
});

describe('useReviewApplication — ruxsat kartasi yangilanadi (ATW-Q8)', () => {
  it('ariza ko‘rib chiqilgach karta qayta o‘qiladi', async () => {
    h.fetchOne.mockResolvedValue(body(14));
    h.putJson.mockResolvedValue({});
    const { wrapper } = setup();
    const card = renderHook(() => useAttestationEligibility('r1'), { wrapper });
    await waitFor(() => expect(card.result.current.data?.details.attendance.unexcusedHours).toBe(14));

    h.fetchOne.mockResolvedValue(body(4));
    const review = renderHook(() => useReviewApplication(), { wrapper });
    await act(() =>
      review.result.current.mutateAsync({ id: 'a1', data: { status: 'tasdiqlangan' } }),
    );
    await waitFor(() => expect(card.result.current.data?.details.attendance.unexcusedHours).toBe(4));
    expect(eligibilityCalls()).toEqual([
      ['/assessments/resident/r1/eligibility'],
      ['/assessments/resident/r1/eligibility'],
    ]);
  });

  it('ko‘rib chiqish yiqilsa karta qayta SO‘RALMAYDI', async () => {
    h.fetchOne.mockResolvedValue(body(14));
    h.putJson.mockRejectedValue(new Error('500'));
    const { wrapper } = setup();
    const card = renderHook(() => useAttestationEligibility('r1'), { wrapper });
    await waitFor(() => expect(card.result.current.isSuccess).toBe(true));

    const review = renderHook(() => useReviewApplication(), { wrapper });
    await act(async () => {
      await review.result.current
        .mutateAsync({ id: 'a1', data: { status: 'tasdiqlangan' } })
        .catch(() => undefined);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(eligibilityCalls()).toHaveLength(1);
  });
});
