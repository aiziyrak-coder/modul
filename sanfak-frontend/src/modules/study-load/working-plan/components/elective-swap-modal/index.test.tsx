import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import type {
  BackendElectiveSwapResult,
  BackendElectiveUsage,
  BackendElectiveUsageInfo,
  BackendScienceOption,
} from '../../api/mapper';
import ElectiveSwapModal from './index';

const { getMock, putMock, paginateMock } = vi.hoisted(() => ({
  getMock: vi.fn<(url: string, config?: unknown) => Promise<{ data: unknown }>>(),
  putMock: vi.fn<(url: string, body?: unknown) => Promise<{ data: unknown }>>(),
  paginateMock: vi.fn<(url: string, params?: unknown) => Promise<{ docs: BackendScienceOption[] }>>(),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: { get: getMock, put: putMock },
    fetchPaginated: paginateMock,
  };
});

const EMPTY_USAGE: BackendElectiveUsage = {
  science: 'science-1',
  scienceProgram: { total: 0, signed: 0 },
  syllabus: { total: 0, signed: 0 },
  workload: { total: 0, signed: 0 },
  workloadDistribution: { total: 0, signed: 0 },
  total: 0,
  signedTotal: 0,
  signed: [],
};

function usageResponse(over: Partial<BackendElectiveUsageInfo>): BackendElectiveUsageInfo {
  return {
    workingPlan: 'wp-1',
    studyPlan: 'sp-1',
    elective: true,
    locked: false,
    status: 'draft',
    affectedWorkingPlans: 0,
    usage: EMPTY_USAGE,
    canSwap: true,
    ...over,
  };
}

function renderModal() {
  return renderWithProviders(
    <ElectiveSwapModal
      planDocId="wp-1"
      semKey="1"
      blockId="blk-2"
      scienceRowId="sci-1"
      workingScheduleId="ws-1"
      currentScienceId="science-1"
      currentCode="FA1024"
      currentTitle="Anatomiya"
    />,
  );
}

beforeEach(() => {
  getMock.mockReset();
  putMock.mockReset();
  paginateMock.mockReset();
  paginateMock.mockResolvedValue({
    docs: [{ _id: 'science-9', title: 'Gistologiya', scienceCode: 'FA9' }],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ElectiveSwapModal', () => {
  it('`canSwap: false` (studyPlan yo`q) → tugma o`chiq va SABAB ko`rinadi', async () => {
    getMock.mockResolvedValue({
      data: { data: usageResponse({ studyPlan: null, canSwap: false }) },
    });

    renderModal();

    expect(
      await screen.findByText(/manba o'quv rejaga bog'lanmagan/i),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Almashtirish/ })).toBeDisabled();
  });

  it('`affectedWorkingPlans: 3` → qamrov xabari "3 ta ishchi reja" ko`rinadi', async () => {
    getMock.mockResolvedValue({
      data: { data: usageResponse({ affectedWorkingPlans: 3 }) },
    });

    renderModal();

    expect(await screen.findByText("Bu o'zgarish 3 ta ishchi rejaga qo'llanadi")).toBeTruthy();
    expect(screen.queryByText(/qulflangan/)).toBeNull();
  });

  it('F-09: `lockedWorkingPlans: 1` → qulflangan reja o`zgarmasligi aytiladi', async () => {
    getMock.mockResolvedValue({
      data: { data: usageResponse({ affectedWorkingPlans: 1, lockedWorkingPlans: 1 }) },
    });

    renderModal();

    expect(await screen.findByText("Bu o'zgarish 1 ta ishchi rejaga qo'llanadi")).toBeTruthy();
    expect(
      screen.getByText("1 ta qulflangan (tasdiqlanayotgan yoki tasdiqlangan) ishchi reja o'zgarmaydi"),
    ).toBeTruthy();
  });

  it('`persisted: false` → OGOHLANTIRISH ko`rsatiladi, success emas', async () => {
    getMock.mockResolvedValue({ data: { data: usageResponse({}) } });
    const swapResult: BackendElectiveSwapResult = {
      workingPlan: 'wp-1',
      updatedPlans: 2,
      updatedRows: 2,
      studyPlanRows: 1,
      persisted: false,
      persistError: 'validation failed',
      siblingErrors: [],
      usage: EMPTY_USAGE,
      science: { from: { science: 'science-1', code: 'FA1024' }, to: { science: 'science-9', code: 'FA9', title: 'Gistologiya' } },
    };
    putMock.mockResolvedValue({ data: { data: swapResult } });

    renderModal();

    const selector = await screen.findByRole('combobox');
    fireEvent.mouseDown(selector);
    fireEvent.click(await screen.findByText('FA9 — Gistologiya'));

    fireEvent.click(screen.getByRole('button', { name: /Almashtirish/ }));

    expect(await screen.findByText(/manba o'quv rejaga yozilmadi/i)).toBeTruthy();
    expect(screen.queryByText('Tanlov fani almashtirildi')).toBeNull();
    expect(screen.getByText('2 ta ishchi reja, 2 ta qator yangilandi')).toBeTruthy();
  });

  it('katalog so`rovi faqat tanlov fanlarini so`raydi (`isElective: true`)', async () => {
    getMock.mockResolvedValue({ data: { data: usageResponse({}) } });

    renderModal();

    await waitFor(() =>
      expect(paginateMock).toHaveBeenCalledWith(
        '/sciences/paginate',
        expect.objectContaining({ active: true, isElective: true }),
      ),
    );
  });
});
