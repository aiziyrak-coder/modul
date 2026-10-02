import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import SyllabusListPage from './syllabus-list-page';

const { fetchPaginatedMock } = vi.hoisted(() => ({
  fetchPaginatedMock: vi.fn(),
}));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, fetchPaginated: fetchPaginatedMock };
});

interface IDocOverrides {
  _id: string;
  scienceTitle: string;
  status: string;
  currentStep?: string | null;
  approvalSteps?: Array<{ status: string; comment?: string | null }>;
}

function buildDoc(overrides: IDocOverrides) {
  return {
    _id: overrides._id,
    science: { _id: `sc-${overrides._id}`, title: overrides.scienceTitle },
    scienceTitle: overrides.scienceTitle,
    semester: 1,
    year: 1,
    status: overrides.status,
    createdAt: '2026-08-01',
    currentStep: overrides.currentStep ?? null,
    approvalSteps: overrides.approvalSteps ?? [],
  };
}

function mockList(docs: ReturnType<typeof buildDoc>[]) {
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

function findRow(scienceName: string): HTMLElement {
  const cell = screen.getByText(scienceName);
  const row = cell.closest('tr');
  if (!row) throw new Error(`Qator topilmadi: ${scienceName}`);
  return row;
}

describe('SyllabusListPage — Faol/Qoralama tab filtri (TZ 4.2.8)', () => {
  it("status 'new' — Faol tabda ko'rinadi, Qoralamada yo'q", async () => {
    mockList([
      buildDoc({ _id: '1', scienceTitle: 'Matematika', status: 'new' }),
      buildDoc({ _id: '2', scienceTitle: 'Fizika', status: 'draft' }),
    ]);
    renderWithProviders(<SyllabusListPage />);

    await screen.findByText('Matematika');
    expect(screen.queryByText('Fizika')).not.toBeInTheDocument();
  });

  it("status 'draft' — Qoralama tabda ko'rinadi, Faolda yo'q", async () => {
    mockList([
      buildDoc({ _id: '1', scienceTitle: 'Matematika', status: 'new' }),
      buildDoc({ _id: '2', scienceTitle: 'Fizika', status: 'draft' }),
    ]);
    renderWithProviders(<SyllabusListPage />);

    await screen.findByText('Matematika');
    await userEvent.click(screen.getByText('Qoralama'));

    await screen.findByText('Fizika');
    expect(screen.queryByText('Matematika')).not.toBeInTheDocument();
  });

  it("'new' qatorida yashil Tasdiqlash tugmasi bor", async () => {
    mockList([buildDoc({ _id: '1', scienceTitle: 'Matematika', status: 'new' })]);
    renderWithProviders(<SyllabusListPage />);

    await screen.findByText('Matematika');
    const row = findRow('Matematika');
    expect(row.querySelector('.anticon-check')).not.toBeNull();
  });

  it("'in_review' qatorida Tasdiqlash HAM Qaytarish HAM bor (joriy foydalanuvchi navbatida)", async () => {
    mockList([
      buildDoc({ _id: '1', scienceTitle: 'Kimyo', status: 'in_review', currentStep: 'kafedra' }),
    ]);
    renderWithProviders(<SyllabusListPage />);

    await screen.findByText('Kimyo');
    const row = findRow('Kimyo');
    expect(row.querySelector('.anticon-check')).not.toBeNull();
    expect(row.querySelector('.anticon-close')).not.toBeNull();
  });

  it("'approved' qatorida Tasdiqlash HAM Qaytarish HAM yo'q (zanjir tugagan)", async () => {
    mockList([buildDoc({ _id: '1', scienceTitle: 'Geografiya', status: 'approved' })]);
    renderWithProviders(<SyllabusListPage />);

    await screen.findByText('Geografiya');
    const row = findRow('Geografiya');
    expect(row.querySelector('.anticon-check')).toBeNull();
    expect(row.querySelector('.anticon-close')).toBeNull();
  });

  it("'new' uchun O'chirish tugmasi bor (backend ruxsat beradi)", async () => {
    mockList([buildDoc({ _id: '1', scienceTitle: 'Biologiya', status: 'new' })]);
    renderWithProviders(<SyllabusListPage />);

    await screen.findByText('Biologiya');
    const row = findRow('Biologiya');
    expect(row.querySelector('.anticon-delete')).not.toBeNull();
  });

  it("'rejected' qatorida rad sababi tooltip ikonkasi hamon ishlaydi (regressiya qulfi)", async () => {
    mockList([
      buildDoc({
        _id: '1',
        scienceTitle: 'Tarix',
        status: 'rejected',
        approvalSteps: [{ status: 'rejected', comment: 'Sabab matni' }],
      }),
    ]);
    renderWithProviders(<SyllabusListPage />);

    await screen.findByText('Tarix');
    const row = findRow('Tarix');
    expect(row.querySelector('.anticon-info-circle')).not.toBeNull();
  });
});
