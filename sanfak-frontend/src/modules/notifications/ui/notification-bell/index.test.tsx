import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useUnreadCount } from '../../api/queries';
import { NotificationBell } from './index';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    lang: 'uz',
  }),
}));

vi.mock('../../lib/use-online', () => ({
  useOnline: () => true,
}));

vi.mock('../../api/queries', () => ({
  useUnreadCount: vi.fn(),
}));

const mockUseUnreadCount = vi.mocked(useUnreadCount);

function mockQuery(overrides: Partial<ReturnType<typeof useUnreadCount>>) {
  mockUseUnreadCount.mockReturnValue({
    data: undefined,
    isError: false,
    isPending: false,
    dataUpdatedAt: 0,
    ...overrides,
  } as ReturnType<typeof useUnreadCount>);
}

describe('NotificationBell — spec §1 BELL SPEKI badge holatlari', () => {
  it("0 ta o'qilmagan — badge YO'Q, aria-label \"o'qilmagan yo'q\"", () => {
    mockQuery({ data: 0 });
    renderWithProviders(<NotificationBell open={false} panelId="p1" />);

    expect(document.querySelector('.ant-badge-count')).toBeNull();
    expect(screen.getByRole('button', { name: /o'qilmagan yo'q/ })).toBeInTheDocument();
  });

  it("5 ta — aniq son badge'da VA aria-label'da", () => {
    mockQuery({ data: 5 });
    renderWithProviders(<NotificationBell open={false} panelId="p1" />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5 ta/ })).toBeInTheDocument();
  });

  it('99 — chegara, hali "+" yoq', () => {
    mockQuery({ data: 99 });
    renderWithProviders(<NotificationBell open={false} panelId="p1" />);

    expect(document.querySelector('.ant-scroll-number')?.textContent).toBe('99');
  });

  it("127 — badge \"99+\", lekin aria-label'da REAL son (127)", () => {
    mockQuery({ data: 127 });
    renderWithProviders(<NotificationBell open={false} panelId="p1" />);

    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /127 ta/ })).toBeInTheDocument();
  });

  it('xato — yolgon "0" badge chizilmaydi, aria-label boshqa matnga tushadi', () => {
    mockQuery({ isError: true, data: undefined });
    renderWithProviders(<NotificationBell open={false} panelId="p1" />);

    expect(document.querySelector('.ant-badge-count')).toBeNull();
    expect(screen.getByRole('button', { name: /o'qilmagan yo'q/ })).toBeInTheDocument();
  });

  it('yuklanmoqda — birinchi renderda badge chaqnamaydi', () => {
    mockQuery({ isPending: true, data: undefined });
    renderWithProviders(<NotificationBell open={false} panelId="p1" />);

    expect(document.querySelector('.ant-badge-count')).toBeNull();
  });

  it('a11y — yopiq holatda aria-haspopup/aria-expanded/aria-controls', () => {
    mockQuery({ data: 0 });
    renderWithProviders(<NotificationBell open={false} panelId="p1" />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
  });

  it('a11y — ochiq holatda aria-expanded="true" va aria-controls panelId', () => {
    mockQuery({ data: 0 });
    renderWithProviders(<NotificationBell open panelId="p1" />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'p1');
  });
});
