import { render, screen } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { theme } from '../../styles/theme';
import type { SupervisorCard as SupervisorCardType } from '../../api/residency-api';

const useSupervisorCard = vi.fn();
vi.mock('../../api/residency-api', () => ({
  useSupervisorCard: (id: string | null) => useSupervisorCard(id),
}));

const { default: SupervisorCardModal, SupervisorInfo } = await import('./index');

const asDefaultTheme = theme as unknown as DefaultTheme;

const CARD: SupervisorCardType = {
  id: 'u1',
  fullName: 'Ergasheva Dilnoza Shavkatovna',
  academicTitle: 'Dotsent',
  position: 'Kafedra mudiri',
  department: 'Farmakologiya kafedrasi',
  faculty: 'Davolash fakulteti',
  division: null,
  phone: '+998901112233',
  office: '214-xona',
  workingHours: 'Du–Ju, 9:00–17:00',
};

const wrap = (ui: React.ReactNode) =>
  render(<ThemeProvider theme={asDefaultTheme}>{ui}</ThemeProvider>);

describe('SupervisorInfo — talabaning ish joyi koordinatasi', () => {
  it('prop berilmasa blok UMUMAN chizilmaydi (biriktirish oynasi holati)', () => {
    wrap(<SupervisorInfo card={CARD} />);

    expect(screen.queryByText('Talabaning ish joyi')).not.toBeInTheDocument();
    expect(screen.queryByText('Ish joyi kengligi')).not.toBeInTheDocument();
    expect(screen.queryByText('Ish joyi uzunligi')).not.toBeInTheDocument();
  });

  it('koordinata bor — kenglik va uzunlik alohida qator bo‘lib chiqadi', () => {
    wrap(<SupervisorInfo card={CARD} workplaceLocation={{ lat: 41.311081, lng: 69.240562 }} />);

    expect(screen.getByText('Ish joyi kengligi')).toBeInTheDocument();
    expect(screen.getByText('41.311081')).toBeInTheDocument();
    expect(screen.getByText('Ish joyi uzunligi')).toBeInTheDocument();
    expect(screen.getByText('69.240562')).toBeInTheDocument();
  });

  it('blok sarlavhasi koordinata KIMNIKI ekanini aytadi', () => {
    wrap(<SupervisorInfo card={CARD} workplaceLocation={{ lat: 41, lng: 69 }} />);

    expect(screen.getByText('Talabaning ish joyi')).toBeInTheDocument();
  });

  it('koordinata yo‘q (null) — qatorlar chiziqcha bilan qoladi', () => {
    wrap(<SupervisorInfo card={CARD} workplaceLocation={null} />);

    expect(screen.getByText('Talabaning ish joyi')).toBeInTheDocument();
    expect(screen.getByText('Ish joyi kengligi')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('ustoz maydonlari o‘z holicha qoladi', () => {
    wrap(<SupervisorInfo card={CARD} workplaceLocation={{ lat: 41, lng: 69 }} />);

    expect(screen.getByText('Ergasheva Dilnoza Shavkatovna')).toBeInTheDocument();
    expect(screen.getByText('Farmakologiya kafedrasi')).toBeInTheDocument();
    expect(screen.getByText('214-xona')).toBeInTheDocument();
  });
});

describe('SupervisorCardModal — propni kartaga uzatadi', () => {
  beforeEach(() => useSupervisorCard.mockReset());

  it('koordinata modal orqali ham yetib boradi', () => {
    useSupervisorCard.mockReturnValue({ data: CARD, isLoading: false, isError: false });

    wrap(
      <SupervisorCardModal
        supervisorId="u1"
        workplaceLocation={{ lat: 40.5, lng: 68.5 }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('40.5')).toBeInTheDocument();
    expect(screen.getByText('68.5')).toBeInTheDocument();
  });

  it('koordinata berilmasa blok yo‘q', () => {
    useSupervisorCard.mockReturnValue({ data: CARD, isLoading: false, isError: false });

    wrap(<SupervisorCardModal supervisorId="u1" onClose={() => {}} />);

    expect(screen.queryByText('Talabaning ish joyi')).not.toBeInTheDocument();
  });

  it('yuklanayotganda karta ham, koordinata ham chizilmaydi', () => {
    useSupervisorCard.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    wrap(
      <SupervisorCardModal
        supervisorId="u1"
        workplaceLocation={{ lat: 40.5, lng: 68.5 }}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText('Ish joyi kengligi')).not.toBeInTheDocument();
  });
});
