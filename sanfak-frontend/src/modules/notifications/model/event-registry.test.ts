import { describe, expect, it } from 'vitest';
import { COUNCIL_VARIANT_SUFFIX, EVENT_REGISTRY } from './event-registry';
import { resolveEvent } from './resolve-event';
import type { NotificationVM } from './types';

function vm(overrides: Partial<NotificationVM> & Pick<NotificationVM, 'eventType'>): NotificationVM {
  return {
    id: '1',
    title: 'Sarlavha',
    body: 'Matn',
    bodyLines: ['Matn'],
    metadata: null,
    rawLink: null,
    safeLink: null,
    read: false,
    readAt: null,
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    ...overrides,
  };
}

const REGISTRY_KEYS = Object.keys(EVENT_REGISTRY);
const REAL_EVENT_TYPES = REGISTRY_KEYS.filter((k) => !k.endsWith(COUNCIL_VARIANT_SUFFIX));

describe('resolveEvent — katalogdagi HAR BIR eventType shaklga aylanadi', () => {
  it.each(REAL_EVENT_TYPES)('%s — body mavjud bo\'lganda haqiqiy Shape qaytaradi', (eventType) => {
    const resolved = resolveEvent(vm({ eventType, body: 'bir qatorli matn' }));
    expect(['title-only', 'single-line', 'multiline']).toContain(resolved.shape);
  });

  it.each(REGISTRY_KEYS)(
    'body===null bo\'lganda "%s" HECH QACHON single-line/multiline chiqmaydi',
    (registryKey) => {
      const eventType = registryKey.replace(COUNCIL_VARIANT_SUFFIX, '');
      const isCouncilVariant = registryKey.endsWith(COUNCIL_VARIANT_SUFFIX);
      const resolved = resolveEvent(
        vm({
          eventType,
          body: null,
          metadata: isCouncilVariant ? { code: 'T' } : null,
        }),
      );
      expect(resolved.shape).toBe('title-only');
    },
  );
});

describe('resolveEvent — task_assigned/task_completed nom to\'qnashuvi (4.07 ↔ 4.09)', () => {
  it('4.07 task_assigned: metadata.code hujjat raqami (docNumber) — task-management registriga tushadi', () => {
    const resolved = resolveEvent(
      vm({ eventType: 'task_assigned', metadata: { taskId: 'x', code: 'T-0042' }, rawLink: '/tasks/x' }),
    );
    expect(resolved.codeKind).toBe('docNumber');
    expect(resolved.moduleLabelKey).toBe('notif.mod.task');
  });

  it('4.09 task_assigned: metadata.code bitta harf (T/U/V/E) — council registriga tushadi', () => {
    const resolved = resolveEvent(
      vm({ eventType: 'task_assigned', metadata: { taskId: 'x', code: 'T' }, rawLink: '/kengash/topshiriqlar' }),
    );
    expect(resolved.codeKind).toBe('letter');
    expect(resolved.moduleLabelKey).toBe('notif.mod.council');
  });

  it('ikkilamchi belgi: code yo\'q bo\'lsa ham /kengash havolasi council variantiga yo\'naltiradi', () => {
    const resolved = resolveEvent(
      vm({ eventType: 'task_completed', metadata: null, rawLink: '/kengash/topshiriqlar', body: null }),
    );
    expect(resolved.moduleLabelKey).toBe('notif.mod.council');
  });

  it('4.07 task_completed — success toni, task moduli chipi', () => {
    const resolved = resolveEvent(
      vm({ eventType: 'task_completed', metadata: { taskId: 'x', code: 'T-0100' }, rawLink: '/tasks/x' }),
    );
    expect(resolved.tone).toBe('success');
    expect(resolved.moduleLabelKey).toBe('notif.mod.task');
  });
});

describe('resolveEvent — noma\'lum eventType uchun runtime fallback (spek §2)', () => {
  it('body bo\'lmasa (null) → title-only, neutral', () => {
    const resolved = resolveEvent(vm({ eventType: 'brand_new_x', body: null }));
    expect(resolved.shape).toBe('title-only');
    expect(resolved.tone).toBe('neutral');
  });

  it('body bir qatorli → single-line, neutral', () => {
    const resolved = resolveEvent(vm({ eventType: 'brand_new_x', body: 'bitta qator' }));
    expect(resolved.shape).toBe('single-line');
    expect(resolved.tone).toBe('neutral');
  });

  it('body ko\'p qatorli (\\n bilan) → multiline, neutral', () => {
    const resolved = resolveEvent(vm({ eventType: 'brand_new_x', body: 'a\nb' }));
    expect(resolved.shape).toBe('multiline');
    expect(resolved.tone).toBe('neutral');
  });

  it('noma\'lum event HECH QACHON "success" toni olmaydi', () => {
    const cases = [null, 'bitta qator', 'a\nb'];
    for (const body of cases) {
      const resolved = resolveEvent(vm({ eventType: 'another_unknown_event', body }));
      expect(resolved.tone).not.toBe('success');
      expect(resolved.tone).toBe('neutral');
    }
  });
});
