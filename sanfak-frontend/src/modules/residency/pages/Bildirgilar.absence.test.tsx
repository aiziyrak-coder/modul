import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import type * as NoticeApi from '../api/notice-api';
import type { AbsenceStreak, Notice } from '../api/notice-types';

const m = vi.hoisted(() => ({
  notices: [] as Notice[],
  streak: undefined as AbsenceStreak | undefined,
  create: vi.fn(),
}));

const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });

vi.mock('@/app/session', () => ({ usePermission: () => () => true }));
vi.mock('../lib/capabilities', () => ({
  useResidencyCapabilities: () => ({ canDecideNotice: false, canSendNotice: true, isMentor: true }),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isLoading: false }),
}));
vi.mock('../api/reference-api', () => ({
  academicYearValue: () => '',
  useAcademicYears: () => ({ data: [] }),
  withCurrent: (list: unknown[]) => list,
  useCourses: () => ({ data: [] }),
}));
vi.mock('../api/residency-api', () => ({
  useMyResidents: () => ({ data: [{ id: 'r1', fullName: 'Aliyev Vali' }] }),
  useSpecialties: () => ({ data: [] }),
  useDepartments: () => ({ data: [] }),
  useGroups: () => ({ data: [] }),
}));
vi.mock('../api/notice-api', async (importOriginal) => ({
  ...(await importOriginal<typeof NoticeApi>()),
  useNotices: () => ({ data: m.notices, isLoading: false }),
  useCreateNotice: () => ({ mutateAsync: m.create, isPending: false }),
  useUpdateNotice: mutation,
  useDeleteNotice: mutation,
  useViewNotice: mutation,
  useReviewNotice: mutation,
  useProblemStudents: () => ({ data: [], isLoading: false }),
  useCreateProblemStudent: mutation,
  useUpdateProblemStudent: mutation,
  useDeleteProblemStudent: mutation,
  useAbsenceStreak: (residentId: string | null) => ({
    data: residentId ? m.streak : undefined,
    isLoading: false,
  }),
  downloadNoticePdf: vi.fn(),
}));

const { mapAbsenceStreak, mapNotice } = await import('../api/notice-api');
const { default: Bildirgilar } = await import('./Bildirgilar');

const NEW_STREAK = {
  resident: 'r1',
  days: 3,
  from: '2026-09-21',
  to: '2026-09-25',
  threshold: 3,
  eligible: true,
  windowDays: 7,
  windowFrom: '2026-09-19',
  windowTo: '2026-09-25',
  dayKeys: ['2026-09-21', '2026-09-23', '2026-09-25'],
  lastNotice: null,
};

const OLD_STREAK = {
  resident: 'r1',
  days: 4,
  from: '2026-09-21',
  to: '2026-09-24',
  threshold: 3,
  eligible: true,
};

const CHECKBOX = 'Davomat bildirgisi sifatida yuborish (PDF hujjat ilova qilinadi)';

function draw() {
  return render(
    <ConfigProvider>
      <AntdApp>
        <ThemeProvider theme={theme as unknown as DefaultTheme}>
          <Bildirgilar />
        </ThemeProvider>
      </AntdApp>
    </ConfigProvider>,
  );
}

async function openCreateWithResident() {
  draw();
  fireEvent.click(screen.getByRole('button', { name: /Yangi bildirgi/ }));
  const group = screen.getByText('Talaba (davomat bildirgisi uchun)').parentElement;
  const selector = group?.querySelector('.ant-select-selector');
  if (!selector) throw new Error('Talaba tanlovi topilmadi');
  fireEvent.mouseDown(selector);
  fireEvent.click(await screen.findByTitle('Aliyev Vali'));
}

const rowOf = (title: string): HTMLElement => {
  const tr = screen.getByText(title).closest('tr');
  if (!tr) throw new Error(`qator yo'q: ${title}`);
  return tr;
};

beforeEach(() => {
  m.notices = [];
  m.streak = undefined;
  m.create.mockReset();
  m.create.mockResolvedValue({});
});

describe('Bildirgilar — yaratish oynasi, oyna qoidasi (ABS)', { timeout: 30_000 }, () => {
  it('eligible — katakcha bor; «Oxirgi 7 kunda», sanalgan kunlar va ostona', async () => {
    m.streak = mapAbsenceStreak(NEW_STREAK, 'r1');
    await openCreateWithResident();

    const info = await screen.findByText(/Oxirgi 7 kunda/);
    expect(info).toHaveTextContent(
      'Oxirgi 7 kunda (2026-09-19 — 2026-09-25) sababsiz qoldirgan: 3 kun — 2026-09-21, 2026-09-23, 2026-09-25 · ostona: 3 kun',
    );
    expect(within(info).getByText('3 kun').tagName).toBe('B');
    expect(screen.getByLabelText(CHECKBOX)).toBeInTheDocument();
    expect(screen.queryByText(/ketma-ket/i)).toBeNull();
    expect(screen.queryByText(/Bu rezident uchun/)).toBeNull();
  });

  it('eligible emas — aniq yordamchi matn, katakcha yo‘q', async () => {
    m.streak = mapAbsenceStreak(
      { ...NEW_STREAK, days: 2, eligible: false, dayKeys: ['2026-09-22', '2026-09-24'] },
      'r1',
    );
    await openCreateWithResident();

    expect(
      await screen.findByText(
        'Davomat bildirgisi oxirgi 7 kunda kamida 3 kun sababsiz qoldirilganda yuboriladi.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Oxirgi 7 kunda/)).toHaveTextContent(
      'sababsiz qoldirgan: 2 kun — 2026-09-22, 2026-09-24 · ostona: 3 kun',
    );
    expect(screen.queryByLabelText(CHECKBOX)).toBeNull();
  });

  it('sanalgan kun yo‘q — « — » qo‘shimchasi yo‘q', async () => {
    m.streak = mapAbsenceStreak(
      { ...NEW_STREAK, days: 0, eligible: false, from: null, to: null, dayKeys: [] },
      'r1',
    );
    await openCreateWithResident();

    const info = await screen.findByText(/Oxirgi 7 kunda/);
    expect(info.textContent).toBe(
      'Oxirgi 7 kunda (2026-09-19 — 2026-09-25) sababsiz qoldirgan: 0 kun · ostona: 3 kun',
    );
  });

  it('🔴 eski backend — neytral matn, «ketma-ket» YO‘Q; eligible emas — umumiy yordamchi', async () => {
    m.streak = mapAbsenceStreak({ ...OLD_STREAK, eligible: false }, 'r1');
    await openCreateWithResident();

    const info = await screen.findByText(/Sababsiz qoldirgan:/);
    expect(info.textContent).toBe(
      'Sababsiz qoldirgan: 4 kun (2026-09-21 — 2026-09-24) · ostona: 3 kun',
    );
    expect(
      screen.getByText('Davomat bildirgisi ostonaga yetganda yuboriladi.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Oxirgi/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/ketma-ket/i);
    expect(screen.queryByLabelText(CHECKBOX)).toBeNull();
  });

  it('eski backend, eligible — katakcha bor, «ketma-ket» yo‘q', async () => {
    m.streak = mapAbsenceStreak(OLD_STREAK, 'r1');
    await openCreateWithResident();

    expect(await screen.findByLabelText(CHECKBOX)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ketma-ket/i);
  });

  it('lastNotice — ogohlantirish chiqadi, lekin katakcha va yuborish ishlaydi', async () => {
    m.streak = mapAbsenceStreak(
      {
        ...NEW_STREAK,
        lastNotice: {
          id: 'n9',
          createdAt: '2026-09-22T05:00:00.000Z',
          days: 3,
          from: '2026-09-15',
          to: '2026-09-19',
        },
      },
      'r1',
    );
    await openCreateWithResident();

    expect(
      await screen.findByText(
        'Bu rezident uchun 2026-09-22 da davomat bildirgisi yuborilgan (2026-09-15 — 2026-09-19, 3 kun). Yana yuborish mumkin.',
      ),
    ).toBeInTheDocument();

    const box = screen.getByLabelText<HTMLInputElement>(CHECKBOX);
    expect(box).toBeEnabled();
    fireEvent.click(box);
    expect(box.checked).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Bildirgi sarlavhasini kiriting'), {
      target: { value: 'Davomat' },
    });
    fireEvent.change(screen.getByPlaceholderText('Bildirgi matnini kiriting...'), {
      target: { value: 'Matn' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }));
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'davomat', resident: 'r1' }),
    );
  });
});

describe('Bildirgilar — ko‘rish oynasi, absence snapshot', { timeout: 30_000 }, () => {
  type RawAbsence = Parameters<typeof NoticeApi.mapNotice>[0]['absence'];
  const davomat = (id: string, title: string, absence: RawAbsence) =>
    mapNotice({
      _id: id,
      program: 'magistratura',
      kind: 'davomat',
      status: 'yangi',
      sender: 'u2',
      title,
      content: 'Matn',
      createdAt: '2026-09-26T05:00:00.000Z',
      absence,
    });

  beforeEach(() => {
    m.notices = [
      davomat('d1', 'Yangi qoida', {
        days: 3,
        from: '2026-09-21',
        to: '2026-09-25',
        windowDays: 7,
        windowFrom: '2026-09-19',
        windowTo: '2026-09-25',
      }),
      davomat('d2', 'Eski qoida', { days: 5, from: '2026-09-01', to: '2026-09-08' }),
    ];
  });

  it('yangi snapshot — «Sababsiz qoldirgan» + «Tekshirilgan davr»', () => {
    draw();
    fireEvent.click(within(rowOf('Yangi qoida')).getByTitle('Ko‘rish'));

    expect(screen.getByText('Sababsiz qoldirgan')).toBeInTheDocument();
    expect(screen.getByText('3 kun (oxirgi 7 kunda)')).toBeInTheDocument();
    expect(screen.getByText('Tekshirilgan davr')).toBeInTheDocument();
    expect(screen.getByText('2026-09-19 — 2026-09-25')).toBeInTheDocument();
    expect(screen.queryByText('Ketma-ket qoldirgan')).toBeNull();
    expect(screen.queryByText('Davri')).toBeNull();
  });

  it('eski snapshot (windowDays null) — «Ketma-ket qoldirgan» + «Davri» o‘zgarmagan', () => {
    draw();
    fireEvent.click(within(rowOf('Eski qoida')).getByTitle('Ko‘rish'));

    expect(screen.getByText('Ketma-ket qoldirgan')).toBeInTheDocument();
    expect(screen.getByText('5 kun')).toBeInTheDocument();
    expect(screen.getByText('Davri')).toBeInTheDocument();
    expect(screen.getByText('2026-09-01 — 2026-09-08')).toBeInTheDocument();
    expect(screen.queryByText('Sababsiz qoldirgan')).toBeNull();
    expect(screen.queryByText('Tekshirilgan davr')).toBeNull();
  });
});
