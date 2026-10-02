import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api';
import { putElectiveChoice } from './distribution-api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('putElectiveChoice — wire body', () => {
  it('AYNAN 2 kalit yuboradi va `/distributions` prefiksiga boradi', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
      data: {
        data: {
          distribution: 'd-1',
          blockId: 'blk-1',
          science: 'science-9',
          electiveSlot: 'science-1',
          totalHour: 90,
        },
      },
    });

    const res = await putElectiveChoice('d-1', {
      blockId: 'blk-1',
      scienceId: 'science-9',
    });

    expect(put).toHaveBeenCalledTimes(1);
    const call = put.mock.calls[0];
    expect(call?.[0]).toBe('/distributions/d-1/elective-choice');

    const body = call?.[1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['blockId', 'scienceId']);
    expect(body).toEqual({ blockId: 'blk-1', scienceId: 'science-9' });

    expect(res).toEqual({
      blockId: 'blk-1',
      scienceId: 'science-9',
      electiveSlotScienceId: 'science-1',
      totalHour: 90,
    });
  });

  it('`suitabilityBasis` berilsa — 4 kalit yuboradi (`declaredBy`/`declaredAt` YO\'Q)', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
      data: {
        data: {
          distribution: 'd-1',
          blockId: 'blk-1',
          science: 'science-9',
          electiveSlot: 'science-1',
          totalHour: 90,
        },
      },
    });

    await putElectiveChoice('d-1', {
      blockId: 'blk-1',
      scienceId: 'science-9',
      suitabilityBasis: 'kafedrada_mutaxassis_yoq',
      suitabilityNote: 'Kafedrada mos mutaxassis yo\'q, vakant e\'lon qilindi.',
    });

    const body = put.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'blockId',
      'scienceId',
      'suitabilityBasis',
      'suitabilityNote',
    ]);
    expect(body).toEqual({
      blockId: 'blk-1',
      scienceId: 'science-9',
      suitabilityBasis: 'kafedrada_mutaxassis_yoq',
      suitabilityNote: 'Kafedrada mos mutaxassis yo\'q, vakant e\'lon qilindi.',
    });
  });

  it('`suitabilityBasis` berilmasa — QO\'SHIMCHA kalitlar UMUMAN yo\'q (AYNAN 2 kalit saqlanadi)', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
      data: { data: { blockId: 'blk-1', science: 'science-1' } },
    });

    await putElectiveChoice('d-1', { blockId: 'blk-1', scienceId: 'science-1' });

    const body = put.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['blockId', 'scienceId']);
  });
});
