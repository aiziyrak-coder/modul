import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import type * as ReactRouter from 'react-router-dom';
import StudyPlanListPage from './study-plan-list-page';

const { fetchPaginatedMock, fetchListMock } = vi.hoisted(() => ({
  fetchPaginatedMock: vi.fn(),
  fetchListMock: vi.fn(),
}));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, fetchPaginated: fetchPaginatedMock, fetchList: fetchListMock };
});

const { openPdfMock } = vi.hoisted(() => ({ openPdfMock: vi.fn() }));
vi.mock('../../lib/open-pdf', () => ({ openPdf: openPdfMock }));

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../components/create-working-plan-confirm', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ open, onConfirm }: { open: boolean; onConfirm: (a: string) => void }) =>
      open
        ? createElement(
            'button',
            { type: 'button', onClick: () => onConfirm('') },
            'stub-confirm',
          )
        : null,
  };
});

const { doneFixture } = vi.hoisted(() => ({
  doneFixture: { current: null as unknown },
}));

vi.mock('../../working-schedule/components/generate-modal', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ open, onDone }: { open: boolean; onDone: (d: unknown) => void }) =>
      open
        ? createElement(
            'button',
            { type: 'button', onClick: () => onDone(doneFixture.current) },
            'stub-done',
          )
        : null,
  };
});

function buildPlan(overrides: {
  _id: string;
  title: string;
  learningProcessId: string | null;
}) {
  return {
    _id: overrides._id,
    status: 'new',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    learningProcess: overrides.learningProcessId
      ? {
          _id: overrides.learningProcessId,
          title: overrides.title,
          year: '2025-2026',
          direction: { _id: 'dir-1', title: 'Davolash ishi' },
        }
      : null,
  };
}

function mockList(docs: ReturnType<typeof buildPlan>[]) {
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

function findViewButton(title: string): HTMLButtonElement {
  const row = screen.getByText(title).closest('tr');
  if (!row) throw new Error(`Qator topilmadi: ${title}`);
  const button = [...row.querySelectorAll('button')].find((b) =>
    b.querySelector('.anticon-eye'),
  );
  if (!button) throw new Error(`Ko'rish tugmasi topilmadi: ${title}`);
  return button;
}

describe("StudyPlanListPage — 'Ko'rish' DOIM PDF ochadi (AD-2)", () => {
  it("learningProcessId BOR bo'lsa ham PDF chaqiriladi, navigatsiya qilinmaydi", async () => {
    openPdfMock.mockResolvedValue(undefined);
    navigateMock.mockClear();
    mockList([buildPlan({ _id: 'sp-1', title: 'Davolash ishi rejasi', learningProcessId: 'lp-1' })]);

    const user = userEvent.setup();
    renderWithProviders(<StudyPlanListPage />);

    await screen.findByText('Davolash ishi rejasi');
    await user.click(findViewButton('Davolash ishi rejasi'));

    expect(openPdfMock).toHaveBeenCalledTimes(1);
    expect(openPdfMock.mock.calls[0]?.[0]).toBe('/study-plans/sp-1/pdf');
    expect(navigateMock, 'detal sahifaga o`tib ketdi — AD-2 defekti').not.toHaveBeenCalled();
  });
});

describe('StudyPlanListPage — generatsiya natijasi xabari (AD-6)', () => {
  async function runGenerateFlow(done: unknown) {
    doneFixture.current = done;
    mockList([buildPlan({ _id: 'sp-1', title: 'Davolash ishi rejasi', learningProcessId: 'lp-1' })]);

    const user = userEvent.setup();
    renderWithProviders(<StudyPlanListPage />);

    await screen.findByText('Davolash ishi rejasi');
    const row = screen.getByText('Davolash ishi rejasi').closest('tr');
    const acceptButton = [...(row?.querySelectorAll('button') ?? [])].find((b) =>
      b.querySelector('.anticon-check'),
    );
    if (!acceptButton) throw new Error("'Yaratish' amal tugmasi topilmadi");

    await user.click(acceptButton);
    await user.click(await screen.findByText('stub-confirm'));
    await user.click(await screen.findByText('stub-done'));
  }

  it("totalCreated === 0 bo'lsa muvaffaqiyat xabari KO'RSATILMAYDI", async () => {
    await runGenerateFlow({
      success: false,
      totalCreated: 0,
      totalReplaced: 0,
      totalLockedReplaced: 0,
      totalSkipped: 5,
      statusUpdated: false,
      message: "Hech qanday ishchi o'quv reja yaratilmadi (5 ta kurs o'tkazib yuborildi)",
      learningProcessStatus: 'new',
      created: [],
      skipped: [],
    });

    await screen.findByText(
      "Hech qanday ishchi o'quv reja yaratilmadi (5 ta kurs o'tkazib yuborildi)",
    );
    await waitFor(() => {
      expect(document.querySelector('.ant-message-warning')).not.toBeNull();
    });
    expect(
      document.querySelector('.ant-message-success'),
      'success xabari chiqdi — AD-6 defekti qaytdi',
    ).toBeNull();
    expect(screen.getByText('stub-done')).toBeTruthy();
  });

  it("totalCreated > 0 bo'lsa backend xabari success sifatida ko'rsatiladi", async () => {
    await runGenerateFlow({
      success: true,
      totalCreated: 5,
      totalReplaced: 0,
      totalLockedReplaced: 0,
      totalSkipped: 0,
      statusUpdated: true,
      message: "5 ta ishchi o'quv reja yaratildi",
      learningProcessStatus: 'created',
      created: [],
      skipped: [],
    });

    await screen.findByText("5 ta ishchi o'quv reja yaratildi");
    await waitFor(() => {
      expect(document.querySelector('.ant-message-success')).not.toBeNull();
    });
  });
});
