import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useSessionStore } from '@/app/session';
import { ModalHost, useModalStore } from '@/shared/ui';
import { apiClient } from '@/shared/api';
import type * as SharedApi from '@/shared/api';
import WorkingScheduleListPage from './working-schedule-list-page';

const { fetchPaginatedMock, fetchListMock } = vi.hoisted(() => ({
  fetchPaginatedMock: vi.fn(),
  fetchListMock: vi.fn(),
}));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, fetchPaginated: fetchPaginatedMock, fetchList: fetchListMock };
});

function buildDoc(o: { _id: string; title: string; status: string; currentStep?: string | null }) {
  return {
    _id: o._id,
    title: o.title,
    direction: { _id: `dir-${o._id}`, title: 'Davolash ishi' },
    courseRef: { _id: `c-${o._id}`, title: '1-kurs' },
    academicYear: { _id: 'ay1', title: '2026/2027' },
    stage: null,
    date: '2026-09-01',
    status: o.status,
    createdAt: '2026-09-01T08:00:00.000Z',
    currentStep: o.currentStep ?? null,
  };
}

function mockList(docs: ReturnType<typeof buildDoc>[]) {
  fetchListMock.mockResolvedValue([]);
  fetchPaginatedMock.mockResolvedValue({
    docs,
    totalDocs: docs.length,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    nextPage: null,
    prevPage: null,
  });
}

function findRow(title: string): HTMLElement {
  const row = screen.getByText(title).closest('tr');
  if (!row) throw new Error(`Qator topilmadi: ${title}`);
  return row;
}

const WS_PERMISSIONS = [
  'workingSchedule:readAll',
  'workingSchedule:read',
  'workingSchedule:approve',
  'workingSchedule:reject',
];

function loginAs(roleName: string, permissions: string[] = WS_PERMISSIONS) {
  useSessionStore.setState({
    user: { id: `u-${roleName}`, email: `${roleName}@x.uz`, fullName: roleName, roles: [{ id: roleName, name: roleName }] },
    permissions,
  });
}

const DEV_SESSION = {
  user: { id: 'dev-user', email: 'dev@platform.local', fullName: 'Developer', roles: [{ id: 'dev', name: 'Developer' }] },
  permissions: ['*'],
};

const REVOKE = 'Tasdiqni bekor qilish';

afterEach(() => {
  useSessionStore.setState(DEV_SESSION);
  useModalStore.setState({ show: false, animating: false, loading: false, config: {} });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('WorkingScheduleListPage — «Tasdiqni bekor qilish» (ADR-041)', { timeout: 20_000 }, () => {
  it('approved + rektor (yakuniy bosqich) — tugma BOR', async () => {
    loginAs('rektor');
    mockList([buildDoc({ _id: '1', title: 'Davolash 2026/2027', status: 'approved' })]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Davolash 2026/2027');
    expect(findRow('Davolash 2026/2027').textContent).toContain(REVOKE);
  });

  it("approved + prorektor (yakuniy EMAS) — tugma YO'Q", async () => {
    loginAs('prorektor');
    mockList([buildDoc({ _id: '2', title: 'Pediatriya 2026/2027', status: 'approved' })]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Pediatriya 2026/2027');
    expect(findRow('Pediatriya 2026/2027').textContent).not.toContain(REVOKE);
  });

  it("approved + rektor, lekin `workingSchedule:reject` yo'q — tugma YO'Q (permission gate saqlanadi)", async () => {
    loginAs('rektor', ['workingSchedule:readAll', 'workingSchedule:read']);
    mockList([buildDoc({ _id: '3', title: 'Stomatologiya 2026/2027', status: 'approved' })]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Stomatologiya 2026/2027');
    expect(findRow('Stomatologiya 2026/2027').textContent).not.toContain(REVOKE);
  });

  it("in_review + navbat rektorda — mavjud «Qaytarish» o'zgarmagan, bekor qilish YO'Q", async () => {
    loginAs('rektor');
    mockList([
      buildDoc({ _id: '4', title: 'Jarrohlik 2026/2027', status: 'in_review', currentStep: 'rektor' }),
    ]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Jarrohlik 2026/2027');
    const row = findRow('Jarrohlik 2026/2027');
    expect(row.textContent).toContain('Qaytarish');
    expect(row.textContent).not.toContain(REVOKE);
  });

  it("409 active_dependents — bog'liq hujjatlar ro'yxati modalda, holat o'zgarmaydi", async () => {
    loginAs('rektor');
    mockList([buildDoc({ _id: 'ws-9', title: 'Farmatsevtika 2026/2027', status: 'approved' })]);
    const patchSpy = vi.spyOn(apiClient, 'patch').mockRejectedValue({
      message: 'Request failed with status code 409',
      response: {
        status: 409,
        data: {
          status: 'error',
          statusCode: 409,
          message: "Bu hujjatdan hosil bo'lgan faol hujjatlar bor — avval ularni qaytaring",
          detail: '',
          reason: 'active_dependents',
          dependents: [
            { type: 'workload', id: 'w1', title: 'Anatomiya kafedrasi yuklamasi', status: 'approved' },
            { type: 'workload', id: 'w2', title: null, status: 'in_review' },
            { type: 'workload', count: 2, hidden: true },
          ],
        },
      },
    });

    renderWithProviders(
      <>
        <WorkingScheduleListPage />
        <ModalHost />
      </>,
    );

    await screen.findByText('Farmatsevtika 2026/2027');
    const row = findRow('Farmatsevtika 2026/2027');
    fireEvent.click(within(row).getByRole('button', { name: new RegExp(REVOKE) }));

    const textarea = await waitFor(() => {
      const el = document.querySelector('textarea');
      if (!el) throw new Error('textarea hali yo\'q');
      return el;
    });
    fireEvent.change(textarea, { target: { value: 'Rektor buyrug\'i bilan qayta ko\'rib chiqiladi' } });
    const confirmBtn = screen.getAllByRole('button', { name: new RegExp(REVOKE) }).at(-1);
    if (!confirmBtn) throw new Error('Modal tasdiqlash tugmasi topilmadi');
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
    expect(patchSpy).toHaveBeenCalledWith('/working-schedules/reject/ws-9', {
      comment: "Rektor buyrug'i bilan qayta ko'rib chiqiladi",
    });

    const list = await screen.findByTestId('revoke-dependents');
    expect(screen.getByText("Avval bog'liq hujjatlarni qaytaring")).toBeInTheDocument();
    const [first, second, third, ...rest] = within(list).getAllByRole('listitem');
    expect(rest).toHaveLength(0);
    expect(first?.textContent).toContain('Yuklama');
    expect(first?.textContent).toContain('Anatomiya kafedrasi yuklamasi');
    expect(first?.textContent).toContain('Tasdiqlangan');
    expect(second?.textContent).toContain('Nomsiz hujjat');
    expect(third?.textContent).toBe("Yuklama — 2 ta (sizga ko'rinmaydigan)");
    expect(useModalStore.getState().show).toBe(true);
  });
});
