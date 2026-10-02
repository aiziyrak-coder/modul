import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MultiChipSelect, { type ChipOption } from './index';

const OPTIONS: ChipOption[] = [
  { value: '1', label: '1-kurs' },
  { value: '2', label: '2-kurs' },
  { value: '3', label: '3-kurs' },
];

function renderChips(props: Partial<React.ComponentProps<typeof MultiChipSelect>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <MultiChipSelect
      ariaLabel="Kurs"
      options={OPTIONS}
      value={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return { ...utils, onChange };
}

function openDropdown(): void {
  const selector = document.querySelector('.ant-select-selector');
  if (!selector) throw new Error('Select topilmadi');
  fireEvent.mouseDown(selector);
}

async function pickOption(label: string): Promise<void> {
  fireEvent.click(await screen.findByTitle(label));
}

async function selectedLabels(): Promise<string[]> {
  await screen.findByRole('listbox');
  return Array.from(document.querySelectorAll('.ant-select-item-option'))
    .filter((el) => el.getAttribute('aria-selected') === 'true')
    .map((el) => el.getAttribute('title') ?? '');
}

function Controlled() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <>
      <MultiChipSelect ariaLabel="Kurs" options={OPTIONS} value={value} onChange={setValue} />
      <output data-testid="tanlangan">{value.join(',')}</output>
    </>
  );
}

describe('MultiChipSelect', () => {
  it('ko‘p tanlovli select sifatida chiziladi', () => {
    renderChips();
    expect(document.querySelector('.ant-select-multiple')).toBeTruthy();
  });

  it('ochilganda har variantni ko‘rsatadi', async () => {
    renderChips();
    openDropdown();
    expect(await screen.findByTitle('1-kurs')).toBeInTheDocument();
    expect(screen.getByTitle('2-kurs')).toBeInTheDocument();
    expect(screen.getByTitle('3-kurs')).toBeInTheDocument();
  });

  it('tanlanganini belgilangan holatda ko‘rsatadi', async () => {
    renderChips({ value: ['2'] });
    openDropdown();
    expect(await selectedLabels()).toEqual(['2-kurs']);
  });

  it('bosilganda qiymatni QO‘SHADI', async () => {
    const { onChange } = renderChips({ value: ['1'] });
    openDropdown();
    await pickOption('3-kurs');
    expect(onChange).toHaveBeenCalledWith(['1', '3']);
  });

  it('qayta bosilganda qiymatni OLIB TASHLAYDI', async () => {
    const { onChange } = renderChips({ value: ['1', '3'] });
    openDropdown();
    await pickOption('1-kurs');
    expect(onChange).toHaveBeenCalledWith(['3']);
  });

  it('ketma-ket tanlash to‘planib boradi (boshqariladigan holat)', async () => {
    render(<Controlled />);
    openDropdown();
    await pickOption('1-kurs');
    await pickOption('3-kurs');
    await waitFor(() => {
      expect(screen.getByTestId('tanlangan')).toHaveTextContent('1,3');
    });

    await pickOption('1-kurs');
    await waitFor(() => {
      expect(screen.getByTestId('tanlangan')).toHaveTextContent('3');
    });
  });

  it('hech narsa tanlanmasa "cheklov yo‘q" izohini placeholder sifatida ko‘rsatadi', async () => {
    renderChips({ emptyHint: 'Barcha kurslar' });
    expect(document.querySelector('.ant-select-selection-placeholder')).toHaveTextContent(
      'Barcha kurslar',
    );
    openDropdown();
    expect(await selectedLabels()).toEqual([]);
  });

  it('tanlov bo‘lsa izoh yo‘qoladi', async () => {
    renderChips({ value: ['1'], emptyHint: 'Barcha kurslar' });
    expect(screen.queryByText('Barcha kurslar')).not.toBeInTheDocument();
    openDropdown();
    expect(await selectedLabels()).toEqual(['1-kurs']);
  });

  it('tozalash tugmasi butun tanlovni bo‘shatadi (bo‘sh = cheklovsiz)', () => {
    const { onChange } = renderChips({ value: ['1', '2'] });
    const clear = document.querySelector('.ant-select-clear');
    if (!clear) throw new Error('Tozalash tugmasi topilmadi');
    fireEvent.mouseDown(clear);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('yuklanayotganda yuklanish holatini ko‘rsatadi', () => {
    renderChips({ loading: true });
    expect(document.querySelector('.ant-select-arrow .anticon-loading')).toBeTruthy();
  });

  it('variant bo‘lmasa tegishli matnni ko‘rsatadi', async () => {
    renderChips({ options: [], notFoundText: 'Mutaxassislik topilmadi' });
    openDropdown();
    expect(await screen.findByText('Mutaxassislik topilmadi')).toBeInTheDocument();
  });

  it('disabled holatda ochilmaydi va tanlab bo‘lmaydi', () => {
    const { onChange } = renderChips({ disabled: true });
    expect(screen.getByRole('combobox')).toBeDisabled();
    openDropdown();
    expect(document.querySelector('.ant-select-item-option')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('`aria-label` beriladi', () => {
    renderChips({ ariaLabel: 'Mutaxassislik bo‘yicha yo‘naltirish' });
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-label',
      'Mutaxassislik bo‘yicha yo‘naltirish',
    );
  });
});
