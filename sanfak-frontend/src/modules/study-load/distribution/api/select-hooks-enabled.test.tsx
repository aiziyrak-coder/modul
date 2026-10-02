import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type * as SharedApi from '@/shared/api';
import { useTeachersForSelect, useWorkloadBlocksForSelect } from './distribution-api';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn<(url: string, config?: unknown) => Promise<{ data: unknown }>>(),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return { ...actual, apiClient: { ...actual.apiClient, get: getMock } };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getMock.mockReset();
  getMock.mockResolvedValue({ data: [] });
});

describe('useTeachersForSelect / useWorkloadBlocksForSelect — enabled (P-26/P-27)', () => {
  it('enabled: false → GET /teachers YUBORILMAYDI', async () => {
    const { result } = renderHook(() => useTeachersForSelect({ enabled: false }), { wrapper });
    await new Promise((r) => setTimeout(r, 30));
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('default (enabled yo`q) → avvalgidek so`raladi (assign-drawer buzilmaydi)', async () => {
    renderHook(() => useTeachersForSelect(), { wrapper });
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/teachers'));
  });

  it('enabled: false → GET /workloads/detail/:id YUBORILMAYDI', async () => {
    renderHook(() => useWorkloadBlocksForSelect('w1', { enabled: false }), { wrapper });
    await new Promise((r) => setTimeout(r, 30));
    expect(getMock).not.toHaveBeenCalled();
  });

  it('enabled: true + id → so`raladi', async () => {
    getMock.mockResolvedValue({ data: { _id: 'w1', directions: [] } });
    renderHook(() => useWorkloadBlocksForSelect('w1', { enabled: true }), { wrapper });
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/workloads/detail/w1'));
  });
});
