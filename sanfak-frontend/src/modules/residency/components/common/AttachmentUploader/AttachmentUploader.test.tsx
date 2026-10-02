import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttachmentUploader from './index';
import { theme } from '../../../styles/theme';

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ThemeProvider theme={theme as unknown as DefaultTheme}>{ui}</ThemeProvider>
  </QueryClientProvider>
);

const badFile = () =>
  new File(['x'], 'zararli.exe', { type: 'application/octet-stream' });

const okFile = () => new File(['x'], 'hujjat.pdf', { type: 'application/pdf' });

const dropZone = (): HTMLElement => screen.getByLabelText(/fayl biriktirish/i);

const dragAndDrop = (files: File[]) => {
  const zone = dropZone();
  fireEvent.dragOver(zone, { dataTransfer: { files } });
  fireEvent.drop(zone, { dataTransfer: { files } });
};

const fileInput = (): HTMLInputElement => {
  const el = document.querySelector('input[type="file"]');
  if (!el) throw new Error('fayl inputi topilmadi');
  return el as HTMLInputElement;
};

const renderUploader = () =>
  render(wrap(<AttachmentUploader existing={[]} announcementId={null} />));

const notice = () => screen.getByRole('alert');
const noNotice = () => screen.queryByRole('alert');

describe('D-44 — rad etish sababi ikkala yo‘lda ham ko‘rinadi', () => {
  it('DIALOG orqali tanlanganda sabab chiqadi (ilgari ham ishlardi)', () => {
    renderUploader();
    fireEvent.change(fileInput(), { target: { files: [badFile()] } });
    expect(notice().textContent).toMatch(/qabul qilinmaydi/i);
  });

  it('SUDRAB TASHLANGANDA ham sabab chiqadi (regressiya)', () => {
    renderUploader();
    dragAndDrop([badFile()]);
    expect(notice().textContent).toMatch(/qabul qilinmaydi/i);
  });

  it('sudrab tashlashda faylning NOMI ham xabarda bo‘ladi', () => {
    renderUploader();
    dragAndDrop([badFile()]);
    expect(notice().textContent).toMatch(/zararli\.exe/);
  });

  it('bir nechta rad etilgan fayl — hammasining sababi chiqadi', () => {
    renderUploader();
    const files = [
      new File(['x'], 'a.exe', { type: 'application/octet-stream' }),
      new File([], 'b.pdf', { type: 'application/pdf' }),
    ];
    dragAndDrop(files);
    expect(notice().textContent).toMatch(/a\.exe/);
    expect(notice().textContent).toMatch(/b\.pdf/);
  });
});

describe('qabul qilingan fayl navbatga tushadi', () => {
  it('yaroqli fayl ro‘yxatda ko‘rinadi va sabab chiqmaydi', () => {
    renderUploader();
    dragAndDrop([okFile()]);
    expect(screen.getByText('hujjat.pdf')).toBeTruthy();
    expect(noNotice()).toBeNull();
  });

  it('yaroqli va yaroqsiz aralash — yaroqlisi qabul qilinadi, sabab ham chiqadi', () => {
    renderUploader();
    dragAndDrop([okFile(), badFile()]);
    expect(screen.getByText('hujjat.pdf')).toBeTruthy();
    expect(notice().textContent).toMatch(/zararli\.exe/);
  });
});
