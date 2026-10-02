import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import ElectiveRowModal from './index';

const { postMock, fetchListMock } = vi.hoisted(() => ({
  postMock: vi.fn<(url: string, body?: unknown) => Promise<{ data: unknown }>>(),
  fetchListMock: vi.fn<(url: string, params?: unknown) => Promise<unknown[]>>(),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: postMock },
    fetchList: fetchListMock,
  };
});

function renderModal() {
  return renderWithProviders(
    <ElectiveRowModal
      open
      planId="plan-1"
      block={{
        blockCode: 'TF2',
        title: 'Tanlov fanlari',
        freeQuota: { '3': { hour: 30, credit: 4 } },
      }}
      onClose={() => {}}
    />,
  );
}

beforeEach(() => {
  postMock.mockReset();
  fetchListMock.mockReset();
  fetchListMock.mockResolvedValue([{ _id: 'sci-1', title: 'Fan A', scienceCode: 'FA1' }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ElectiveRowModal', () => {
  it('fanlar ro`yxati faqat tanlov fanlarini so`raydi (`isElective: true`)', async () => {
    renderModal();

    await waitFor(() =>
      expect(fetchListMock).toHaveBeenCalledWith('/sciences', { active: true, isElective: true }),
    );
  });

  it('kamida bitta semestr tanlanmaguncha "Qo`shish" o`chiq', async () => {
    renderModal();

    const submit = screen.getByRole('button', { name: /Qo'shish/ });
    expect(submit).toBeDisabled();

    const combos = await screen.findAllByRole('combobox');
    fireEvent.mouseDown(combos[0]!);
    fireEvent.click(await screen.findByText('FA1 — Fan A'));

    expect(screen.getByRole('button', { name: /Qo'shish/ })).toBeDisabled();
  });

  it('submit body: department/code/title YO`Q, semesters shakli to`g`ri', async () => {
    postMock.mockResolvedValue({
      data: { data: { row: {}, quota: {}, derivedWorkingPlans: 0, warning: null } },
    });

    renderModal();

    const combosBeforeSem = await screen.findAllByRole('combobox');
    fireEvent.mouseDown(combosBeforeSem[0]!);
    fireEvent.click(await screen.findByText('FA1 — Fan A'));

    const combosForSem = screen.getAllByRole('combobox');
    fireEvent.mouseDown(combosForSem[1]!);
    fireEvent.click(await screen.findByText(/3-semestr/));

    const spins = screen.getAllByRole('spinbutton');
    fireEvent.change(spins[0]!, { target: { value: '12' } });
    fireEvent.change(spins[1]!, { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: /Qo'shish/ }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [url, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/study-plans/plan-1/elective-row');
    expect(body).toEqual({
      blockCode: 'TF2',
      science: 'sci-1',
      serialNumber: undefined,
      semesters: [{ semester: '3', hour: 12, credit: 2 }],
      alternatives: undefined,
    });
    expect(body).not.toHaveProperty('department');
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('title');
  });
  it('kredit kiritilganda haftalik soat avtomatik teng bo`ladi; qo`lda o`zgartirilgan soat saqlanadi', async () => {
    renderModal();

    const combosBeforeSem = await screen.findAllByRole('combobox');
    fireEvent.mouseDown(combosBeforeSem[0]!);
    fireEvent.click(await screen.findByText('FA1 — Fan A'));

    const combosForSem = screen.getAllByRole('combobox');
    fireEvent.mouseDown(combosForSem[1]!);
    fireEvent.click(await screen.findByText(/3-semestr/));

    const spins = screen.getAllByRole('spinbutton');
    fireEvent.change(spins[1]!, { target: { value: '3' } });
    await waitFor(() => expect((spins[0] as HTMLInputElement).value).toBe('3'));

    fireEvent.change(spins[0]!, { target: { value: '5' } });
    fireEvent.change(spins[1]!, { target: { value: '4' } });
    await waitFor(() => expect((spins[1] as HTMLInputElement).value).toBe('4'));
    expect((spins[0] as HTMLInputElement).value).toBe('5');
  });
});
