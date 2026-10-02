import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { SemesterData, WorkingPlanBlock } from '../../working-plan/model/types';
import PlanGrid from './working-plan-grid';

function block(): WorkingPlanBlock {
  return {
    id: 'blk-1',
    blockCode: 'MFI',
    serialNumber: '1.00',
    code: null,
    title: 'Majburiy fanlar',
    sciences: [
      {
        id: 'sci-1',
        serialNumber: '1.01',
        code: 'FA1024',
        title: 'Anatomiya',
        scienceRef: 'science-1',
        departmentRef: null,
        particle: [{ id: 'p-1', slug: 'maruza', title: 'Maruza', value: 10, canonical: null, colNum: 1 }],
        totalCredit: 4,
        weeklyHours: 2,
        evaluationType: null,
        alternatives: [],
        rowType: 'subject',
      },
    ],
  };
}

const semesters = (): Record<string, SemesterData> => ({
  '1': { semester: '1', blocks: [block()], blocksTotal: null, practice: null, grandTotal: null },
  '2': { semester: '2', blocks: [block()], blocksTotal: null, practice: null, grandTotal: null },
});

function renderGrid(semesterNumbers?: Record<string, string>) {
  return renderWithProviders(
    <PlanGrid
      semesters={semesters()}
      particleLabels={[{ slug: 'maruza', title: 'Maruza', colNum: 1 }]}
      workingPlanId="wp-1"
      workingScheduleId="ws-1"
      editable={false}
      semesterNumbers={semesterNumbers}
    />,
  );
}

describe('PlanGrid (ishchi reja tabi) — semestr sarlavhasi bosqichga qarab', () => {
  it('III bosqich: lokal 1/2 → sarlavhada 5-semestr / 6-semestr', () => {
    renderGrid({ '1': '5', '2': '6' });

    expect(screen.getByText('5-semestr')).toBeTruthy();
    expect(screen.getByText('6-semestr')).toBeTruthy();
    expect(screen.queryByText('1-semestr')).toBeNull();
  });

  it('`semesterNumbers` berilmasa (eski chaqiruvchi) — lokal kalitning o`zi', () => {
    renderGrid();

    expect(screen.getByText('1-semestr')).toBeTruthy();
    expect(screen.getByText('2-semestr')).toBeTruthy();
  });

  it('qisman kelsa — yetishmagan kalit lokalga tushadi', () => {
    renderGrid({ '1': '5' });

    expect(screen.getByText('5-semestr')).toBeTruthy();
    expect(screen.getByText('2-semestr')).toBeTruthy();
  });
});
