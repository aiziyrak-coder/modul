import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../../styles/theme';
import { mapWarnings } from '../../api/sams-status-mapper';
import SamsWarnings from './index';

const can = vi.fn<(key: string) => boolean>();
vi.mock('@/app/session', () => ({ usePermission: () => can }));

const DATA = mapWarnings({
  day: '2026-09-27',
  digestDay: '2026-09-26',
  unresolved: {
    count: 2,
    groups: [
      {
        dbname: 'klinika_a',
        orgTitle: 'Akfa klinikasi',
        residents: [
          { resident: 'r1', fullName: 'Aliyev Vali', jshshir: '30101990000011', isNew: true },
        ],
      },
      {
        dbname: null,
        orgTitle: null,
        residents: [{ resident: 'r2', fullName: 'Karimova Nodira', jshshir: '40202990000022' }],
      },
    ],
  },
  ambiguous: {
    count: 1,
    items: [
      {
        resident: 'r3',
        fullName: 'Toshev Bek',
        jshshir: '30303990000033',
        clinics: [
          { dbname: 'klinika_a', orgTitle: 'Akfa klinikasi' },
          { dbname: 'klinika_b', orgTitle: 'Respublika klinikasi' },
        ],
      },
    ],
  },
  noSchedule: { count: 0, groups: [] },
  inactiveUser: { count: 0, groups: [] },
  tenantSetChanged: {
    changes: [
      { at: '2026-09-26T10:00:00.000Z', from: 7, to: 6, removed: ['klinika_c'], isNew: true },
      { at: '2026-09-21T10:00:00.000Z', from: 6, to: 7 },
    ],
  },
});

const q = vi.hoisted(() => ({ isError: false, refetch: vi.fn() }));

vi.mock('../../api/sams-status-api', () => ({
  useSamsWarnings: () => ({
    data: DATA,
    isLoading: false,
    isError: q.isError,
    error: q.isError ? new Error('502') : null,
    dataUpdatedAt: Date.parse('2026-09-27T05:00:00.000Z'),
    refetch: q.refetch,
  }),
}));

function renderIt() {
  return render(
    <ThemeProvider theme={theme as unknown as DefaultTheme}>
      <MemoryRouter>
        <SamsWarnings />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const section = (title: RegExp) => screen.getByText(title).closest('section') as HTMLElement;

beforeEach(() => {
  can.mockReset();
  q.isError = false;
  q.refetch.mockReset();
});

describe('SamsWarnings', () => {
  it('unresolved klinika bo‘yicha guruhlanadi, aniqlanmagan guruh nomi bilan', () => {
    renderIt();
    const s = section(/1\. JSHSHIR/);
    expect(within(s).getByText(/Akfa klinikasi · 1/)).toBeTruthy();
    expect(within(s).getByText(/Klinika aniqlanmagan \(hech qachon topilmagan\) · 1/)).toBeTruthy();
    expect(within(s).getByText('30101990000011')).toBeTruthy();
  });

  it('«Faqat yangilari» — faqat isNew qatorlar qoladi', () => {
    renderIt();
    expect(screen.getByText('Karimova Nodira')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Faqat yangilari/ }));
    expect(screen.getByText('Aliyev Vali')).toBeTruthy();
    expect(screen.queryByText('Karimova Nodira')).toBeNull();
    expect(within(section(/2\. Bir necha klinikada/)).getByText(/Yangi holat yo.q/)).toBeTruthy();
    expect(screen.queryByText(/6 → 7/)).toBeNull();
  });

  it('havolalar ruxsat bilan: jurnal — readAll, kontingent — resident:update', () => {
    can.mockImplementation((k) => k === 'residentAttendance:readAll' || k === 'resident:update');
    renderIt();
    expect(screen.getByRole('link', { name: 'Aliyev Vali' }).getAttribute('href')).toBe(
      '/residency/jurnal/r1',
    );
    expect(
      screen.getAllByRole('link', { name: /Kontingentda tahrirlash/ })[0]?.getAttribute('href'),
    ).toBe('/residency/kontingent/tahrir/r1');
  });

  it('ruxsatsiz — havola yo‘q, faqat matn', () => {
    can.mockReturnValue(false);
    renderIt();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Aliyev Vali')).toBeTruthy();
  });

  it('ambiguous — klinikalar ro‘yxati; tenant — sonlar va chiqib ketgan dbname', () => {
    renderIt();
    expect(screen.getByText('Akfa klinikasi, Respublika klinikasi')).toBeTruthy();
    expect(screen.getByText(/klinikalar soni: 7 → 6/)).toBeTruthy();
    expect(screen.getByText(/Chiqib ketgan: klinika_c/)).toBeTruthy();
  });

  it('🔴 qayta so‘rov yiqildi (data bor) — ro‘yxat va filtr qoladi, kichik izoh + qayta urinish', () => {
    const view = renderIt();
    fireEvent.click(screen.getByRole('checkbox', { name: /Faqat yangilari/ }));
    q.isError = true;
    view.rerender(
      <ThemeProvider theme={theme as unknown as DefaultTheme}>
        <MemoryRouter>
          <SamsWarnings />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText(/Yangilab bo.lmadi — ko.rsatilgan holat 10:00 dagi/)).toBeTruthy();
    expect(screen.queryByText(/Ma.lumotni yuklab bo.lmadi/)).toBeNull();
    expect(screen.getByText('Aliyev Vali')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Faqat yangilari/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(q.refetch).toHaveBeenCalledTimes(1);
  });

  it('holat kuni va oxirgi yig‘ma ko‘rinadi', () => {
    renderIt();
    expect(screen.getByText(/Holat kuni: 27\.09\.2026/)).toBeTruthy();
    expect(screen.getByText(/Oxirgi kunlik yig.ma: 26\.09\.2026/)).toBeTruthy();
  });
});
