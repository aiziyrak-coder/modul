import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import type { Attendance } from '../api/types';

const h = vi.hoisted(() => ({ grants: [] as string[], records: [] as unknown[] }));

vi.mock('@/app/session', () => ({
  usePermission: () => (key: string) => h.grants.includes(key),
}));
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
vi.mock('../components/AttendanceExcuse/ExcuseAbsenceModal', () => ({
  default: ({ record, onClose }: { record: { id: string }; onClose: () => void }) => (
    <div role="dialog" aria-label="Sababli qilish oynasi">
      {record.id}
      <button onClick={onClose}>stub-yopish</button>
    </div>
  ),
}));

const { default: JurnalDetail } = await import('./JurnalDetail');

const OFFICE = [
  'resident:read',
  'resident:readAll',
  'resident:create',
  'residencyReport:readAll',
  'residentAttendance:create',
  'residentAttendance:approve',
];
const KLINIK_USTOZ_PRE_A1 = [
  'resident:read',
  'resident:readAll',
  'resident:create',
  'residencyNotice:create',
  'residentAttendance:create',
  'residentAttendance:approve',
];

const rec = (over: Partial<Attendance>): Attendance => ({
  id: 'att-x',
  residentId: 'res-1',
  resident: {
    id: 'res-1',
    fullName: 'Karimov Jasur',
    program: 'ordinatura',
    specialtyTitle: 'Kardiologiya',
    departmentTitle: 'Terapiya',
    courseNumber: 1,
    groupId: null,
    groupTitle: null,
  },
  date: '2026-09-25',
  scienceId: 'sci-1',
  scienceTitle: 'Kardiologiya',
  lessonType: 'amaliy',
  teacherId: null,
  teacherName: null,
  groupId: null,
  status: 'present',
  hours: 2,
  score: null,
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
  ...over,
});

const application = (fileUrl: string | null) => ({
  id: 'app-1',
  fileUrl,
  reason: 'Ariza sababi',
  type: null,
  status: null,
});

const RECORDS: Attendance[] = [
  rec({ id: 'att-present', date: '2026-09-29', status: 'present', score: 8 }),
  rec({ id: 'att-absent', date: '2026-09-28', status: 'absent' }),
  rec({
    id: 'att-office',
    date: '2026-09-27',
    status: 'excused',
    excuseReason: 'Kasallik varaqasi',
    application: null,
  }),
  rec({
    id: 'att-app-nofile',
    date: '2026-09-26',
    status: 'excused',
    excuseReason: 'Ariza sababi',
    application: application(null),
  }),
  rec({
    id: 'att-app-file',
    date: '2026-09-25',
    status: 'excused',
    excuseReason: 'Ariza sababi',
    application: application('/files/a.pdf'),
  }),
  rec({
    id: 'att-legacy-app',
    date: '2026-09-24',
    status: 'excused',
    excuseReason: 'Ariza asosida',
    fromDate: '2026-08-01',
    toDate: '2026-08-05',
    application: null,
  }),
];

function draw(grants: string[], records: Attendance[] = RECORDS) {
  h.grants = grants;
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

const bodyRows = () => screen.getAllByRole('row').slice(1);
const rowOf = (id: string) => bodyRows()[RECORDS.findIndex((r) => r.id === id)]!;
const asosCell = (id: string) => {
  const cells = within(rowOf(id)).getAllByRole('cell');
  return cells[6]!;
};

beforeEach(() => vi.clearAllMocks());

describe('EXC — «darslar tarixi»da «Sababli qilish»', () => {
  it('bo‘lim xodimi: «Amallar» ustuni, tugma faqat «Kelmadi» qatorida, oyna shu qator bilan', () => {
    draw(OFFICE);

    expect(screen.getByRole('columnheader', { name: 'Amallar' })).toBeInTheDocument();
    const buttons = screen.getAllByTitle('Sababli qilish');
    expect(buttons).toHaveLength(1);
    expect(rowOf('att-absent')).toContainElement(buttons[0]!);

    fireEvent.click(buttons[0]!);
    expect(screen.getByRole('dialog', { name: 'Sababli qilish oynasi' })).toHaveTextContent(
      'att-absent',
    );
  });

  it('klinik ustoz (A1 gacha `approve` bilan ham) — ustun ham, tugma ham yo‘q', () => {
    draw(KLINIK_USTOZ_PRE_A1);

    expect(screen.queryByRole('columnheader', { name: 'Amallar' })).toBeNull();
    expect(screen.queryAllByTitle('Sababli qilish')).toHaveLength(0);
    expect(within(rowOf('att-absent')).getAllByRole('cell')).toHaveLength(7);
  });

  it.each([
    ['klinik ustoz', KLINIK_USTOZ_PRE_A1, '7'],
    ['bo‘lim xodimi', OFFICE, '8'],
  ])('bo‘sh jadval — %s: colSpan %s', (_label, grants, span) => {
    draw(grants, []);
    expect(screen.getByText('Yozuvlar topilmadi')).toHaveAttribute('colspan', span);
  });
});

describe('EXC — «Asos» katagi: «Bo‘lim» faqat arizasiz sababli qatorda', () => {
  it('arizasiz sababli — «Bo‘lim», sabab title da', () => {
    draw(OFFICE);
    const label = within(asosCell('att-office')).getByText('Bo‘lim');
    expect(label).toHaveAttribute('title', 'Kasallik varaqasi');
  });

  it('arizali, lekin faylsiz — «—», «Bo‘lim» EMAS', () => {
    draw(OFFICE);
    const cell = asosCell('att-app-nofile');
    expect(within(cell).queryByText('Bo‘lim')).toBeNull();
    expect(cell).toHaveTextContent('—');
  });

  it('eski arizali (havolasiz, lekin `fromDate` bor) — «—», «Bo‘lim» EMAS', () => {
    draw(OFFICE);
    const cell = asosCell('att-legacy-app');
    expect(within(cell).queryByText('Bo‘lim')).toBeNull();
    expect(cell).toHaveTextContent('—');
  });

  it('arizali, fayl bilan — hujjat havolasi (o‘zgarmadi)', () => {
    draw(OFFICE);
    const cell = asosCell('att-app-file');
    expect(within(cell).getByRole('link')).toHaveAttribute('href', '/files/a.pdf');
    expect(within(cell).queryByText('Bo‘lim')).toBeNull();
  });

  it.each(['att-present', 'att-absent'])('%s — «Bo‘lim» yo‘q', (id) => {
    draw(OFFICE);
    expect(within(asosCell(id)).queryByText('Bo‘lim')).toBeNull();
  });

  it('klinik ustozda ham «Bo‘lim» yozuvi ko‘rinadi (faqat o‘qish)', () => {
    draw(KLINIK_USTOZ_PRE_A1);
    expect(within(asosCell('att-office')).getByText('Bo‘lim')).toBeInTheDocument();
  });
});
