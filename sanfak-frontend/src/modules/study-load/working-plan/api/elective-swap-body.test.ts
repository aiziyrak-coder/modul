import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api';
import { putElectiveScience } from './working-plan-api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('putElectiveScience — wire body', () => {
  it('AYNAN 4 kalit yuboradi va boshqa hech nima qo`shmaydi', async () => {
    const put = vi
      .spyOn(apiClient, 'put')
      .mockResolvedValue({ data: { data: { persisted: true } } });

    await putElectiveScience({
      planDocId: 'wp-1',
      semKey: '1',
      blockId: 'blk-2',
      scienceRowId: 'sci-1',
      scienceId: 'science-9',
    });

    expect(put).toHaveBeenCalledTimes(1);
    const call = put.mock.calls[0];
    expect(call?.[0]).toBe('/working-plans/wp-1/elective-science');

    const body = call?.[1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['_id', 'parentId', 'scienceId', 'semKey']);
    expect(body).toEqual({
      semKey: '1',
      parentId: 'blk-2',
      _id: 'sci-1',
      scienceId: 'science-9',
    });
  });
});
