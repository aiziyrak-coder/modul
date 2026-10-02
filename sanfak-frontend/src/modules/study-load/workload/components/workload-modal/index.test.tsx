import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { useModalStore } from '@/shared/ui';
import { WorkloadProgress } from './index';

vi.mock('@/shared/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

type MutationVars = { department: string; academicYear: string };

const { mutationImpl } = vi.hoisted(() => ({ mutationImpl: vi.fn() }));

vi.mock('../../api/workload-api', () => ({
  useCreateWorkload: () => {
    const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    return {
      isPending: status === 'pending',
      isSuccess: status === 'success',
      isError: status === 'error',
      mutate: (vars: MutationVars, opts?: { onError?: (e: unknown) => void }) => {
        setStatus('pending');
        Promise.resolve(mutationImpl(vars) as Promise<void>).then(
          () => setStatus('success'),
          (e) => {
            setStatus('error');
            opts?.onError?.(e);
          },
        );
      },
      mutateAsync: (vars: MutationVars) => {
        setStatus('pending');
        return Promise.resolve(mutationImpl(vars) as Promise<void>).then(
          (r) => { setStatus('success'); return r; },
          (e) => { setStatus('error'); throw e; },
        );
      },
    };
  },
}));

function createDeferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('WorkloadProgress — progress modal API lifecycle bilan sinxron', () => {
  let showModal: ReturnType<typeof vi.fn>;
  let hideModal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mutationImpl.mockReset();
    showModal = vi.fn();
    hideModal = vi.fn();
    useModalStore.setState({ showModal, hideModal });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('POST kutilayotganda (kechikkanda ham) modal ochiq qoladi — hideModal chaqirilmaydi', async () => {
    const deferred = createDeferred<void>();
    mutationImpl.mockReturnValue(deferred.promise);

    renderWithProviders(
      <WorkloadProgress department="d1" academicYear="y1" deptTitle="Filologiya" />,
    );

    expect(mutationImpl).toHaveBeenCalledWith({ department: 'd1', academicYear: 'y1' });
    expect(screen.getByText('studyLoad.progress.title')).toBeInTheDocument();
    expect(hideModal).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText('studyLoad.progress.title')).toBeInTheDocument();
    expect(hideModal).not.toHaveBeenCalled();
  });

  it('muvaffaqiyatda SuccessModal ko`rinadi va showModal QAYTA chaqirilmaydi (remount yo`q)', async () => {
    vi.useRealTimers();

    const deferred = createDeferred<void>();
    mutationImpl.mockReturnValue(deferred.promise);

    await act(async () => {
      renderWithProviders(
        <WorkloadProgress department="d1" academicYear="y1" deptTitle="Filologiya" />,
      );
    });

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(
      await screen.findByText('studyLoad.progress.successTextWithDept', undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument();
    expect(
      showModal,
      'WorkloadProgress showModal chaqirsa — ModalHost ProgressModal`ni remount qiladi (eski bug)',
    ).not.toHaveBeenCalled();
    expect(hideModal, 'faqat "Davom etish" bosilganda yopilishi kerak').not.toHaveBeenCalled();
  });

  it('xatoda modal yopiladi (hideModal chaqiriladi)', async () => {
    const deferred = createDeferred<void>();
    mutationImpl.mockReturnValue(deferred.promise);

    renderWithProviders(
      <WorkloadProgress department="d1" academicYear="y1" deptTitle="Filologiya" />,
    );

    await act(async () => {
      deferred.reject(new Error('server xatosi'));
      await deferred.promise.catch(() => undefined);
    });

    expect(hideModal).toHaveBeenCalledTimes(1);
    expect(showModal).not.toHaveBeenCalled();
  });
});
