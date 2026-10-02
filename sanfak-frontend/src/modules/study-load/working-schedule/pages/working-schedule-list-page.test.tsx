import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useSessionStore } from '@/app/session';
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

interface IDocOverrides {
  _id: string;
  title: string;
  status: string;
  currentStep?: string | null;
}

function buildDoc(o: IDocOverrides) {
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
  const cell = screen.getByText(title);
  const row = cell.closest('tr');
  if (!row) throw new Error(`Qator topilmadi: ${title}`);
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

describe('WorkingScheduleListPage — qayta ochish darvozasi (2026-09-10 QA)', () => {
  it("`rejected` + O'UB — 'Qayta ochish' tugmasi BOR", async () => {
    mockList([buildDoc({ _id: '1', title: 'Davolash 2026/2027', status: 'rejected' })]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Davolash 2026/2027');
    const row = findRow('Davolash 2026/2027');

    expect(row.textContent).toContain('Qayta ochish');
    expect(row.querySelector('.anticon-redo')).not.toBeNull();
  });

  it("`rejected` + O'UB EMAS (masalan dekan) — 'Qayta ochish' KO'RINMAYDI", async () => {
    useSessionStore.setState({
      user: { id: 'u2', email: 'd@x.uz', fullName: 'Dekan', roles: [{ id: 'r2', name: 'dekan' }] },
      permissions: [
        'workingSchedule:readAll',
        'workingSchedule:read',
        'workingSchedule:update',
        'workingSchedule:approve',
        'workingSchedule:reject',
        'workingSchedule:delete',
      ],
    });
    mockList([buildDoc({ _id: '2', title: 'Pediatriya 2026/2027', status: 'rejected' })]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Pediatriya 2026/2027');
    const row = findRow('Pediatriya 2026/2027');

    expect(row.textContent).not.toContain('Qayta ochish');
  });

  it("`draft` + O'UB — 'Qayta ochish' YO'Q (bu status uchun 'Tasdiqlash'/submit yo'li bor)", async () => {
    mockList([buildDoc({ _id: '3', title: 'Stomatologiya 2026/2027', status: 'draft' })]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Stomatologiya 2026/2027');
    const row = findRow('Stomatologiya 2026/2027');

    expect(row.textContent).not.toContain('Qayta ochish');
  });

  it("`in_review` — 'Qayta ochish' YO'Q", async () => {
    mockList([
      buildDoc({ _id: '4', title: 'Jarrohlik 2026/2027', status: 'in_review', currentStep: 'methodical' }),
    ]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Jarrohlik 2026/2027');
    const row = findRow('Jarrohlik 2026/2027');

    expect(row.textContent).not.toContain('Qayta ochish');
  });

  it("`approved` — 'Qayta ochish' YO'Q (zanjir tugagan)", async () => {
    mockList([buildDoc({ _id: '5', title: 'Farmatsevtika 2026/2027', status: 'approved' })]);
    renderWithProviders(<WorkingScheduleListPage />);

    await screen.findByText('Farmatsevtika 2026/2027');
    const row = findRow('Farmatsevtika 2026/2027');

    expect(row.textContent).not.toContain('Qayta ochish');
  });
});
