import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Formik } from 'formik';
import { renderWithProviders } from '@/test/test-utils';
import type { ScienceProgramOption } from '../../model/types';
import ScienceProgramSelect from './index';

const OPTIONS: ScienceProgramOption[] = [
  { value: 'sp-142', label: 'Anatomiya', isV142: true, disabled: true },
  { value: 'sp-259', label: 'Fiziologiya', isV142: false, disabled: false },
];

function renderSelect(onChange: (v: string) => void = vi.fn()) {
  return renderWithProviders(
    <Formik initialValues={{ scienceProgram: '' }} onSubmit={() => undefined}>
      {(formik) => (
        <>
          <ScienceProgramSelect
            name="scienceProgram"
            label="syllabus.field.scienceProgram"
            placeholder="syllabus.field.scienceProgramPlaceholder"
            options={OPTIONS}
          />
          <button
            type="button"
            onClick={() => onChange(formik.values.scienceProgram)}
          >
            qiymatni-o&apos;qish
          </button>
        </>
      )}
    </Formik>,
  );
}

function openDropdown(): void {
  const selector = document.querySelector('.ant-select-selector');
  if (!selector) throw new Error('Select topilmadi');
  fireEvent.mouseDown(selector);
}

describe('ScienceProgramSelect — ADR-011 v142 darvozasi (DOM)', () => {
  it("v142 dasturi ro`yxatda KO`RINADI, `disabled` va `142-son` tegi bilan", async () => {
    renderSelect();
    openDropdown();

    const v142Option = await screen.findByTitle(/Anatomiya/);
    expect(v142Option).toBeInTheDocument();
    expect(v142Option.className).toContain('ant-select-item-option-disabled');
    expect(v142Option.textContent).toContain('142-son');
    expect(v142Option.getAttribute('title')).toContain('yagona hujjat');
    expect(
      screen.getByText(/142-son buyruq bo'yicha fan dasturi va sillabus yagona hujjat/),
    ).toBeInTheDocument();
  });

  it("v142 optioniga bosilsa qiymat O`ZGARMAYDI, v259 esa tanlanadi", async () => {
    const read = vi.fn();
    renderSelect(read);
    openDropdown();

    const v142Option = await screen.findByTitle(/Anatomiya/);
    fireEvent.click(v142Option);
    fireEvent.click(screen.getByRole('button', { name: /qiymatni/ }));
    expect(read).toHaveBeenLastCalledWith('');

    const v259Option = await screen.findByTitle('Fiziologiya');
    expect(v259Option.className).not.toContain('ant-select-item-option-disabled');
    fireEvent.click(v259Option);

    fireEvent.click(screen.getByRole('button', { name: /qiymatni/ }));
    await waitFor(() => {
      expect(read).toHaveBeenLastCalledWith('sp-259');
    });
  });
});
