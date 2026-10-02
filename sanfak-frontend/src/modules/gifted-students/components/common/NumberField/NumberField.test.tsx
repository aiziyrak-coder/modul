import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from './index';
import { parseDecimalInput } from './parse-decimal-input';

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

describe('NumberField — vergulli o\u2018nlik son', () => {
  it('«2,5» ni 2.5 deb qabul qiladi (antd default parseri 25 qilardi)', () => {
    const onValue = vi.fn();
    render(<ControlledField onValue={onValue} />);

    type('2,5');

    expect(onValue).toHaveBeenLastCalledWith('2.5');
    expect(screen.getByTestId('state')).toHaveTextContent('2.5');
  });

  it('blur\u2019dan keyin ham 2.5 bo\u2018lib qoladi (25 ga aylanmaydi)', () => {
    render(<ControlledField />);

    type('2,5');
    fireEvent.blur(field());

    expect(screen.getByTestId('state')).toHaveTextContent('2.5');
    expect(field().value).toBe('2.5');
  });

  it('nuqta bilan yozish avvalgidek ishlaydi (regressiya nazorati)', () => {
    const onValue = vi.fn();
    render(<ControlledField onValue={onValue} />);

    type('2.5');

    expect(onValue).toHaveBeenLastCalledWith('2.5');
  });

  it('butun son o\u2018zgarmaydi', () => {
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

  it('`max` bo\u2018lgan maydonda ham vergul MAKSIMALGA aylanmaydi', () => {
    render(<ControlledField max={20} />);

    type('4,5');
    fireEvent.blur(field());

    expect(screen.getByTestId('state')).toHaveTextContent('4.5');
  });
});

describe('parseDecimalInput', () => {
  it('vergulni o\u2018nlik nuqtaga o\u2018giradi', () => {
    expect(parseDecimalInput('2,5')).toBe('2.5');
    expect(parseDecimalInput('62,5')).toBe('62.5');
    expect(parseDecimalInput('12,75')).toBe('12.75');
  });

  it('bo\u2018shliq (NBSP ham) mingliklar ajratgichi sifatida tashlanadi', () => {
    expect(parseDecimalInput('1\u00A0500')).toBe('1500');
    expect(parseDecimalInput(' 5 ')).toBe('5');
  });

  it('bo\u2018sh kirishni SATR sifatida qaytaradi (0 emas)', () => {
    expect(parseDecimalInput('')).toBe('');
    expect(parseDecimalInput(undefined)).toBe('');
  });

  it('tugallanmagan «2.» ni buzmaydi (yozish davom etmoqda)', () => {
    expect(parseDecimalInput('2.')).toBe('2.');
  });

  it('ikkita vergulli kirishni "tuzatmaydi" \u2014 yaroqsiz bo\u2018lib qoladi', () => {
    expect(parseDecimalInput('1,2,3')).toBe('1.2.3');
    expect(Number.isNaN(Number(parseDecimalInput('1,2,3')))).toBe(true);
  });
});
