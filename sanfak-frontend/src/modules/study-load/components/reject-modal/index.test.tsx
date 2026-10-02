import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import RejectModal from './index';

const PLACEHOLDER = 'Qaytarish sababini kiriting...';

describe('RejectModal — F-11', () => {
  it('sabab maydoni 1000 belgi bilan cheklangan va hisoblagich ko`rinadi', () => {
    const { container } = renderWithProviders(
      <RejectModal title="Yuklama qaytarish" onConfirm={vi.fn().mockResolvedValue(undefined)} />,
    );

    expect(screen.getByPlaceholderText(PLACEHOLDER).getAttribute('maxlength')).toBe('1000');
    expect(container.querySelector('.ant-input-data-count')?.textContent).toContain('1000');
  });

  it("ketma-ket ikki bosish — bitta so'rov (javob kelguncha qayta yuborilmaydi)", async () => {
    let finish: () => void = () => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderWithProviders(<RejectModal title="Yuklama qaytarish" onConfirm={onConfirm} />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Soatlar xato' } });
    const confirm = screen.getByRole('button', { name: /Qaytarish/ });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Soatlar xato');
    finish();
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });
});
