import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { NotificationVM } from '../../model/types';
import * as queries from '../../api/queries';
import FeedPage from './index';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'uz' }),
}));

vi.mock('../../api/queries', () => ({
  useFeed: vi.fn(),
  useUnreadCount: vi.fn(),
  useMarkRead: vi.fn(),
  useMarkAllRead: vi.fn(),
}));

function makeVm(
  overrides: Partial<NotificationVM> & Pick<NotificationVM, 'id' | 'eventType' | 'title' | 'createdAt'>,
): NotificationVM {
  return {
    body: null,
    bodyLines: [],
    metadata: null,
    rawLink: null,
    safeLink: null,
    read: false,
    readAt: null,
    ...overrides,
  };
}

function mockMarkRead(): ReturnType<typeof queries.useMarkRead> {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ message: 'ok' }),
    isPending: false,
  } as unknown as ReturnType<typeof queries.useMarkRead>;
}

function mockMarkAllRead(): ReturnType<typeof queries.useMarkAllRead> {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ message: 'ok', modified: 0 }),
    isPending: false,
  } as unknown as ReturnType<typeof queries.useMarkAllRead>;
}

function feedResult(docs: NotificationVM[]): ReturnType<typeof queries.useFeed> {
  return {
    data: {
      docs,
      totalDocs: docs.length,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: null,
      prevPage: null,
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof queries.useFeed>;
}

beforeEach(() => {
  vi.mocked(queries.useMarkRead).mockReturnValue(mockMarkRead());
  vi.mocked(queries.useMarkAllRead).mockReturnValue(mockMarkAllRead());
  vi.mocked(queries.useUnreadCount).mockReturnValue(
    { data: 0, refetch: vi.fn() } as unknown as ReturnType<typeof queries.useUnreadCount>,
  );
});

describe('FeedPage — spec §UX §5 SAHIFA', () => {
  it('shows the branded empty state when the feed has no items — never a generic antd Empty, never flashed during loading', () => {
    vi.mocked(queries.useFeed).mockReturnValue(feedResult([]));

    renderWithProviders(<FeedPage />);

    expect(screen.getByText('notif.empty.title')).toBeInTheDocument();
    expect(screen.getByText('notif.empty.hint')).toBeInTheDocument();
  });

  it('groups items by LOCAL calendar day (spec §10) — today vs. 20 days ago land in separate, labeled groups', () => {
    const now = new Date();
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    const todayItem = makeVm({
      id: 'n-today',
      eventType: 'brand_new_x',
      title: 'Bugungi xabar',
      createdAt: now,
    });
    const olderItem = makeVm({
      id: 'n-older',
      eventType: 'brand_new_x',
      title: 'Eski xabar',
      createdAt: twentyDaysAgo,
    });

    vi.mocked(queries.useFeed).mockReturnValue(feedResult([todayItem, olderItem]));

    renderWithProviders(<FeedPage />);

    expect(screen.getByText('notif.group.today')).toBeInTheDocument();
    expect(screen.getByText('notif.group.older')).toBeInTheDocument();
    expect(screen.getByText('Bugungi xabar')).toBeInTheDocument();
    expect(screen.getByText('Eski xabar')).toBeInTheDocument();
  });

  it('a same-day eventType rollup group (spec §10) is keyboard-openable — D3 fix: the old shared/ui Accordion had no role/tabIndex/onKeyDown', () => {
    const now = new Date();
    const items = [0, 1, 2].map((i) =>
      makeVm({
        id: `n-rollup-${i}`,
        eventType: 'sla_overdue',
        title: `SLA xabari ${i}`,
        createdAt: now,
      }),
    );

    vi.mocked(queries.useFeed).mockReturnValue(feedResult(items));

    renderWithProviders(<FeedPage />);

    const header = screen.getByRole('button', { name: /notif\.rollup/ });
    expect(header).toHaveAttribute('tabIndex', '0');
    expect(header).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(header, { key: 'Enter' });

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('SLA xabari 0')).toBeInTheDocument();
  });
});
