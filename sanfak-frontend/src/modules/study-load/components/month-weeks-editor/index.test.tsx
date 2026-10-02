import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import MonthWeeksEditor from './index';

const MONTHS = [
  'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr', 'Yanvar', 'Fevral',
  'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust',
];
const LIVE = [5, 4, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4];
const months = () => MONTHS.map((month, i) => ({ month, count: LIVE[i]! }));

function renderEditor(over: Partial<React.ComponentProps<typeof MonthWeeksEditor>> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <MonthWeeksEditor open months={months()} showApplyToSchedules onCancel={onCancel} onSave={onSave} {...over} />,
  );
  return { onSave, onCancel };
}

const saveButton = () => screen.getByRole('button', { name: 'Saqlash' });
const input = (month: string) => screen.getByRole('spinbutton', { name: month }) as HTMLInputElement;

describe('MonthWeeksEditor', () => {
  it('12 oy, joriy qiymatlar, jami 52/52, Saqlash yoqiq', () => {
    renderEditor();
    expect(input('Sentabr').value).toBe('5');
    expect(input('Avgust').value).toBe('4');
    expect(screen.getByTestId('month-weeks-total')).toHaveTextContent('Jami: 52 / 52');
    expect(saveButton()).toBeEnabled();
  });

  it('yig`indi buzilsa — xato matni, Saqlash o`chiq; tuzatilsa — yana yoqiq', () => {
    renderEditor();
    fireEvent.change(input('Sentabr'), { target: { value: '4' } });
    expect(screen.getByTestId('month-weeks-total')).toHaveTextContent('Jami: 51 / 52');
    expect(screen.getByText("Haftalar yig'indisi 52 bo'lishi kerak (hozir 51)")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    fireEvent.change(input('Oktabr'), { target: { value: '5' } });
    expect(saveButton()).toBeEnabled();
  });

  it('Saqlash — payload: counts + applyToDraftSchedules (default TRUE)', () => {
    const { onSave } = renderEditor();
    fireEvent.change(input('Sentabr'), { target: { value: '4' } });
    fireEvent.change(input('Oktabr'), { target: { value: '5' } });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0]![0] as { counts: { month: string; count: number }[]; applyToDraftSchedules: boolean };
    expect(payload.applyToDraftSchedules).toBe(true);
    expect(payload.counts.slice(0, 2)).toEqual([
      { month: 'Sentabr', count: 4 },
      { month: 'Oktabr', count: 5 },
    ]);
  });

  it('checkbox o`chirilsa — applyToDraftSchedules: false; LP rejimi bo`lmasa checkbox YO`Q', () => {
    const { onSave } = renderEditor();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(saveButton());
    expect((onSave.mock.calls[0]![0] as { applyToDraftSchedules: boolean }).applyToDraftSchedules).toBe(false);
  });

  it('ishchi reja rejimi (showApplyToSchedules=false) — checkbox chizilmaydi', () => {
    renderEditor({ showApplyToSchedules: false });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('«Teng taqsimlash» — 5,5,5,5,4,… (parser formulasi), jami 52 saqlanadi', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Teng taqsimlash' }));
    expect(input('Sentabr').value).toBe('5');
    expect(input('Dekabr').value).toBe('5');
    expect(input('Yanvar').value).toBe('4');
    expect(screen.getByTestId('month-weeks-total')).toHaveTextContent('Jami: 52 / 52');
    expect(saveButton()).toBeEnabled();
  });
});
