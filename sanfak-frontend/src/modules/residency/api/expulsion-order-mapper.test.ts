import { describe, expect, it } from 'vitest';
import {
  draftFallbackName,
  mapExpulsionOrder,
  toResumePayload,
  toSignPayload,
  type BackendExpulsionOrder,
} from './expulsion-order-mapper';
import { labelOf, STATUS_LABEL } from './expulsion-order-types';

const SHA = 'a'.repeat(64);

const FULL: BackendExpulsionOrder = {
  _id: '65f0000000000000000abc01',
  resident: {
    _id: 'r1',
    fullName: 'Aliyev Vali Salim o‘g‘li',
    program: 'ordinatura',
    courseNumber: 2,
    groupTitle: 'ORD-21',
    specialtyTitle: 'Kardiologiya',
    departmentTitle: 'Ichki kasalliklar',
    status: 'oquvda',
    totalUnexcusedHours: 74,
    active: true,
  },
  residentName: 'Aliyev Vali (snapshot)',
  origin: 'tizim',
  status: 'imzolangan',
  countingYear: '2026-2027',
  draftedAt: '2026-09-20T03:00:00.000Z',
  hoursAtDraft: 72,
  noticesSentAt: '2026-09-20T03:00:05.000Z',
  closedAt: null,
  paperOrderNumber: ' 12-ch ',
  paperOrderDate: '2026-09-25',
  scan: {
    fileName: 'skan.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    sha256: SHA,
    uploadedBy: { firstName: 'Olim', lastName: 'Karimov', middleName: 'Aziz o‘g‘li' },
    uploadedByName: 'Karimov Olim',
    uploadedAt: '2026-09-24T05:00:00.000Z',
  },
  draftPdf: {
    fileName: 'chetlatish-buyrugi-loyihasi-abc01-2026-09-21.pdf',
    size: 5000,
    sha256: 'b'.repeat(64),
    hours: 73,
    templateVersion: 1,
    generatedAt: '2026-09-21T04:00:00.000Z',
    generatedBy: 'u1',
    generatedByName: 'Karimov Olim Aziz o‘g‘li',
  },
  signedAt: '2026-09-25T06:00:00.000Z',
  signedBy: { firstName: 'Olim', lastName: 'Karimov' },
  signedByName: 'Karimov Olim Aziz o‘g‘li',
  hoursAtSign: 74,
  eriSerialNumber: null,
  residentAppliedAt: null,
  history: [
    { at: '2026-09-20T03:00:00.000Z', action: 'yaratildi', source: 'cron', actorName: null, hours: 72 },
    { at: '2026-09-25T06:00:00.000Z', action: 'imzolandi', source: 'office', actorName: 'Karimov Olim', note: 'x' },
  ],
  createdAt: '2026-09-20T03:00:00.000Z',
  canUploadScan: false,
  canReject: false,
  canSign: false,
  needsResume: true,
  canResume: true,
  canGetDraftPdf: true,
};

describe('mapExpulsionOrder', () => {
  it("to'liq DTO — asosiy maydonlar va bayroqlar", () => {
    const o = mapExpulsionOrder(FULL);
    expect(o.id).toBe(FULL._id);
    expect(o.status).toBe('imzolangan');
    expect(o.origin).toBe('tizim');
    expect(o.residentStatus).toBe('oquvda');
    expect(o.residentHours).toBe(74);
    expect(o.residentActive).toBe(true);
    expect(o.resident?.specialtyTitle).toBe('Kardiologiya');
    expect(o.resident?.courseNumber).toBe(2);
    expect(o.countingYear).toBe('2026-2027');
    expect(o.hoursAtDraft).toBe(72);
    expect(o.scan).toEqual({
      fileName: 'skan.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      sha256: SHA,
      uploadedByName: 'Karimov Olim Aziz o‘g‘li',
      uploadedAt: '2026-09-24T05:00:00.000Z',
    });
    expect(o.draftPdf?.fileName).toBe('chetlatish-buyrugi-loyihasi-abc01-2026-09-21.pdf');
    expect(o.draftPdf?.hours).toBe(73);
    expect(o.draftPdf?.generatedByName).toBe('Karimov Olim Aziz o‘g‘li');
    expect(o.history).toHaveLength(2);
    expect(o.history[0]).toEqual({
      at: '2026-09-20T03:00:00.000Z',
      action: 'yaratildi',
      source: 'cron',
      actorName: null,
      hours: 72,
      note: null,
    });
    expect(o.flags).toEqual({
      canUploadScan: false,
      canReject: false,
      canSign: false,
      needsResume: true,
      canResume: true,
      canGetDraftPdf: true,
    });
  });

  it('qog‘oz raqami XOM saqlanadi (trim yo‘q) — yarim imzo shu qiymat bilan', () => {
    expect(mapExpulsionOrder(FULL).paperOrderNumber).toBe(' 12-ch ');
  });

  it('bayroqlar yo‘q — hammasi false; `"true"` satri bayroq EMAS', () => {
    const o = mapExpulsionOrder({
      _id: 'x',
      canSign: 'true',
      canReject: 1,
      canUploadScan: null,
    });
    expect(Object.values(o.flags).every((v) => v === false)).toBe(true);
  });

  it('history yo‘q — bo‘sh massiv', () => {
    expect(mapExpulsionOrder({ _id: 'x' }).history).toEqual([]);
    expect(mapExpulsionOrder({ _id: 'x', history: null }).history).toEqual([]);
  });

  it('skan: sha256 siz → null; nomsiz haqiqiy skan zaxira nom bilan QOLADI', () => {
    expect(mapExpulsionOrder({ _id: 'x', scan: null }).scan).toBeNull();
    expect(mapExpulsionOrder({ _id: 'x', scan: { fileName: 'a.pdf' } }).scan).toBeNull();
    const noName = mapExpulsionOrder({ _id: 'x', scan: { sha256: SHA, size: 5 } }).scan;
    expect(noName?.sha256).toBe(SHA);
    expect(noName?.fileName).toBe('buyruq-skan');
  });

  it('loyiha PDF: nom yoki xesh yo‘q → null', () => {
    expect(mapExpulsionOrder({ _id: 'x', draftPdf: { sha256: SHA } }).draftPdf).toBeNull();
    expect(mapExpulsionOrder({ _id: 'x', draftPdf: { fileName: 'a.pdf' } }).draftPdf).toBeNull();
    expect(mapExpulsionOrder({ _id: 'x', draftPdf: null }).draftPdf).toBeNull();
  });

  it('jonli rezident ismi snapshotdan ustun; rezident yo‘q — snapshot; ikkalasi yo‘q — «—»', () => {
    expect(mapExpulsionOrder(FULL).residentName).toBe('Aliyev Vali Salim o‘g‘li');
    const snapshotOnly = mapExpulsionOrder({ _id: 'x', resident: 'r1', residentName: 'Snapshot Ism' });
    expect(snapshotOnly.residentName).toBe('Snapshot Ism');
    expect(snapshotOnly.resident).toBeNull();
    expect(mapExpulsionOrder({ _id: 'x' }).residentName).toBe('—');
  });

  it('signedBy — `nameOrSnapshot`: sharifsiz jonli ism snapshot kengaytmasi bilan to‘ldiriladi', () => {
    expect(mapExpulsionOrder(FULL).signedByName).toBe('Karimov Olim Aziz o‘g‘li');
    const other = mapExpulsionOrder({
      _id: 'x',
      signedBy: { firstName: 'Jasur', lastName: 'Nodirov' },
      signedByName: 'Sobirov Jasur',
    });
    expect(other.signedByName).toBe('Nodirov Jasur');
  });

  it('noma‘lum holat / manba → null (majburlanmaydi)', () => {
    const o = mapExpulsionOrder({ _id: 'x', status: 'arxiv', origin: 'boshqa' });
    expect(o.status).toBeNull();
    expect(o.origin).toBeNull();
    expect(labelOf(STATUS_LABEL, o.status)).toBe('—');
    expect(labelOf(STATUS_LABEL, 'arxiv')).toBe('arxiv');
  });

  it('nofaol rezident — residentActive false; noma‘lum rezident holati — null', () => {
    const o = mapExpulsionOrder({
      _id: 'x',
      resident: { _id: 'r1', active: false, status: 'boshqa' },
    });
    expect(o.residentActive).toBe(false);
    expect(o.residentStatus).toBeNull();
  });
});

describe('toSignPayload — YANGI imzo tanasi', () => {
  const input = { paperOrderNumber: ' 12-ch ', paperOrderDate: '2026-09-25', scanSha256: SHA };

  it('kalitlar AYNAN {orderId, paperOrderNumber, paperOrderDate, scanSha256}; raqam trim', () => {
    const p = toSignPayload('o1', input);
    expect(Object.keys(p).sort()).toEqual(
      ['orderId', 'paperOrderDate', 'paperOrderNumber', 'scanSha256'].sort(),
    );
    expect(p).toEqual({
      orderId: 'o1',
      paperOrderNumber: '12-ch',
      paperOrderDate: '2026-09-25',
      scanSha256: SHA,
    });
    expect('eriKey' in p).toBe(false);
    expect('eriSignature' in p).toBe(false);
  });

  it('eriSignature bo‘sh/null — kalit YO‘Q; qiymat bo‘lsa — qo‘shiladi', () => {
    expect('eriSignature' in toSignPayload('o1', { ...input, eriSignature: '' })).toBe(false);
    expect('eriSignature' in toSignPayload('o1', { ...input, eriSignature: null })).toBe(false);
    expect(toSignPayload('o1', { ...input, eriSignature: 'abc' }).eriSignature).toBe('abc');
  });
});

describe('toResumePayload — yarim imzoni yakunlash', () => {
  it('saqlangan qiymatlar AYNAN (trim YO‘Q)', () => {
    const p = toResumePayload(mapExpulsionOrder(FULL));
    expect(p).toEqual({
      orderId: FULL._id,
      paperOrderNumber: ' 12-ch ',
      paperOrderDate: '2026-09-25',
      scanSha256: SHA,
    });
    expect(Object.keys(p ?? {})).toHaveLength(4);
  });

  it('biror qiymat yo‘q — null (taxmin qilingan tana yuborilmaydi)', () => {
    expect(toResumePayload(mapExpulsionOrder({ ...FULL, paperOrderNumber: null }))).toBeNull();
    expect(toResumePayload(mapExpulsionOrder({ ...FULL, paperOrderDate: null }))).toBeNull();
    expect(toResumePayload(mapExpulsionOrder({ ...FULL, scan: null }))).toBeNull();
  });
});

describe('draftFallbackName', () => {
  it('backend nomining shakli, id ning oxirgi 6 belgisi bilan', () => {
    expect(draftFallbackName('65f0000000000000000abc01')).toBe('chetlatish-buyrugi-loyihasi-0abc01.pdf');
  });
});
