import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import { mapResidentRollup, type BackendResidentRollup } from '../api/mapper';
import type { ResidentRollup } from '../api/types';

const h = vi.hoisted(() => ({ rollup: [] as unknown[] }));

const GRANTS = ['resident:read', 'resident:readAll', 'residentAttendance:readAll'];
vi.mock('@/app/session', () => ({
  usePermission: () => (perm: string) => GRANTS.includes(perm),
}));
vi.mock('../api/residency-api', () => ({
  useAttendance: () => ({
    data: { items: [], total: 0, page: 1, totalPages: 1 },
    isFetching: false,
  }),
  useJournalStats: () => ({ data: undefined }),
  useAttendanceByResident: () => ({
    data: { items: h.rollup, total: h.rollup.length, page: 1, totalPages: 1 },
    isFetching: false,
  }),
  useResidentAttendance: () => ({ data: [] }),
  useMyResident: () => ({ data: undefined }),
  useSciences: () => ({ data: [] }),
  useGroups: () => ({ data: [] }),
}));
vi.mock('../api/reference-api', () => ({
  useCourses: () => ({ data: [] }),
  useAcademicYears: () => ({ data: [] }),
  withCurrent: <T,>(list: T[]) => list,
}));
vi.mock('../components/LessonSession/SessionList', () => ({ default: () => null }));
vi.mock('../components/LessonSession/AnnounceModal', () => ({ default: () => null }));
vi.mock('../components/AttendanceExcuse/ExcuseAbsenceModal', () => ({ default: () => null }));

const { default: Davomat } = await import('./Davomat');

const row = (id: string, name: string, extra: Partial<BackendResidentRollup>): ResidentRollup =>
  mapResidentRollup({
    _id: id,
    resident: { _id: id, fullName: name, specialtyTitle: 'Kardiologiya', courseNumber: 1 },
    total: 10,
    present: 8,
    scoreSum: 580,
    lastDate: '2026-09-29',
    ...extra,
  });

function drawTarix(rollup: ResidentRollup[]) {
  h.rollup = rollup;
  render(
    <MemoryRouter initialEntries={['/residency/davomat']}>
      <ThemeProvider theme={theme as unknown as DefaultTheme}>
        <Davomat />
      </ThemeProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText('Darslar tarixi'));
}

const cellsOf = (name: string) =>
  within(screen.getByText(name).closest('tr') as HTMLElement).getAllByRole('cell');

describe('Davomat «Darslar tarixi» — «O‘rtacha ball» (LSC-Q6=A)', { timeout: 20_000 }, () => {
  it('🔴 sarlavha «O‘rtacha ball»; yangi backend — scoreAvg, eski backend — «—» (yig‘indi EMAS)', () => {
    drawTarix([
      row('r1', 'Yangi Backend', { scoreAvg: 72.5, scoredCount: 8 }),
      row('r2', 'Eski Backend', {}),
    ]);
    expect(screen.getByRole('columnheader', { name: 'O‘rtacha ball' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Jami ball' })).toBeNull();

    const fresh = cellsOf('Yangi Backend')[5]!;
    expect(fresh).toHaveTextContent('72.5');
    expect(fresh).toHaveAttribute('title', '8 ta ball qo‘yilgan dars bo‘yicha');

    const legacy = cellsOf('Eski Backend')[5]!;
    expect(legacy).toHaveTextContent('—');
    expect(legacy).not.toHaveTextContent('580');
    expect(legacy).not.toHaveAttribute('title');
  });
});
