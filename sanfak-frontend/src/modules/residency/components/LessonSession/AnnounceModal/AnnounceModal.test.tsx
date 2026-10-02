import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import dayjs from 'dayjs';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../../../styles/theme';
import type { Resident } from '../../../api/types';
import type * as SessionApi from '../../../api/session-api';
import type * as SharedUi from '@/shared/ui';
import { uzToday } from '../../../lib/uz-day';
import AnnounceModal from './index';

interface DatePickerProbe {
  value?: string | null;
  onChange?: (v: string | null) => void;
  disabledDate?: (d: dayjs.Dayjs) => boolean;
  'aria-label'?: string;
}

const m = vi.hoisted(() => ({
  isOffice: false,
  residents: [] as Resident[],
  groups: [] as Array<{ id: string; title: string }>,
  officeTotal: 0 as number | undefined,
  officePlaceholder: false,
  mutateAsync: vi.fn(),
  myResidentsCalls: [] as Array<[unknown, unknown]>,
  groupsCalls: [] as unknown[],
  residentsCalls: [] as Array<[unknown, unknown]>,
  disabledDate: null as null | ((d: unknown) => boolean),
}));

vi.mock('../../../lib/capabilities', () => ({
  useResidencyCapabilities: () => ({ isOffice: m.isOffice }),
}));

vi.mock('../../../api/residency-api', () => ({
  useSciences: () => ({ data: [{ id: 'sc1', title: 'Kardiologiya' }] }),
  useGroups: (enabled: unknown) => {
    m.groupsCalls.push(enabled);
    return {
      data: enabled ? m.groups : undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  },
  useMyResidents: (params: unknown, enabled: unknown) => {
    m.myResidentsCalls.push([params, enabled]);
    return {
      data: enabled ? m.residents : undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  },
  useResidents: (params: unknown, enabled: unknown) => {
    m.residentsCalls.push([params, enabled]);
    const data =
      enabled && m.officeTotal !== undefined
        ? { items: [], total: m.officeTotal, page: 1, totalPages: 1 }
        : undefined;
    return {
      data,
      isPlaceholderData: m.officePlaceholder,
      isFetching: m.officePlaceholder,
      isLoading: false,
    };
  },
}));

vi.mock('../../../api/session-api', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionApi>()),
  useAnnounceSession: () => ({ mutateAsync: m.mutateAsync, isPending: false }),
}));

vi.mock('@/shared/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUi>()),
  DatePicker: (p: DatePickerProbe) => {
    m.disabledDate = p.disabledDate as (d: unknown) => boolean;
    return (
      <input
        aria-label={p['aria-label']}
        value={p.value ?? ''}
        onChange={(e) => p.onChange?.(e.target.value || null)}
      />
    );
  },
}));

const res = (id: string, fullName: string, groupId: string | null, groupTitle: string | null) =>
  ({ id, fullName, groupId, groupTitle }) as Resident;

const httpError = (status: number, data: Record<string, unknown>) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

function renderModal() {
  const onClose = vi.fn();
  const onAnnounced = vi.fn();
  render(
    <ConfigProvider>
      <AntdApp>
        <ThemeProvider theme={theme as unknown as DefaultTheme}>
          <AnnounceModal onClose={onClose} onAnnounced={onAnnounced} />
        </ThemeProvider>
      </AntdApp>
    </ConfigProvider>,
  );
  return { onClose, onAnnounced };
}

async function pick(label: string, title: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
  const option = await waitFor(() => {
    const el = document.querySelector<HTMLElement>(`.ant-select-item-option[title="${title}"]`);
    if (!el) throw new Error(`variant yo'q: ${title}`);
    return el;
  });
  fireEvent.click(option);
}

const setDay = (v: string) =>
  fireEvent.change(screen.getByLabelText('Sana'), { target: { value: v } });
const btn = (name: string) => screen.getByRole('button', { name });
const TODAY = uzToday();

async function fillValid() {
  setDay(TODAY);
  await pick('Fan', 'Kardiologiya');
  await pick('Guruh', 'ORD-101');
}

const RENDER_TIMEOUT_MS = 30_000;

beforeEach(() => {
  m.isOffice = false;
  m.residents = [
    res('r1', 'Valiyev Anvar', 'g1', 'ORD-101'),
    res('r2', 'Aliyev Bobur', 'g1', 'ORD-101'),
    res('r3', 'Karimova Dilnoza', 'g2', 'ORD-202'),
    res('r4', 'Guruhsiz', null, null),
  ];
  m.groups = [
    { id: 'g1', title: 'ORD-101' },
    { id: 'g9', title: 'ORD-909' },
  ];
  m.officeTotal = 14;
  m.officePlaceholder = false;
  m.mutateAsync = vi.fn();
  m.myResidentsCalls = [];
  m.groupsCalls = [];
  m.residentsCalls = [];
  m.disabledDate = null;
});

describe('AnnounceModal — forma', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('MD-35: Sana, Fan, Guruh yetishmaydi — «Davom etish» o‘chiq', () => {
    renderModal();
    expect(screen.getByRole('status')).toHaveTextContent('yetishmayapti: Sana, Fan, Guruh');
    expect(btn('Davom etish')).toBeDisabled();
  });

  it('soat: aynan 1..8, sukut 2', async () => {
    renderModal();
    const soat = screen.getByRole('combobox', { name: 'Soat' }).closest('.ant-select');
    expect(soat?.querySelector('.ant-select-selection-item')).toHaveAttribute('title', '2 soat');

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Soat' }));
    await waitFor(() =>
      expect(document.querySelector('.ant-select-item-option[title="1 soat"]')).not.toBeNull(),
    );
    const titles = [...document.querySelectorAll('.ant-select-item-option')].map((o) =>
      o.getAttribute('title'),
    );
    expect(titles.filter((t) => t?.endsWith(' soat'))).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8'].map((h) => `${h} soat`),
    );
  });

  it('sana: kecha va o‘quv yili oxiridan keyin o‘chiq, bugun ochiq', () => {
    renderModal();
    const disabled = m.disabledDate;
    if (!disabled) throw new Error('disabledDate uzatilmadi');
    const today = dayjs(TODAY);
    expect(disabled(today.subtract(1, 'day'))).toBe(true);
    expect(disabled(today)).toBe(false);
    expect(disabled(today.add(400, 'day'))).toBe(true);
  });

  it('ustoz yo‘li: guruhlar FAQAT o‘z ordinatorlaridan, ko‘rinish — ismlar', async () => {
    renderModal();
    expect(m.myResidentsCalls.at(-1)).toEqual([{ program: 'ordinatura', status: 'oquvda' }, true]);
    expect(m.groupsCalls.every((e) => e === false)).toBe(true);

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Guruh' }));
    await waitFor(() =>
      expect(document.querySelector('.ant-select-item-option[title="ORD-101"]')).not.toBeNull(),
    );
    expect(document.querySelector('.ant-select-item-option[title="ORD-909"]')).toBeNull();
    expect(document.querySelector('.ant-select-item-option[title="ORD-202"]')).not.toBeNull();

    fireEvent.click(
      document.querySelector<HTMLElement>('.ant-select-item-option[title="ORD-101"]')!,
    );
    const preview = await screen.findByTestId('roster-preview');
    expect(preview).toHaveTextContent('2 ta rezident');
    expect(preview).toHaveTextContent('Aliyev Bobur, Valiyev Anvar');
    expect(preview).not.toHaveTextContent('Karimova');
  });

  it('ustozda guruhli ordinator yo‘q — bo‘sh holat aytiladi', () => {
    m.residents = [res('r4', 'Guruhsiz', null, null)];
    renderModal();
    expect(screen.getByText('Sizga biriktirilgan guruhli ordinator yo‘q')).toBeInTheDocument();
  });

  it('bo‘lim yo‘li: barcha guruhlar, son `useResidents(...).total` dan', async () => {
    m.isOffice = true;
    renderModal();
    await pick('Guruh', 'ORD-909');
    expect(m.residentsCalls.at(-1)).toEqual([
      { group: 'g9', program: 'ordinatura', status: 'oquvda', limit: 1 },
      true,
    ]);
    expect(await screen.findByTestId('roster-preview')).toHaveTextContent('14 ta rezident');
    expect(m.myResidentsCalls.every(([, enabled]) => enabled === false)).toBe(true);
  });

  it('bo‘lim yo‘li: ESKI guruh soni (placeholder) ko‘rinmaydi — hisoblanmoqda, «Davom etish» o‘chiq', async () => {
    m.isOffice = true;
    m.officeTotal = 5;
    m.officePlaceholder = true;
    renderModal();
    setDay(TODAY);
    await pick('Fan', 'Kardiologiya');
    await pick('Guruh', 'ORD-909');
    expect(screen.queryByTestId('roster-preview')).toBeNull();
    expect(screen.queryByText(/5 ta rezident/)).toBeNull();
    expect(screen.getByText('Rezidentlar hisoblanmoqda…')).toBeInTheDocument();
    expect(btn('Davom etish')).toBeDisabled();
  });

  it('guruhda ordinator 0 — bloklanadi va sababi aytiladi', async () => {
    m.isOffice = true;
    m.officeTotal = 0;
    renderModal();
    setDay(TODAY);
    await pick('Fan', 'Kardiologiya');
    await pick('Guruh', 'ORD-101');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tanlangan guruhda o‘qiyotgan ordinator yo‘q',
    );
    expect(btn('Davom etish')).toBeDisabled();
  });
});

describe('AnnounceModal — tasdiq va yuborish', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('tasdiq qadami: xulosa + «kun yopilguncha bekor qilish mumkin»', async () => {
    renderModal();
    await fillValid();
    fireEvent.click(btn('Davom etish'));

    const summary = screen.getByLabelText('E’lon xulosasi');
    for (const text of ['Kardiologiya', 'Amaliy', 'ORD-101', '2 soat', '2 ta']) {
      expect(within(summary).getByText(text)).toBeInTheDocument();
    }
    const terms = screen.getByRole('note', { name: 'E’lon shartlari' });
    expect(terms).toHaveTextContent('kun yopilguncha bekor qilish mumkin');
    expect(terms).toHaveTextContent('«kelmadi» hisoblanmaydi');
    expect(terms).not.toHaveTextContent('bekor qilinmaydi');
    expect(screen.getByRole('note', { name: 'Dars bali' })).toHaveTextContent(
      'har dars uchun ball qo‘yilmaydi',
    );
  });

  it('«E’lon qilish» — aynan 5 kalit, keyin onAnnounced(id)', async () => {
    m.mutateAsync.mockResolvedValue({ id: 'new1', rosterCount: 2, skipped: [] });
    const { onAnnounced } = renderModal();
    await fillValid();
    await pick('Soat', '4 soat');
    await pick('Dars turi', "Ma'ruza");
    fireEvent.click(btn('Davom etish'));
    expect(screen.queryByRole('note', { name: 'Dars bali' })).toBeNull();
    fireEvent.click(btn('E’lon qilish'));

    await waitFor(() => expect(onAnnounced).toHaveBeenCalledWith('new1'));
    const sent = m.mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['day', 'group', 'hours', 'lessonType', 'science']);
    expect(sent).toEqual({
      day: TODAY,
      science: 'sc1',
      lessonType: 'maruza',
      group: 'g1',
      hours: 4,
    });
    for (const forbidden of ['status', 'score', 'manualVerified', 'samsVerified', 'date']) {
      expect(sent).not.toHaveProperty(forbidden);
    }
    expect(await screen.findByText('Mashg‘ulot e’lon qilindi · 2 ta rezident')).toBeInTheDocument();
  });

  it('server xatosi — oyna ochiq qoladi, xabar ko‘rinadi', async () => {
    m.mutateAsync.mockRejectedValue(
      httpError(400, {
        message: 'Guruhda bu mashg‘ulotga mos rezident yo‘q',
        reason: 'no_eligible_residents',
      }),
    );
    const { onAnnounced, onClose } = renderModal();
    await fillValid();
    fireEvent.click(btn('Davom etish'));
    fireEvent.click(btn('E’lon qilish'));

    expect(
      await screen.findByText('Guruhda bu mashg‘ulotga mos rezident yo‘q'),
    ).toBeInTheDocument();
    expect(onAnnounced).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(btn('E’lon qilish')).toBeInTheDocument();
  });

  it('day_not_announceable — formaga qaytadi, sana tozalanadi, oraliq aytiladi', async () => {
    m.mutateAsync.mockRejectedValue(
      httpError(400, {
        message: 'Sana oraliqdan tashqarida',
        reason: 'day_not_announceable',
        from: '2026-09-28',
        to: '2027-08-31',
      }),
    );
    renderModal();
    await fillValid();
    fireEvent.click(btn('Davom etish'));
    fireEvent.click(btn('E’lon qilish'));

    expect(
      await screen.findByText('Ruxsat etilgan sana: 28.09.2026 — 31.08.2027'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Sana')).toHaveValue('');
    expect(btn('Davom etish')).toBeDisabled();
  });

  it('🔴 day_not_announceable — sana tanlagichi SERVER oralig‘iga o‘tadi (rad etilgan kun yopiladi)', async () => {
    const tomorrow = dayjs(TODAY).add(1, 'day');
    m.mutateAsync.mockRejectedValue(
      httpError(400, {
        message: 'Sana oraliqdan tashqarida',
        reason: 'day_not_announceable',
        from: tomorrow.format('YYYY-MM-DD'),
        to: '2099-08-31',
      }),
    );
    renderModal();
    await fillValid();
    expect(m.disabledDate?.(dayjs(TODAY))).toBe(false);
    fireEvent.click(btn('Davom etish'));
    fireEvent.click(btn('E’lon qilish'));

    await screen.findByText(/^Ruxsat etilgan sana:/);
    const disabled = m.disabledDate;
    if (!disabled) throw new Error('disabledDate uzatilmadi');
    expect(disabled(dayjs(TODAY))).toBe(true);
    expect(disabled(tomorrow)).toBe(false);
    expect(disabled(dayjs('2099-08-31'))).toBe(false);
    expect(disabled(dayjs('2099-09-01'))).toBe(true);
  });

  it('day_not_announceable, meta buzuq — mahalliy oraliq saqlanadi, server matni ko‘rinadi', async () => {
    m.mutateAsync.mockRejectedValue(
      httpError(400, {
        message: 'Sana oraliqdan tashqarida',
        reason: 'day_not_announceable',
        from: 'garbage',
      }),
    );
    renderModal();
    await fillValid();
    fireEvent.click(btn('Davom etish'));
    fireEvent.click(btn('E’lon qilish'));

    expect(await screen.findAllByText('Sana oraliqdan tashqarida')).not.toHaveLength(0);
    expect(m.disabledDate?.(dayjs(TODAY))).toBe(false);
  });

  it('takroriy e’lon (409 session_already_announced) — mavjud sessiya ochiladi', async () => {
    m.mutateAsync.mockRejectedValue(
      httpError(409, {
        message: 'Bu mashg‘ulot allaqachon e’lon qilingan',
        reason: 'session_already_announced',
        session: 'old7',
      }),
    );
    const { onAnnounced } = renderModal();
    await fillValid();
    fireEvent.click(btn('Davom etish'));
    fireEvent.click(btn('E’lon qilish'));
    await waitFor(() => expect(onAnnounced).toHaveBeenCalledWith('old7'));
  });
});
