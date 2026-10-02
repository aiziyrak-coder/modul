import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSafeLink } from '../api/link-guard';
import { resolveLinkPermission } from '../lib/resolve-link-permission';
import MetadataList from '../ui/metadata-list';
import manifest from '../notifications.module';
import { EVENT_REGISTRY } from './event-registry';
import { resolveEvent } from './resolve-event';
import type { NotificationVM, RendererDescriptor, Tone } from './types';

type Row = [eventType: string, tone: Tone, shape: RendererDescriptor['shape'], metaKeys: string[]];

const RESIDENCY_EVENTS: readonly Row[] = [
  ['residency_expulsion', 'warning', 'single-line', ['residentId', 'orderId']],
  ['residency_expulsion_draft_office', 'warning', 'single-line', ['reminderStage', 'orderId', 'residentId']],
  ['residency_expulsion_signed', 'danger', 'single-line', ['orderId', 'residentId']],
  ['residency_expulsion_rejected', 'info', 'single-line', ['orderId', 'residentId']],
  ['residency_expulsion_basis_lost_office', 'warning', 'single-line', ['orderId', 'residentId']],
  ['residency_absence_notice_auto', 'warning', 'single-line', ['noticeId', 'residentId']],
  ['residency_sams_digest', 'warning', 'multiline', ['digestDay']],
  ['residency_sams_tenants_changed', 'warning', 'single-line', ['digestDay']],
];

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
    createdAt: new Date('2026-09-27T03:00:00.000Z'),
    ...overrides,
  };
}

function entry(eventType: string): RendererDescriptor {
  const descriptor = EVENT_REGISTRY[eventType];
  if (!descriptor) throw new Error(`EVENT_REGISTRY da "${eventType}" yozuvi yo'q`);
  return descriptor;
}

const camel = (eventType: string) => eventType.replace(/_([a-z])/g, (_m, ch: string) => ch.toUpperCase());

describe('rezidentura bildirishnomalari — registr yozuvlari', () => {
  it.each(RESIDENCY_EVENTS)('%s — tone %s, shape %s, metaFields %j', (eventType, tone, shape, metaKeys) => {
    const d = entry(eventType);
    expect(d.tone).toBe(tone);
    expect(d.shape).toBe(shape);
    expect(d.moduleLabelKey).toBe('notif.mod.residency');
    expect((d.metaFields ?? []).map((f) => f.key)).toEqual(metaKeys);
    expect(resolveEvent(vm({ eventType })).moduleLabelKey).toBe('notif.mod.residency');
  });

  it('id maydonlari `id` formatida, bosqich — `count`', () => {
    const fields = entry('residency_expulsion_draft_office').metaFields ?? [];
    expect(fields.find((f) => f.key === 'reminderStage')?.fmt).toBe('count');
    expect(fields.find((f) => f.key === 'orderId')?.fmt).toBe('id');
    expect(fields.find((f) => f.key === 'residentId')?.fmt).toBe('id');
  });

  it('eski `residency_expulsion` endi yakuniy/danger EMAS — qaytariladigan loyiha xabari', () => {
    expect(entry('residency_expulsion').tone).not.toBe('danger');
  });
});

describe('0-kun va eslatma — farq faqat `reminderStage`', () => {
  const STAGE_LABEL = /Eslatma bosqichi|Этап напоминания|Reminder stage/;
  const ids = { residentId: '65f0000000000000000abc01', orderId: '65f0000000000000000abc02' };

  it('eslatma VM — descriptor `reminderStage` ni e’lon qiladi va u chiziladi', () => {
    const d = resolveEvent(vm({ eventType: 'residency_expulsion_draft_office', metadata: { ...ids, reminderStage: 2 } }));
    expect(d.metaFields?.some((f) => f.key === 'reminderStage')).toBe(true);
    render(createElement(MetadataList, { metadata: { ...ids, reminderStage: 2 }, metaFields: d.metaFields }));
    expect(screen.getByText(STAGE_LABEL)).toBeInTheDocument();
  });

  it('0-kun VM — bosqich qatori YO‘Q', () => {
    const d = resolveEvent(vm({ eventType: 'residency_expulsion_draft_office', metadata: ids }));
    render(createElement(MetadataList, { metadata: ids, metaFields: d.metaFields }));
    expect(screen.queryByText(STAGE_LABEL)).toBeNull();
  });
});

describe('bo‘lim havolalari', () => {
  it('buyruqlar sahifasi link-guard’dan o‘zgarishsiz o‘tadi va `resident:changeStatus` ga tushadi', () => {
    expect(getSafeLink('/residency/chetlatish-buyruqlari', null)).toBe('/residency/chetlatish-buyruqlari');
    expect(resolveLinkPermission('/residency/chetlatish-buyruqlari')).toBe('resident:changeStatus');
    expect(resolveLinkPermission('/residency/chetlatish-buyruqlari/65f0000000000000000abc02')).toBe(
      'resident:changeStatus',
    );
  });

  it('U-7 (basis_lost_office) havolasi — buyruq tafsiloti, link-guard’dan o‘zgarishsiz (F3-Q10)', () => {
    const detail = '/residency/chetlatish-buyruqlari/65f0000000000000000abc02';
    expect(getSafeLink(detail, null)).toBe(detail);
  });

  it('eski havola (`/residency/davomat`) ham tirik — eski xabarlar buzilmaydi', () => {
    expect(getSafeLink('/residency/davomat', null)).toBe('/residency/davomat');
    expect(resolveLinkPermission('/residency/davomat')).toBe('residentAttendance:readAll');
  });

  it('avtomatik bildirgi havolasi (query bilan) bildirgilar sahifasiga', () => {
    expect(getSafeLink('/residency/bildirgilar?notice=abc', null)).toBe('/residency/bildirgilar?notice=abc');
    expect(resolveLinkPermission('/residency/bildirgilar?notice=abc')).toBe('residencyNotice:readAll');
  });
});

describe('yorliqlar — uch tilda', () => {
  const i18n = manifest.i18n ?? {};
  const eventKeys = RESIDENCY_EVENTS.map(([eventType]) => `notif.event.${camel(eventType)}`);
  const metaKeys = ['orderId', 'residentId', 'reminderStage', 'noticeId', 'digestDay'].map((k) => `notif.meta.${k}`);

  it.each(['uz', 'ru', 'en'])('%s — har tur va meta kaliti tarjima qilingan', (lng) => {
    const bundle = (i18n as Record<string, Record<string, string>>)[lng] ?? {};
    for (const key of [...eventKeys, ...metaKeys]) {
      expect(bundle[key], `${lng}: ${key}`).toBeTruthy();
    }
  });
});
