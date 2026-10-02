import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import type { Attendance } from '../api/types';

const GRANTS: Record<string, string[]> = {
  klinik_ustoz: [
    'resident:read',
    'resident:readAll',
    'residencyNotice:create',
    'residentAttendance:create',
  ],
  rezident: ['resident:read'],
  rahbar: ['resident:read', 'resident:readAll', 'residentAttendance:readAll'],
  magistratura_bolim: [
    'resident:read',
    'resident:readAll',
    'resident:create',
    'residencyReport:readAll',
    'residentAttendance:create',
    'residentAttendance:approve',
  ],
  klinik_ustoz_preA1: [
    'resident:read',
    'resident:readAll',
    'residencyNotice:create',
    'residentAttendance:create',
    'residentAttendance:approve',
  ],
};

let currentRole = 'klinik_ustoz';
vi.mock('@/app/session', () => ({
  usePermission: () => (perm: string) => (GRANTS[currentRole] ?? []).includes(perm),
}));

const navigate = vi.hoisted(() => vi.fn());

const rec = (over: Partial<Attendance>): Attendance => ({
  id: 'att-x',
  residentId: 'res-1',
  resident: {
    id: 'res-1',
    fullName: 'Karimov Jasur',
    program: 'ordinatura',
    specialtyTitle: 'Kardiologiya',
    departmentTitle: null,
    courseNumber: 1,
    groupId: null,
    groupTitle: null,
  },
  date: '2026-09-25',
  scienceId: 'sci-1',
  scienceTitle: 'Kardiologiya',
  lessonType: 'amaliy',
  teacherId: 'u-1',
  teacherName: 'Ustozov Ustoz',
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

const RECORDS: Attendance[] = [
  rec({ id: 'att-1', status: 'present', checkInTime: '08:52', checkOutTime: '14:10' }),
  rec({ id: 'att-2', status: 'absent', checkInTime: null, checkOutTime: null }),
  rec({ id: 'att-3', status: 'present', checkInTime: '08:52', checkOutTime: null }),
  rec({ id: 'att-4', status: 'present', checkInTime: '', checkOutTime: '14:10' }),
];

let staffItems: Attendance[] = [];

vi.mock('../api/residency-api', () => ({
  useAttendance: () => ({
    data: { items: staffItems, total: staffItems.length, page: 1, totalPages: 1 },
    isFetching: false,
  }),
  useJournalStats: () => ({ data: undefined }),
  useAttendanceByResident: () => ({ data: undefined, isFetching: false }),
  useResidentAttendance: () => ({ data: RECORDS }),
  useMyResident: () => ({ data: { id: 'res-1' } }),
  useSciences: () => ({ data: [] }),
  useGroups: () => ({ data: [] }),
}));
vi.mock('../api/reference-api', () => ({
  useCourses: () => ({ data: [] }),
  useAcademicYears: () => ({ data: [] }),
  withCurrent: <T,>(list: T[]) => list,
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterDom>()),
  useNavigate: () => navigate,
}));
vi.mock('../components/LessonSession/SessionList', () => ({
  default: () => <div data-testid="session-list" />,
}));
vi.mock('../components/LessonSession/AnnounceModal', () => ({
  default: ({
    onAnnounced,
    onClose,
  }: {
    onAnnounced: (id: string | null) => void;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Mashg‘ulot e’loni">
      <button onClick={() => onAnnounced('s-new')}>stub-e’lon</button>
      <button onClick={() => onAnnounced(null)}>stub-e’lon-idsiz</button>
      <button onClick={onClose}>stub-yopish</button>
    </div>
  ),
}));
vi.mock('../components/AttendanceExcuse/ExcuseAbsenceModal', () => ({
  default: ({ record, onClose }: { record: Attendance; onClose: () => void }) => (
    <div role="dialog" aria-label="Sababli qilish oynasi">
      {record.id}
      <button onClick={onClose}>stub-sababli-yopish</button>
    </div>
  ),
}));

const { default: Davomat } = await import('./Davomat');

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderAs(role: string, entry = '/residency/davomat') {
  currentRole = role;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider theme={theme as unknown as DefaultTheme}>
        <Davomat />
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const ANNOUNCE_DIALOG = { name: 'Mashg‘ulot e’loni' };
const sessionsTab = () => screen.queryByRole('button', { name: 'Mashg‘ulotlar' });
const location = () => screen.getByTestId('location').textContent;

const PAGE_RENDER = { timeout: 20_000 };

describe('F1 — jurnalda qo‘lda davomat yozilmaydi (D-R2)', PAGE_RENDER, () => {
  beforeEach(() => vi.clearAllMocks());

  it('klinik ustoz: «Dars qo‘shish» yo‘q, «Mashg‘ulot e’lon qilish» e’lon oynasini shu yerda ochadi', () => {
    renderAs('klinik_ustoz');

    expect(screen.queryByRole('button', { name: /Dars qo‘shish/ })).toBeNull();
    expect(screen.queryByText(/qo‘lda tasdiqlayman/)).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('dialog', ANNOUNCE_DIALOG)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Mashg‘ulot e’lon qilish/ }));
    expect(screen.getByRole('dialog', ANNOUNCE_DIALOG)).toBeInTheDocument();
    expect(location()).toBe('/residency/davomat');

    fireEvent.click(screen.getByRole('button', { name: 'stub-e’lon' }));
    expect(navigate).toHaveBeenCalledWith('/residency/davomat/mashgulot/s-new');
    expect(screen.queryByRole('dialog', ANNOUNCE_DIALOG)).toBeNull();
  });

  it('oyna yopilsa sahifada qolinadi; javobda id bo‘lmasa «Mashg‘ulotlar» tabi ochiladi', () => {
    renderAs('klinik_ustoz');

    fireEvent.click(screen.getByRole('button', { name: /Mashg‘ulot e’lon qilish/ }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-yopish' }));
    expect(screen.queryByRole('dialog', ANNOUNCE_DIALOG)).toBeNull();
    expect(location()).toBe('/residency/davomat');

    fireEvent.click(screen.getByRole('button', { name: /Mashg‘ulot e’lon qilish/ }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-e’lon-idsiz' }));
    expect(screen.queryByRole('dialog', ANNOUNCE_DIALOG)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(location()).toBe('/residency/davomat?tab=mashgulotlar');
    expect(screen.getByTestId('session-list')).toBeInTheDocument();
  });

  it('e’lon granti yo‘q xodim tugmani ham, «Mashg‘ulotlar» tabini ham ko‘rmaydi', () => {
    renderAs('rahbar');

    expect(screen.queryByRole('button', { name: /Mashg‘ulot e’lon qilish/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Dars qo‘shish/ })).toBeNull();
    expect(sessionsTab()).toBeNull();
    expect(screen.queryByTestId('session-list')).toBeNull();
  });
});

describe('F1-Q10 — «Mashg‘ulotlar» Jurnal tabi (menyu bandi emas)', PAGE_RENDER, () => {
  beforeEach(() => vi.clearAllMocks());

  it('tab e’lonlar ro‘yxatini ochadi, davomat kartochkalari, filtrlari va jadvali yashirinadi, tab URL’ga yoziladi', () => {
    renderAs('klinik_ustoz');
    expect(screen.queryByTestId('session-list')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'F.I.Sh' })).toBeInTheDocument();
    expect(screen.getByText('Umumiy davomat')).toBeInTheDocument();

    fireEvent.click(sessionsTab()!);

    expect(screen.getByTestId('session-list')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'F.I.Sh' })).toBeNull();
    expect(screen.queryByText('Umumiy davomat')).toBeNull();
    expect(screen.queryByRole('button', { name: /Mashg‘ulot e’lon qilish/ })).toBeNull();
    expect(location()).toBe('/residency/davomat?tab=mashgulotlar');
  });

  it('`?tab=mashgulotlar` bilan kelinsa (tafsilotdan «orqaga») darhol shu tab ochiladi', () => {
    renderAs('klinik_ustoz', '/residency/davomat?tab=mashgulotlar');
    expect(screen.getByTestId('session-list')).toBeInTheDocument();
  });

  it('«Kunlik dars» ga qaytilsa `tab` URL’dan olib tashlanadi, boshqa parametrlar qoladi', () => {
    renderAs('klinik_ustoz', '/residency/davomat?tab=mashgulotlar&x=1');
    fireEvent.click(screen.getByRole('button', { name: 'Kunlik dars' }));

    expect(screen.queryByTestId('session-list')).toBeNull();
    expect(location()).toBe('/residency/davomat?x=1');
  });

  it('e’lon huquqisiz `?tab=mashgulotlar` — standart tab (bo‘sh sahifa emas)', () => {
    renderAs('rahbar', '/residency/davomat?tab=mashgulotlar');
    expect(screen.queryByTestId('session-list')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'F.I.Sh' })).toBeInTheDocument();
  });

  it('rezident jurnalida tab yo‘q', () => {
    renderAs('rezident', '/residency/davomat?tab=mashgulotlar');
    expect(sessionsTab()).toBeNull();
    expect(screen.queryByTestId('session-list')).toBeNull();
  });
});

describe('F2 — «Batafsil»da kelgan/ketgan vaqti faqat o‘qiladi', PAGE_RENDER, () => {
  beforeEach(() => vi.clearAllMocks());

  const timeRow = (): HTMLElement => {
    const row = screen.getByText('Kelgan / ketgan').parentElement;
    if (!row) throw new Error('«Kelgan / ketgan» qatori topilmadi');
    return row;
  };

  it('ikkala vaqt bo‘lsa oraliq ko‘rinadi, tahrirlash maydoni yo‘q', () => {
    renderAs('rezident');
    fireEvent.click(screen.getAllByTitle('Batafsil')[0]!);

    const row = timeRow();
    expect(row).toHaveTextContent('08:52–14:10');
    expect(within(row).queryByRole('textbox')).toBeNull();
  });

  it('vaqt yozilmagan qatorda «—»', () => {
    renderAs('rezident');
    fireEvent.click(screen.getAllByTitle('Batafsil')[1]!);

    const row = timeRow();
    expect(row).toHaveTextContent('—');
    expect(row).not.toHaveTextContent(':');
  });

  it.each([
    ['faqat kelgan vaqti bor (ketgan null)', 2],
    ['faqat ketgan vaqti bor (kelgan bo‘sh satr)', 3],
  ])('chala juftlikda «—»: %s', (_case, index) => {
    renderAs('rezident');
    fireEvent.click(screen.getAllByTitle('Batafsil')[index]!);

    const row = timeRow();
    expect(row).toHaveTextContent('—');
    expect(row).not.toHaveTextContent(/null|undefined|\d/);
  });
});

describe(
  'EXC — «Sababli qilish» faqat bo‘lim xodimida va faqat «Kelmadi» qatorida',
  PAGE_RENDER,
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
      staffItems = [
        rec({
          id: 'att-p',
          status: 'present',
          resident: { ...rec({}).resident!, fullName: 'Keldi Kelganov' },
        }),
        rec({
          id: 'att-a',
          status: 'absent',
          resident: { ...rec({}).resident!, fullName: 'Kelmadi Qoldirov' },
        }),
        rec({
          id: 'att-e',
          status: 'excused',
          excuseReason: 'Kasallik varaqasi',
          resident: { ...rec({}).resident!, fullName: 'Sababli Uzrliyev' },
        }),
      ];
    });

    afterEach(() => {
      staffItems = [];
    });

    const excuseButtons = () => screen.queryAllByTitle('Sababli qilish');

    it('bo‘lim xodimi: tugma bitta — «Kelmadi» qatorida; bosilsa o‘sha qator oynasi ochiladi', () => {
      renderAs('magistratura_bolim');

      expect(excuseButtons()).toHaveLength(1);
      const btn = screen.getByRole('button', { name: 'Kelmadi Qoldirov — 2026-09-25 — sababli qilish' });
      expect(btn.closest('tr')).toHaveTextContent('Kelmadi');

      fireEvent.click(btn);
      expect(screen.getByRole('dialog', { name: 'Sababli qilish oynasi' })).toHaveTextContent(
        'att-a',
      );
      fireEvent.click(screen.getByRole('button', { name: 'stub-sababli-yopish' }));
      expect(screen.queryByRole('dialog', { name: 'Sababli qilish oynasi' })).toBeNull();
    });

    it.each(['klinik_ustoz', 'klinik_ustoz_preA1', 'rahbar', 'rezident'])(
      '%s — «Sababli qilish» tugmasi yo‘q',
      (role) => {
        renderAs(role);
        expect(excuseButtons()).toHaveLength(0);
      },
    );

    it('«Batafsil»: sababli qatorda «Sabab» ko‘rinadi, «Kelmadi» qatorida yo‘q', () => {
      renderAs('magistratura_bolim');

      fireEvent.click(screen.getAllByTitle('Batafsil')[2]!);
      const row = screen.getByText('Sabab').parentElement;
      expect(row).toHaveTextContent('Kasallik varaqasi');
      fireEvent.click(screen.getAllByRole('button', { name: 'Yopish' })[0]!);

      fireEvent.click(screen.getAllByTitle('Batafsil')[1]!);
      expect(screen.queryByText('Sabab')).toBeNull();
    });
  },
);
