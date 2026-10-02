import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '@/shared/lib/i18n';
import { humanizeAction, cleanSegment, toSectionKey, isDenied } from './humanize';
import type { AuditLogEntry } from '../api/audit-log-api';

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'a1',
    createdAt: null,
    userName: 'Test User',
    user: null,
    action: 'GET /x',
    module: 'courses',
    method: 'GET',
    path: '/api/courses',
    statusCode: 200,
    responseTime: 12,
    files: [],
    ip: '127.0.0.1',
    userAgent: '',
    ...overrides,
  };
}

const t = i18n.t.bind(i18n);

describe('humanizeAction — uz chiqish eski matn bilan bayt-ma-bayt bir xil', () => {
  afterEach(() => {
    void i18n.changeLanguage('uz');
  });

  it('fayl yuklab olish — fayl nomi bor', () => {
    const entry = makeEntry({ module: 'files', files: ['report.pdf'] });
    const h = humanizeAction(entry, {}, t);
    expect(h.text).toBe('"report.pdf" faylini yuklab oldi');
    expect(h.verb).toBe('"report.pdf" faylini yuklab oldi');
  });

  it('fayl yuklab olish — fayl nomi yo`q (fallback "fayl")', () => {
    const entry = makeEntry({ module: 'files', files: [] });
    const h = humanizeAction(entry, {}, t);
    expect(h.text).toBe('"fayl" faylini yuklab oldi');
  });

  it('DOWNLOAD action prefiksi ham fayl yo`liga tushadi', () => {
    const entry = makeEntry({ module: 'study-plans', action: 'DOWNLOAD /x', files: ['r.xlsx'] });
    const h = humanizeAction(entry, {}, t);
    expect(h.text).toBe('"r.xlsx" faylini yuklab oldi');
  });

  it('PATH_OVERRIDES — /api/auth -> tizimga kirdi', () => {
    const entry = makeEntry({ module: 'auth', path: '/api/auth', method: 'POST' });
    const h = humanizeAction(entry, {}, t);
    expect(h.section).toBe('Tizim');
    expect(h.verb).toBe('tizimga kirdi');
    expect(h.text).toBe('tizimga kirdi');
  });

  it('PATH_OVERRIDES — /api/auth/eri-attach -> ERI bo`limi', () => {
    const entry = makeEntry({ module: 'auth', path: '/api/auth/eri-attach', method: 'POST' });
    const h = humanizeAction(entry, {}, t);
    expect(h.section).toBe('ERI');
    expect(h.text).toBe('elektron imzo biriktirdi');
  });

  it('SUFFIX_VERBS — /approve yo`li -> "{{section}}" — tasdiqladi', () => {
    const entry = makeEntry({ module: 'courses', path: '/api/courses/123/approve', method: 'PUT' });
    const h = humanizeAction(entry, { course: 'Kurslar' }, t);
    expect(h.verb).toBe('tasdiqladi');
    expect(h.text).toBe('"Kurslar" — tasdiqladi');
  });

  it('umumiy qoida — POST -> yangi yozuv qo`shdi', () => {
    const entry = makeEntry({ module: 'courses', method: 'POST', path: '/api/courses' });
    const h = humanizeAction(entry, { course: 'Kurslar' }, t);
    expect(h.text).toBe('"Kurslar" — yangi yozuv qo‘shdi');
  });

  it('umumiy qoida — PUT/PATCH -> o`zgartirdi', () => {
    const entry = makeEntry({ module: 'courses', method: 'PUT', path: '/api/courses/123' });
    const h = humanizeAction(entry, { course: 'Kurslar' }, t);
    expect(h.text).toBe('"Kurslar" — o‘zgartirdi');
  });

  it('umumiy qoida — DELETE -> o`chirdi', () => {
    const entry = makeEntry({ module: 'courses', method: 'DELETE', path: '/api/courses/123' });
    const h = humanizeAction(entry, { course: 'Kurslar' }, t);
    expect(h.text).toBe('"Kurslar" — o‘chirdi');
  });

  it('umumiy qoida — GET + id -> yozuvini ko`rdi', () => {
    const entry = makeEntry({
      module: 'courses',
      method: 'GET',
      path: '/api/courses/507f1f77bcf86cd799439011',
    });
    const h = humanizeAction(entry, { course: 'Kurslar' }, t);
    expect(h.text).toBe('"Kurslar" — yozuvini ko‘rdi');
  });

  it('umumiy qoida — GET ro`yxat (id yo`q) -> ro`yxatini ko`rdi', () => {
    const entry = makeEntry({ module: 'courses', method: 'GET', path: '/api/courses' });
    const h = humanizeAction(entry, { course: 'Kurslar' }, t);
    expect(h.text).toBe('"Kurslar" — ro‘yxatini ko‘rdi');
  });

  it('module bo`sh VA titles`da yo`q -> fallback "Noma`lum bo`lim"', () => {
    const entry = makeEntry({ module: '', method: 'GET', path: '/api/unknown' });
    const h = humanizeAction(entry, {}, t);
    expect(h.section).toBe('Nomaʼlum bo‘lim');
  });
});

describe('humanizeAction — ru tilga almashtirganda haqiqiy tarjima chiqadi', () => {
  afterEach(() => {
    void i18n.changeLanguage('uz');
  });

  it('POST -> "добавил новую запись" (kalitning o`zi emas)', async () => {
    await i18n.changeLanguage('ru');
    const entry = makeEntry({ module: 'courses', method: 'POST', path: '/api/courses' });
    const h = humanizeAction(entry, { course: 'Курсы' }, t);
    expect(h.text).toBe('"Курсы" — добавил новую запись');
  });

  it('/api/auth -> "вошёл в систему"', async () => {
    await i18n.changeLanguage('ru');
    const entry = makeEntry({ module: 'auth', path: '/api/auth', method: 'POST' });
    const h = humanizeAction(entry, {}, t);
    expect(h.section).toBe('Система');
    expect(h.text).toBe('вошёл в систему');
  });
});

describe('cleanSegment / toSectionKey / isDenied — o`zgarmagan helper`lar', () => {
  it('cleanSegment query`ni kesadi', () => {
    expect(cleanSegment('courses?active=true')).toBe('courses');
  });

  it('toSectionKey ko`plikni birlikka, kebab`ni camelCase`ga o`giradi', () => {
    expect(toSectionKey('academic-levels')).toBe('academicLevel');
    expect(toSectionKey('courses')).toBe('course');
  });

  it('isDenied 401/403 uchun true', () => {
    expect(isDenied(401)).toBe(true);
    expect(isDenied(403)).toBe(true);
    expect(isDenied(200)).toBe(false);
    expect(isDenied(null)).toBe(false);
  });
});
