import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import type { BackendElectiveOptions } from '../../api/mapper';
import ElectiveChoiceModal from './index';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn<(url: string, config?: unknown) => Promise<{ data: unknown }>>(),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: { get: getMock, put: vi.fn() },
  };
});

const OTHER_DEPARTMENT_REASON =
  "Boshqa kafedra fani — hozircha faqat o'z kafedrangiz fanini tanlash mumkin";

function options(over: Partial<BackendElectiveOptions> = {}): BackendElectiveOptions {
  return {
    main: {
      science: 'science-1',
      code: 'FA1024',
      title: 'Anatomiya',
      department: 'dep-1',
    },
    alternatives: [
      {
        science: 'science-9',
        code: 'FA9',
        title: 'Gistologiya',
        department: 'dep-1',
        selectable: true,
        reason: null,
      },
      {
        science: 'science-10',
        code: 'FA10',
        title: 'Biokimyo',
        department: 'dep-2',
        selectable: false,
        reason: OTHER_DEPARTMENT_REASON,
      },
    ],
    ...over,
  };
}

function renderModal(currentScienceId: string | null = 'science-1') {
  return renderWithProviders(
    <ElectiveChoiceModal
      distributionId="d-1"
      blockId="blk-1"
      currentScienceId={currentScienceId}
    />,
  );
}

beforeEach(() => {
  getMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ElectiveChoiceModal', () => {
  it('`selectable: false` variant KO`RINADI, lekin o`chirilgan + sabab bor', async () => {
    getMock.mockResolvedValue({ data: { data: options() } });

    renderModal();

    expect(await screen.findByText('FA10 — Biokimyo')).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios[2]).toBeDisabled();
    expect(radios[1]).not.toBeDisabled();
    expect(screen.getByText(OTHER_DEPARTMENT_REASON)).toBeTruthy();
  });

  it('joriy tanlov BELGILANGAN bo`ladi', async () => {
    getMock.mockResolvedValue({ data: { data: options() } });

    renderModal('science-9');

    await screen.findByText('FA9 — Gistologiya');
    const radios = screen.getAllByRole('radio');
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
    expect((radios[0] as HTMLInputElement).checked).toBe(false);
  });

  it('`main: null` → "tanlov varianti yo`q" holati (xato EMAS)', async () => {
    getMock.mockResolvedValue({ data: { data: { main: null, alternatives: [] } } });

    renderModal(null);

    expect(await screen.findByText("Bu blok uchun tanlov varianti yo'q")).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
