import { render, screen } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { theme } from '../../../styles/theme';
import type { ReadStats } from '../../../api/announcement-types';

const useAnnouncementReadStats = vi.fn();
vi.mock('../../../api/announcement-api', () => ({
  useAnnouncementReadStats: (id: string | null) => useAnnouncementReadStats(id),
}));

const { default: ReadStatsModal } = await import('./index');

const asDefaultTheme = theme as unknown as DefaultTheme;

const STATS: ReadStats = {
  total: 3,
  readCount: 1,
  unreadCount: 2,
  percent: 33,
  read: [
    {
      user: 'u1',
      fullName: 'Aliyev Aziz',
      courseNumber: 1,
      specialtyTitle: 'Kardiologiya',
      readAt: '2026-08-19T10:00:00.000Z',
    },
  ],
  unread: [
    { user: 'u2', fullName: 'Valiyev Vali', courseNumber: 2, specialtyTitle: null },
    { user: 'u3', fullName: 'Salimova Sabina', courseNumber: null, specialtyTitle: 'Nevrologiya' },
  ],
};

function renderModal(state: Record<string, unknown>) {
  useAnnouncementReadStats.mockReturnValue(state);
  return render(
    <ThemeProvider theme={asDefaultTheme}>
      <ReadStatsModal announcementId="a1" announcementTitle="Test e’lon" onClose={() => {}} />
    </ThemeProvider>,
  );
}

describe('ReadStatsModal', () => {
  beforeEach(() => useAnnouncementReadStats.mockReset());

  it('foiz, sanoqlar va ikkala ro‘yxatni ko‘rsatadi', () => {
    renderModal({ data: STATS, isLoading: false, error: null });

    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('O‘qiganlar (1)')).toBeInTheDocument();
    expect(screen.getByText('O‘qimaganlar (2)')).toBeInTheDocument();
    expect(screen.getByText('Aliyev Aziz')).toBeInTheDocument();
    expect(screen.getByText('Valiyev Vali')).toBeInTheDocument();
    expect(screen.getByText('Salimova Sabina')).toBeInTheDocument();
  });

  it('progressbar `aria-valuenow` ni foizga qo‘yadi', () => {
    renderModal({ data: STATS, isLoading: false, error: null });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  });

  it('kurs va mutaxassislik bo‘lmasa qatordan tushib qoladi', () => {
    renderModal({ data: STATS, isLoading: false, error: null });
    expect(screen.getByText('2-kurs')).toBeInTheDocument();
    expect(screen.getByText('Nevrologiya')).toBeInTheDocument();
  });

  it('qabul qiluvchi bo‘lmasa foiz o‘rniga "—" va tushuntirish', () => {
    renderModal({
      data: { total: 0, readCount: 0, unreadCount: 0, percent: null, read: [], unread: [] },
      isLoading: false,
      error: null,
    });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/yo‘naltirilmagan/)).toBeInTheDocument();
    expect(screen.queryByText(/O‘qiganlar \(/)).not.toBeInTheDocument();
  });

  it('hech kim o‘qimagan bo‘lsa tegishli matn chiqadi', () => {
    renderModal({
      data: { ...STATS, readCount: 0, percent: 0, read: [] },
      isLoading: false,
      error: null,
    });
    expect(screen.getByText('Hali hech kim o‘qimagan')).toBeInTheDocument();
  });

  it('hamma o‘qigan bo‘lsa tegishli matn chiqadi', () => {
    renderModal({
      data: { ...STATS, unreadCount: 0, percent: 100, unread: [] },
      isLoading: false,
      error: null,
    });
    expect(screen.getByText('Hamma o‘qigan')).toBeInTheDocument();
  });

  it('yuklanayotgan holat', () => {
    renderModal({ data: undefined, isLoading: true, error: null });
    expect(screen.getByText('Yuklanmoqda…')).toBeInTheDocument();
  });

  it('xato holati — server xabari ko‘rsatiladi', () => {
    renderModal({ data: undefined, isLoading: false, error: new Error('Ruxsat yo‘q') });
    expect(screen.getByRole('alert')).toHaveTextContent('Ruxsat yo‘q');
  });
});
