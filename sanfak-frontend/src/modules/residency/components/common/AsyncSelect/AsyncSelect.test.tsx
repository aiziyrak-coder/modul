import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsyncSelect, type AsyncSelectOption } from './index';

function renderSelect(props: Partial<React.ComponentProps<typeof AsyncSelect>> = {}) {
  const onSearch = vi.fn();
  const onChange = vi.fn();
  const utils = render(
    <AsyncSelect value="" options={[]} onChange={onChange} onSearch={onSearch} {...props} />,
  );
  return { ...utils, onSearch, onChange };
}

function openDropdown(): void {
  const selector = document.querySelector('.ant-select-selector');
  if (!selector) throw new Error('Select topilmadi');
  fireEvent.mouseDown(selector);
}

function selectionText(): string {
  return document.querySelector('.ant-select-selection-item')?.textContent ?? '';
}

describe('AsyncSelect', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the placeholder when nothing is selected', () => {
    renderSelect({ placeholder: 'Tanlang' });
    expect(screen.getByText('Tanlang')).toBeInTheDocument();
  });

  it('swaps to the search placeholder while the dropdown is open', async () => {
    renderSelect({ placeholder: 'Tanlang', searchPlaceholder: 'F.I.Sh bo‘yicha qidiring' });
    openDropdown();
    expect(await screen.findByText('F.I.Sh bo‘yicha qidiring')).toBeInTheDocument();
  });

  it('debounces onSearch by 300ms — no call before, one call after', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { onSearch } = renderSelect();
    openDropdown();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Ali' } });

    onSearch.mockClear();
    vi.advanceTimersByTime(200);
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onSearch).toHaveBeenCalledWith('Ali');
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('D-078: clears the search query on close, so reopening starts fresh', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { onSearch } = renderSelect();
    openDropdown();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Rahbar' } });
    expect(input).toHaveValue('Rahbar');

    fireEvent.keyDown(input, { key: 'Escape', keyCode: 27 });

    expect(screen.getByRole('combobox')).toHaveValue('');
    onSearch.mockClear();
    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('shows "Topilmadi" when the search returns no options', async () => {
    renderSelect({ options: [] });
    openDropdown();
    expect(await screen.findByText('Topilmadi')).toBeInTheDocument();
  });

  it('shows a spinner instead of the empty text while loading', async () => {
    renderSelect({ options: [], loading: true });
    openDropdown();
    await waitFor(() => {
      expect(document.querySelector('.ant-select-dropdown .ant-spin')).toBeTruthy();
    });
    expect(screen.queryByText('Topilmadi')).not.toBeInTheDocument();
  });

  it('selects an option via click and calls onChange with (value, option)', async () => {
    const options: AsyncSelectOption[] = [{ value: 'u1', label: 'Aliyev Vali' }];
    const { onChange } = renderSelect({ options });
    openDropdown();
    fireEvent.click(await screen.findByTitle('Aliyev Vali'));
    expect(onChange).toHaveBeenCalledWith('u1', options[0]);
  });

  it('clears the value and calls onChange with an empty string', () => {
    const { onChange } = renderSelect({
      value: 'u1',
      options: [{ value: 'u1', label: 'Aliyev Vali' }],
    });
    const clear = document.querySelector('.ant-select-clear');
    if (!clear) throw new Error('Tozalash tugmasi topilmadi');
    fireEvent.mouseDown(clear);
    expect(onChange).toHaveBeenCalledWith('', undefined);
  });

  it('renders no clear affordance when allowClear is false', () => {
    renderSelect({
      value: 'u1',
      options: [{ value: 'u1', label: 'Aliyev Vali' }],
      allowClear: false,
    });
    expect(document.querySelector('.ant-select-clear')).toBeNull();
  });

  it('is disabled — the dropdown does not open', () => {
    renderSelect({ disabled: true, options: [{ value: 'u1', label: 'Aliyev Vali' }] });
    expect(screen.getByRole('combobox')).toBeDisabled();
    openDropdown();
    expect(document.querySelector('.ant-select-item-option')).toBeNull();
  });

  it('keeps the selected label visible even when it drops out of the current options (seen-options cache)', () => {
    const options: AsyncSelectOption[] = [{ value: 'u1', label: 'Aliyev Vali' }];
    const { rerender } = render(
      <AsyncSelect value="u1" options={options} onChange={vi.fn()} onSearch={vi.fn()} />,
    );
    expect(selectionText()).toBe('Aliyev Vali');

    rerender(
      <AsyncSelect
        value="u1"
        options={[{ value: 'u2', label: 'Boboyev Sardor' }]}
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    );
    expect(selectionText()).toBe('Aliyev Vali');
  });

  it('shows knownOption label immediately (edit mode) even before any search happened', () => {
    renderSelect({ value: 'u9', knownOption: { value: 'u9', label: 'Legacy Supervisor' } });
    expect(selectionText()).toBe('Legacy Supervisor');
  });

  it('falls back to fallbackLabel when neither options nor knownOption know the value', () => {
    renderSelect({ value: 'u404', fallbackLabel: 'Biriktirilgan akkaunt' });
    expect(selectionText()).toBe('Biriktirilgan akkaunt');
  });

  it('is a stateful controlled input driven by the parent (regression guard for App usage)', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      const options: AsyncSelectOption[] = [{ value: 'u1', label: 'Aliyev Vali' }];
      return (
        <AsyncSelect
          value={value}
          options={options}
          onChange={(v) => setValue(v)}
          onSearch={vi.fn()}
        />
      );
    }
    render(<Harness />);
    openDropdown();
    fireEvent.click(await screen.findByTitle('Aliyev Vali'));
    await waitFor(() => {
      expect(selectionText()).toBe('Aliyev Vali');
    });
  });

  it('stays empty when the parent keeps value="" (chip-picker call sites)', async () => {
    const options: AsyncSelectOption[] = [{ value: 'u1', label: 'Aliyev Vali' }];
    const { onChange } = renderSelect({ options });
    openDropdown();
    fireEvent.click(await screen.findByTitle('Aliyev Vali'));
    expect(onChange).toHaveBeenCalledWith('u1', options[0]);
    await waitFor(() => {
      expect(selectionText()).toBe('');
    });
  });
});
