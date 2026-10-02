import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';
import UploadForm from './index';

const { fetchListMock } = vi.hoisted(() => ({ fetchListMock: vi.fn() }));

vi.mock('@/shared/api', async () => {
  const actual = await vi.importActual<typeof SharedApi>('@/shared/api');
  return { ...actual, fetchList: fetchListMock };
});

describe('UploadForm — planSource + basisNote', () => {
  it('ochilganda planSource default "institute" tanlangan', () => {
    fetchListMock.mockResolvedValue([]);
    renderWithProviders(<UploadForm />);

    const instituteRadio = screen.getByRole('radio', { name: 'Institut o‘zi tuzgan' });
    const ministryRadio = screen.getByRole('radio', { name: 'Yuqori tashkilot tasdiqlagan' });
    expect(instituteRadio).toBeChecked();
    expect(ministryRadio).not.toBeChecked();
  });

  it("basisNote 500 belgidan uzun bo'lsa Yup xatosi ko'rsatiladi", async () => {
    fetchListMock.mockResolvedValue([]);
    renderWithProviders(<UploadForm />);

    const textarea = screen.getByPlaceholderText(
      'TDTU tomonidan 2025-yil tasdiqlangan o‘quv reja asosida ishlab chiqilgan',
    );
    fireEvent.change(textarea, { target: { value: 'a'.repeat(501) } });
    fireEvent.blur(textarea);

    await screen.findByText('Izoh 500 belgidan oshmasligi kerak');
  });

  it('BUG-6: "Yuqori tashkilot tasdiqlagan" tanlansa basisNote MAJBURIY bo\'ladi', async () => {
    fetchListMock.mockResolvedValue([]);
    renderWithProviders(<UploadForm />);

    const ministryRadio = screen.getByRole('radio', { name: 'Yuqori tashkilot tasdiqlagan' });
    fireEvent.click(ministryRadio);

    const textarea = screen.getByPlaceholderText(
      'TDTU tomonidan 2025-yil tasdiqlangan o‘quv reja asosida ishlab chiqilgan',
    );
    fireEvent.blur(textarea);

    await screen.findByText('Reja qaysi asosda tuzilganini kiriting');
    expect(screen.getByText('Reja qaysi asosda tuzilgan *')).toBeTruthy();
  });

  it('BUG-6: "Institut o\'zi tuzgan" tanlanganda basisNote ixtiyoriy qoladi', () => {
    fetchListMock.mockResolvedValue([]);
    renderWithProviders(<UploadForm />);

    expect(screen.getByText('Reja qaysi asosda tuzilgan (ixtiyoriy)')).toBeTruthy();
  });
});
