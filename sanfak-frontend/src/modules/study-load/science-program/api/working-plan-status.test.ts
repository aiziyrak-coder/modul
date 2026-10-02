import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, apiClient: { get: getMock } };
});

import { useWorkingPlanStatus } from './science-program-api';

const SCIENCE = 'sci-1';
const YEAR = 'ay-2023';

const mySciencesResponse = (academicYear: string | null) => ({
  data: {
    data: [
      {
        science: SCIENCE,
        scienceName: 'Odam anatomiyasi 1,2,3',
        scienceCode: 'AN11-312',
        academicYear,
        semester: 1,
        acceptanceStatus: 'accepted',
      },
    ],
  },
});

const PLAN_STATUS_RESPONSE = {
  data: { hasWorkingPlan: true, warning: null, planHours: null },
};

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

const isStatusCall = ([url]: unknown[]) => String(url).includes('working-plan-status');

const planStatusParams = () => {
  const call = getMock.mock.calls.find(isStatusCall);
  return call?.[1]?.params as Record<string, unknown> | undefined;
};

beforeEach(() => {
  getMock.mockReset();
  getMock.mockImplementation((url: string) =>
    Promise.resolve(
      String(url).includes('working-plan-status')
        ? PLAN_STATUS_RESPONSE
        : mySciencesResponse(YEAR),
    ),
  );
});

describe("useWorkingPlanStatus — T-18 o'quv yili so'rovga qo'shiladi", () => {
  it("biriktirmada yil bor — `academicYear` params ga qo'shiladi (POST bilan bir manba)", async () => {
    const qc = newClient();
    renderHook(() => useWorkingPlanStatus(SCIENCE), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(planStatusParams()).toBeDefined());
    expect(planStatusParams()).toEqual({ science: SCIENCE, academicYear: YEAR });
  });

  it("yilsiz biriktirma — `academicYear` YUBORILMAYDI (eski xulq saqlanadi)", async () => {
    getMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('working-plan-status')
          ? PLAN_STATUS_RESPONSE
          : mySciencesResponse(null),
      ),
    );
    const qc = newClient();
    renderHook(() => useWorkingPlanStatus(SCIENCE), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(planStatusParams()).toBeDefined());
    expect(planStatusParams()).toEqual({ science: SCIENCE });
  });

  it("bitta so'rov: biriktirmalar yuklanmaguncha status so'ralmaydi", async () => {
    const qc = newClient();
    renderHook(() => useWorkingPlanStatus(SCIENCE), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(planStatusParams()).toBeDefined());
    expect(getMock.mock.calls.filter(isStatusCall)).toHaveLength(1);
  });

  it("fan tanlanmagan — `working-plan-status` umuman so'ralmaydi", async () => {
    const qc = newClient();
    renderHook(() => useWorkingPlanStatus(undefined), { wrapper: makeWrapper(qc) });

    await waitFor(() =>
      expect(getMock.mock.calls.some(([url]) => String(url).includes('my-sciences'))).toBe(true),
    );
    expect(planStatusParams()).toBeUndefined();
  });
});
