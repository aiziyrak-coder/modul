import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import ReportsPage from './pages/reports';
import ScientificTitlesPage from './pages/scientific-titles';
import ScientificDegreesPage from './pages/scientific-degrees';
import type * as ReferenceApi from './api/reference-api';
import type * as AchievementApiModule from './api/achievement-api';

vi.mock('./api/reference-api', async (importOriginal) => ({
  ...(await importOriginal<typeof ReferenceApi>()),
  useFaculties: () => ({ data: [] }),
  useDepartments: () => ({ data: [] }),
  useAcademicYears: () => ({ data: [] }),
  useAcademicLevels: () => ({ data: [] }),
  useAcademicTitles: () => ({ data: [] }),
}));

const TITLE_ROW = {
  id: '6a5e0860bb67938f21629bfb',
  authorName: 'Karimov Akmal',
  facultyName: 'Davolash fakulteti',
  departmentName: 'Ichki kasalliklar kafedrasi',
  academicYear: '2024/2025',
  fileUrl: 'http://localhost:4000/files/x.pdf',
  status: 'new' as const,
  titleType: 'Professor',
  specialty: 'Jarrohlik',
  diplomaSeries: 'FD-1234',
  diplomaNumber: '012345',
  date: '2024-07-20T00:00:00.000Z',
  rejectionReason: null,
  rejectedByName: null,
  rejectedByRole: null,
  approvedByName: null,
  submittedDate: '2026-07-20',
};

const paginated = {
  data: { docs: [TITLE_ROW], totalDocs: 1, page: 1, limit: 12, totalPages: 1 },
  isFetching: false,
};

vi.mock('./api/achievement-api', async (importOriginal) => {
  const actual = await importOriginal<typeof AchievementApiModule>();
  const api = {
    usePaginate: () => paginated,
    useOne: () => ({ data: undefined, isLoading: false }),
    useApprove: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useReject: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCreate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRemove: () => ({ mutateAsync: vi.fn(), isPending: false }),
    fetchAllForExport: vi.fn(),
  };
  return {
    ...actual,
    degreeApi: api,
    titleApi: api,
    patentApi: api,
    certificateApi: api,
    achievementApiByKey: {
      degrees: api,
      titles: api,
      patents: api,
      certificates: api,
    },
  };
});

describe('ReportsPage — `only` rejimi', () => {
  it.each(['degrees', 'titles', 'patents', 'certificates'] as const)(
    '%s sahifasi ma`lumot bilan yiqilmasdan render bo`ladi',
    (key) => {
      expect(() => renderWithProviders(<ReportsPage only={key} />)).not.toThrow();
    },
  );
});

describe('Route o`ramlari (rol ajratish)', () => {
  it('Ilmiy unvonlar sahifasi yiqilmaydi', () => {
    expect(() => renderWithProviders(<ScientificTitlesPage />)).not.toThrow();
  });

  it('Ilmiy darajalar sahifasi yiqilmaydi', () => {
    expect(() => renderWithProviders(<ScientificDegreesPage />)).not.toThrow();
  });
});
