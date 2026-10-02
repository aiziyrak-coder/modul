import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useSessionStore } from '@/app/session';
import type * as SharedApi from '@/shared/api';
import WorkloadListPage from './workload-list-page';

const { fetchPaginatedMock, fetchListMock } = vi.hoisted(() => ({
  fetchPaginatedMock: vi.fn(),
  fetchListMock: vi.fn(),
}));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, fetchPaginated: fetchPaginatedMock, fetchList: fetchListMock };
});

interface IDocOverrides {
  _id: string;
  departmentTitle: string;
  status: string;
  currentStep?: string | null;
  lastEditedAfterApprovalAt?: string | null;
}

function buildDoc(o: IDocOverrides) {
  return {
    _id: o._id,
    title: o.departmentTitle,
    department: { _id: `d-${o._id}`, title: o.departmentTitle },
    academicYear: { _id: 'ay1', title: '2026/2027' },
    status: o.status,
    date: '2026-09-01',
    totalLectures: 14,
    totalHours: 2340,
    currentStep: o.currentStep ?? null,
    lastEditedAfterApprovalAt: o.lastEditedAfterApprovalAt ?? null,
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

function findRow(departmentTitle: string): HTMLElement {
  const cell = screen.getByText(departmentTitle);
  const row = cell.closest('tr');
  if (!row) throw new Error(`Qator topilmadi: ${departmentTitle}`);
  return row;
}

const DEV_SESSION = {
  user: { id: 'dev-user', email: 'dev@platform.local', fullName: 'Developer', roles: [{ id: 'dev', name: 'Developer' }] },
  permissions: ['*'],
};

afterEach(() => {
  useSessionStore.setState(DEV_SESSION);
  vi.clearAllMocks();
});

describe('WorkloadListPage — ADR-012 amallar darvozasi', () => {
  it("`rejected` — 'Qayta ochish' tugmasi BOR, Edit (qalam) tugmasi YO'Q (AF-FE-1/2)", async () => {
    mockList([buildDoc({ _id: '1', departmentTitle: 'Ichki kasalliklar', status: 'rejected' })]);
    renderWithProviders(<WorkloadListPage />);

    await screen.findByText('Ichki kasalliklar');
    const row = findRow('Ichki kasalliklar');

    expect(row.textContent).toContain('Qayta ochish');
    expect(row.querySelector('.anticon-redo')).not.toBeNull();
    expect(row.querySelector('.anticon-edit')).toBeNull();
  });

  it("`in_review` — tahrir tugmalari (qalam ham, qayta ochish ham) YO'Q", async () => {
    mockList([
      buildDoc({ _id: '2', departmentTitle: 'Jarrohlik', status: 'in_review', currentStep: 'kafedra' }),
    ]);
    renderWithProviders(<WorkloadListPage />);

    await screen.findByText('Jarrohlik');
    const row = findRow('Jarrohlik');

    expect(row.querySelector('.anticon-edit')).toBeNull();
    expect(row.textContent).not.toContain('Qayta ochish');
  });

  it('`approved` — Edit qalami YO\'Q (to\'liq tasdiqlangan hujjat o\'zgarmaydi), qayta ochish YO\'Q', async () => {
    mockList([buildDoc({ _id: '3', departmentTitle: 'Pediatriya', status: 'approved' })]);
    renderWithProviders(<WorkloadListPage />);

    await screen.findByText('Pediatriya');
    const row = findRow('Pediatriya');

    expect(row.querySelector('.anticon-edit')).toBeNull();
    expect(row.textContent).not.toContain('Qayta ochish');
  });

  it("`rejected` + o'quv-uslubiy boshqarma EMAS — 'Qayta ochish' KO'RINMAYDI", async () => {
    useSessionStore.setState({
      user: { id: 'u2', email: 'k@x.uz', fullName: 'Kafedra mudiri', roles: [{ id: 'r2', name: 'kafedra_mudiri' }] },
      permissions: ['workload:readAll', 'workload:read', 'workload:update', 'workload:approve', 'workload:delete'],
    });
    mockList([buildDoc({ _id: '4', departmentTitle: 'Nevrologiya', status: 'rejected' })]);
    renderWithProviders(<WorkloadListPage />);

    await screen.findByText('Nevrologiya');
    const row = findRow('Nevrologiya');

    expect(row.textContent).not.toContain('Qayta ochish');
  });

  it("`lastEditedAfterApprovalAt` bor — ro'yxatda belgi ko'rinadi; `null` — ko'rinmaydi (AF-FE-4)", async () => {
    mockList([
      buildDoc({
        _id: '5',
        departmentTitle: 'Stomatologiya',
        status: 'approved',
        lastEditedAfterApprovalAt: '2026-08-19T09:12:00.000Z',
      }),
      buildDoc({ _id: '6', departmentTitle: 'Farmatsevtika', status: 'approved' }),
    ]);
    renderWithProviders(<WorkloadListPage />);

    await screen.findByText('Stomatologiya');
    expect(findRow('Stomatologiya').textContent).toContain('Tahrirlangan');
    expect(findRow('Farmatsevtika').textContent).not.toContain('Tahrirlangan');
  });
});
