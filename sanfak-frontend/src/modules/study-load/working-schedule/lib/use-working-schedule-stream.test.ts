import { TextEncoder } from 'node:util';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken, setRefreshToken, clearTokens } from '@/shared/api/token-store';
import * as clientModule from '@/shared/api/client';
import { useWorkingScheduleStream } from './use-working-schedule-stream';

const refreshAccessTokenMock = vi.spyOn(clientModule, 'refreshAccessToken');

const encoder = new TextEncoder();

function fakeBody(chunks: string[]) {
  let i = 0;
  return {
    getReader() {
      return {
        read: async () => {
          if (i < chunks.length) {
            const value = encoder.encode(chunks[i]);
            i += 1;
            return { done: false, value };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

function sseResponse(status: number, chunks: string[]) {
  return {
    status,
    ok: status >= 200 && status < 300,
    body: chunks.length > 0 ? fakeBody(chunks) : null,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  refreshAccessTokenMock.mockReset();
  setAccessToken('old-token');
  setRefreshToken('refresh-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearTokens();
});

describe('token — Authorization HEADER, URL EMAS (P0 regressiya)', () => {
  it('URL"da `token=` yo\'q, `Authorization: Bearer` header bilan yuboriladi', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse(200, ['event: done\ndata: {"success":true,"totalCreated":0,"message":"x"}\n\n']),
    );
    const { result } = renderHook(() =>
      useWorkingScheduleStream({ learningProcessId: 'lp-1' }),
    );

    act(() => result.current.start());
    await waitFor(() => expect(result.current.doneData).not.toBeNull());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('token=');
    expect(url).toContain('learningProcess=lp-1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer old-token');
  });
});

describe('courses — kurs tanlovi (variant B)', () => {
  const doneChunk = 'event: done\ndata: {"success":true,"totalCreated":0,"message":"x"}\n\n';

  async function urlFor(props: { approval?: string; courses?: number[] }): Promise<string> {
    fetchMock.mockResolvedValueOnce(sseResponse(200, [doneChunk]));
    const { result } = renderHook(() =>
      useWorkingScheduleStream({ learningProcessId: 'lp-1', ...props }),
    );
    act(() => result.current.start());
    await waitFor(() => expect(result.current.doneData).not.toBeNull());
    return fetchMock.mock.calls[0]?.[0] as string;
  }

  it('tanlangan kurslar `courses=` bilan vergul orqali yuboriladi', async () => {
    const url = await urlFor({ approval: 'P-1', courses: [5, 6] });
    expect(url).toMatch(
      /\/working-schedules\/generate-stream\?learningProcess=lp-1&approval=P-1&courses=5,6$/,
    );
  });

  it('courses yo`q yoki bo`sh — param qo`shilmaydi (URL avvalgidek)', async () => {
    const withoutCourses = await urlFor({});
    expect(withoutCourses).not.toContain('courses=');
    expect(withoutCourses).toMatch(/generate-stream\?learningProcess=lp-1$/);

    fetchMock.mockClear();
    const emptyCourses = await urlFor({ courses: [] });
    expect(emptyCourses).toBe(withoutCourses);
  });
});

describe('SSE parse — start/progress/done', () => {
  it('bloklarni to\'g\'ri qabul qiladi va holatni yangilaydi', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse(200, [
        'event: start\ndata: {"courses":[{"courseNum":1,"status":"pending"}]}\n\n',
        'event: progress\ndata: {"courseNum":1,"status":"created","percent":100}\n\n',
        'event: done\ndata: {"success":true,"totalCreated":1,"message":"tayyor"}\n\n',
      ]),
    );
    const onDone = vi.fn();
    const { result } = renderHook(() =>
      useWorkingScheduleStream({ learningProcessId: 'lp-1', onDone }),
    );

    act(() => result.current.start());
    await waitFor(() => expect(result.current.isRunning).toBe(false));

    expect(result.current.progress).toBe(100);
    expect(result.current.courses[0]?.status).toBe('created');
    expect(result.current.doneData?.totalCreated).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('bir chunk ICHIDA kelgan IKKITA blokni ham ajrata oladi', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse(200, [
        'event: start\ndata: {"courses":[]}\n\nevent: done\ndata: {"success":true,"totalCreated":0,"message":"x"}\n\n',
      ]),
    );
    const { result } = renderHook(() =>
      useWorkingScheduleStream({ learningProcessId: 'lp-1' }),
    );

    act(() => result.current.start());
    await waitFor(() => expect(result.current.doneData).not.toBeNull());
    expect(result.current.doneData?.success).toBe(true);
  });
});

describe('401 → refresh → qayta ulanish', () => {
  it('bitta 401 — refresh qilinadi, YANGI token bilan qayta so\'raladi, oqim davom etadi', async () => {
    refreshAccessTokenMock.mockImplementationOnce(async () => {
      setAccessToken('new-token');
      return 'new-token';
    });
    fetchMock
      .mockResolvedValueOnce(sseResponse(401, []))
      .mockResolvedValueOnce(
        sseResponse(200, ['event: done\ndata: {"success":true,"totalCreated":2,"message":"ok"}\n\n']),
      );

    const { result } = renderHook(() =>
      useWorkingScheduleStream({ learningProcessId: 'lp-1' }),
    );

    act(() => result.current.start());
    await waitFor(() => expect(result.current.doneData).not.toBeNull());

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect((secondInit.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
    expect(result.current.doneData?.totalCreated).toBe(2);
    expect(result.current.streamError).toBeNull();
  });

  it('refresh MUVAFFAQIYATSIZ bo\'lsa — xato holatiga o\'tadi, cheksiz qayta urinish YO\'Q', async () => {
    refreshAccessTokenMock.mockResolvedValueOnce(null);
    fetchMock.mockResolvedValueOnce(sseResponse(401, []));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useWorkingScheduleStream({ learningProcessId: 'lp-1', onError }),
    );

    act(() => result.current.start());
    await waitFor(() => expect(result.current.streamError).not.toBeNull());

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('backend xato / tarmoq xatosi', () => {
  it('HTTP 500 — xato holati qo\'yiladi, refresh CHAQIRILMAYDI', async () => {
    fetchMock.mockResolvedValueOnce(sseResponse(500, []));

    const { result } = renderHook(() =>
      useWorkingScheduleStream({ learningProcessId: 'lp-1' }),
    );

    act(() => result.current.start());
    await waitFor(() => expect(result.current.streamError).not.toBeNull());

    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    expect(result.current.streamError).toContain('500');
  });
});

describe('stop() — foydalanuvchi to\'xtatsa xato holati QO\'YILMAYDI', () => {
  it('start() dan keyin darhol stop() — streamError bo\'sh qoladi', async () => {
    let resolveFetch: ((value: ReturnType<typeof sseResponse>) => void) | undefined;
    const pending = new Promise<ReturnType<typeof sseResponse>>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockImplementationOnce(() => pending);

    const { result } = renderHook(() =>
      useWorkingScheduleStream({ learningProcessId: 'lp-1' }),
    );

    act(() => result.current.start());
    act(() => result.current.stop());
    resolveFetch?.(sseResponse(200, []));

    await waitFor(() => expect(result.current.isRunning).toBe(false));
    expect(result.current.streamError).toBeNull();
  });
});
