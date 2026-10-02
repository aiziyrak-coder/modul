import { render, screen, within } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../styles/theme';
import type * as NoticeApi from '../api/notice-api';
import { AUTO_NOTICE_REVOKED_LABEL, type Notice } from '../api/notice-types';

const m = vi.hoisted(() => ({ notices: [] as Notice[] }));

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
  useMyResidents: () => ({ data: [] }),
  useSpecialties: () => ({ data: [] }),
  useDepartments: () => ({ data: [] }),
  useGroups: () => ({ data: [] }),
}));
vi.mock('../api/notice-api', async (importOriginal) => ({
  ...(await importOriginal<typeof NoticeApi>()),
  useNotices: () => ({ data: m.notices, isLoading: false }),
  useCreateNotice: mutation,
  useUpdateNotice: mutation,
  useDeleteNotice: mutation,
  useViewNotice: mutation,
  useReviewNotice: mutation,
  useProblemStudents: () => ({ data: [], isLoading: false }),
  useCreateProblemStudent: mutation,
  useUpdateProblemStudent: mutation,
  useDeleteProblemStudent: mutation,
  useAbsenceStreak: () => ({ data: undefined }),
  downloadNoticePdf: vi.fn(),
}));

const { mapNotice } = await import('../api/notice-api');
const { default: Bildirgilar } = await import('./Bildirgilar');

const base = {
  program: 'magistratura',
  content: 'Matn',
  status: 'yangi',
  createdAt: '2026-09-28T03:00:00.000Z',
};

const rowOf = (title: string): HTMLElement => {
  const tr = screen.getByText(title).closest('tr');
  if (!tr) throw new Error(`qator yo'q: ${title}`);
  return tr;
};

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

beforeEach(() => {
  m.notices = [
    mapNotice({
      ...base,
      _id: 'auto1',
      kind: 'avtomatik',
      sender: null,
      senderName: 'Tizim (avtomatik)',
      title: 'Avtomatik bildirgi: sababsiz soatlar ostonasi (6 soat)',
      auto: { state: 'faol', countingYear: '2026/2027' },
    }),
    mapNotice({
      ...base,
      _id: 'auto2',
      kind: 'avtomatik',
      sender: 'u1',
      title: 'Tizim B',
      auto: { state: 'bekor_qilingan', countingYear: '2025/2026' },
    }),
    mapNotice({ ...base, _id: 'own1', kind: 'oddiy', sender: 'u1', title: 'O‘zimniki' }),
  ];
});

describe('Bildirgilar — avtomatik bildirgi (P10)', { timeout: 30_000 }, () => {
  it('«Avtomatik» nishoni; tahrirlash/o‘chirish tugmasi yo‘q', () => {
    draw();
    for (const title of ['Avtomatik bildirgi: sababsiz soatlar ostonasi (6 soat)', 'Tizim B']) {
      const row = rowOf(title);
      expect(within(row).getByText('Avtomatik')).toBeInTheDocument();
      expect(within(row).queryByTitle('Tahrirlash')).toBeNull();
      expect(within(row).queryByTitle('O‘chirish')).toBeNull();
      expect(within(row).getByTitle('Ko‘rish')).toBeInTheDocument();
    }
    expect(within(rowOf('Avtomatik bildirgi: sababsiz soatlar ostonasi (6 soat)')).getByText(
      'Tizim (avtomatik)',
    )).toBeInTheDocument();
  });

  it('auto.state: faol — hisob yili sarlavhada, «bekor qilingan» yo‘q; bekor_qilingan — yorliq bor', () => {
    draw();
    const active = rowOf('Avtomatik bildirgi: sababsiz soatlar ostonasi (6 soat)');
    expect(within(active).getByTitle('Hisob yili: 2026/2027')).toHaveTextContent('Avtomatik');
    expect(within(active).queryByText(AUTO_NOTICE_REVOKED_LABEL)).toBeNull();
    expect(within(rowOf('Tizim B')).getByText(AUTO_NOTICE_REVOKED_LABEL)).toBeInTheDocument();
  });

  it('qo‘lda yozilgan o‘z bildirgisi — tugmalar joyida, nishon yo‘q', () => {
    draw();
    const row = rowOf('O‘zimniki');
    expect(within(row).getByTitle('Tahrirlash')).toBeInTheDocument();
    expect(within(row).getByTitle('O‘chirish')).toBeInTheDocument();
    expect(within(row).queryByText('Avtomatik')).toBeNull();
    expect(within(row).queryByText(AUTO_NOTICE_REVOKED_LABEL)).toBeNull();
  });
});
