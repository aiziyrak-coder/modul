import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import type { BackendScienceOption } from '../../api/mapper';
import type { ElectiveAlternative } from '../../model/types';
import ElectiveAlternativesModal from './index';

const { putMock, paginateMock } = vi.hoisted(() => ({
  putMock: vi.fn<(url: string, body?: unknown) => Promise<{ data: unknown }>>(),
  paginateMock:
    vi.fn<(url: string, params?: unknown) => Promise<{ docs: BackendScienceOption[] }>>(),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: { get: vi.fn(), put: putMock },
    fetchPaginated: paginateMock,
  };
});

function renderModal(initialAlternatives: ElectiveAlternative[] = []) {
  return renderWithProviders(
    <ElectiveAlternativesModal
      planDocId="wp-1"
      semKey="1"
      blockId="blk-2"
      scienceRowId="sci-1"
      workingScheduleId="ws-1"
      mainScienceId="science-1"
      mainCode="FA1024"
      mainTitle="Anatomiya"
      initialAlternatives={initialAlternatives}
    />,
  );
}

beforeEach(() => {
  putMock.mockReset();
  paginateMock.mockReset();
  paginateMock.mockResolvedValue({
    docs: [
      { _id: 'science-1', title: 'Anatomiya', scienceCode: 'FA1024' },
      { _id: 'science-9', title: 'Gistologiya', scienceCode: 'FA9' },
      { _id: 'science-10', title: 'Biokimyo', scienceCode: 'FA10' },
    ],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ElectiveAlternativesModal', () => {
  it('kredit/soat maydoni YO`Q — alternativning o`z krediti yo`q (invariant #3)', () => {
    renderModal();

    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText(/kredit va soat slotda qoladi/i)).toBeTruthy();
  });

  it('2 ta alternativ bo`lsa qo`shish yo`li YOPIQ (MAX chegarasi UI da)', () => {
    renderModal([
      { scienceId: 'science-9', code: 'FA9', title: 'Gistologiya', departmentId: null },
      { scienceId: 'science-10', code: 'FA10', title: 'Biokimyo', departmentId: null },
    ]);

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Qo'shish/ })).toBeDisabled();
    expect(screen.getByText(/Chegara to'ldi/i)).toBeTruthy();
  });

  it('asosiy fan va qo`shilgan fan katalogda TANLAB BO`LMAYDI', async () => {
    renderModal([
      { scienceId: 'science-9', code: 'FA9', title: 'Gistologiya', departmentId: null },
    ]);

    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByText('FA10 — Biokimyo');

    const option = (label: string) =>
      document.querySelector(`.ant-select-item-option[title="${label}"]`);

    expect(option('FA1024 — Anatomiya')?.className).toContain(
      'ant-select-item-option-disabled',
    );
    expect(option('FA9 — Gistologiya')?.className).toContain(
      'ant-select-item-option-disabled',
    );
    expect(option('FA10 — Biokimyo')?.className).not.toContain(
      'ant-select-item-option-disabled',
    );
  });

  it('`persisted: false` → OGOHLANTIRISH ko`rsatiladi, success emas', async () => {
    putMock.mockResolvedValue({
      data: {
        data: {
          workingPlan: 'wp-1',
          updatedRows: 1,
          studyPlanRows: 1,
          persisted: false,
          persistError: 'validation failed',
          alternatives: [{ science: 'science-9', code: 'FA9', title: 'Gistologiya' }],
        },
      },
    });

    renderModal();

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('FA9 — Gistologiya'));
    fireEvent.click(screen.getByRole('button', { name: /Qo'shish/ }));
    fireEvent.click(screen.getByRole('button', { name: /Saqlash/ }));

    expect(await screen.findByText(/manba o'quv rejaga yozilmadi/i)).toBeTruthy();
    expect(screen.queryByText('Alternativ fanlar saqlandi')).toBeNull();
  });

  it('katalog so`rovi faqat tanlov fanlarini so`raydi (`isElective: true`)', async () => {
    renderModal();

    await waitFor(() =>
      expect(paginateMock).toHaveBeenCalledWith(
        '/sciences/paginate',
        expect.objectContaining({ active: true, isElective: true }),
      ),
    );
  });
});
