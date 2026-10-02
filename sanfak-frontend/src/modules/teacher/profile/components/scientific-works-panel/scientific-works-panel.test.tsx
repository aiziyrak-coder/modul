import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type { ScientificWorkItem } from '../../model/types';
import ScientificWorksPanel from './index';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseMyArticles = vi.fn();

vi.mock('../../api/my-scientific-works-api', () => ({
  useMyArticles: (enabled: boolean) => mockUseMyArticles(enabled),
  useMyTheses: () => ({ data: [], isLoading: false, isError: false }),
  useMyMonographs: () => ({ data: [], isLoading: false, isError: false }),
  useMyMethodicalRecommendations: () => ({ data: [], isLoading: false, isError: false }),
}));

const query = (data: ScientificWorkItem[]) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  isFetching: false,
  refetch: vi.fn(),
});

const item = (over: Partial<ScientificWorkItem> = {}): ScientificWorkItem => ({
  id: '1',
  title: 'Test maqola',
  status: 'approved',
  fileUrl: 'http://example.test/a.pdf',
  ...over,
});

describe('ScientificWorksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bo`sh `title` (TZ 4.10.3 — nom SSV javobidan keyin) `untitled` placeholder bilan chiqadi', () => {
    mockUseMyArticles.mockReturnValue(query([item({ title: '' })]));
    renderWithProviders(<ScientificWorksPanel />);

    expect(screen.getByText('teacher.scientificWorks.untitled')).toBeInTheDocument();
  });

  it('faqat bo`shliqdan iborat `title` ham placeholder bilan almashtiriladi', () => {
    mockUseMyArticles.mockReturnValue(query([item({ title: '   ' })]));
    renderWithProviders(<ScientificWorksPanel />);

    expect(screen.getByText('teacher.scientificWorks.untitled')).toBeInTheDocument();
  });

  it('nomi bor ish o`z nomi bilan chiqadi (placeholder ishlatilmaydi)', () => {
    mockUseMyArticles.mockReturnValue(query([item({ title: 'Stomatologiyada profilaktika' })]));
    renderWithProviders(<ScientificWorksPanel />);

    expect(screen.getByText('Stomatologiyada profilaktika')).toBeInTheDocument();
    expect(screen.queryByText('teacher.scientificWorks.untitled')).not.toBeInTheDocument();
  });

  it('ro`yxat bo`sh bo`lsa — bo`sh holat matni', () => {
    mockUseMyArticles.mockReturnValue(query([]));
    renderWithProviders(<ScientificWorksPanel />);

    expect(screen.getByText('teacher.scientificWorks.empty')).toBeInTheDocument();
  });

  it('`fileUrl` bor qator bosiladigan (button), `fileUrl` yo`q qator bosilmaydigan', () => {
    mockUseMyArticles.mockReturnValue(
      query([
        item({ id: '1', title: 'Fayli bor', fileUrl: 'http://example.test/a.pdf' }),
        item({ id: '2', title: 'Fayli yo`q', fileUrl: null }),
      ]),
    );
    renderWithProviders(<ScientificWorksPanel />);

    expect(screen.getByText('Fayli bor').closest('button')).not.toBeNull();
    expect(screen.getByText('Fayli yo`q').closest('button')).toBeNull();
  });

  it('TZ/User Flow dagi to`rt bo`lim tab sifatida chiqadi', () => {
    mockUseMyArticles.mockReturnValue(query([]));
    renderWithProviders(<ScientificWorksPanel />);

    for (const key of ['articles', 'theses', 'monographs', 'methodical']) {
      expect(screen.getByText(`teacher.scientificWorks.tab.${key}`)).toBeInTheDocument();
    }
  });

  it('faqat FAOL tab so`rov yuboradi (qolgan uchtasi `enabled=false`)', () => {
    mockUseMyArticles.mockReturnValue(query([]));
    renderWithProviders(<ScientificWorksPanel />);

    expect(mockUseMyArticles).toHaveBeenCalledWith(true);
  });
});
