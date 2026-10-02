import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import type { Attendance } from '../api/types';

const h = vi.hoisted(() => ({ records: [] as unknown[] }));

vi.mock('@/app/session', () => ({ usePermission: () => () => false }));
vi.mock('../api/residency-api', () => ({
  useResidentAttendance: () => ({
    data: h.records,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAttendanceStats: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const { default: JurnalDetail } = await import('./JurnalDetail');

const rec = (id: string, status: Attendance['status'], score: number | null): Attendance => ({
  id,
  residentId: 'res-1',
  resident: null,
  date: '2026-09-25',
  scienceId: 'sci-1',
  scienceTitle: 'Kardiologiya',
  lessonType: 'maruza',
  teacherId: null,
  teacherName: null,
  groupId: null,
  status,
  hours: 2,
  score,
  samsVerified: false,
  manualVerified: false,
  checkInTime: null,
  checkOutTime: null,
  late: false,
  lateMinutes: null,
  excuseReason: null,
  fromDate: null,
  toDate: null,
  application: null,
});

function draw(records: Attendance[]) {
  h.records = records;
  return render(
    <MemoryRouter initialEntries={['/residency/jurnal/res-1']}>
      <ThemeProvider theme={theme as unknown as DefaultTheme}>
        <Routes>
          <Route path="/residency/jurnal/:residentId" element={<JurnalDetail />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

const avgCard = () => screen.getByText('O‘rtacha ball').previousElementSibling;

describe('JurnalDetail — «O‘rtacha ball» (LSC-Q6=A)', { timeout: 20_000 }, () => {
  it('🔴 kelmagan, sababli va ballsiz darslar maxrajga KIRMAYDI', () => {
    draw([
      rec('a1', 'present', 80),
      rec('a2', 'present', 65),
      rec('a3', 'present', null),
      rec('a4', 'absent', null),
      rec('a5', 'absent', 10),
      rec('a6', 'excused', 90),
    ]);
    expect(avgCard()).toHaveTextContent('72.5');
    expect(screen.queryByText('Jami ball')).toBeNull();
  });

  it('ballangan dars yo‘q — «—», 0 EMAS', () => {
    draw([rec('a1', 'present', null), rec('a2', 'absent', null)]);
    expect(avgCard()).toHaveTextContent('—');
  });
});
