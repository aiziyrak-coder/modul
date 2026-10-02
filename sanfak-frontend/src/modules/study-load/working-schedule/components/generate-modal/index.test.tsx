import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import GenerateModal from './index';

class FakeSseStream {
  static instances: FakeSseStream[] = [];

  private encoder = new TextEncoder();
  private queue: Uint8Array[] = [];
  private waiting: ((r: { done: boolean; value?: Uint8Array }) => void) | null = null;
  private closed = false;

  constructor() {
    FakeSseStream.instances.push(this);
  }

  emit(type: string, data: unknown) {
    const chunk = this.encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ done: false, value: chunk });
    } else {
      this.queue.push(chunk);
    }
  }

  getReader() {
    return {
      read: (): Promise<{ done: boolean; value?: Uint8Array }> => {
        const next = this.queue.shift();
        if (next) return Promise.resolve({ done: false, value: next });
        if (this.closed) return Promise.resolve({ done: true, value: undefined });
        return new Promise((resolve) => {
          this.waiting = resolve;
        });
      },
    };
  }
}

function lastStream(): FakeSseStream {
  const stream = FakeSseStream.instances.at(-1);
  if (!stream) throw new Error('fetch oqimi ochilmadi — modal streamni boshlamadi');
  return stream;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const fetchMock = vi.fn(() => {
  const stream = new FakeSseStream();
  return Promise.resolve({ status: 200, ok: true, body: stream });
});

beforeEach(() => {
  FakeSseStream.instances = [];
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const DONE_ZERO = {
  success: false,
  totalCreated: 0,
  totalReplaced: 0,
  totalLockedReplaced: 0,
  totalSkipped: 2,
  statusUpdated: false,
  message: "Hech qanday ishchi o'quv reja yaratilmadi (2 ta kurs o'tkazib yuborildi)",
  learningProcessStatus: 'new' as const,
  created: [],
  skipped: [
    { courseNum: 1, reason: 'Kontingent topilmadi' },
    { courseNum: 2, reason: 'Semestr maʼlumoti yoʻq' },
  ],
};

describe('GenerateModal — `done` kelganda modal AVTOMATIK yopilmaydi (AD-6)', () => {
  it("`done` kelganda modal ochiq qoladi va onClose CHAQIRILMAYDI", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <GenerateModal open learningProcessId="lp-1" onDone={onDone} onClose={onClose} />,
    );

    const es = lastStream();
    await act(async () => {
      es.emit('start', {
        courses: [
          { courseNum: 1, status: 'pending' },
          { courseNum: 2, status: 'pending' },
        ],
      });
    });
    await flush();
    await act(async () => {
      es.emit('done', DONE_ZERO);
    });
    await flush();

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onClose, 'modal o`zini yopdi — AD-6 defekti qaytdi').not.toHaveBeenCalled();

    expect(screen.getByText(DONE_ZERO.message)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yopish' })).toBeTruthy();
  });

  it("0 ta yaratilganda 'yaratildi' DEYILMAYDI va har kurs uchun skip sababi ko'rsatiladi", async () => {
    renderWithProviders(
      <GenerateModal open learningProcessId="lp-1" onDone={vi.fn()} onClose={vi.fn()} />,
    );

    const es = lastStream();
    await act(async () => {
      es.emit('start', {
        courses: [
          { courseNum: 1, status: 'pending' },
          { courseNum: 2, status: 'pending' },
        ],
      });
    });
    await flush();
    await act(async () => {
      es.emit('done', DONE_ZERO);
    });
    await flush();

    expect(screen.getByText('Kontingent topilmadi')).toBeTruthy();
    expect(screen.getByText('Semestr maʼlumoti yoʻq')).toBeTruthy();
    expect(screen.queryByText("Ishchi o'quv reja muvaffaqiyatli yaratildi")).toBeNull();
    expect(screen.getAllByText("O'tkazib yuborildi").length).toBe(2);
  });

  it("almashtirilgan IMZOLANGAN hujjatlar soni kurs qatorida ko'rinadi", async () => {
    renderWithProviders(
      <GenerateModal open learningProcessId="lp-1" onDone={vi.fn()} onClose={vi.fn()} />,
    );

    const es = lastStream();
    await act(async () => {
      es.emit('start', { courses: [{ courseNum: 3, status: 'pending' }] });
    });
    await flush();
    await act(async () => {
      es.emit('done', {
        success: true,
        totalCreated: 1,
        totalReplaced: 2,
        totalLockedReplaced: 1,
        totalSkipped: 0,
        statusUpdated: true,
        message: "1 ta ishchi o'quv reja yaratildi",
        learningProcessStatus: 'created',
        created: [{ courseNum: 3, replaced: 2, lockedReplaced: 1 }],
        skipped: [],
      });
    });
    await flush();

    expect(
      screen.getByText('2 ta eski reja almashtirildi, shundan 1 tasi tasdiqlangan edi'),
    ).toBeTruthy();
  });
});
