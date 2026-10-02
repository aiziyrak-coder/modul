import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { useSessionStore } from '@/app/session';
import type * as QueriesModule from './api/queries';
import { NotificationBellSlot } from './notifications.navbar-slot';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    lang: 'uz',
  }),
}));

vi.mock('./lib/use-online', () => ({ useOnline: () => true }));

vi.mock('./api/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof QueriesModule>();
  return {
    ...actual,
    useUnreadCount: vi.fn(() => ({ data: 0, isError: false, isPending: false, dataUpdatedAt: 0 })),
  };
});

const panelImpl = vi.fn(() => <div>panel-content</div>);
vi.mock('./ui/notification-panel', () => ({ default: () => panelImpl() }));

function login() {
  act(() => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: 'u1@test.local', fullName: 'Test User', roles: [{ id: 'r1', name: 'test' }] },
      permissions: ['*'],
    });
  });
}

function logout() {
  act(() => {
    useSessionStore.setState({ status: 'unauthenticated', user: null, permissions: [] });
  });
}

beforeEach(() => {
  panelImpl.mockReset();
  panelImpl.mockImplementation(() => <div>panel-content</div>);
});

afterEach(() => {
  logout();
});

describe('NotificationBellSlot — spec §3 SLOT SPEKI', () => {
  it('sessiyasiz — hech narsa render qilmaydi', () => {
    logout();
    renderWithProviders(<NotificationBellSlot />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sessiya bilan — qoʻngʻiroq tugmasi koʻrinadi', () => {
    login();
    renderWithProviders(<NotificationBellSlot />);

    expect(screen.getByRole('button', { name: /o'qilmagan/ })).toBeInTheDocument();
  });

  it('panel klik bilan ochiladi', async () => {
    login();
    const user = userEvent.setup();
    renderWithProviders(<NotificationBellSlot />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText('panel-content')).toBeInTheDocument());
  });

  it('panel klaviatura (Enter) bilan ochiladi', async () => {
    login();
    const user = userEvent.setup();
    renderWithProviders(<NotificationBellSlot />);

    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('panel-content')).toBeInTheDocument());
  });

  it('PanelBoundary — panel crash qilsa, qoʻngʻiroq TIRIK qoladi (navbar yiqilmaydi)', async () => {
    login();
    panelImpl.mockImplementation(() => {
      throw new Error('boom — intentional test crash');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderWithProviders(<NotificationBellSlot />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    expect(screen.queryByText('panel-content')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });
});
