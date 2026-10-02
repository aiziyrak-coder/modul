import { useState } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttachmentUploader, { type AttachmentUploaderHandle } from './index';
import type { Attachment } from '../../../api/announcement-types';
import { theme } from '../../../styles/theme';

vi.mock('../../../api/announcement-api', () => ({
  uploadAttachment: vi.fn(),
  useInvalidateAnnouncements: () => () => {},
}));
const { uploadAttachment } = await import('../../../api/announcement-api');
const upload = vi.mocked(uploadAttachment);

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ThemeProvider theme={theme as unknown as DefaultTheme}>{ui}</ThemeProvider>
  </QueryClientProvider>
);

const att = (i: number): Attachment => ({
  id: `a${i}`,
  name: `server-${i}.pdf`,
  size: '1 KB',
  type: 'pdf',
  bytes: 1024,
  mimeType: 'application/pdf',
  uploadedByName: null,
  uploadedAt: null,
});

const pdf = (i: number) => new File(['x'], `hujjat-${i}.pdf`, { type: 'application/pdf' });

function Harness({ handle }: { handle: { current: AttachmentUploaderHandle | null } }) {
  const [existing, setExisting] = useState<Attachment[]>([]);
  return (
    <AttachmentUploader
      ref={(node) => {
        handle.current = node;
      }}
      existing={existing}
      announcementId="a1"
      onUploaded={setExisting}
    />
  );
}

const fileInput = (): HTMLInputElement => {
  const el = document.querySelector('input[type="file"]');
  if (!el) throw new Error('fayl inputi topilmadi');
  return el as HTMLInputElement;
};

const pick = (files: File[]) =>
  fireEvent.change(fileInput(), { target: { files } });

const notice = () => screen.queryByRole('alert')?.textContent ?? '';

beforeEach(() => vi.clearAllMocks());

describe('kvota — yuklangan fayl ikki marta sanalmaydi (D-40)', () => {
  it('🔴 5 ta fayl yuklangach 6-fayl QABUL qilinadi', async () => {
    const handle: { current: AttachmentUploaderHandle | null } = { current: null };
    let uploaded = 0;
    upload.mockImplementation(async () => {
      uploaded += 1;
      return Array.from({ length: uploaded }, (_, i) => att(i));
    });

    render(wrap(<Harness handle={handle} />));
    pick([pdf(1), pdf(2), pdf(3), pdf(4), pdf(5)]);
    await act(async () => {
      await handle.current!.uploadPending('a1');
    });
    await waitFor(() => expect(screen.getAllByText(/yuklandi/).length).toBe(5));
    expect(upload).toHaveBeenCalledTimes(5);

    pick([pdf(6)]);

    expect(notice()).not.toMatch(/ko.pi bilan/i);
    expect(screen.getByTitle('hujjat-6.pdf')).toBeTruthy();
  });
});

describe('kvota — yiqilgan fayl SANALADI (D-40 ning teskarisi)', () => {
  it('🔴 qayta yuboriladigan yozuv chegaraga kiradi', async () => {
    const handle: { current: AttachmentUploaderHandle | null } = { current: null };
    upload.mockImplementation(() => Promise.reject(new Error('tarmoq')));

    render(wrap(<Harness handle={handle} />));
    pick([pdf(0)]);
    await act(async () => {
      await handle.current!.uploadPending('a1');
    });
    await waitFor(() => expect(screen.getByText(/yuklashda xatolik|tarmoq/i)).toBeTruthy());

    pick(Array.from({ length: 10 }, (_, i) => pdf(i + 1)));

    expect(notice()).toMatch(/ko.pi bilan 10 ta fayl/i);
  });
});
