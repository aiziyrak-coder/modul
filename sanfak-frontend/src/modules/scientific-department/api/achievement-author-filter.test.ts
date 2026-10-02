import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { degreeApi } from './achievement-api';

const { fetchPaginatedMock } = vi.hoisted(() => ({ fetchPaginatedMock: vi.fn() }));

vi.mock('@/shared/api', () => ({
  fetchPaginated: fetchPaginatedMock,
  fetchList: vi.fn(),
  fetchOne: vi.fn(),
  deleteData: vi.fn(),
  putJson: vi.fn(),
  uploadMultipart: vi.fn(),
}));

const MINE = 'u-mine';
const OTHER = 'u-other';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const row = (id: string, author: unknown) => ({
  _id: id,
  author,
  status: 'new',
  academicYear: '2025/2026',
  degreeType: 'phd',
});

const page = (docs: unknown[]) => ({
  docs,
  totalDocs: docs.length,
  page: 1,
  limit: 12,
  totalPages: 1,
});

describe('achievement usePaginate — muallif filtri (F-46)', () => {
  beforeEach(() => {
    fetchPaginatedMock.mockReset();
  });

  it("backendga `author` parami YUBORILMAYDI (Joi qabul qilmaydi — 400)", async () => {
    fetchPaginatedMock.mockResolvedValue(page([]));

    const { result } = renderHook(() => degreeApi.usePaginate(1, 12, {}, true, MINE), {
      wrapper: makeWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(fetchPaginatedMock).toHaveBeenCalledTimes(1);
    const [url, params] = fetchPaginatedMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/scientific-degrees/paginate');
    expect(params).not.toHaveProperty('author');
    expect(params).not.toHaveProperty('mineOf');
  });

  it('begona muallifli qator client filtrida tushib qoladi', async () => {
    fetchPaginatedMock.mockResolvedValue(
      page([
        row('mine-populated', { _id: MINE, firstName: 'A', lastName: 'B' }),
        row('other-populated', { _id: OTHER, firstName: 'C', lastName: 'D' }),
        row('mine-raw-id', MINE),
        row('other-raw-id', OTHER),
        row('no-author', null),
      ]),
    );

    const { result } = renderHook(() => degreeApi.usePaginate(1, 12, {}, true, MINE), {
      wrapper: makeWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.docs.map((d) => d.id)).toEqual(['mine-populated', 'mine-raw-id']);
  });

  it("`mineOf = null` (sessiya yo'q) — so'rov umuman yuborilmaydi", async () => {
    fetchPaginatedMock.mockResolvedValue(page([row('x', OTHER)]));

    const { result } = renderHook(() => degreeApi.usePaginate(1, 12, {}, true, null), {
      wrapper: makeWrapper(newQueryClient()),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchPaginatedMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("`mineOf` BERILMAGAN (hisobot rejimi) — filtr qo'llanmaydi (regressiya qo'rig'i)", async () => {
    fetchPaginatedMock.mockResolvedValue(
      page([row('a', { _id: MINE }), row('b', { _id: OTHER })]),
    );

    const { result } = renderHook(() => degreeApi.usePaginate(1, 12, {}), {
      wrapper: makeWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.docs.map((d) => d.id)).toEqual(['a', 'b']);
  });
});
