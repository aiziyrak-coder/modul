import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import TeacherLeaveListPage from './teacher-leave-list-page';

const { fetchPaginatedMock } = vi.hoisted(() => ({
  fetchPaginatedMock: vi.fn(),
}));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, fetchPaginated: fetchPaginatedMock };
});

const { openPdfMock } = vi.hoisted(() => ({
  openPdfMock: vi.fn(),
}));

vi.mock('../../lib/open-pdf', () => ({
  openPdf: openPdfMock,
}));

function buildDoc(overrides: {
  _id: string;
  teacherName: string;
  status: string;
}) {
  const [lastName, firstName] = overrides.teacherName.split(' ');
  return {
    _id: overrides._id,
    teacher: { _id: `t-${overrides._id}`, firstName, lastName },
    type: 'leave',
    reason: 'sabab',
    fromDate: '2026-01-01',
    toDate: '2026-01-10',
    status: overrides.status,
    approvedBy: null,
    approvalDate: null,
    approvalComment: null,
    active: true,
    createdAt: '2026-01-01',
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

function findPdfButton(teacherName: string): HTMLButtonElement {
  const nameCell = screen.getByText(teacherName);
  const row = nameCell.closest('tr');
  if (!row) throw new Error(`Qator topilmadi: ${teacherName}`);
  const button = row.querySelector<HTMLButtonElement>(
    'button[style*="--color-text-soft"]',
  );
  if (!button) throw new Error(`PDF tugmasi topilmadi: ${teacherName}`);
  return button;
}

describe('TeacherLeaveListPage — PDF (bayonnoma) tugmasi status bo\'yicha gate', () => {
  it("status 'pending' bo'lsa — PDF tugmasi disabled", async () => {
    mockList([buildDoc({ _id: '1', teacherName: 'Karimov Anvar', status: 'pending' })]);

    renderWithProviders(<TeacherLeaveListPage />);

    const button = await screen.findByText('Karimov Anvar').then(() => findPdfButton('Karimov Anvar'));
    expect(button).toBeDisabled();
  });

  it("status 'approved' bo'lsa — PDF tugmasi faol", async () => {
    mockList([buildDoc({ _id: '1', teacherName: 'Karimov Anvar', status: 'approved' })]);

    renderWithProviders(<TeacherLeaveListPage />);

    await screen.findByText('Karimov Anvar');
    const button = findPdfButton('Karimov Anvar');
    expect(button).not.toBeDisabled();
  });

  it("status 'rejected' bo'lsa — PDF tugmasi disabled", async () => {
    mockList([buildDoc({ _id: '1', teacherName: 'Karimov Anvar', status: 'rejected' })]);

    renderWithProviders(<TeacherLeaveListPage />);

    await screen.findByText('Karimov Anvar');
    const button = findPdfButton('Karimov Anvar');
    expect(button).toBeDisabled();
  });

  it("mavjud yuklanish mantig'i buzilmagan: bitta 'approved' qator PDF yuklab olayotganda boshqa 'approved' qator ham disabled bo'ladi", async () => {
    let resolveOpenPdf: () => void = () => {};
    openPdfMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveOpenPdf = resolve;
      }),
    );
    mockList([
      buildDoc({ _id: '1', teacherName: 'Karimov Anvar', status: 'approved' }),
      buildDoc({ _id: '2', teacherName: 'Tosheva Dilnoza', status: 'approved' }),
    ]);

    const user = userEvent.setup();
    renderWithProviders(<TeacherLeaveListPage />);

    await screen.findByText('Karimov Anvar');
    const firstButton = findPdfButton('Karimov Anvar');
    const secondButton = findPdfButton('Tosheva Dilnoza');
    expect(firstButton).not.toBeDisabled();
    expect(secondButton).not.toBeDisabled();

    await user.click(firstButton);

    await waitFor(() => {
      expect(findPdfButton('Tosheva Dilnoza')).toBeDisabled();
    });
    expect(findPdfButton('Karimov Anvar')).not.toBeDisabled();

    resolveOpenPdf();
    await waitFor(() => {
      expect(findPdfButton('Tosheva Dilnoza')).not.toBeDisabled();
    });
  }, 15_000);
});
