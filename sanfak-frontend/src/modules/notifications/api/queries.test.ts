import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notifKeys, useNotificationSocketSync } from './queries';

const { getNotificationSocketMock, onMock, offMock } = vi.hoisted(() => {
  const onMock = vi.fn();
  const offMock = vi.fn();
  const getNotificationSocketMock = vi.fn(() => ({ on: onMock, off: offMock }));
  return { getNotificationSocketMock, onMock, offMock };
});

vi.mock('../lib/notification-socket', () => ({
  getNotificationSocket: getNotificationSocketMock,
}));

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => {
  getNotificationSocketMock.mockClear();
  onMock.mockClear();
  offMock.mockClear();
});

describe('useNotificationSocketSync — N-04 Faza 4 socket accelerator', () => {
  it('enabled=false — "soketsiz ham to`g`ri ishlashi" shartnomasi: obuna UMUMAN urinilmaydi', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useNotificationSocketSync(false), { wrapper: makeWrapper(qc) });

    expect(getNotificationSocketMock).not.toHaveBeenCalled();
    expect(onMock).not.toHaveBeenCalled();
  });

  it('enabled=true — "notification" hodisasiga bitta obuna ochiladi', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useNotificationSocketSync(true), { wrapper: makeWrapper(qc) });

    expect(getNotificationSocketMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith('notification', expect.any(Function));
  });

  it('hodisa kelganda — unread + feed keshlari invalidate qilinadi (badge/list yangilanadi)', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(notifKeys.unread, 3);
    qc.setQueryData(notifKeys.feed({}, 1), { docs: [], totalDocs: 0, page: 1, limit: 20, totalPages: 1 });

    renderHook(() => useNotificationSocketSync(true), { wrapper: makeWrapper(qc) });
    const handler = onMock.mock.calls[0]?.[1] as (payload: unknown) => void;
    handler({ eventType: 'task_assigned', title: 't', body: null, link: null, createdAt: new Date().toISOString() });

    expect(qc.getQueryState(notifKeys.unread)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(notifKeys.feed({}, 1))?.isInvalidated).toBe(true);
  });

  it('unmount — AYNAN o`sha handler bilan obunadan chiqadi (StrictMode xavfsiz, dublikat obuna qoldirmaydi)', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = renderHook(() => useNotificationSocketSync(true), { wrapper: makeWrapper(qc) });
    const handler = onMock.mock.calls[0]?.[1];

    unmount();

    expect(offMock).toHaveBeenCalledWith('notification', handler);
  });

  it('enabled true→false (logout) — komponent unmount bo`lmasa ham obunadan chiqadi', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = renderHook(({ enabled }) => useNotificationSocketSync(enabled), {
      wrapper: makeWrapper(qc),
      initialProps: { enabled: true },
    });
    const handler = onMock.mock.calls[0]?.[1];

    rerender({ enabled: false });

    expect(offMock).toHaveBeenCalledWith('notification', handler);
    expect(getNotificationSocketMock).toHaveBeenCalledTimes(1);
  });
});
