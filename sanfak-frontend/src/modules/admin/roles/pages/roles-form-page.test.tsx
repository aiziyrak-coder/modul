import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { i18n } from '@/shared/lib/i18n';
import type * as ReactRouterDom from 'react-router-dom';
import type { AdminRole, AdminRoleInput, SectionsGroupedResponse } from '../model/types';
import RolesFormPage from './roles-form-page';

const mockNavigate = vi.fn();
let mockId: string | undefined;

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDom>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: mockId }),
  };
});

const mockUseAdminRole = vi.fn();
const mockUseSectionsGrouped = vi.fn();
const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();

vi.mock('../api/roles-api', () => ({
  useAdminRole: (id: string | undefined) => mockUseAdminRole(id),
  useCreateRole: () => ({ mutateAsync: createMutateAsync }),
  useUpdateRole: () => ({ mutateAsync: updateMutateAsync }),
  useSectionsGrouped: () => mockUseSectionsGrouped(),
}));

const emptySections: SectionsGroupedResponse = {
  groups: [],
  ungrouped: [],
  actions: [],
  totalGroups: 0,
  totalPermissions: 0,
};

function makeRole(overrides: Partial<AdminRole> = {}): AdminRole {
  return {
    id: 'r1',
    title: 'Mavjud rol',
    desc: '',
    permissions: [],
    scopeLevel: 'faculty',
    isSystem: false,
    active: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

beforeEach(() => {
  mockId = undefined;
  mockNavigate.mockReset();
  createMutateAsync.mockReset().mockResolvedValue({ _id: 'new1' });
  updateMutateAsync.mockReset().mockResolvedValue({ message: 'ok' });
  mockUseAdminRole.mockReset().mockReturnValue({ data: undefined, isLoading: false });
  mockUseSectionsGrouped.mockReset().mockReturnValue({ data: emptySections, isLoading: false });
});

describe('RolesFormPage — scopeLevel maydoni', () => {
  it('CREATE: default tanlov "Faqat o`zi" (self), saqlashda body.scopeLevel === "self"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RolesFormPage />);

    expect(await screen.findByText("Faqat o'zi")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Masalan/), 'Yangi rol');
    await user.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ scopeLevel: 'self' }),
      ),
    );
  });

  it('EDIT-REGRESSIYA: mavjud scopeLevel select`ga yuklanadi va tegilmasa ham saqlanadi', async () => {
    mockId = 'r1';
    mockUseAdminRole.mockReturnValue({
      data: makeRole({ scopeLevel: 'faculty' }),
      isLoading: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<RolesFormPage />);

    expect(await screen.findByText('Fakultet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'r1',
          body: expect.objectContaining({ scopeLevel: 'faculty' }),
        }),
      ),
    );
  });

  it('EDIT-O`ZGARTIRISH: select`dan yangi qiymat tanlansa aynan shu qiymat ketadi', async () => {
    mockId = 'r1';
    mockUseAdminRole.mockReturnValue({
      data: makeRole({ scopeLevel: 'faculty' }),
      isLoading: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<RolesFormPage />);

    const combobox = await screen.findByRole('combobox');
    fireEvent.mouseDown(combobox);
    const option = await screen.findByText("Kafedra / bo'lim");
    fireEvent.click(option);

    await user.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ scopeLevel: 'department' }),
        }),
      ),
    );
  });
});

describe("RolesFormPage — «Ro'yxat ko'rish» ogohlantirishi", () => {
  const sectionsWith = (): SectionsGroupedResponse => ({
    ...emptySections,
    ungrouped: [
      { section: 'student', title: 'Talabalar', actionKeys: ['read', 'readAll'] },
      { section: 'department', title: 'Kafedralar', actionKeys: ['read', 'readAll'] },
    ],
  });

  it("`read` bor / `readAll` yo'q -> banner chiqadi va bo'lim nomini ko'rsatadi", async () => {
    mockId = 'r1';
    mockUseAdminRole.mockReturnValue({
      data: makeRole({ permissions: [{ section: 'student', actionKeys: ['read'] }] }),
      isLoading: false,
    });
    mockUseSectionsGrouped.mockReturnValue({ data: sectionsWith(), isLoading: false });

    renderWithProviders(<RolesFormPage />);

    expect(
      await screen.findByText(/1 ta bo'limda ro'yxat sahifasi ochilmaydi/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Talabalar/)).toBeInTheDocument();
  });

  it("`readAll` bor / `read` yo'q (dropdown-only) -> banner CHIQMAYDI", async () => {
    mockId = 'r1';
    mockUseAdminRole.mockReturnValue({
      data: makeRole({
        permissions: [{ section: 'department', actionKeys: ['readAll'] }],
      }),
      isLoading: false,
    });
    mockUseSectionsGrouped.mockReturnValue({ data: sectionsWith(), isLoading: false });

    renderWithProviders(<RolesFormPage />);

    expect(await screen.findByRole('button', { name: 'Saqlash' })).toBeInTheDocument();
    expect(screen.queryByText(/ro'yxat sahifasi ochilmaydi/)).not.toBeInTheDocument();
  });

  it('ikkalasi belgilangan -> banner CHIQMAYDI', async () => {
    mockId = 'r1';
    mockUseAdminRole.mockReturnValue({
      data: makeRole({
        permissions: [{ section: 'student', actionKeys: ['read', 'readAll'] }],
      }),
      isLoading: false,
    });
    mockUseSectionsGrouped.mockReturnValue({ data: sectionsWith(), isLoading: false });

    renderWithProviders(<RolesFormPage />);

    expect(await screen.findByRole('button', { name: 'Saqlash' })).toBeInTheDocument();
    expect(screen.queryByText(/ochilmaydi/)).not.toBeInTheDocument();
  });

  it('ogohlantirish SAQLASHNI BLOKLAMAYDI (variant B — faqat ko`rsatadi)', async () => {
    mockId = 'r1';
    mockUseAdminRole.mockReturnValue({
      data: makeRole({ permissions: [{ section: 'student', actionKeys: ['read'] }] }),
      isLoading: false,
    });
    mockUseSectionsGrouped.mockReturnValue({ data: sectionsWith(), isLoading: false });
    const user = userEvent.setup();

    renderWithProviders(<RolesFormPage />);
    await screen.findByText(/ro'yxat sahifasi ochilmaydi/);

    await user.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    const body = updateMutateAsync.mock.calls[0]?.[0]?.body as AdminRoleInput;
    const student = body.permissions?.find(
      (perm: { section: string }) => perm.section === 'student',
    );
    expect(student?.actionKeys).toEqual(['read']);
  });
});

describe('RolesFormPage — i18n (FAZA 3)', () => {
  afterEach(() => {
    void i18n.changeLanguage('uz');
  });

  it('tilni ru ga almashtirganda scopeLevel variantlari va tugmalar rus tiliga o\'tadi', async () => {
    await i18n.changeLanguage('ru');
    renderWithProviders(<RolesFormPage />);

    expect(await screen.findByText('Только себя')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    expect(screen.queryByText("Faqat o'zi")).not.toBeInTheDocument();
  });
});
