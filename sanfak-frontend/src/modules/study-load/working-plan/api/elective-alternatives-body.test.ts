import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api';
import { putElectiveAlternatives } from './working-plan-api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('putElectiveAlternatives — wire body', () => {
  it('AYNAN 4 kalit yuboradi, element ichida faqat `scienceId`', async () => {
    const put = vi
      .spyOn(apiClient, 'put')
      .mockResolvedValue({ data: { data: { persisted: true } } });

    await putElectiveAlternatives({
      planDocId: 'wp-1',
      semKey: '1',
      blockId: 'blk-2',
      scienceRowId: 'sci-1',
      scienceIds: ['science-9', 'science-10'],
    });

    expect(put).toHaveBeenCalledTimes(1);
    const call = put.mock.calls[0];
    expect(call?.[0]).toBe('/working-plans/wp-1/elective-alternatives');

    const body = call?.[1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'alternatives',
      'blockId',
      'scienceRowId',
      'semKey',
    ]);
    expect(body).toEqual({
      semKey: '1',
      blockId: 'blk-2',
      scienceRowId: 'sci-1',
      alternatives: [{ scienceId: 'science-9' }, { scienceId: 'science-10' }],
    });

    const items = body['alternatives'] as Record<string, unknown>[];
    for (const item of items) {
      expect(Object.keys(item)).toEqual(['scienceId']);
    }
  });

  it('bo`sh massiv = hamma alternativ olib tashlansin (qonuniy amal)', async () => {
    const put = vi
      .spyOn(apiClient, 'put')
      .mockResolvedValue({ data: { data: { persisted: true } } });

    await putElectiveAlternatives({
      planDocId: 'wp-1',
      semKey: '2',
      blockId: 'blk-2',
      scienceRowId: 'sci-1',
      scienceIds: [],
    });

    const body = put.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(body)).toContain('alternatives');
    expect(body['alternatives']).toEqual([]);
  });
});
