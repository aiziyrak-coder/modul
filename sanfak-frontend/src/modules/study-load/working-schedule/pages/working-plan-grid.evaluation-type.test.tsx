import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import type {
  SemesterData,
  WorkingPlanBlock,
  WorkingPlanScience,
} from '../../working-plan/model/types';
import PlanGrid from './working-plan-grid';

const AT_EXAM_ORAL = '64b7f1c2a1b2c3d4e5f60011';
const AT_TEST = '64b7f1c2a1b2c3d4e5f60012';

const { fetchListMock, putMock } = vi.hoisted(() => ({
  fetchListMock: vi.fn<(url: string, params?: unknown) => Promise<unknown[]>>(),
  putMock: vi.fn<(url: string, body?: unknown) => Promise<{ data: unknown }>>(),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: { put: putMock },
    fetchList: fetchListMock,
  };
});

function science(saved: string | null): WorkingPlanScience {
  return {
    id: 'sci-1',
    serialNumber: '1.01',
    code: 'FA1024',
    title: 'Anatomiya',
    scienceRef: 'science-1',
    departmentRef: null,
    particle: [
      { id: 'p-1', slug: 'maruza', title: 'Maruza', value: 10, canonical: null, colNum: 1 },
    ],
    totalCredit: 4,
    weeklyHours: 2,
    evaluationType: saved,
    alternatives: [],
    rowType: 'subject',
  };
}

function blockWithEvaluation(saved: string | null): WorkingPlanBlock {
  return {
    id: 'blk-1',
    blockCode: 'MFI',
    serialNumber: '1.00',
    code: null,
    title: 'Majburiy fanlar',
    sciences: [science(saved)],
  };
}

function semesters(blk: WorkingPlanBlock): Record<string, SemesterData> {
  return {
    '1': { semester: '1', blocks: [blk], blocksTotal: null, practice: null, grandTotal: null },
  };
}

function renderGrid(blk: WorkingPlanBlock) {
  return renderWithProviders(
    <PlanGrid
      semesters={semesters(blk)}
      particleLabels={[{ slug: 'maruza', title: 'Maruza', colNum: 1 }]}
      workingPlanId="wp-1"
      workingScheduleId="ws-1"
      editable
    />,
  );
}

function startEdit() {
  const pencil = document.querySelector('.anticon-edit')?.closest('button');
  expect(pencil).toBeTruthy();
  fireEvent.click(pencil as HTMLElement);
}

function save() {
  const check = document.querySelector('.anticon-check')?.closest('button');
  expect(check).toBeTruthy();
  fireEvent.click(check as HTMLElement);
}

function expectColumnHeader() {
  expect(screen.getAllByText('Yakuniy baholash turi').length).toBeGreaterThan(0);
}

function lastPutBody(): Record<string, unknown> {
  const call = putMock.mock.calls.at(-1);
  expect(call).toBeTruthy();
  return (call as unknown[])[1] as Record<string, unknown>;
}

beforeEach(() => {
  fetchListMock.mockReset();
  putMock.mockReset();
  fetchListMock.mockResolvedValue([
    { _id: AT_EXAM_ORAL, title: "Imtihon (og'zaki)" },
    { _id: AT_TEST, title: 'Imtihon (test)' },
  ]);
  putMock.mockResolvedValue({ data: {} });
});

describe("PlanGrid — Yakuniy baholash turi ustuni", () => {
  it('ustun sarlavhasi va SAQLANGAN MATN ko`rinadi (ko`rish rejimi)', async () => {
    renderGrid(blockWithEvaluation("Imtihon (og'zaki)"));

    expectColumnHeader();
    expect(screen.getByText("Imtihon (og'zaki)")).toBeTruthy();
    await waitFor(() => {
      expect(fetchListMock).toHaveBeenCalledWith('/assessment-types', { active: true });
    });
  });

  it('qiymat yo`q bo`lsa katak BO`SH (taxminiy qiymat YOZILMAYDI)', () => {
    renderGrid(blockWithEvaluation(null));

    expectColumnHeader();
    expect(screen.queryByText(/imtihon/i)).toBeNull();
    expect(screen.queryByText(/test/i)).toBeNull();
  });

  it('tahrirda tanlangan variant wire`ga `_id` bo`lib ketadi (MATN emas)', async () => {
    renderGrid(blockWithEvaluation(null));
    await waitFor(() => expect(fetchListMock).toHaveBeenCalled());

    startEdit();
    const select = document.querySelector('.ant-select');
    expect(select).toBeTruthy();
    fireEvent.mouseDown(
      (select as HTMLElement).querySelector('.ant-select-selector') as HTMLElement,
    );
    fireEvent.click(await screen.findByTitle("Imtihon (og'zaki)"));

    save();

    await waitFor(() => expect(putMock).toHaveBeenCalled());
    expect(lastPutBody().evaluationType).toBe(AT_EXAM_ORAL);
    expect(String(lastPutBody().evaluationType)).toMatch(/^[0-9a-f]{24}$/);
  });

  it('katalogda topilmagan eski MATN — tegilmasa kalit YUBORILMAYDI', async () => {
    renderGrid(blockWithEvaluation('imtihon'));
    await waitFor(() => expect(fetchListMock).toHaveBeenCalled());

    startEdit();
    save();

    await waitFor(() => expect(putMock).toHaveBeenCalled());
    expect('evaluationType' in lastPutBody()).toBe(false);
  });

  it('mos MATN bo`lsa ham — tegilmasa kalit YUBORILMAYDI', async () => {
    renderGrid(blockWithEvaluation('Imtihon (test)'));
    await waitFor(() => expect(fetchListMock).toHaveBeenCalled());

    startEdit();
    save();

    await waitFor(() => expect(putMock).toHaveBeenCalled());
    expect('evaluationType' in lastPutBody()).toBe(false);
  });

  it('joriy qiymat Select`da OLDINDAN tanlangan ko`rinadi', async () => {
    renderGrid(blockWithEvaluation('Imtihon (test)'));
    await waitFor(() => expect(fetchListMock).toHaveBeenCalled());

    startEdit();
    await waitFor(() => {
      expect(document.querySelector('.ant-select-selection-item')?.textContent).toBe(
        'Imtihon (test)',
      );
    });
  });

  it('tanlov tozalansa `null` yuboriladi', async () => {
    renderGrid(blockWithEvaluation('Imtihon (test)'));
    await waitFor(() => expect(fetchListMock).toHaveBeenCalled());

    startEdit();
    await waitFor(() => expect(document.querySelector('.ant-select-clear')).toBeTruthy());
    const clear = document.querySelector('.ant-select-clear') as HTMLElement;
    fireEvent.mouseDown(clear);
    fireEvent.click(clear);

    save();

    await waitFor(() => expect(putMock).toHaveBeenCalled());
    expect(lastPutBody().evaluationType).toBeNull();
  });
});
