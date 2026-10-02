import { describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import StudyPlanProcessTab from './index';

vi.mock('../../api/detail-api', () => ({
  useUpdateLearningProcessCourse: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateMonthWeeks: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

const KEYS = [
  { _id: 'k-n', key: 'N', title: "Nazariy va amaliy ta'lim" },
  { _id: 'k-t', key: 'T', title: "Ta'til" },
];

const COURSES = [
  {
    _id: 'c1',
    course: 'I',
    months: [
      {
        month: 'Sentabr',
        weeks: [{ week: 1 }, { week: 2 }, { week: 3 }, { week: 4 }],
      },
    ],
    weeks: { '1': ' ', '2': ' ', '3': ' ', '4': 'T' },
    total: 0,
    statistics: [
      { _id: 's-n', key: ' ', slug: 'nazariy', title: "Nazariy va amaliy ta'lim", value: 0 },
      { _id: 's-t', key: 'T', slug: 'tatil', title: "Ta'til", value: 0 },
      { _id: 's-h', key: null, slug: 'hammasi', title: 'Hammasi', value: 0 },
    ],
  },
];

describe('StudyPlanProcessTab — hafta harfi statistikani qayta hisoblaydi', () => {
  it('2-haftaga "T" qo`yilsa: nazariy 2, ta`til 2, hammasi 4, Jami 2', async () => {
    const { container } = renderWithProviders(
      <StudyPlanProcessTab learningProcessId="lp-1" keys={KEYS} courses={COURSES} />,
    );

    fireEvent.click(container.querySelector('.anticon-edit')!.closest('button')!);

    const courseRow = () => container.querySelector<HTMLElement>('tbody tr')!;
    const statInputs = () =>
      Array.from(courseRow().querySelectorAll<HTMLInputElement>('td.stat-cell input'));
    const totalInput = () =>
      courseRow().querySelector<HTMLInputElement>('td.total-cell input')!;

    expect(statInputs().map((i) => i.value)).toEqual(['0', '0', '0']);

    const weekCells = Array.from(courseRow().querySelectorAll('td')).slice(1, 5);
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
