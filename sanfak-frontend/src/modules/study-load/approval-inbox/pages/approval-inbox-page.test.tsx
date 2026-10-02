import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import ApprovalInboxPage from './approval-inbox-page';

const { fetchListMock } = vi.hoisted(() => ({
  fetchListMock: vi.fn(),
}));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, fetchList: fetchListMock };
});

describe('ApprovalInboxPage', () => {
  it('so\'rov xato bo\'lsa Alert ko\'rsatiladi, "hujjat yo\'q" bo\'sh holati emas', async () => {
    fetchListMock.mockRejectedValueOnce(new Error('Server xatosi'));

    renderWithProviders(<ApprovalInboxPage />);

    expect(await screen.findByText('Server xatosi')).toBeInTheDocument();
    expect(
      screen.queryByText(/imzoingizni kutayotgan hujjat yo'q/),
    ).not.toBeInTheDocument();
  });

  it("bo'sh massiv qaytsa — Empty ko'rsatiladi, Alert yo'q (mavjud xulq buzilmagan)", async () => {
    fetchListMock.mockResolvedValueOnce([]);

    renderWithProviders(<ApprovalInboxPage />);

    expect(await screen.findByText(/imzoingizni kutayotgan hujjat yo'q/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Server xatosi')).not.toBeInTheDocument();
    });
  });
});
