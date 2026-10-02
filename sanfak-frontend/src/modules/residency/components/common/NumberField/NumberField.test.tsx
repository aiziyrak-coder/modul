import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from './index';
import { normalizeDecimalText, parseDecimalInput } from './parse-decimal-input';

function ControlledField(props: { max?: number; onValue?: (v: string) => void }) {
  const [raw, setRaw] = useState('');
  return (
    <>
      <NumberField
        min={0}
        max={props.max}
        value={raw === '' ? null : Number(raw)}
        onChange={(v) => {
          const next = v === null ? '' : String(v);
          setRaw(next);
          props.onValue?.(next);
        }}
      />
      <output data-testid="state">{raw}</output>
    </>
  );
}

function field(): HTMLInputElement {
  return screen.getByRole('spinbutton');
}

function type(value: string): void {
  fireEvent.change(field(), { target: { value } });
}

describe('NumberField — vergulli o‘nlik son', () => {
  it('«8,5» ni 8.5 deb qabul qiladi (antd default parseri 85 qilardi)', () => {
    const onValue = vi.fn();
    render(<ControlledField onValue={onValue} />);

    type('8,5');

    expect(onValue).toHaveBeenLastCalledWith('8.5');
    expect(screen.getByTestId('state')).toHaveTextContent('8.5');
  });

  it('blur’dan keyin ham 8.5 bo‘lib qoladi (85 ga aylanmaydi)', () => {
    render(<ControlledField />);

    type('8,5');
    fireEvent.blur(field());

    expect(screen.getByTestId('state')).toHaveTextContent('8.5');
    expect(field().value).toBe('8.5');
  });

  it('nuqta bilan yozish avvalgidek ishlaydi (regressiya nazorati)', () => {
    const onValue = vi.fn();
    render(<ControlledField onValue={onValue} />);

    type('8.5');

    expect(onValue).toHaveBeenLastCalledWith('8.5');
  });

  it('butun son o‘zgarmaydi', () => {
    const onValue = vi.fn();
    render(<ControlledField onValue={onValue} />);

    type('60');

    expect(onValue).toHaveBeenLastCalledWith('60');
  });

  it('maydonni tozalash `null` beradi (parser SATR qaytargani uchun)', () => {
    const onValue = vi.fn();
    render(<ControlledField onValue={onValue} />);

    type('7');
    type('');

    expect(onValue).toHaveBeenLastCalledWith('');
  });

  it('`max` bo‘lgan maydonda ham vergul MAKSIMALGA aylanmaydi', () => {
    render(<ControlledField max={10} />);

    type('7,5');
    fireEvent.blur(field());

    expect(screen.getByTestId('state')).toHaveTextContent('7.5');
  });

  it('koordinata aniqligi saqlanadi (Shimoliy qutb holati)', () => {
    const onValue = vi.fn();
    render(<ControlledField onValue={onValue} />);

    type('41,311081');
    fireEvent.blur(field());

    expect(onValue).toHaveBeenLastCalledWith('41.311081');
  });
});

describe('parseDecimalInput', () => {
  it('vergulni o‘nlik nuqtaga o‘giradi', () => {
    expect(parseDecimalInput('8,5')).toBe('8.5');
    expect(parseDecimalInput('62,5')).toBe('62.5');
    expect(parseDecimalInput('41,311081')).toBe('41.311081');
  });

  it('bo‘shliq (NBSP ham) mingliklar ajratgichi sifatida tashlanadi', () => {
    expect(parseDecimalInput('1 500')).toBe('1500');
    expect(parseDecimalInput(' 5 ')).toBe('5');
  });

  it('bo‘sh kirishni SATR sifatida qaytaradi (0 emas)', () => {
    expect(parseDecimalInput('')).toBe('');
    expect(parseDecimalInput(undefined)).toBe('');
  });

  it('tugallanmagan «2.» ni buzmaydi (yozish davom etmoqda)', () => {
    expect(parseDecimalInput('2.')).toBe('2.');
  });

  it('manfiy son saqlanadi (koordinata janubiy/g‘arbiy yarim shar)', () => {
    expect(parseDecimalInput('-12,5')).toBe('-12.5');
  });

  it('ikkita vergulli kirishni "tuzatmaydi" — yaroqsiz bo‘lib qoladi', () => {
    expect(parseDecimalInput('1,2,3')).toBe('1.2.3');
    expect(Number.isNaN(Number(parseDecimalInput('1,2,3')))).toBe(true);
  });
});

describe('normalizeDecimalText — `<input type="text">` yo‘li', () => {
  it('«6,5» haftalik soat 65 emas, 6.5 bo‘ladi', () => {
    expect(Number(normalizeDecimalText('6,5'))).toBe(6.5);
  });

  it('«2,5» o‘qish muddati 25 emas', () => {
    expect(Number(normalizeDecimalText('2,5'))).toBe(2.5);
  });

  it('butun daqiqa o‘zgarmaydi', () => {
    expect(normalizeDecimalText('15')).toBe('15');
  });
});
