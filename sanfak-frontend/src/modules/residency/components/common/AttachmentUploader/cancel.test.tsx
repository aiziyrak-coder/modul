import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttachmentUploader, { type AttachmentUploaderHandle } from './index';
import { theme } from '../../../styles/theme';
import type * as AnnouncementApi from '../../../api/announcement-api';

const uploadAttachment = vi.fn();

const rejectWith = (err: Error) =>
  uploadAttachment.mockImplementationOnce(() => Promise.reject(err));

vi.mock('../../../api/announcement-api', async (importOriginal) => {
  const actual = await importOriginal<typeof AnnouncementApi>();
  return { ...actual, uploadAttachment: (...a: unknown[]) => uploadAttachment(...a) };
});

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ThemeProvider theme={theme as unknown as DefaultTheme}>{ui}</ThemeProvider>
  </QueryClientProvider>
);

const pdf = (name = 'hujjat.pdf') => new File(['x'], name, { type: 'application/pdf' });

const canceledError = () => {
  const e = new Error('canceled');
  e.name = 'CanceledError';
  return e;
};

const zone = () => screen.getByLabelText(/fayl biriktirish/i);

const dragAndDrop = (files: File[]) => {
  fireEvent.dragOver(zone(), { dataTransfer: { files } });
  fireEvent.drop(zone(), { dataTransfer: { files } });
};

beforeEach(() => uploadAttachment.mockReset());

const renderUploader = () => {
  const ref = createRef<AttachmentUploaderHandle>();
  render(wrap(<AttachmentUploader ref={ref} existing={[]} announcementId="a1" />));
  return ref;
};

describe('D-43 — bekor qilish nosozlik EMAS', () => {
  it('bekor qilingan fayl `canceled` deb sanaladi, `failed` ga TUSHMAYDI', async () => {
    rejectWith(canceledError());
    const ref = renderUploader();
    dragAndDrop([pdf()]);

    let result: { ok: number; failed: number; canceled: number } | undefined;
    await act(async () => {
      result = await ref.current!.uploadPending('a1');
    });

    expect(result).toEqual({ ok: 0, failed: 0, canceled: 1 });
  });

  it('haqiqiy nosozlik hamon `failed` bo‘lib qoladi', async () => {
    rejectWith(new Error('500'));
    const ref = renderUploader();
    dragAndDrop([pdf()]);

    let result: { ok: number; failed: number; canceled: number } | undefined;
    await act(async () => {
      result = await ref.current!.uploadPending('a1');
    });

    expect(result).toEqual({ ok: 0, failed: 1, canceled: 0 });
  });

  it('muvaffaqiyatli yuklash `ok` bo‘ladi', async () => {
    uploadAttachment.mockImplementationOnce(() => Promise.resolve([]));
    const ref = renderUploader();
    dragAndDrop([pdf()]);

    let result: { ok: number; failed: number; canceled: number } | undefined;
    await act(async () => {
      result = await ref.current!.uploadPending('a1');
    });

    expect(result).toEqual({ ok: 1, failed: 0, canceled: 0 });
  });

  it('aralash partiya har uchala sanoqni ALOHIDA beradi', async () => {
    uploadAttachment
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.reject(canceledError()))
      .mockImplementationOnce(() => Promise.reject(new Error('500')));
    const ref = renderUploader();
    dragAndDrop([pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')]);

    let result: { ok: number; failed: number; canceled: number } | undefined;
    await act(async () => {
      result = await ref.current!.uploadPending('a1');
    });

    expect(result).toEqual({ ok: 1, failed: 1, canceled: 1 });
  });
});

describe('bekor qilingan qator ekranda', () => {
  it('sababi ko‘rinadi va «Qayta urinish» tugmasi qoladi', async () => {
    rejectWith(canceledError());
    const ref = renderUploader();
    dragAndDrop([pdf()]);
    await act(async () => {
      await ref.current!.uploadPending('a1');
    });

    expect(screen.getByText(/bekor qilindi/i)).toBeTruthy();
    expect(screen.getByLabelText(/qayta urinish/i)).toBeTruthy();
  });

  it('bekor qilingan fayl hamon NAVBATDA hisoblanadi (modal ogohlantiradi)', async () => {
    rejectWith(canceledError());
    const ref = renderUploader();
    dragAndDrop([pdf()]);
    await act(async () => {
      await ref.current!.uploadPending('a1');
    });

    expect(ref.current!.hasPending()).toBe(true);
  });
});
