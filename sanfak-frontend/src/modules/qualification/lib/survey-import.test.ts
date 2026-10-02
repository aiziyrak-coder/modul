import { describe, expect, it } from 'vitest';
import { parseSurveyText } from './survey-import';
import { SURVEY_TYPE } from '../model/survey.types';

const DOC = `O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI
ANKETA-SO'ROVNOMA SAVOLLARI
Hurmatli tinglovchi! Fakultetimizda so'rovnoma o'tkazilmoqda.
I-bo'lim. Tinglovchi haqida ma'lumot
2. Kurs turi
A) umumiy malaka oshirish   B) mavzuli malaka oshirish   C) ixtisoslashtirish (qayta tayyorlash)
8. Lavozimingiz  (erkin javob)
10. Kurs mazmuni e'lon qilingan o'quv dasturiga mos keldimi?
A) ha, to'liq   B) asosan ha   C) qisman   D) yo'q   E) umuman yo'q
IX bo'lim. Ochiq savollar (erkin javob)
46. Kursning Siz uchun eng foydali jihatlari nimalardan iborat bo'ldi?
Ishtirokingiz uchun tashakkur!`;

describe('Anketa importi', () => {
  const q = parseSurveyText(DOC);

  it('faqat raqamlangan savollarni oladi (sarlavha va kirish matni emas)', () => {
    expect(q).toHaveLength(4);
    expect(q.map((x) => x.question)).toEqual([
      'Kurs turi',
      'Lavozimingiz',
      "Kurs mazmuni e'lon qilingan o'quv dasturiga mos keldimi?",
      'Kursning Siz uchun eng foydali jihatlari nimalardan iborat bo‘ldi?'.replace(
        '‘',
        "'",
      ),
    ]);
  });

  it('bitta qatordagi variantlarni ajratadi', () => {
    expect(q[0]?.type).toBe(SURVEY_TYPE.CHOICE);
    expect(q[0]?.options).toEqual([
      { text: 'umumiy malaka oshirish' },
      { text: 'mavzuli malaka oshirish' },
      { text: 'ixtisoslashtirish (qayta tayyorlash)' },
    ]);
  });

  it('variantsiz savol OCHIQ MATN bo‘ladi', () => {
    expect(q[1]?.type).toBe(SURVEY_TYPE.TEXT);
    expect(q[1]?.options).toEqual([]);
    expect(q[3]?.type).toBe(SURVEY_TYPE.TEXT);
  });

  it('"(erkin javob)" izohi savol matnidan chiqariladi', () => {
    expect(q[1]?.question).toBe('Lavozimingiz');
  });

  it('besh variantli savol to‘liq o‘qiladi', () => {
    expect(q[2]?.options.map((o) => o.text)).toEqual([
      "ha, to'liq",
      'asosan ha',
      'qisman',
      "yo'q",
      "umuman yo'q",
    ]);
  });

  it('variantlar ikki qatorga bo‘lingan savolni ham yig‘adi (42-savol)', () => {
    const parsed = parseSurveyText(
      `42. Umumiy qoniqish darajangizni baholang
A) 1   B) 2   C) 3   D) 4   E) 5   F) 6   G) 7
H) 8   I) 9   J) 10`,
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.options).toHaveLength(10);
    expect(parsed[0]?.options[9]).toEqual({ text: '10' });
  });

  it('bo‘sh matnda hech narsa qaytmaydi', () => {
    expect(parseSurveyText('')).toEqual([]);
    expect(parseSurveyText('Shunchaki matn, savol yo‘q')).toEqual([]);
  });
});
