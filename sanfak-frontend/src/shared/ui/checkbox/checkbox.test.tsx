import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './index';

describe('Checkbox — interaktiv (onChange berilgan)', () => {
  it('🔴 ekran o\u2018quvchi uchun checkbox sifatida e\u2019lon qilinadi', () => {
    render(<Checkbox checked onChange={() => {}}>Faol</Checkbox>);
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  it('🔴 Tab bilan fokuslanadi', () => {
    render(<Checkbox onChange={() => {}}>Faol</Checkbox>);
    expect(screen.getByRole('checkbox').getAttribute('tabindex')).toBe('0');
  });

  it('🔴 Bo\u2018sh joy (Space) holatni almashtiradi', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange}>Faol</Checkbox>);
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Space sahifani surib yubormaydi', () => {
    render(<Checkbox onChange={() => {}}>Faol</Checkbox>);
    const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    screen.getByRole('checkbox').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('Enter ATAYLAB ishlamaydi — nativ checkbox ham unda almashmaydi', () => {
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange}>Faol</Checkbox>);
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uch holatli katakcha — `mixed`', () => {
    render(<Checkbox indeterminate onChange={() => {}}>Qisman</Checkbox>);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('mixed');
  });

  it('`indeterminate` `checked` dan USTUN (chizish mantig\u2018i bilan bir xil)', () => {
    render(<Checkbox indeterminate checked onChange={() => {}}>Qisman</Checkbox>);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('mixed');
  });

  it('o\u2018chirilgan katakcha tab tartibidan CHIQADI va almashmaydi', () => {
    const onChange = vi.fn();
    render(<Checkbox disabled onChange={onChange}>Faol</Checkbox>);
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('tabindex')).toBe('-1');
    expect(box.getAttribute('aria-disabled')).toBe('true');

    fireEvent.keyDown(box, { key: ' ' });
    fireEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Checkbox — DEKORATIV (onChange berilmagan)', () => {
  it('rol BERILMAYDI — ekran o\u2018quvchi soxta boshqaruv ko\u2018rmaydi', () => {
    render(<Checkbox checked />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('fokuslanmaydi va ARIA holati e\u2019lon qilinmaydi', () => {
    const { container } = render(<Checkbox checked />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.hasAttribute('tabindex')).toBe(false);
    expect(root.hasAttribute('aria-checked')).toBe(false);
    expect(root.hasAttribute('aria-disabled')).toBe(false);
  });

  it('DOM bugungidek qoladi — ildiz hamon `<label>`', () => {
    const { container } = render(<Checkbox checked />);
    expect(container.firstElementChild?.tagName).toBe('LABEL');
  });
});
