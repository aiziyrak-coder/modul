import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AxiosError, type AxiosHeaders } from 'axios';
import type { MessageInstance } from 'antd/es/message/interface';
import type { TFunction } from 'i18next';
import { openPdf } from './open-pdf';

const PDF_ERROR_TEMPLATES: Record<string, string> = {
  'studyLoad.pdf.sessionExpired': 'Sessiya muddati tugagan. Qaytadan tizimga kiring.',
  'studyLoad.pdf.forbidden': "Bu hujjatni ko'rish uchun ruxsatingiz yo'q.",
  'studyLoad.pdf.notFound': 'Hujjat topilmadi.',
  'studyLoad.pdf.openFailed': "Hujjatni ochib bo'lmadi. Birozdan keyin qayta urinib ko'ring.",
};
const t = ((key: string) => PDF_ERROR_TEMPLATES[key] ?? key) as unknown as TFunction;

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn<(url: string, config?: unknown) => Promise<{ data: Blob }>>(),
}));

vi.mock('@/shared/api', () => ({
  apiClient: { get: getMock },
}));

function stubObjectUrl() {
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });
  return { createObjectURL, revokeObjectURL };
}

function createMessageApiMock(): MessageInstance {
  return {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    open: vi.fn(),
    destroy: vi.fn(),
  } as unknown as MessageInstance;
}

describe('openPdf', () => {
  let urlMocks: ReturnType<typeof stubObjectUrl>;
  let fakeTab: { location: { href: string }; close: ReturnType<typeof vi.fn> };
  let windowOpenSpy: MockInstance<typeof window.open>;
  let messageApi: MessageInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
    urlMocks = stubObjectUrl();

    fakeTab = { location: { href: '' }, close: vi.fn() };
    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab as unknown as Window);

    messageApi = createMessageApiMock();
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
    vi.useRealTimers();
  });

  it("muvaffaqiyatli yo'l: blob so'raladi, createObjectURL chaqiriladi, yangi tab manziliga o'rnatiladi", async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    getMock.mockResolvedValueOnce({ data: blob });

    await openPdf('/distributions/1/pdf', messageApi, t);

    expect(windowOpenSpy).toHaveBeenCalledWith('', '_blank');
    expect(getMock).toHaveBeenCalledWith('/distributions/1/pdf', { responseType: 'blob' });
    expect(urlMocks.createObjectURL).toHaveBeenCalledWith(blob);
    expect(fakeTab.location.href).toBe('blob:mock-url');
    expect(messageApi.error).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(urlMocks.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it("xato yo'li: message.error chaqiriladi, createObjectURL chaqirilmaydi, bo'sh tab yopiladi", async () => {
    const axiosError = new AxiosError(
      'Request failed with status code 401',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {} as AxiosHeaders,
        config: { headers: {} as AxiosHeaders },
      },
    );
    getMock.mockRejectedValueOnce(axiosError);

    await openPdf('/distributions/1/pdf', messageApi, t);

    expect(urlMocks.createObjectURL).not.toHaveBeenCalled();
    expect(fakeTab.close).toHaveBeenCalled();
    expect(messageApi.error).toHaveBeenCalledWith(
      'Sessiya muddati tugagan. Qaytadan tizimga kiring.',
    );
  });

  it("noma'lum xato (404): mos xabar bilan message.error chaqiriladi", async () => {
    const axiosError = new AxiosError(
      'Request failed with status code 404',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 404,
        statusText: 'Not Found',
        data: {},
        headers: {} as AxiosHeaders,
        config: { headers: {} as AxiosHeaders },
      },
    );
    getMock.mockRejectedValueOnce(axiosError);

    await openPdf('/distributions/1/pdf', messageApi, t);

    expect(messageApi.error).toHaveBeenCalledWith('Hujjat topilmadi.');
  });
});
