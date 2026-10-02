import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { NotificationVM } from '../../model/types';
import NotificationItem from './index';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'uz' }),
}));

function makeVm(overrides: Partial<NotificationVM> = {}): NotificationVM {
  return {
    id: 'n1',
    eventType: 'unknown_event_never_in_registry',
    title: 'Test sarlavha',
    body: null,
    bodyLines: [],
    metadata: null,
    rawLink: null,
    safeLink: null,
    read: false,
    readAt: null,
    createdAt: new Date('2026-08-14T10:00:00Z'),
    ...overrides,
  };
}

describe('NotificationItem — spec §9 XAVFSIZ RENDER / §1 BODY SAQLASH', () => {
  it('never injects HTML from body — XSS regression (dangerouslySetInnerHTML is an absolute prohibition)', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const vm = makeVm({ body: payload, bodyLines: payload.split('\n') });

    const { container } = renderWithProviders(<NotificationItem notification={vm} variant="full" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it('draws no second line at all when body is null (no empty div, no "undefined")', () => {
    const vm = makeVm({ body: null, bodyLines: [] });

    const { container } = renderWithProviders(<NotificationItem notification={vm} variant="compact" />);

    expect(container.querySelectorAll('.ant-typography')).toHaveLength(2);
    expect(container.textContent).not.toContain('undefined');
  });

  it('preserves a multiline body verbatim in the DOM under white-space: pre-wrap, even though it is visually clamped', () => {
    const rawBody = 'Birinchi qator\nIkkinchi qator\nUchinchi qator\nTo’rtinchi qator';
    const vm = makeVm({ body: rawBody, bodyLines: rawBody.split('\n') });

    const { container } = renderWithProviders(<NotificationItem notification={vm} variant="full" />);

    const typographyEls = container.querySelectorAll('.ant-typography');
    expect(typographyEls.length).toBeGreaterThanOrEqual(2);
    const bodyEl = typographyEls[1] as HTMLElement;
    expect(bodyEl.textContent).toBe(rawBody);
    expect(bodyEl.parentElement).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('renders an unknown eventType via the neutral fallback instead of crashing', () => {
    const vm = makeVm({ eventType: 'brand_new_event_no_one_has_seen_yet', body: 'Bir qatorli matn' });

    expect(() => renderWithProviders(<NotificationItem notification={vm} variant="full" />)).not.toThrow();
    expect(screen.getByText(vm.title)).toBeInTheDocument();
  });

  describe('D1 — "Batafsil" reaches full content even when the row has a link', () => {
    const linkedVm = () =>
      makeVm({
        eventType: 'task_assigned',
        body: 'Uzun mazmun — foydalanuvchi buni to‘liq ko‘ra olishi shart',
        rawLink: '/task-management/tasks/abc',
        safeLink: '/task-management/tasks/abc',
        metadata: { taskId: 'abc' },
      });

    it('shows the action on a row that HAS a safeLink', () => {
      renderWithProviders(
        <NotificationItem notification={linkedVm()} variant="full" onOpenDetail={vi.fn()} />,
      );

      expect(screen.getByRole('button', { name: 'notif.detail' })).toBeInTheDocument();
    });

    it('calls onOpenDetail and does NOT let the click fall through to the row (stopPropagation)', () => {
      const onOpenDetail = vi.fn();
      const onOpen = vi.fn();

      renderWithProviders(
        <NotificationItem
          notification={linkedVm()}
          variant="full"
          onOpen={onOpen}
          onOpenDetail={onOpenDetail}
        />,
      );

      screen.getByRole('button', { name: 'notif.detail' }).click();

      expect(onOpenDetail).toHaveBeenCalledTimes(1);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('omits the action when no handler is wired (keeps older call sites unchanged)', () => {
      renderWithProviders(<NotificationItem notification={linkedVm()} variant="full" />);

      expect(screen.queryByRole('button', { name: 'notif.detail' })).not.toBeInTheDocument();
    });
  });
});
