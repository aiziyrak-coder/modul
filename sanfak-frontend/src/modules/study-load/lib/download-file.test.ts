import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosHeaders } from 'axios';
import type { MessageInstance } from 'antd/es/message/interface';
import type { TFunction } from 'i18next';
import { downloadFile, fileNameFromDisposition } from './download-file';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn<
    (url: string, config?: unknown) => Promise<{ data: Blob; headers: Record<string, string> }>
  >(),
}));

vi.mock('@/shared/api', () => ({
  apiClient: { get: getMock },
}));

const MESSAGES: Record<string, string> = {
  'studyLoad.pdf.forbidden': "Bu hujjatni ko'rish uchun ruxsatingiz yo'q.",
  'studyLoad.download.failed': "Faylni yuklab bo'lmadi.",
  'studyLoad.download.conflict': "Hisobot tuzilmadi: tasdiqlangan hujjat yo'q.",
};
const t = ((key: string) => MESSAGES[key] ?? key) as unknown as TFunction;

function createMessageApiMock(): MessageInstance {
  return { error: vi.fn(), success: vi.fn(), info: vi.fn() } as unknown as MessageInstance;
}

describe('fileNameFromDisposition', () => {
  it('oddiy `filename="…"` va qo`shtirnoqsiz shakl', () => {
    expect(fileNameFromDisposition('attachment; filename="a-b.xlsx"')).toBe('a-b.xlsx');
    expect(fileNameFromDisposition('attachment; filename=a.xlsx')).toBe('a.xlsx');
  });
  it('RFC 5987 `filename*=UTF-8\'\'…` dekodlanadi va ustun', () => {
    expect(
      fileNameFromDisposition("attachment; filename=\"x.xlsx\"; filename*=UTF-8''kafedra%20hisobi.xlsx"),
    ).toBe('kafedra hisobi.xlsx');
  });
  it('sarlavha yo`q → null', () => {
    expect(fileNameFromDisposition(undefined)).toBeNull();
    expect(fileNameFromDisposition('inline')).toBeNull();
  });
});

describe('downloadFile', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let messageApi: MessageInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    messageApi = createMessageApiMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    clickSpy.mockRestore();
  });

  it('blob so`rovi params bilan; nom Content-Disposition`dan; <a download> bosiladi; URL bekor qilinadi', async () => {
    const blob = new Blob(['PK'], { type: 'application/octet-stream' });
    getMock.mockResolvedValue({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="kafedralar-soatlar-hisobi-2026-2027.xlsx"' },
    });

    const ok = await downloadFile('/workloads/summary.xlsx', { academicYear: 'ay1' }, 'fallback.xlsx', messageApi, t);

    expect(ok).toBe(true);
    expect(getMock).toHaveBeenCalledWith('/workloads/summary.xlsx', {
      params: { academicYear: 'ay1' },
      responseType: 'blob',
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('kafedralar-soatlar-hisobi-2026-2027.xlsx');
    expect(anchor.href).toContain('blob:mock-url');
    expect(document.body.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('Content-Disposition yo`q → fallback nom', async () => {
    getMock.mockResolvedValue({ data: new Blob(['PK']), headers: {} });
    await downloadFile('/x.xlsx', {}, 'fallback.xlsx', messageApi, t);
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('fallback.xlsx');
  });

  it('403 → ruxsat xabari, false; hech narsa yuklanmaydi', async () => {
    const err = new AxiosError('forbidden', '403', undefined, undefined, {
      status: 403,
      statusText: 'Forbidden',
      data: {},
      headers: {} as AxiosHeaders,
      config: { headers: {} as AxiosHeaders },
    });
    getMock.mockRejectedValue(err);

    const ok = await downloadFile('/x.xlsx', {}, 'f.xlsx', messageApi, t);

    expect(ok).toBe(false);
    expect(messageApi.error).toHaveBeenCalledWith(MESSAGES['studyLoad.pdf.forbidden']);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('noma`lum xato → umumiy xabar', async () => {
    getMock.mockRejectedValue(new Error('network'));
    await downloadFile('/x.xlsx', {}, 'f.xlsx', messageApi, t);
    expect(messageApi.error).toHaveBeenCalledWith(MESSAGES['studyLoad.download.failed']);
  });

  const conflictError = (body: BodyInit | object) =>
    new AxiosError('conflict', '409', undefined, undefined, {
      status: 409,
      statusText: 'Conflict',
      data: body,
      headers: {} as AxiosHeaders,
      config: { headers: {} as AxiosHeaders },
    });

  const blobWithText = (body: string): Blob =>
    Object.assign(new Blob([body], { type: 'application/json' }), {
      text: () => Promise.resolve(body),
    });

  it('409 (blob tanasi) → backend xabari ko`rsatiladi, fayl saqlanmaydi', async () => {
    const payload = JSON.stringify({
      status: 'error',
      statusCode: 409,
      message: "2029/2030 o'quv yilida tasdiqlangan yuklama topilmadi",
    });
    getMock.mockRejectedValue(conflictError(blobWithText(payload)));

    const ok = await downloadFile('/workloads/summary.xlsx', {}, 'f.xlsx', messageApi, t);

    expect(ok).toBe(false);
    expect(messageApi.error).toHaveBeenCalledWith(
      "2029/2030 o'quv yilida tasdiqlangan yuklama topilmadi",
    );
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('409 (oddiy JSON tanasi) → backend xabari ko`rsatiladi', async () => {
    getMock.mockRejectedValue(conflictError({ message: 'Tasdiqlangan hujjat yo`q' }));
    await downloadFile('/workloads/summary.xlsx', {}, 'f.xlsx', messageApi, t);
    expect(messageApi.error).toHaveBeenCalledWith('Tasdiqlangan hujjat yo`q');
  });

  it('409 (tana JSON emas) → tarjima qilingan zaxira xabar', async () => {
    getMock.mockRejectedValue(conflictError(blobWithText('<html>502</html>')));
    await downloadFile('/workloads/summary.xlsx', {}, 'f.xlsx', messageApi, t);
    expect(messageApi.error).toHaveBeenCalledWith(MESSAGES['studyLoad.download.conflict']);
  });

  it('409 (tanani umuman o`qib bo`lmaydi) → osilib qolmaydi, zaxira xabar', async () => {
    vi.useRealTimers();
    const stuck = Object.assign(new Blob(['x']), { text: () => new Promise<string>(() => {}) });
    getMock.mockRejectedValue(conflictError(stuck));

    await downloadFile('/workloads/summary.xlsx', {}, 'f.xlsx', messageApi, t);

    expect(messageApi.error).toHaveBeenCalledWith(MESSAGES['studyLoad.download.conflict']);
  }, 10_000);
});
