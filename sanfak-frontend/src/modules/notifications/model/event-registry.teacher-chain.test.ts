import { describe, expect, it } from 'vitest';
import { getSafeLink } from '../api/link-guard';
import { EVENT_REGISTRY } from './event-registry';
import { resolveEvent } from './resolve-event';
import type { NotificationVM, RendererDescriptor, Tone } from './types';

const TEACHER_CHAIN_EVENTS: ReadonlyArray<[string, Tone, string]> = [
  ['personalWorkPlan_submitted', 'info', 'notif.mod.teacher'],
  ['personalWorkPlan_stepPending', 'info', 'notif.mod.teacher'],
  ['personalWorkPlan_approved', 'success', 'notif.mod.teacher'],
  ['personalWorkPlan_rejected', 'danger', 'notif.mod.teacher'],
  ['personalReport_submitted', 'info', 'notif.mod.teacher'],
  ['personalReport_approved', 'success', 'notif.mod.teacher'],
  ['personalReport_rejected', 'danger', 'notif.mod.teacher'],
  ['teacherProfile_approved', 'success', 'notif.mod.teacher'],
  ['teacherProfile_rejected', 'danger', 'notif.mod.teacher'],
  ['teacherLeave_submitted', 'info', 'notif.mod.studyLoad'],
  ['teacherLeave_approved', 'success', 'notif.mod.studyLoad'],
  ['teacherLeave_rejected', 'danger', 'notif.mod.studyLoad'],
];

function entry(eventType: string): RendererDescriptor {
  const descriptor = EVENT_REGISTRY[eventType];
  if (!descriptor) throw new Error(`EVENT_REGISTRY da "${eventType}" yozuvi yo'q`);
  return descriptor;
}

function vm(eventType: string, body: string | null = 'Bosqich: Kafedra'): NotificationVM {
  return {
    id: '1',
    eventType,
    title: 'Sarlavha',
    body,
    bodyLines: body ? [body] : [],
    metadata: null,
    rawLink: null,
    safeLink: null,
    read: false,
    readAt: null,
    createdAt: new Date('2026-09-10T00:00:00.000Z'),
  };
}

describe('event-registry — 4.03 zanjir bildirishnomalari (PR #191, 12 eventType)', () => {
  it.each(TEACHER_CHAIN_EVENTS)('%s registrda bor, tone=%s, modul=%s', (eventType, tone, moduleLabelKey) => {
    const descriptor = entry(eventType);
    expect(descriptor.tone).toBe(tone);
    expect(descriptor.moduleLabelKey).toBe(moduleLabelKey);
    expect(descriptor.shape).toBe('single-line');
  });

  it.each(TEACHER_CHAIN_EVENTS.map(([e]) => e))(
    '%s — resolveEvent fallback ("Noma\'lum") ga TUSHMAYDI',
    (eventType) => {
      const resolved = resolveEvent(vm(eventType));
      expect(resolved.moduleLabelKey).not.toBe('notif.mod.unknown');
    },
  );

  it('body === null bo\'lsa shape title-only ga majburlanadi', () => {
    expect(resolveEvent(vm('personalWorkPlan_approved', null)).shape).toBe('title-only');
  });

  it('har yozuvning metaFields kalitlari backend metadata bilan mos', () => {
    const keys = (eventType: string) => entry(eventType).metaFields?.map((m) => m.key);
    expect(keys('personalWorkPlan_stepPending')).toEqual(['planId']);
    expect(keys('personalReport_submitted')).toEqual(['reportId', 'planId']);
    expect(keys('teacherProfile_approved')).toEqual(['profileId']);
    expect(keys('teacherLeave_rejected')).toEqual(['leaveId']);
  });
});

describe('link-guard — 4.03 backend linklari FE namespace\'ida bor (REPAIRS shart emas)', () => {
  it.each([
    '/teacher/work-plans/inbox',
    '/teacher/work-plans/6aa272dab1be030dda51502a',
    '/teacher/work-plans/reports',
    '/teacher/profile',
    '/study-load/teacher-leaves',
  ])('%s → o\'zgarishsiz qaytadi', (link) => {
    expect(getSafeLink(link, null)).toBe(link);
  });
});
