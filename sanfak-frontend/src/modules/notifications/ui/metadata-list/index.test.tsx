import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import MetadataList from './index';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('MetadataList — D3 fix: collapse sections are keyboard-openable', () => {
  it('"Texnik ma\'lumot" (unannounced metadata) panel is focusable and opens on Enter, not mouse-only', () => {
    renderWithProviders(<MetadataList metadata={{ mysteryKey: 'qiymat' }} />);

    const header = screen.getByRole('button', { name: /notif\.tech/ });
    expect(header).toHaveAttribute('tabIndex', '0');
    expect(header).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(header, { key: 'Enter' });

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('mysteryKey')).toBeInTheDocument();
  });

  it('array-value panel (e.g. `affectedWorkloads`) is focusable and opens on Enter', () => {
    renderWithProviders(
      <MetadataList
        metadata={{ ids: ['a', 'b', 'c'] }}
        metaFields={[{ key: 'ids', labelKey: 'notif.meta.affectedWorkloads', fmt: 'text' }]}
      />,
    );

    const header = screen.getByRole('button', { name: /notif\.meta\.arrayCount/ });
    expect(header).toHaveAttribute('tabIndex', '0');
    expect(header).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(header, { key: 'Enter' });

    expect(header).toHaveAttribute('aria-expanded', 'true');
  });
});
