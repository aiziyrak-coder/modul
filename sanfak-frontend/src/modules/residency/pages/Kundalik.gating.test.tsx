import { render, screen } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { theme } from '../styles/theme';
import type { DailyLog } from '../api/types';

const GRANTS: Record<string, string[]> = {
  ilmiy_rahbar: [
    'resident:read',
    'resident:readAll',
    'residencyNotice:create',
    'residentDailyLog:approve',
  ],
  klinik_ustoz: [
    'resident:read',
    'resident:readAll',
    'residencyNotice:create',
    'residentAttendance:create',
    'residentDailyLog:approve',
  ],
  kafedra_mudiri: ['resident:read', 'resident:readAll'],
};

let currentRole = 'ilmiy_rahbar';
vi.mock('@/app/session', () => ({
  usePermission: () => (perm: string) => (GRANTS[currentRole] ?? []).includes(perm),
}));

const LOG: DailyLog = {
  id: 'log-1',
  residentId: 'res-1',
  resident: {
    id: 'res-1',
    fullName: 'Sobirova Nilufar',
    program: 'magistratura',
    specialtyTitle: 'Kardiologiya',
    departmentTitle: null,
    courseNumber: 1,
    groupId: null,
    groupTitle: null,
  },
  date: '2026-09-01',
  workType: 'Klinik ish',
  semester: null,
  clinicalWork: 'Bemor ko‘rigi',
  skills: [],
  status: 'kutilmoqda',
  supervisorName: null,
  supervisorComment: null,
  comment: null,
  fileUrl: null,
};

const noopMutation = { mutateAsync: vi.fn(), isPending: false };

vi.mock('../api/residency-api', () => ({
  useDailyLogs: () => ({ data: { items: [LOG], total: 1, page: 1, totalPages: 1 } }),
  useDailyLogStats: () => ({ data: { total: 1, kutilmoqda: 1, tasdiqlangan: 0, qaytarilgan: 0 } }),
  useCreateDailyLog: () => noopMutation,
  useUpdateDailyLog: () => noopMutation,
  useApproveDailyLog: () => noopMutation,
  useReturnDailyLog: () => noopMutation,
  useMyResident: () => ({ data: null }),
  useGroups: () => ({ data: [] }),
}));
vi.mock('../api/reference-api', () => ({
  useAcademicYears: () => ({ data: [] }),
  useCourses: () => ({ data: [] }),
  academicYearWindow: () => null,
}));
vi.mock('../api/skill-api', () => ({ useSkills: () => ({ data: [] }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const { default: Kundalik } = await import('./Kundalik');

function renderAs(role: string) {
  currentRole = role;
  return render(
    <ThemeProvider theme={theme as unknown as DefaultTheme}>
      <Kundalik />
    </ThemeProvider>,
  );
}

describe('Kundalik — ustoz bo‘limi `residentDailyLog:approve` ga bog‘langan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ilmiy_rahbar kundalikni TASDIQLAY oladi (davomat granti bo‘lmasa ham)', () => {
    renderAs('ilmiy_rahbar');

    expect(screen.getByTitle('Tasdiqlash')).toBeInTheDocument();
    expect(screen.getByTitle('Qaytarish')).toBeInTheDocument();
    expect(screen.getByText('So‘nggi yozuvlar')).toBeInTheDocument();
  });

  it('klinik_ustoz uchun ham ishlaydi (regressiya nazorati)', () => {
    renderAs('klinik_ustoz');

    expect(screen.getByTitle('Tasdiqlash')).toBeInTheDocument();
  });

  it('`approve` granti YO‘Q rolda amallar chizilmaydi', () => {
    renderAs('kafedra_mudiri');

    expect(screen.queryByTitle('Tasdiqlash')).not.toBeInTheDocument();
    expect(screen.queryByText('So‘nggi yozuvlar')).not.toBeInTheDocument();
    expect(screen.getByText('Sobirova Nilufar')).toBeInTheDocument();
  });
});
