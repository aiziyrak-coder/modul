import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useModalStore } from '@/shared/ui';
import ApproveModal from './index';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key, lang: 'uz' }),
}));

const hideModal = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  hideModal.mockClear();
  useModalStore.setState({ hideModal });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ApproveModal — tasdiqlash animatsiyasi ko`rinib ulgursin', () => {
  it('muvaffaqiyatdan keyin modal DARHOL yopilmaydi', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<ApproveModal title="Sinov" onConfirm={onConfirm} />);

    const btn = screen.getByRole('button', { name: 'studyLoad.common.accept' });
    await act(async () => {
      btn.click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(hideModal, 'modal darhol yopildi — defekt qaytdi').not.toHaveBeenCalled();
    const marks = screen.getAllByText('Tasdiqlandi');
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(marks.some((el) => el.tagName === 'STRONG'), 'modal ichidagi holat yo`q').toBe(true);
  });

  it('P-14: muvaffaqiyatda toast chiqadi (modal yopilgach ham iz qoladi)', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<ApproveModal title="Sinov" onConfirm={onConfirm} />);

    await act(async () => {
      screen.getByRole('button', { name: 'studyLoad.common.accept' }).click();
    });
    expect(document.querySelector('.ant-message-notice')).not.toBeNull();
  });

  it('belgilangan vaqt o`tgach modal yopiladi', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<ApproveModal title="Sinov" onConfirm={onConfirm} />);

    await act(async () => {
      screen.getByRole('button', { name: 'studyLoad.common.accept' }).click();
    });
    expect(hideModal).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(hideModal).toHaveBeenCalledTimes(1);
  });

  it('xato bo`lsa muvaffaqiyat holati KO`RSATILMAYDI va modal ochiq qoladi', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('server xatosi'));
    renderWithProviders(<ApproveModal title="Sinov" onConfirm={onConfirm} />);

    await act(async () => {
      screen.getByRole('button', { name: 'studyLoad.common.accept' }).click();
    });

    expect(screen.queryByText('Tasdiqlandi')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(hideModal).not.toHaveBeenCalled();
  });
});
