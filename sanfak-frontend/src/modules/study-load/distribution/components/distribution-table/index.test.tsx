import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useSessionStore } from '@/app/session';
import { useModalStore } from '@/shared/ui';
import type * as SharedApi from '@/shared/api';
import type { DistributionTeacher } from '../../model/types';
import DistributionTable from './index';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn<(url: string, config?: unknown) => Promise<{ data: unknown }>>(),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: { get: getMock, put: vi.fn(), post: vi.fn(), delete: vi.fn() },
  };
});

const ADD_HOURS_LABEL = "Soat qo'shish";
const DEFAULT_PERMISSIONS = useSessionStore.getState().permissions;

const teacher = (overrides: Partial<DistributionTeacher> = {}): DistributionTeacher => ({
  id: 'entry-1',
  userId: 'user-1',
  fullName: 'Karimov Anvar',
  stavka: 1,
  position: 'assistant',
  isVacant: false,
  vacantLabel: null,
  blocks: [],
  totalHour: 320,
  auditoriumHour: 320,
  minHour: 400,
  maxHour: 600,
  acceptanceStatus: 'pending',
  rejectionReason: null,
  respondedAt: null,
  ...overrides,
});

function renderTable(t: DistributionTeacher, status = 'draft') {
  return renderWithProviders(
    <DistributionTable
      teachers={[t]}
      distributionId="d-1"
      workloadId="w-1"
      distributionStatus={status}
    />,
  );
}

beforeEach(() => {
  getMock.mockReset();
  getMock.mockResolvedValue({ data: { data: [], docs: [] } });
  useSessionStore.setState({ permissions: DEFAULT_PERMISSIONS });
  useModalStore.setState({ show: false, config: {} });
});

afterEach(() => {
  useSessionStore.setState({ permissions: DEFAULT_PERMISSIONS });
  useModalStore.setState({ show: false, config: {} });
  vi.restoreAllMocks();
});

describe('DistributionTable — norma ostida «Soat qo\'shish» (T-06)', () => {
  it('under: tugma bor, bosilganda o\'qituvchi uchun biriktirish oynasi ochiladi', async () => {
    renderTable(teacher());

    const btn = await screen.findByRole('button', { name: new RegExp(ADD_HOURS_LABEL) });
    expect(btn).toBeEnabled();

    fireEvent.click(btn);

    await waitFor(() => {
      const { show, config } = useModalStore.getState();
      expect(show).toBe(true);
      expect(String(config.title)).toContain('Karimov Anvar');
    });
  });

  it('ok (norma bajarilgan): badge ham, tugma ham YO\'Q', () => {
    renderTable(teacher({ auditoriumHour: 420, totalHour: 420 }));

    expect(screen.queryByRole('button', { name: new RegExp(ADD_HOURS_LABEL) })).toBeNull();
  });

  it('tahrirlanmaydigan holat (approved): tugma o\'chirilgan', async () => {
    renderTable(teacher(), 'approved');

    const btn = await screen.findByRole('button', { name: new RegExp(ADD_HOURS_LABEL) });
    expect(btn).toBeDisabled();
  });

  it('workloadDistribution:update granti yo\'q — tugma YO\'Q', () => {
    useSessionStore.setState({ permissions: ['workloadDistribution:read'] });
    renderTable(teacher());

    expect(screen.queryByRole('button', { name: new RegExp(ADD_HOURS_LABEL) })).toBeNull();
  });
});
