import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import type * as ReactRouterDom from 'react-router-dom';
import type * as SharedApi from '@/shared/api';
import TeacherDetailPage from './teacher-detail-page';

const mockNavigate = vi.fn();
let mockTeacherId: string | undefined = 'tch-01';
let mockSearch = new URLSearchParams();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDom>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ teacherId: mockTeacherId }),
    useSearchParams: () => [mockSearch, vi.fn()],
  };
});

const BACKEND_SUBS = [
  {
    _id: 'sub-1',
    teacher: {
      _id: 'tch-01',
      firstName: 'Azizbek',
      lastName: 'Tursunov',
      department: { _id: 'dep-01', title: 'Ichki kasalliklar kafedrasi' },
      faculty: { _id: 'fac-01', title: 'Davolash fakulteti' },
      position: { _id: 'pos-01', title: 'Dotsent' },
    },
    indicator: { _id: 'ind-1', title: 'Xalqaro jurnaldagi maqola', coefficient: 10 },
    academicYear: { _id: 'ay-01', title: '2025/2026' },
    semester: 1,
    status: 'pending',
    score: 0,
    authorShare: 100,
    data: {},
    files: [],
    createdAt: '2026-03-15T00:00:00.000Z',
  },
  {
    _id: 'sub-2',
    teacher: {
      _id: 'tch-01',
      firstName: 'Azizbek',
      lastName: 'Tursunov',
      department: { _id: 'dep-01', title: 'Ichki kasalliklar kafedrasi' },
      faculty: { _id: 'fac-01', title: 'Davolash fakulteti' },
      position: { _id: 'pos-01', title: 'Dotsent' },
    },
    indicator: { _id: 'ind-2', title: 'Monografiya', coefficient: 20 },
    academicYear: { _id: 'ay-02', title: '2026/2027' },
    semester: 2,
    status: 'approved',
    score: 20,
    authorShare: 100,
    data: {},
    files: [],
    createdAt: '2026-03-16T00:00:00.000Z',
  },
  {
    _id: 'sub-3',
    teacher: {
      _id: 'tch-01',
      firstName: 'Azizbek',
      lastName: 'Tursunov',
      department: { _id: 'dep-01', title: 'Ichki kasalliklar kafedrasi' },
      faculty: { _id: 'fac-01', title: 'Davolash fakulteti' },
      position: { _id: 'pos-01', title: 'Dotsent' },
    },
    indicator: { _id: 'ind-3', title: 'Patent', coefficient: 5 },
    academicYear: { _id: 'ay-02', title: '2026/2027' },
    semester: 2,
    status: 'rejected',
    score: 0,
    authorShare: 100,
    data: {},
    files: [],
    createdAt: '2026-03-17T00:00:00.000Z',
  },
];

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    fetchList: vi.fn(async (url: string, params?: Record<string, unknown>) => {
      if (url !== '/submissions') return [];
      const teacher = params?.teacher as string | undefined;
      const year = params?.academicYear as string | undefined;
      let rows = BACKEND_SUBS;
      if (teacher) rows = rows.filter((s) => s.teacher._id === teacher);
      if (year) rows = rows.filter((s) => s.academicYear._id === year);
      return rows;
    }),
    fetchOne: vi.fn(async () => ({ active: true, activeFrom: null })),
  };
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockTeacherId = 'tch-01';
  mockSearch = new URLSearchParams();
});

function dataRows(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .filter((r) => within(r).queryAllByRole('cell').length > 1);
}

async function bodyRows(expected: number) {
  const table = await screen.findByRole('table');
  await waitFor(() => expect(dataRows(table)).toHaveLength(expected));
  return dataRows(table);
}

describe('TeacherDetailPage — sifat nazorati "Batafsil" sahifasi', () => {
  it("o'qituvchi kartochkasi: F.I.Sh, lavozim, kafedra, fakultet", async () => {
    renderWithProviders(<TeacherDetailPage />);

    expect(await screen.findByRole('heading', { name: /Tursunov/ })).toBeInTheDocument();
    expect(screen.getByText('Dotsent')).toBeInTheDocument();
    expect(screen.getByText(/Ichki kasalliklar/)).toBeInTheDocument();
    expect(screen.getByText(/Davolash fakulteti/)).toBeInTheDocument();
  });

  it('BARCHA statuslar chiqadi — faqat tasdiqlangani emas', async () => {
    renderWithProviders(<TeacherDetailPage />);

    await bodyRows(3);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Tekshirilmoqda')).toBeInTheDocument();
    expect(within(table).getByText('Tasdiqlangan')).toBeInTheDocument();
    expect(within(table).getByText('Rad etilgan')).toBeInTheDocument();
  });

  it("URL'dagi davr jadvalga boshlang'ich filtr sifatida qo'llanadi", async () => {
    mockSearch = new URLSearchParams({ year: 'ay-01', semester: '1' });
    renderWithProviders(<TeacherDetailPage />);

    await bodyRows(1);
  });

  it('"Orqaga" o\'sha kesimga (davr + fakultet) qaytaradi', async () => {
    mockSearch = new URLSearchParams({ year: 'ay-01', semester: '2', faculty: 'fac-01' });
    renderWithProviders(<TeacherDetailPage />);

    await screen.findByRole('heading', { name: /Tursunov/ });
    await userEvent.click(screen.getByRole('button', { name: /Orqaga/ }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/education-quality/reports/teacher?year=ay-01&semester=2&faculty=fac-01',
    );
  });

  it("noma'lum o'qituvchi — sahifa bo'sh holatni ko'rsatadi (crash emas)", async () => {
    mockTeacherId = 'tch-yoq';
    renderWithProviders(<TeacherDetailPage />);

    expect(await screen.findByText("O'qituvchi topilmadi")).toBeInTheDocument();
  });
});
