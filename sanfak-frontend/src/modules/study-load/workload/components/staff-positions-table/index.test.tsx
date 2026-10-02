import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useSessionStore } from '@/app/session';
import type * as SharedApi from '@/shared/api';
import type { StaffPositions } from '../../model/detail-types';
import StaffPositionsTable from './index';

const { patchJsonMock } = vi.hoisted(() => ({ patchJsonMock: vi.fn() }));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, patchJson: patchJsonMock };
});

const staffPositions: StaffPositions = {
  items: [
    { id: 'sp-1', category: 'departmentHead', slug: 'professor', positions: 1, load: 300, totalHours: 300, hourly: 0 },
  ],
  totalPositions: 1,
  hourly: 0,
};

const ROW = { positions: 0, load: 1, totalHours: 2, hourly: 3 } as const;
const SLUG_COUNT = 11;

function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('tbody tr'));
}

function cellsOf(row: HTMLElement): HTMLElement[] {
  return Array.from(row.querySelectorAll('input[role="spinbutton"]'));
}

beforeEach(() => {
  useSessionStore.setState({
    user: { id: 'u1', email: 'k@x.uz', fullName: 'Kafedra mudiri', roles: [{ id: 'r1', name: 'kafedra_mudiri' }] },
    permissions: ['workload:read', 'workload:update'],
  });
  patchJsonMock.mockResolvedValue({
    message: 'ok',
    staffPositions: { items: [], totalPositions: 0, hourly: 0 },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  useSessionStore.setState({
    user: { id: 'dev-user', email: 'dev@platform.local', fullName: 'Developer', roles: [{ id: 'dev', name: 'Developer' }] },
    permissions: ['*'],
  });
});

describe('StaffPositionsTable — qator darajasidagi "Amallar" ustuni', () => {
  it("ko'rish rejimi (default): kataklar input EMAS, har tahrirlanadigan qatorda qalam bor", () => {
    const { container } = renderWithProviders(
      <StaffPositionsTable workloadId="w1" staffPositions={staffPositions} canEdit />,
    );

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.getByText('Amallar')).toBeTruthy();
    expect(rows(container)[ROW.positions]!.querySelector('.anticon-edit')).not.toBeNull();
    expect(rows(container)[ROW.load]!.querySelector('.anticon-edit')).not.toBeNull();
    expect(screen.getAllByText('300')).toHaveLength(4);
  });

  it("oxirgi «Jami ish o'rinlari» — faqat «Ish o'rinlari» qatorida, qolgan qatorlarda «—» (blanka)", () => {
    const { container } = renderWithProviders(
      <StaffPositionsTable workloadId="w1" staffPositions={staffPositions} canEdit={false} />,
    );
    const lastTotal = (row: HTMLElement) => Array.from(row.querySelectorAll('td.total-cell')).pop()?.textContent;

    expect(lastTotal(rows(container)[ROW.positions]!)).toBe('1');
    expect(lastTotal(rows(container)[ROW.load]!)).toBe('—');
    expect(lastTotal(rows(container)[ROW.totalHours]!)).toBe('—');
    expect(lastTotal(rows(container)[ROW.hourly]!)).toBe('—');
  });

  it("qalam bosilgach — FAQAT o'sha qator inputga aylanadi, o'sha qatorda ✓ va ✗ chiqadi", () => {
    const { container } = renderWithProviders(
      <StaffPositionsTable workloadId="w1" staffPositions={staffPositions} canEdit />,
    );

    fireEvent.click(rows(container)[ROW.positions]!.querySelector('.anticon-edit')!);

    const positionsRow = rows(container)[ROW.positions]!;
    expect(cellsOf(positionsRow)).toHaveLength(SLUG_COUNT);
    expect(positionsRow.querySelector('.anticon-check')).not.toBeNull();
    expect(positionsRow.querySelector('.anticon-close')).not.toBeNull();
    expect(positionsRow.querySelector('.anticon-edit')).toBeNull();

    const loadRow = rows(container)[ROW.load]!;
    expect(cellsOf(loadRow)).toHaveLength(0);
    expect(loadRow.querySelector('button')).toBeDisabled();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(SLUG_COUNT);
  });

  it("'Jami soat' qatorida qalam YO'Q (hosila); 'Soatbay' qatorida BOR (2026-09-18 — qo'lda)", () => {
    const { container } = renderWithProviders(
      <StaffPositionsTable workloadId="w1" staffPositions={staffPositions} canEdit />,
    );

    expect(rows(container)[ROW.totalHours]!.querySelector('.anticon-edit')).toBeNull();
    expect(rows(container)[ROW.hourly]!.querySelector('.anticon-edit')).not.toBeNull();
    expect(rows(container)[ROW.totalHours]!.querySelector('td.actions-cell')).not.toBeNull();
  });

  it("'Soatbay' — qalam bosilsa 11 katak input, ✓ da `hourly` PATCH'ga kiradi", async () => {
    const { container } = renderWithProviders(
      <StaffPositionsTable workloadId="w1" staffPositions={staffPositions} canEdit />,
    );
    fireEvent.click(rows(container)[ROW.hourly]!.querySelector('.anticon-edit')!);
    expect(cellsOf(rows(container)[ROW.hourly]!)).toHaveLength(SLUG_COUNT);
    fireEvent.change(cellsOf(rows(container)[ROW.hourly]!)[0]!, { target: { value: '40' } });
    fireEvent.click(rows(container)[ROW.hourly]!.querySelector('.anticon-check')!);

    await waitFor(() => expect(patchJsonMock).toHaveBeenCalledTimes(1));
    const body = patchJsonMock.mock.calls[0]![1] as { items: Record<string, unknown>[] };
    expect(body.items).toContainEqual({
      _id: 'sp-1',
      category: 'departmentHead',
      slug: 'professor',
      positions: 1,
      load: 300,
      hourly: 40,
    });
  });

  it("✗ (Bekor qilish) — o'zgartirilgan qiymat tiklanadi, qator yopiladi, PATCH yuborilmaydi", () => {
    const { container } = renderWithProviders(
      <StaffPositionsTable workloadId="w1" staffPositions={staffPositions} canEdit />,
    );

    fireEvent.click(rows(container)[ROW.positions]!.querySelector('.anticon-edit')!);
    const firstCell = cellsOf(rows(container)[ROW.positions]!)[0]!;
    fireEvent.change(firstCell, { target: { value: '5' } });
    expect(cellsOf(rows(container)[ROW.positions]!)[0]).toHaveValue('5');

    fireEvent.click(rows(container)[ROW.positions]!.querySelector('.anticon-close')!);

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(rows(container)[ROW.positions]!.querySelector('.anticon-edit')).not.toBeNull();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('5')).toBeNull();
    expect(patchJsonMock, 'Bekor qilish PATCH yubordi — shartnoma buzildi').not.toHaveBeenCalled();
  });

  it('✓ (Saqlash) — PATCH 11 slugning TO`LIQ payloadi bilan ketadi (kontrakt qulfi)', async () => {
    const { container } = renderWithProviders(
      <StaffPositionsTable workloadId="w1" staffPositions={staffPositions} canEdit />,
    );

    fireEvent.click(rows(container)[ROW.positions]!.querySelector('.anticon-edit')!);
    fireEvent.change(cellsOf(rows(container)[ROW.positions]!)[0]!, { target: { value: '5' } });
    fireEvent.click(rows(container)[ROW.positions]!.querySelector('.anticon-check')!);

    await waitFor(() => expect(patchJsonMock).toHaveBeenCalledTimes(1));
    const [url, body] = patchJsonMock.mock.calls[0] as [string, { items: unknown[] }];
    expect(url).toBe('/workloads/w1/staff-positions');
    expect(body.items).toHaveLength(11);
    expect(body.items).toContainEqual({
      _id: 'sp-1',
      category: 'departmentHead',
      slug: 'professor',
      positions: 5,
      load: 300,
      hourly: 0,
    });
    expect(body.items).toContainEqual({
      category: 'supportStaff',
      slug: 'laborant',
      positions: 0,
      load: 0,
      hourly: 0,
    });

    await waitFor(() => expect(screen.queryAllByRole('spinbutton')).toHaveLength(0));
  });

  it("`canEdit=false` (masalan `in_review`) — Amallar ustuni umuman qo'shilmaydi", () => {
    const { container } = renderWithProviders(
      <StaffPositionsTable workloadId="w1" staffPositions={staffPositions} canEdit={false} />,
    );

    expect(screen.queryByText('Amallar')).toBeNull();
    expect(container.querySelectorAll('.anticon-edit')).toHaveLength(0);
    expect(container.querySelectorAll('td.actions-cell')).toHaveLength(0);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });
});
