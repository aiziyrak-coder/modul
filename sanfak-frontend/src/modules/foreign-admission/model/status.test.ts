import { describe, expect, it } from 'vitest';
import { STATUS_META, STATUS_ORDER, isActionable, toForeignStatus } from './status';
import { mapApplicant, type BackendApplicant } from '../api/mapper';

describe('toForeignStatus', () => {
  it('backend qiymatlarini to`g`ri map qiladi', () => {
    expect(toForeignStatus('new')).toBe('yangi');
    expect(toForeignStatus('approved')).toBe('tasdiqlangan');
    expect(toForeignStatus('rejected')).toBe('radEtilgan');
  });

  it('nomaʼlum yoki bo`sh qiymat "yangi" ga tushadi (xavfsiz default)', () => {
    expect(toForeignStatus(undefined)).toBe('yangi');
    expect(toForeignStatus('')).toBe('yangi');
    expect(toForeignStatus('documents_review')).toBe('yangi');
    expect(toForeignStatus('enrolled')).toBe('yangi');
  });
});

describe('isActionable', () => {
  it('faqat "Yangi" holatda amal bor (qaror YAKUNIY)', () => {
    expect(isActionable('yangi')).toBe(true);
    expect(isActionable('tasdiqlangan')).toBe(false);
    expect(isActionable('radEtilgan')).toBe(false);
  });
});

describe('STATUS_META', () => {
  it('har holat uchun rang va i18n kaliti bor', () => {
    STATUS_ORDER.forEach((s) => {
      expect(STATUS_META[s].color).toBeTruthy();
      expect(STATUS_META[s].titleKey).toMatch(/^foreignAdmission\.status\./);
    });
  });

  it('TZ ranglari: yangi=ko`k, tasdiqlangan=yashil, radEtilgan=qizil', () => {
    expect(STATUS_META.yangi.color).toBe('blue');
    expect(STATUS_META.tasdiqlangan.color).toBe('green');
    expect(STATUS_META.radEtilgan.color).toBe('red');
  });
});

describe('mapApplicant', () => {
  const base: BackendApplicant = {
    _id: 'app-1',
    fullName: 'Zulfiya Nazarova',
    country: 'Qozogʻiston',
    status: 'rejected',
    rejectionReason: 'Pasport nusxasi oʻqilmaydi',
    reviewedBy: { firstName: 'Dilnoza', lastName: 'Yusupova' },
    parentPhone: '+998 91 222 33 44',
    applicationNumber: 'APP-2026-00001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  };

  it('status va rad sababini oʻtkazadi', () => {
    const a = mapApplicant(base);
    expect(a.status).toBe('radEtilgan');
    expect(a.rejectionReason).toBe('Pasport nusxasi oʻqilmaydi');
  });

  it('koʻrib chiquvchi ismini "Familiya Ism" tartibida yigʻadi', () => {
    expect(mapApplicant(base).reviewedByName).toBe('Yusupova Dilnoza');
  });

  it('boʻsh rad sababi undefined boʻladi (boʻsh tooltip chiqmasin)', () => {
    const a = mapApplicant({ ...base, status: 'approved', rejectionReason: '' });
    expect(a.status).toBe('tasdiqlangan');
    expect(a.rejectionReason).toBeUndefined();
  });

  it('v1.1/v1.2 maydonlari oʻtadi (ota-ona tel., ariza raqami)', () => {
    const a = mapApplicant(base);
    expect(a.parentPhone).toBe('+998 91 222 33 44');
    expect(a.applicationNumber).toBe('APP-2026-00001');
  });

  it('populate qilingan yoʻnalishni 3 tilli NamedRef ga keltiradi', () => {
    const a = mapApplicant({
      ...base,
      direction: { _id: 'd1', titleUz: 'Pediatriya', titleRu: 'Педиатрия', titleEn: 'Pediatrics' },
    });
    expect(a.direction).toEqual({
      id: 'd1',
      titleUz: 'Pediatriya',
      titleRu: 'Педиатрия',
      titleEn: 'Pediatrics',
    });
  });

  it('populate QILINMAGAN ref (yalangʻoch id) undefined boʻladi', () => {
    const a = mapApplicant({ ...base, direction: '507f1f77bcf86cd799439011' });
    expect(a.direction).toBeUndefined();
  });
});
