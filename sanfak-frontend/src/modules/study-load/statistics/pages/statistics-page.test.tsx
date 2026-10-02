import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const can = vi.fn<(key: string) => boolean>();
vi.mock('@/app/session', () => ({
  usePermission: () => can,
}));

const overview = vi.fn();
const faculties = vi.fn();
const teachers = vi.fn();
const academicYears = vi.fn();
const facultyRefs = vi.fn();

vi.mock('../api/statistics-api', () => ({
  useOubOverview: (...args: unknown[]) => overview(...args),
  useOubFaculties: (...args: unknown[]) => faculties(...args),
  useOubTeachers: (...args: unknown[]) => teachers(...args),
  useAcademicYearsForStatistics: () => academicYears(),
  useFacultiesForStatistics: () => facultyRefs(),
}));

const { default: StatisticsPage } = await import('./statistics-page');

const emptyQuery = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };

beforeEach(() => {
  can.mockReset();
  overview.mockReset().mockReturnValue(emptyQuery);
  faculties.mockReset().mockReturnValue({ ...emptyQuery, data: { rows: [], totals: {} } });
  teachers.mockReset().mockReturnValue(emptyQuery);
  academicYears.mockReset().mockReturnValue({ data: [], isLoading: false });
  facultyRefs.mockReset().mockReturnValue({ data: [], isLoading: false });
});

describe('StatisticsPage — statistics:read gating (F-10)', () => {
  it('ruxsat YO`Q: ochiq Alert ko`rsatiladi, so`rovlar `enabled=false` bilan chaqiriladi (yuborilmaydi)', () => {
    can.mockReturnValue(false);
    render(<StatisticsPage />);

    expect(screen.getByText("Bu bo'lim sizga ochiq emas")).toBeTruthy();

    expect(overview).toHaveBeenCalledWith(expect.anything(), false);
    expect(faculties).toHaveBeenCalledWith(expect.anything(), false);
    expect(teachers).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('ruxsat BOR: Alert yo`q, so`rovlar `enabled=true` bilan yuboriladi', () => {
    can.mockReturnValue(true);
    render(<StatisticsPage />);

    expect(screen.queryByText("Bu bo'lim sizga ochiq emas")).toBeNull();
    expect(overview).toHaveBeenCalledWith(expect.anything(), true);
    expect(faculties).toHaveBeenCalledWith(expect.anything(), true);
    expect(teachers).toHaveBeenCalledWith(expect.anything(), true);
  });
});
