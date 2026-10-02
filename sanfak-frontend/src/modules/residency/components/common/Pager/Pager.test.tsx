import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import Pager from './index';
import { theme } from '../../../styles/theme';

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider theme={theme as unknown as DefaultTheme}>{ui}</ThemeProvider>
);

const pageButtons = () =>
  screen
    .getAllByRole('button')
    .filter((b) => /^\d+-sahifa$/.test(b.getAttribute('aria-label') ?? ''));

describe('Pager — chizish', () => {
  it('🔴 ro\u2018yxat o\u2018sganda tugmalar soni O\u2018SMAYDI', () => {
    const { unmount } = render(wrap(<Pager page={1} totalPages={14} onPage={() => {}} />));
    const atFourteen = pageButtons().length;
    unmount();

    render(wrap(<Pager page={1} totalPages={500} onPage={() => {}} />));
    expect(pageButtons()).toHaveLength(atFourteen);
    expect(atFourteen).toBeLessThan(8);
  });

  it('o\u2018rtada turganda ham katak soni bir xil', () => {
    render(wrap(<Pager page={250} totalPages={500} onPage={() => {}} />));
    expect(pageButtons()).toHaveLength(5);
    const nav = screen.getByRole('navigation', { name: /sahifalash/i });
    expect(nav.textContent?.match(/\u2026/g)).toHaveLength(2);
  });

  it('oraliq tugma EMAS — bosib bo\u2018lmaydi', () => {
    const { container } = render(wrap(<Pager page={10} totalPages={20} onPage={() => {}} />));
    const nav = screen.getByRole('navigation', { name: /sahifalash/i });
    expect(within(nav).queryByRole('button', { name: '\u2026' })).toBeNull();
    expect(container.textContent).toContain('\u2026');
  });

  it('joriy sahifa ekran o\u2018quvchisiga ham bildiriladi', () => {
    render(wrap(<Pager page={3} totalPages={20} onPage={() => {}} />));
    const current = screen.getByRole('button', { name: '3-sahifa' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: '2-sahifa' }).getAttribute('aria-current')).toBeNull();
  });

  it('raqam bosilsa o\u2018sha sahifa uzatiladi', () => {
    const onPage = vi.fn();
    render(wrap(<Pager page={1} totalPages={20} onPage={onPage} />));
    fireEvent.click(screen.getByRole('button', { name: '4-sahifa' }));
    expect(onPage).toHaveBeenCalledWith(4);
  });

  it('o\u2018qlar chegarada o\u2018chirilgan', () => {
    const { unmount } = render(wrap(<Pager page={1} totalPages={20} onPage={() => {}} />));
    expect(screen.getByRole('button', { name: /oldingi/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /keyingi/i })).not.toBeDisabled();
    unmount();

    render(wrap(<Pager page={20} totalPages={20} onPage={() => {}} />));
    expect(screen.getByRole('button', { name: /oldingi/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /keyingi/i })).toBeDisabled();
  });
});

describe('Pager — bitta sahifa', () => {
  it('default: umuman chizilmaydi (beshta sahifada shart ALLAQACHON bor edi)', () => {
    const { container } = render(wrap(<Pager page={1} totalPages={1} onPage={() => {}} />));
    expect(container.firstChild).toBeNull();
  });

  it('🔴 `hideWhenSingle={false}` — chiziladi (`OquvReja` paneli siljimasin)', () => {
    render(wrap(<Pager page={1} totalPages={1} onPage={() => {}} hideWhenSingle={false} />));
    expect(pageButtons()).toHaveLength(1);
  });

  it('sahifa yo\u2018q (totalPages=0) — yiqilmaydi', () => {
    render(wrap(<Pager page={1} totalPages={0} onPage={() => {}} hideWhenSingle={false} />));
    expect(pageButtons()).toHaveLength(0);
  });
});
