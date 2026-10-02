import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useMyArticles,
  useMyMethodicalRecommendations,
  useMyMonographs,
  useMyTheses,
} from './my-scientific-works-api';

const { session, fetchListMock } = vi.hoisted(() => ({
  session: { userId: 'u-mine' as string | null },
  fetchListMock: vi.fn(),
}));

vi.mock('@/shared/api', () => ({ fetchList: fetchListMock }));

vi.mock('@/app/session', () => ({
  useSessionStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: session.userId ? { id: session.userId } : null }),
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
  title: `Ish ${id}`,
  journalName: 'Jurnal',
  status: 'approved',
  fileUrl: null,
  author,
});

function describeMineHook(
  label: string,
  hook: (enabled: boolean) => { data?: { id: string }[] },
  url: string,
  expectedParams: { author: string } | undefined,
) {
  describe(`${label} — muallif filtri`, () => {
    beforeEach(() => {
      session.userId = MINE;
      fetchListMock.mockReset();
    });

    it(
      expectedParams
        ? "so'rov muallif filtri bilan ketadi"
        : "so'rovga muallif parami QO'SHILMAYDI (backend Joi qabul qilmaydi — 400)",
      async () => {
        fetchListMock.mockResolvedValue([]);
        const { result } = renderHook(() => hook(true), {
          wrapper: makeWrapper(newQueryClient()),
        });

        await waitFor(() => expect(result.current.data).toBeDefined());
        expect(fetchListMock).toHaveBeenCalledWith(url, expectedParams);
      },
    );

    it('begona muallifli yozuv client filtrida tushib qoladi', async () => {
      fetchListMock.mockResolvedValue([
        row('mine-populated', { _id: MINE, firstName: 'A', lastName: 'B' }),
        row('other-populated', { _id: OTHER, firstName: 'C', lastName: 'D' }),
        row('mine-raw-id', MINE),
        row('other-raw-id', OTHER),
        row('no-author', null),
      ]);

      const { result } = renderHook(() => hook(true), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(result.current.data?.map((i) => i.id)).toEqual(['mine-populated', 'mine-raw-id']);
    });

    it("`userId` yo'q — so'rov umuman yuborilmaydi", async () => {
      session.userId = null;
      fetchListMock.mockResolvedValue([row('x', OTHER)]);

      const { result } = renderHook(() => hook(true), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchListMock).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });
  });
}

describeMineHook('useMyArticles', useMyArticles, '/articles', { author: MINE });
describeMineHook('useMyTheses', useMyTheses, '/theses', { author: MINE });
describeMineHook('useMyMonographs', useMyMonographs, '/monographs', undefined);
describeMineHook(
  'useMyMethodicalRecommendations',
  useMyMethodicalRecommendations,
  '/methodical-recommendations',
  undefined,
);
