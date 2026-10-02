import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../../styles/theme';
import { mapGrid, mapOutage } from '../../api/sams-status-mapper';
import SamsStatusGrid from './index';

const GRID = mapGrid(
  {
    clinics: [
      {
        dbname: 'klinika_a',
        orgTitle: 'Akfa klinikasi',
        live: true,
        days: [
          {
            day: '2026-09-22',
            delivery: 'final',
            measured: false,
            unmeasuredReason: 'before_horizon',
            expectedResidents: 5,
            scannedResidents: 0,
          },
          { day: '2026-09-23', delivery: 'stale', measured: false, unmeasuredReason: 'stale' },
          {
            day: '2026-09-25',
            delivery: 'final',
            measured: true,
            expectedResidents: 5,
            scannedResidents: 0,
          },
          {
            day: '2026-09-26',
            delivery: 'final',
            measured: true,
            expectedResidents: 5,
            scannedResidents: 3,
          },
        ],
      },
    ],
  },
  { from: '2026-09-22', to: '2026-09-28' },
);

const OUTAGE = mapOutage({
  _id: 'o1',
  from: '2026-09-26',
  to: '2026-09-26',
  dbname: 'klinika_a',
  reason: 'Tarmoq uzildi',
});

function renderGrid(
  canWrite = true,
  onDeclare = vi.fn(),
  outages: (typeof OUTAGE)[] | null = [OUTAGE],
  outagesComplete = true,
) {
  render(
    <ThemeProvider theme={theme as unknown as DefaultTheme}>
      <SamsStatusGrid
        grid={GRID}
        today="2026-09-27"
        outages={outages}
        outagesComplete={outagesComplete}
        canWrite={canWrite}
        onDeclare={onDeclare}
      />
    </ThemeProvider>,
  );
  return onDeclare;
}

const cellNamed = (re: RegExp) => screen.getByLabelText(re);

describe('SamsStatusGrid', () => {
  it('🔴 o‘lchanmagan (measured=false) va eskirgan kun — «O‘lchanmagan», qizil emas', () => {
    renderGrid();
    expect(cellNamed(/22\.09\.2026: O.lchanmagan/)).toBeTruthy();
    expect(cellNamed(/23\.09\.2026: O.lchanmagan/)).toBeTruthy();
    expect(screen.queryByLabelText(/22\.09\.2026: Hech kim/)).toBeNull();
    expect(screen.queryByLabelText(/23\.09\.2026: Hech kim/)).toBeNull();
  });

  it('qatorsiz kun — «Ma’lumot yo‘q — o‘lchanmagan»', () => {
    renderGrid();
    expect(cellNamed(/24\.09\.2026: Ma.lumot yo.q/)).toBeTruthy();
  });

  it('yopilgan 0/5 — «Hech kim skanerlanmadi», N/M matni bilan', () => {
    renderGrid();
    expect(cellNamed(/25\.09\.2026: Hech kim skanerlanmadi.*\(0\/5\)/).textContent).toBe('0/5');
  });

  it('uzilish qoplagan kun «U» va bosilmaydi; kelajak kuni bosilmaydi', () => {
    renderGrid();
    const covered = cellNamed(/26\.09\.2026: Uzilish oynasi/);
    expect(covered.textContent).toBe('U');
    expect(covered.tagName).toBe('SPAN');
    expect(cellNamed(/28\.09\.2026/).tagName).toBe('SPAN');
  });

  it('bosilgan katak klinika va kunni uzatadi', () => {
    const onDeclare = renderGrid();
    fireEvent.click(screen.getByRole('button', { name: /25\.09\.2026/ }));
    expect(onDeclare).toHaveBeenCalledWith({ dbname: 'klinika_a', day: '2026-09-25' });
  });

  it('🔴 uzilish qatlami noma’lum (null) — 0/5 qizil emas, hech bir katak bosilmaydi', () => {
    renderGrid(true, vi.fn(), null);
    const zero = cellNamed(/25\.09\.2026: Hech kim skanerlanmadi — uzilish oynalari yuklanmagan/);
    expect(zero.textContent).toBe('0/5');
    expect(zero.tagName).toBe('SPAN');
    expect(screen.queryByLabelText(/Hech kim skanerlanmadi — uzilish bo.lishi mumkin/)).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('🔴 qatlam to‘liq emas (F4-Q18) — topilgan oyna «U», qoplanmagan 0/5 neytral, tugma yo‘q', () => {
    renderGrid(true, vi.fn(), [OUTAGE], false);
    expect(cellNamed(/26\.09\.2026: Uzilish oynasi/).textContent).toBe('U');
    const zero = cellNamed(/25\.09\.2026: Hech kim skanerlanmadi — uzilish oynalari yuklanmagan/);
    expect(zero.tagName).toBe('SPAN');
    expect(screen.queryByLabelText(/Hech kim skanerlanmadi — uzilish bo.lishi mumkin/)).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('legend va D-MODE jumlasi', () => {
    renderGrid(false);
    expect(
      screen.getByText(
        /O.lchanmagan kun hech qachon «kelmadi» hisoblanmaydi va 72 soatga kirmaydi/,
      ),
    ).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
