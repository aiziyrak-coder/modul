import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import RectorCertificatesPage from './index';
import { CERT_STATUS, type CertificateRow } from '../../../model/certificate-approval.types';

const approveMutate = vi.fn().mockResolvedValue({ approved: 1, failed: [] });
const rejectMutate = vi.fn().mockResolvedValue({ rejected: 1 });

let rows: CertificateRow[] = [];

vi.mock('@/app/session', () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../api/certificate-approval-api', () => ({
  useCertificatesForApproval: () => ({
    data: { items: rows, meta: { page: 1, limit: 12, total: rows.length, totalPages: 1 } },
    isFetching: false,
  }),
  useCertificateApproval: () => ({
    approve: { mutateAsync: approveMutate, isPending: false },
    reject: { mutateAsync: rejectMutate, isPending: false },
  }),
}));

const row = (over: Partial<CertificateRow> = {}): CertificateRow => ({
  id: 'c1',
  listenerName: 'Testov Test',
  courseName: 'Kardiologiya asoslari',
  creditHours: 72,
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  kind: 1,
  code: 'I00001',
  regNumber: '000001',
  status: CERT_STATUS.PENDING,
  approvedBy: '',
  approvedAt: null,
  rejectReason: '',
  createdAt: '2026-02-02',
  file: '',
  ...over,
});

beforeEach(() => {
  approveMutate.mockClear();
  rejectMutate.mockClear();
  rows = [row()];
});

function dataRows(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .filter((r) => within(r).queryAllByRole('cell').length > 1);
}

describe('Rektor — hujjatlarni tasdiqlash', () => {
  it('tasdiq kutayotgan qator ko‘rinadi', async () => {
    renderWithProviders(<RectorCertificatesPage />);

    const table = await screen.findByRole('table');
    await waitFor(() => expect(dataRows(table)).toHaveLength(1));
    expect(screen.getByText('Testov Test')).toBeInTheDocument();
    expect(screen.getByText('Kardiologiya asoslari')).toBeInTheDocument();
  });

  it('tasdiqlanmagan qatorda hujjat havolasi YO‘Q', async () => {
    renderWithProviders(<RectorCertificatesPage />);

    const table = await screen.findByRole('table');
    await waitFor(() => expect(dataRows(table)).toHaveLength(1));
    expect(within(table).queryByRole('link')).toBeNull();
  });

  it('tasdiqlangan qatorda havola paydo bo‘ladi', async () => {
    rows = [
      row({
        status: CERT_STATUS.APPROVED,
        file: 'http://x.uz/files/pdfs/I00001.pdf?t=a&e=1',
        approvedBy: 'Rektor R.',
        approvedAt: '2026-02-03',
      }),
    ];
    renderWithProviders(<RectorCertificatesPage />);

    const table = await screen.findByRole('table');
    await waitFor(() => expect(dataRows(table)).toHaveLength(1));
    expect(within(table).getByRole('link')).toHaveAttribute(
      'href',
      'http://x.uz/files/pdfs/I00001.pdf?t=a&e=1',
    );
  });

  it('guruhli tasdiqlash TANLANGAN id larni yuboradi', async () => {
    const user = userEvent.setup({ delay: null });
    rows = [row(), row({ id: 'c2', listenerName: 'Ikkinchi Tinglovchi' })];
    renderWithProviders(<RectorCertificatesPage />);

    const table = await screen.findByRole('table');
    await waitFor(() => expect(dataRows(table)).toHaveLength(2));

    const [firstRow] = dataRows(table);
    expect(firstRow).toBeDefined();
    await user.click(within(firstRow as HTMLElement).getByRole('checkbox'));
    await user.click(await screen.findByRole('button', { name: /Tasdiqlash \(1\)/ }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Tasdiqlash' }));

    await waitFor(() => expect(approveMutate).toHaveBeenCalledWith(['c1']));
  });

  it('aralash ro‘yxatda FAQAT kutayotgan qator tanlanadi', async () => {
    rows = [
      row({ id: 'p1' }),
      row({ id: 'a1', status: CERT_STATUS.APPROVED, file: 'http://x.uz/a.pdf?t=a&e=1' }),
      row({ id: 'r1', status: CERT_STATUS.REJECTED, rejectReason: 'Ism xato' }),
    ];
    renderWithProviders(<RectorCertificatesPage />);

    const table = await screen.findByRole('table');
    await waitFor(() => expect(dataRows(table)).toHaveLength(3));

    const [pending, approved, rejected] = dataRows(table);
    expect(within(pending as HTMLElement).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(approved as HTMLElement).queryByRole('checkbox')).toBeNull();
    expect(within(rejected as HTMLElement).queryByRole('checkbox')).toBeNull();
  });

  it('rad etish sababsiz yuborilmaydi', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<RectorCertificatesPage />);
    await screen.findByRole('table');

    await user.click(screen.getByLabelText('Rad etish'));

    const dialog = await screen.findByRole('dialog');
    const okButton = within(dialog).getByRole('button', { name: 'Rad etish' });
    expect(okButton).toBeDisabled();
    expect(rejectMutate).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole('textbox'), 'Ism xato yozilgan');
    await waitFor(() => expect(okButton).toBeEnabled());
    await user.click(okButton);
    await waitFor(() =>
      expect(rejectMutate).toHaveBeenCalledWith({ ids: ['c1'], reason: 'Ism xato yozilgan' }),
    );
  }, 20000);
});
