import { describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import ProcessGridTab from './index';
import type { WorkingScheduleProcess } from '../../model/process-types';

vi.mock('../../api/working-schedule-process-api', () => ({
  useUpdateWorkingProcess: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useUpdateScheduleMonthWeeks: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

const weeks = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ week: from + i, key: ' ' }));

const data: WorkingScheduleProcess = {
  _id: 'ws1',
  keys: [
    { key: 'N', title: "Nazariy va amaliy ta'lim" },
    { key: 'T', title: "Ta'til" },
  ],
  courses: [
    {
      _id: 'c1',
      course: 'I',
      courseNum: 1,
      months: [
        { month: 'Sentabr', weeks: weeks(1, 5) },
        { month: 'Oktabr', weeks: weeks(6, 9) },
      ],
      weeks: {},
      total: 40,
      statistics: [
        { _id: 's1', key: 'N', slug: 'n', title: "Nazariy va amaliy ta'lim", value: 30 },
        { _id: 's2', key: 'D', slug: 'd', title: 'Yakuniy davlat attestatsiyasi', value: 0 },
        { _id: 's3', key: 'G', slug: 'g', title: "GPA ko'rsatkichini hisoblash", value: 1 },
        { _id: 's4', key: null, slug: 'h', title: 'Hammasi', value: 52 },
      ],
    },
  ],
};

const px = (v: string | undefined) => Number((v ?? '').replace('px', ''));

describe('ProcessGrid — P-09 sticky ustunlar kengligi ↔ offset invarianti', () => {
  it('har sticky sarlavha width = min-width = max-width; offsetlar kumulyativ', () => {
    const { container } = renderWithProviders(
      <ProcessGridTab scheduleId="ws1" isLoading={false} isError={false} data={data} editable />,
    );
    const ths = Array.from(container.querySelectorAll<HTMLElement>('thead th.sticky-col'));
    expect(ths).toHaveLength(6);

    for (const th of ths) {
      const w = px(th.style.width);
      expect(w).toBeGreaterThan(0);
      expect(px(th.style.minWidth)).toBe(w);
      expect(px(th.style.maxWidth)).toBe(w);
    }

    const right = (th: HTMLElement) => px(th.style.getPropertyValue('--sticky-right'));
    const last = ths[ths.length - 1]!;
    expect(right(last)).toBe(0);
    for (let i = ths.length - 2; i >= 0; i--) {
      const next = ths[i + 1]!;
      expect(right(ths[i]!)).toBe(right(next) + px(next.style.width));
    }
  });

  it('52 hafta uchun hafta sarlavhalari to`liq chiziladi (DOM darajasida)', () => {
    const full: WorkingScheduleProcess = {
      ...data,
      courses: [
        {
          ...data.courses[0]!,
          months: Array.from({ length: 13 }, (_, m) => ({
            month: `M${m + 1}`,
            weeks: weeks(m * 4 + 1, m * 4 + 4),
          })),
        },
      ],
    };
    const { container } = renderWithProviders(
      <ProcessGridTab scheduleId="ws1" isLoading={false} isError={false} data={full} editable />,
    );
    const weekHeads = container.querySelectorAll('thead tr:nth-child(2) th');
    expect(weekHeads).toHaveLength(52);
  });
});

const STAT_DATA: WorkingScheduleProcess = {
  _id: 'ws1',
  keys: [
    { _id: 'k-n', key: 'N', title: "Nazariy va amaliy ta'lim" },
    { _id: 'k-t', key: 'T', title: "Ta'til" },
  ],
  courses: [
    {
      _id: 'c1',
      course: 'I',
      courseNum: 1,
      months: [{ month: 'Sentabr', weeks: weeks(1, 4) }],
      weeks: { '1': ' ', '2': ' ', '3': ' ', '4': 'T' },
      total: 0,
      statistics: [
        { _id: 's-n', key: ' ', slug: 'nazariy', title: "Nazariy va amaliy ta'lim", value: 0 },
        { _id: 's-t', key: 'T', slug: 'tatil', title: "Ta'til", value: 0 },
        { _id: 's-h', key: null, slug: 'hammasi', title: 'Hammasi', value: 0 },
      ],
    },
  ],
};

describe('ProcessGrid — hafta harfi statistikani qayta hisoblaydi', () => {
  it('2-haftaga "T" qo`yilsa: nazariy 2, ta`til 2, hammasi 4, Jami 2', async () => {
    const { container } = renderWithProviders(
      <ProcessGridTab scheduleId="ws1" isLoading={false} isError={false} data={STAT_DATA} editable />,
    );

    fireEvent.click(container.querySelector('.anticon-edit')!.closest('button')!);

    const statInputs = () =>
      Array.from(container.querySelectorAll<HTMLInputElement>('td.stat-cell input'));
    const totalInput = () =>
      container.querySelector<HTMLInputElement>('td.total-cell input')!;

    expect(statInputs().map((i) => i.value)).toEqual(['0', '0', '0']);

    const weekCells = Array.from(container.querySelectorAll('tbody tr td')).slice(1, 5);
    fireEvent.click(weekCells[1]!.firstElementChild!);

    const popover = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.ant-popover');
      expect(el).not.toBeNull();
      return el!;
    });
    fireEvent.click(within(popover).getByText('T'));

    await waitFor(() => expect(statInputs().map((i) => i.value)).toEqual(['2', '2', '4']));
    expect(totalInput().value).toBe('2');
  });
});
