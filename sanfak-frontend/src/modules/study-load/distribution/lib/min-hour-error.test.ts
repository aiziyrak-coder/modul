import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { buildMinHourErrorMessage as buildMinHourErrorMessageRaw } from './min-hour-error';

const templates: Record<string, string> = {
  'studyLoad.distribution.minHour.teacherFallback': "o'qituvchi",
  'studyLoad.distribution.minHour.stavkaLabel': '{{stavka}} stavka',
  'studyLoad.distribution.minHour.auditoriumBasis': 'auditoriya {{value}}',
  'studyLoad.distribution.minHour.rowLine':
    '• {{who}}: {{basis}} / {{minHour}} soat — {{shortage}} soat yetishmaydi',
  'studyLoad.distribution.minHour.summary':
    "Yuborilmadi: {{n}} ta o'qituvchida minimal soat to'lmagan.\n{{detail}}\n",
  'studyLoad.distribution.minHour.suggestion':
    "Soatni oshiring yoki qolgan soatni vakant sifatida belgilang.",
};
const t = ((key: string, opts?: Record<string, unknown>) => {
  const template = templates[key] ?? key;
  if (!opts) return template;
  return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(opts[name] ?? ''));
}) as unknown as TFunction;
const buildMinHourErrorMessage = (err: unknown) => buildMinHourErrorMessageRaw(t, err);

describe('buildMinHourErrorMessage', () => {
  const err = (errors: unknown) => ({ response: { data: { errors } } });

  it('kim, qancha va yetishmayotgan soatni ko‘rsatadi', () => {
    const msg = buildMinHourErrorMessage(
      err([{ position: 'senior_teacher', stavka: 1, totalHour: 60, minHour: 380, shortage: 320 }]),
    );

    expect(msg).toContain('senior_teacher');
    expect(msg).toContain('1 stavka');
    expect(msg).toContain('60 / 380');
    expect(msg).toContain('320');
    expect(msg).toMatch(/vakant/i);
  });

  it('shortage berilmasa — minHour va totalHour dan hisoblaydi', () => {
    const msg = buildMinHourErrorMessage(err([{ totalHour: 100, minHour: 400 }]));
    expect(msg).toContain('300');
  });

  it('bir nechta o‘qituvchi — hammasi sanaladi', () => {
    const msg = buildMinHourErrorMessage(
      err([
        { position: 'assistent', stavka: 1, totalHour: 100, minHour: 400, shortage: 300 },
        { position: 'dotsent', stavka: 0.5, totalHour: 50, minHour: 175, shortage: 125 },
      ]),
    );
    expect(msg).toContain('2 ta');
    expect(msg).toContain('assistent');
    expect(msg).toContain('dotsent');
  });

  it('min-soat shakliga mos kelmasa null (boshqa xatoga yolg‘on matn chiqmasin)', () => {
    expect(buildMinHourErrorMessage(err([{ someOther: 'field' }]))).toBeNull();
    expect(buildMinHourErrorMessage(err([]))).toBeNull();
    expect(buildMinHourErrorMessage({ response: { data: {} } })).toBeNull();
    expect(buildMinHourErrorMessage(new Error('tarmoq xatosi'))).toBeNull();
    expect(buildMinHourErrorMessage(undefined)).toBeNull();
  });
});

describe('buildMinHourErrorMessage — auditoriumHour bazasi (D-129)', () => {
  const err = (errors: unknown) => ({ response: { data: { errors } } });

  it('auditoriumHour bor — AYNAN shu raqam ko‘rsatiladi, totalHour emas', () => {
    const msg = buildMinHourErrorMessage(
      err([
        {
          position: 'assistent',
          stavka: 1,
          totalHour: 460,
          auditoriumHour: 292,
          minHour: 400,
          shortage: 108,
        },
      ]),
    );

    expect(msg).toContain('auditoriya 292 / 400');
    expect(msg).toContain('108');
    expect(msg).not.toContain('460 / 400');
  });

  it('shortage berilmasa — auditoriumHour dan hisoblaydi (totalHour dan emas)', () => {
    const msg = buildMinHourErrorMessage(
      err([{ totalHour: 460, auditoriumHour: 292, minHour: 400 }]),
    );
    expect(msg).toContain('108');
  });

  it('auditoriumHour `0` — to‘liq yetishmaslik to‘g‘ri ko‘rsatiladi', () => {
    const msg = buildMinHourErrorMessage(err([{ totalHour: 80, auditoriumHour: 0, minHour: 400 }]));
    expect(msg).toContain('auditoriya 0 / 400');
    expect(msg).toContain('400');
  });

  it('auditoriumHour yo‘q (eski javob) — o‘sha javobning o‘z bazasi (totalHour) saqlanadi', () => {
    const msg = buildMinHourErrorMessage(err([{ totalHour: 60, minHour: 380, shortage: 320 }]));
    expect(msg).toContain('60 / 380');
    expect(msg).not.toContain('auditoriya');
  });
});
