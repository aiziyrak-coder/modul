import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { i18n } from '@/shared/lib/i18n';
import type { AdminUser } from '../model/types';
import UsersListPage from './users-list-page';

const mockUseAdminUsers = vi.fn();
const mockUseDeleteUser = vi.fn();
const mockUseToggleUserActive = vi.fn();
const mockUseAdminRoles = vi.fn();

vi.mock('../api/users-api', () => ({
  useAdminUsers: (...args: unknown[]) => mockUseAdminUsers(...args),
  useDeleteUser: () => mockUseDeleteUser(),
  useToggleUserActive: () => mockUseToggleUserActive(),
}));

vi.mock('../../roles/api/roles-api', () => ({
  useAdminRoles: (...args: unknown[]) => mockUseAdminRoles(...args),
}));

vi.mock('../components/user-form-modal', () => ({
  UserFormModal: () => null,
}));

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u1',
    firstName: 'Alisher',
    lastName: 'Karimov',
    active: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

beforeEach(() => {
  mockUseAdminUsers.mockReset().mockReturnValue({
    data: { items: [makeUser()], meta: { total: 1 } },
    isLoading: false,
  });
  mockUseDeleteUser.mockReset().mockReturnValue({ mutateAsync: vi.fn() });
  mockUseToggleUserActive.mockReset().mockReturnValue({ mutateAsync: vi.fn() });
  mockUseAdminRoles.mockReset().mockReturnValue({ data: { items: [] }, isLoading: false });
});

describe('UsersListPage — i18n (FAZA 2)', () => {
  afterEach(() => {
    void i18n.changeLanguage('uz');
  });

  it('uz: ustun sarlavhalari va tugma matni lokal tilda chiqadi', () => {
    renderWithProviders(<UsersListPage />);
    expect(screen.getByText('F.I.SH')).toBeInTheDocument();
    expect(screen.getByText("Bo'lim")).toBeInTheDocument();
    expect(screen.getByText('Yangi foydalanuvchi')).toBeInTheDocument();
  });

  it('ru: tilni almashtirganda ustun sarlavhalari va tugma rus tiliga o\'tadi', async () => {
    await i18n.changeLanguage('ru');
    renderWithProviders(<UsersListPage />);
    expect(screen.getByText('Ф.И.О.')).toBeInTheDocument();
    expect(screen.getByText('Отдел')).toBeInTheDocument();
    expect(screen.getByText('Новый пользователь')).toBeInTheDocument();
    expect(screen.queryByText('F.I.SH')).not.toBeInTheDocument();
  });
});
