import { describe, expect, it } from 'vitest';
import { mapTopic } from './topic-mapper';

describe('mapTopic', () => {
  it('maps _id → id and keeps kind/duration', () => {
    const r = mapTopic({ _id: 't1', title: 'Kirish', orderNumber: 1, kind: 2, duration: 4 });
    expect(r.id).toBe('t1');
    expect(r.kind).toBe(2);
    expect(r.duration).toBe(4);
    expect(r.orderNumber).toBe(1);
  });

  it('defaults unknown kind → 1 (nazariy)', () => {
    const r = mapTopic({ _id: 't2', title: 'X', orderNumber: 2, kind: 9, duration: 2 });
    expect(r.kind).toBe(1);
  });

  it("kurs kodi o'tadi; backend bermasa bo'sh satr", () => {
    const withCode = mapTopic({ _id: 't3', title: 'X', orderNumber: 1, kind: 1, duration: 1, code: 'MO-72-01' });
    expect(withCode.code).toBe('MO-72-01');
    const without = mapTopic({ _id: 't4', title: 'X', orderNumber: 1, kind: 1, duration: 1 });
    expect(without.code).toBe('');
  });
});
