import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type {
  SemesterData,
  TotalRow,
  WorkingPlanBlock,
  WorkingPlanScience,
} from '../../working-plan/model/types';
import PlanGrid from './working-plan-grid';

const SWAP_LABEL = 'Tanlov fanini almashtirish';
const ALT_LABEL = 'Alternativ fanlar';

function block(over: Partial<WorkingPlanBlock>): WorkingPlanBlock {
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
    ...over,
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

describe('PlanGrid — tanlov fanini almashtirish amali', () => {
  it('MAJBURIY blokda almashtirish amali YO`Q (inline tahrir esa bor)', () => {
    renderGrid(block({ blockCode: 'MFI', title: 'Majburiy fanlar' }));

    expect(screen.queryByLabelText(SWAP_LABEL)).toBeNull();
    expect(document.querySelector('.anticon-swap')).toBeNull();
    expect(document.querySelector('.anticon-edit')).not.toBeNull();
  });

  it('TANLOV blokida almashtirish amali BOR', () => {
    renderGrid(block({ id: 'blk-2', blockCode: 'TF2', title: 'Tanlov fanlari' }));

    expect(screen.getByLabelText(SWAP_LABEL)).toBeTruthy();
  });

  it('`BLK2` generatsiya kodli blok ham tanlov deb qaraladi (title yo`q)', () => {
    renderGrid(block({ id: 'blk-3', blockCode: 'BLK2', title: null }));

    expect(screen.getByLabelText(SWAP_LABEL)).toBeTruthy();
  });
});

describe('PlanGrid — ADR-016 alternativ amali', () => {
  it('MAJBURIY blokda alternativ amali YO`Q', () => {
    renderGrid(block({ blockCode: 'MFI', title: 'Majburiy fanlar' }));

    expect(screen.queryByLabelText(ALT_LABEL)).toBeNull();
  });

  it('TANLOV blokida alternativ amali BOR va almashtirish amali SAQLANADI', () => {
    renderGrid(block({ id: 'blk-2', blockCode: 'TF2', title: 'Tanlov fanlari' }));

    expect(screen.getByLabelText(ALT_LABEL)).toBeTruthy();
    expect(screen.getByLabelText(SWAP_LABEL)).toBeTruthy();
  });
});

describe('PlanGrid — alternativlar jadvalda ko`rinadi', () => {
  const withAlternatives = () =>
    block({
      id: 'blk-2',
      blockCode: 'TF2',
      title: 'Tanlov fanlari',
      sciences: [
        {
          id: 'sci-1',
          serialNumber: '2.01',
          code: 'FA2001',
          title: 'Tibbiy statistika',
          scienceRef: 'science-1',
          departmentRef: null,
          particle: [
            { id: 'p-1', slug: 'maruza', title: 'Maruza', value: 10, canonical: null, colNum: 1 },
          ],
          totalCredit: 4,
          weeklyHours: 2,
          evaluationType: null,
          alternatives: [
            { scienceId: 'sci-alt-1', code: 'FA2002', title: 'Gistologiya', departmentId: null },
            { scienceId: 'sci-alt-2', code: 'FA2003', title: 'Epidemiologiya', departmentId: null },
          ],
          rowType: 'subject',
        },
      ],
    });

  it('alternativ fanlar modal ochilmasdan JADVALDA ko`rinadi', () => {
    renderGrid(withAlternatives());

    expect(screen.getByText('Tibbiy statistika')).toBeTruthy();
    expect(screen.getByText('• Gistologiya')).toBeTruthy();
    expect(screen.getByText('• Epidemiologiya')).toBeTruthy();
    expect(screen.getByText('• FA2002')).toBeTruthy();
    expect(screen.getByText('• FA2003')).toBeTruthy();
  });

  it('alternativsiz qatorda qo`shimcha matn YO`Q (bo`sh holat regressiyasi)', () => {
    renderGrid(block({ id: 'blk-2', blockCode: 'TF2', title: 'Tanlov fanlari' }));

    expect(screen.queryByText(/^• /)).toBeNull();
  });
});

describe('PlanGrid — rowType bo`yicha filtr', () => {
  const baseScience = block({}).sciences[0]!;

  const row = (over: Partial<WorkingPlanScience>): WorkingPlanScience => ({
    ...baseScience,
    ...over,
  });

  it('`sectionHeader` va `aggregate` qatorlari KO`RINMAYDI, `subject` ko`rinadi', () => {
    renderGrid(
      block({
        sciences: [
          row({
            id: 'hdr-1',
            serialNumber: '1.2',
            code: null,
            title: 'Klinika oldi fanlari moduli',
            rowType: 'sectionHeader',
          }),
          row({ id: 'sci-1', title: 'Anatomiya', rowType: 'subject' }),
          row({ id: 'agg-1', code: null, title: 'Jami', rowType: 'aggregate' }),
        ],
      }),
    );

    expect(screen.getByText('Anatomiya')).toBeTruthy();
    expect(screen.queryByText('Klinika oldi fanlari moduli')).toBeNull();
    expect(screen.queryByText('Jami')).toBeNull();
  });
});

describe('PlanGrid — tanlov kvotasi sloti (ADR-032)', () => {
  const baseScience = block({}).sciences[0]!;
  const slot = (): WorkingPlanScience => ({
    ...baseScience,
    id: 'slot-1',
    serialNumber: '2.01',
    code: null,
    title: 'Tanlov fani (tanlanmagan)',
    scienceRef: null,
    totalCredit: 5,
    weeklyHours: 5,
    rowType: 'electiveSlot',
  });

  it('slot qatori ko`rinadi, amali — «Fan tanlash»; ✏️ va alternativ YO`Q', () => {
    renderGrid(block({ id: 'blk-2', blockCode: 'TF2', title: 'Tanlov fanlar', sciences: [slot()] }));

    expect(screen.getByText('Tanlov fani (tanlanmagan)')).toBeTruthy();
    expect(screen.getByLabelText('Fan tanlash')).toBeTruthy();
    expect(screen.queryByLabelText(SWAP_LABEL)).toBeNull();
    expect(screen.queryByLabelText(ALT_LABEL)).toBeNull();
    expect(document.querySelector('.anticon-edit')).toBeNull();
  });

  it('tahrirlab bo`lmaydigan (editable=false) holatda slot ko`rinadi, amal YO`Q', () => {
    renderWithProviders(
      <PlanGrid
        semesters={semesters(block({ id: 'blk-2', blockCode: 'TF2', title: 'Tanlov fanlar', sciences: [slot()] }))}
        particleLabels={[{ slug: 'maruza', title: 'Maruza', colNum: 1 }]}
        workingPlanId="wp-1"
        workingScheduleId="ws-1"
        editable={false}
      />,
    );
    expect(screen.getByText('Tanlov fani (tanlanmagan)')).toBeTruthy();
    expect(screen.queryByLabelText('Fan tanlash')).toBeNull();
  });
});

describe('PlanGrid — yillik jami qatori', () => {
  const YEAR_LABEL = "Jami o'quv yilida";
  const SEM_LABEL = 'Jami semestrda';

  const grandTotal = (value: number): TotalRow => ({
    title: YEAR_LABEL,
    totalHour: value,
    totalCredit: 0,
    weeklyHours: 0,
    particles: [
      { id: `gt-${value}`, slug: 'umumiy', title: 'Umumiy', value, canonical: null, colNum: 1 },
    ],
  });

  const semester = (key: string, value: number): SemesterData => ({
    semester: key,
    blocks: [],
    blocksTotal: null,
    practice: null,
    grandTotal: grandTotal(value),
  });

  const TWO_SEMESTERS: Record<string, SemesterData> = {
    '1': semester('1', 900),
    '2': semester('2', 960),
  };

  function renderSemesters(sems: Record<string, SemesterData>) {
    return renderWithProviders(
      <PlanGrid
        semesters={sems}
        particleLabels={[{ slug: 'umumiy', title: 'Umumiy', colNum: 1 }]}
        workingPlanId="wp-1"
        workingScheduleId="ws-1"
        editable
      />,
    );
  }

  const tablesOf = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('.ant-table-wrapper'));

  it('har semestr jadvali "Jami semestrda" bilan tugaydi (saqlangan sarlavha e`tiborsiz)', () => {
    const { container } = renderSemesters(TWO_SEMESTERS);
    const tables = tablesOf(container);

    expect(tables).toHaveLength(2);
    expect(within(tables[0]!).getByText(SEM_LABEL)).toBeTruthy();
    expect(within(tables[1]!).getByText(SEM_LABEL)).toBeTruthy();
  });

  it('yillik qator FAQAT oxirgi jadvalda va u semestrlar yig`indisi (900+960=1860)', () => {
    const { container } = renderSemesters(TWO_SEMESTERS);
    const tables = tablesOf(container);

    expect(within(tables[0]!).queryByText(YEAR_LABEL)).toBeNull();
    const yearRow = within(tables[1]!).getByText(YEAR_LABEL).closest('tr');
    expect(yearRow).not.toBeNull();
    expect(within(yearRow!).getByText('1860')).toBeTruthy();
    expect(within(tables[1]!).getByText('960')).toBeTruthy();
  });

  it('bitta semestrli rejada yillik qator UMUMAN chizilmaydi (nusxa bo`lardi)', () => {
    renderSemesters({ '1': semester('1', 900) });

    expect(screen.queryByText(YEAR_LABEL)).toBeNull();
    expect(screen.getByText(SEM_LABEL)).toBeTruthy();
  });
});
