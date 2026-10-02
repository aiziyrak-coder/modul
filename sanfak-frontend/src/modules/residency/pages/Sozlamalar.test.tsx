import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedApi from '@/shared/api';
import { theme } from '../styles/theme';

const h = vi.hoisted(() => ({
  fetchOne: vi.fn(),
  putJson: vi.fn(),
  canEdit: true,
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  fetchOne: h.fetchOne,
  putJson: h.putJson,
}));
vi.mock('@/app/session', () => ({
  usePermission: () => (key: string) => key === 'residencyLesson:update' && h.canEdit,
}));

const { default: Sozlamalar } = await import('./Sozlamalar');

const ROOT = '/residency-settings';

const NEW_SETTING = {
  _id: 's1',
  workDayFrom: '09:00',
  workDayTo: '14:00',
  absenceStreakDays: 4,
  absenceWindowDays: 10,
  updatedBy: 'u1',
};

const OLD_SETTING = {
  _id: 's1',
  workDayFrom: '09:00',
  workDayTo: '14:00',
  absenceStreakDays: 3,
  updatedBy: 'u1',
};

const NOTE =
  'Rezident oxirgi kunlar oynasida kamida belgilangan sondagi kun sababsiz qoldirsa, klinik ' +
  'ustozda bo‘lim xodimiga davomat bildirgisi yuborish tugmasi ochiladi. Kunlar ketma-ket ' +
  'bo‘lishi shart emas — kun ora qoldirish ham sanaladi. Bir kunda nechta dars bo‘lsa ham kun ' +
  'bir marta sanaladi; o‘sha kuni birorta darsga kelgan yoki sababi tasdiqlangan bo‘lsa, kun ' +
  'sanalmaydi. Dam olish va bayram kunlari sanalmaydi; hali tugamagan bugungi kun hisobga ' +
  'olinmaydi.';

const N_LABEL = 'Sababsiz kunlar, kamida (1–30)';
const W_LABEL = 'Oyna — oxirgi necha kun (1–30)';
const N_WARN = 'Sababsiz kunlar soni 1 va 30 orasidagi butun son bo‘lishi kerak';
const W_WARN = 'Oyna 1 va 30 kun orasidagi butun son bo‘lishi kerak';
const NW_WARN = 'Sababsiz kunlar soni oyna kunlaridan ko‘p bo‘lmasligi kerak';

function draw() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConfigProvider>
        <AntdApp>
          <ThemeProvider theme={theme as unknown as DefaultTheme}>
            <Sozlamalar />
          </ThemeProvider>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>,
  );
}

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const type = (el: HTMLInputElement, value: string) => fireEvent.change(el, { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

beforeEach(() => {
  h.fetchOne.mockReset();
  h.putJson.mockReset();
  h.putJson.mockResolvedValue({});
  h.canEdit = true;
});

describe('Sozlamalar — yangi backend (oyna qoidasi)', { timeout: 30_000 }, () => {
  it('ikkala maydon saqlangan qiymat bilan, izoh va «Hozirgi qoida»', async () => {
    h.fetchOne.mockResolvedValue(NEW_SETTING);
    draw();
    await waitFor(() => expect(input(N_LABEL).value).toBe('4'));
    expect(input(W_LABEL).value).toBe('10');
    expect(input(N_LABEL).placeholder).toBe('3');
    expect(input(W_LABEL).placeholder).toBe('7');
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(
      screen.getByText('Hozirgi qoida: oxirgi 10 kun ichida kamida 4 kun.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/tugma hech qachon ochilmaydi/)).toBeNull();
    expect(screen.queryByText('Ketma-ket kun (1–30)')).toBeNull();
    expect(h.fetchOne).toHaveBeenCalledWith(ROOT);
  });

  it('PUT tanasida to‘rt maydon (W ham)', async () => {
    h.fetchOne.mockResolvedValue(NEW_SETTING);
    draw();
    await waitFor(() => expect(input(N_LABEL).value).toBe('4'));
    type(input(N_LABEL), '3');
    type(input(W_LABEL), ' 7 ');
    save();
    await waitFor(() => expect(h.putJson).toHaveBeenCalledTimes(1));
    expect(h.putJson).toHaveBeenCalledWith(ROOT, {
      workDayFrom: '09:00',
      workDayTo: '14:00',
      absenceStreakDays: 3,
      absenceWindowDays: 7,
    });
    expect(await screen.findByText('Sozlamalar saqlandi')).toBeInTheDocument();
  });

  it('N = W — ruxsat (chegara)', async () => {
    h.fetchOne.mockResolvedValue(NEW_SETTING);
    draw();
    await waitFor(() => expect(input(N_LABEL).value).toBe('4'));
    type(input(N_LABEL), '5');
    type(input(W_LABEL), '5');
    save();
    await waitFor(() => expect(h.putJson).toHaveBeenCalledTimes(1));
    expect(h.putJson).toHaveBeenCalledWith(
      ROOT,
      expect.objectContaining({ absenceStreakDays: 5, absenceWindowDays: 5 }),
    );
  });

  it('N > W — ogohlantirish, PUT yo‘q', async () => {
    h.fetchOne.mockResolvedValue(NEW_SETTING);
    draw();
    await waitFor(() => expect(input(N_LABEL).value).toBe('4'));
    type(input(N_LABEL), '8');
    type(input(W_LABEL), '7');
    save();
    expect(await screen.findByText(NW_WARN)).toBeInTheDocument();
    expect(h.putJson).not.toHaveBeenCalled();
  });

  it.each(['0', '31', '2.5', ''])('W = %p — oyna ogohlantirishi, PUT yo‘q', async (w) => {
    h.fetchOne.mockResolvedValue(NEW_SETTING);
    draw();
    await waitFor(() => expect(input(W_LABEL).value).toBe('10'));
    type(input(W_LABEL), w);
    save();
    expect(await screen.findByText(W_WARN)).toBeInTheDocument();
    expect(h.putJson).not.toHaveBeenCalled();
  });

  it.each(['0', '31', 'abc'])('N = %p — kunlar soni ogohlantirishi, PUT yo‘q', async (n) => {
    h.fetchOne.mockResolvedValue(NEW_SETTING);
    draw();
    await waitFor(() => expect(input(N_LABEL).value).toBe('4'));
    type(input(N_LABEL), n);
    save();
    expect(await screen.findByText(N_WARN)).toBeInTheDocument();
    expect(h.putJson).not.toHaveBeenCalled();
  });

  it('«Hozirgi qoida» SAQLANGAN qiymatdan — yozilayotgan matn uni o‘zgartirmaydi', async () => {
    h.fetchOne.mockResolvedValue(NEW_SETTING);
    draw();
    await waitFor(() => expect(input(N_LABEL).value).toBe('4'));
    type(input(N_LABEL), '2');
    type(input(W_LABEL), '5');
    expect(
      screen.getByText('Hozirgi qoida: oxirgi 10 kun ichida kamida 4 kun.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/oxirgi 5 kun ichida/)).toBeNull();
  });

  it('saqlangan N > W — qizil yordamchi', async () => {
    h.fetchOne.mockResolvedValue({ ...NEW_SETTING, absenceStreakDays: 9, absenceWindowDays: 5 });
    draw();
    expect(
      await screen.findByText(
        'Sababsiz kunlar soni oyna kunlaridan ko‘p — tugma hech qachon ochilmaydi',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Hozirgi qoida: oxirgi 5 kun ichida kamida 9 kun.'),
    ).toBeInTheDocument();
  });
});

describe('Sozlamalar — eski backend (ABS-Q11=A)', { timeout: 30_000 }, () => {
  it('eski karta; PUT da absenceWindowDays YO‘Q', async () => {
    h.fetchOne.mockResolvedValue(OLD_SETTING);
    draw();
    expect(await screen.findByText('Ketma-ket kun (1–30)')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Rezident shu kundan ko‘p ketma-ket sababsiz qoldirsa, klinik ustozda bo‘lim xodimiga bildirgi yuborish tugmasi ochiladi.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(W_LABEL)).toBeNull();
    expect(screen.queryByPlaceholderText('7')).toBeNull();
    expect(screen.queryByText(/Hozirgi qoida/)).toBeNull();

    const streak = screen.getByPlaceholderText('3') as HTMLInputElement;
    expect(streak.value).toBe('3');
    type(streak, '5');
    save();
    await waitFor(() => expect(h.putJson).toHaveBeenCalledTimes(1));
    expect(h.putJson).toHaveBeenCalledWith(ROOT, {
      workDayFrom: '09:00',
      workDayTo: '14:00',
      absenceStreakDays: 5,
    });
    const body = h.putJson.mock.calls.at(0)?.at(1) as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain('absenceWindowDays');
  });

  it('eski kartada eski ogohlantirish (N = 0), PUT yo‘q', async () => {
    h.fetchOne.mockResolvedValue(OLD_SETTING);
    draw();
    const streak = (await screen.findByPlaceholderText('3')) as HTMLInputElement;
    type(streak, '0');
    save();
    expect(
      await screen.findByText('Qoldirish ostonasi 1 va 30 kun orasidagi butun son bo‘lishi kerak'),
    ).toBeInTheDocument();
    expect(h.putJson).not.toHaveBeenCalled();
  });
});

describe('Sozlamalar — ruxsat', { timeout: 30_000 }, () => {
  it('`residencyLesson:update` siz — maydonlar o‘chiq, «Saqlash» yo‘q', async () => {
    h.canEdit = false;
    h.fetchOne.mockResolvedValue(NEW_SETTING);
    draw();
    await waitFor(() => expect(input(N_LABEL).value).toBe('4'));
    expect(input(N_LABEL)).toBeDisabled();
    expect(input(W_LABEL)).toBeDisabled();
    expect(screen.getByPlaceholderText('09:00')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Saqlash' })).toBeNull();
    expect(
      screen.getByText(
        'Sozlamalarni faqat magistratura va klinik ordinatura bo‘limi o‘zgartira oladi.',
      ),
    ).toBeInTheDocument();
  });

  it('eski backend + ruxsatsiz — eski maydon ham o‘chiq', async () => {
    h.canEdit = false;
    h.fetchOne.mockResolvedValue(OLD_SETTING);
    draw();
    expect(await screen.findByPlaceholderText('3')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Saqlash' })).toBeNull();
  });
});
