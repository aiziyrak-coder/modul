import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { step1Schema } from '../lib/step-schemas';

const SRC = readFileSync(join(__dirname, 'syllabus-form-page.tsx'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

function slice(src: string, startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  if (start === -1) return '';
  const end = src.indexOf(endMarker, start);
  return end === -1 ? src.slice(start) : src.slice(start, end);
}

function stripLineComments(src: string): string {
  return src
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

const HANDLE_SUBMIT = slice(
  SRC,
  'const handleSubmit = async',
  'const handleSaveDraft = async',
);
const HANDLE_SAVE_DRAFT = slice(
  SRC,
  'const handleSaveDraft = async',
  'if (isEditMode && recordLoading)',
);
const TO_PAYLOAD = slice(SRC, 'function toPayload', 'const SyllabusFormPage = () =>');

describe('SyllabusFormPage — "Saqlash" → finalize ulanishi (TZ 4.2.8)', () => {
  it('manba bo`laklari topildi (skaner mo`ljalni yo`qotmadi)', () => {
    expect(HANDLE_SUBMIT.length).toBeGreaterThan(0);
    expect(HANDLE_SAVE_DRAFT.length).toBeGreaterThan(0);
    expect(TO_PAYLOAD.length).toBeGreaterThan(0);
  });

  it('yakuniy "Saqlash" — CREATE (POST) yo`lida `finalize: true` yuboriladi', () => {
    expect(HANDLE_SUBMIT).toMatch(
      /createMutation\.mutateAsync\(toPayload\(values,\s*\{\s*finalize:\s*true(,\s*science)?\s*\}\)\)/,
    );
  });

  it('yakuniy "Saqlash" — EDIT (PUT) yo`lida ham `finalize: true` yuboriladi', () => {
    expect(HANDLE_SUBMIT).toMatch(
      /updateMutation\.mutateAsync\(toPayload\(values,\s*\{\s*finalize:\s*true(,\s*science)?\s*\}\)\)/,
    );
  });

  it('"Qoralamaga saqlash" — `finalize` UMUMAN yuborilmaydi (draft yo`li tegilmagan)', () => {
    expect(HANDLE_SAVE_DRAFT).not.toMatch(/finalize/);
    expect(HANDLE_SAVE_DRAFT).toMatch(
      /createMutation\.mutateAsync\(toPayload\(values(,\s*\{\s*science\s*\})?\)\)/,
    );
    expect(HANDLE_SAVE_DRAFT).toMatch(
      /updateMutation\.mutateAsync\(toPayload\(values(,\s*\{\s*science\s*\})?\)\)/,
    );
  });

  it('P-36: payloadda `year`/`semester` biriktirilgan fandan, faqat musbat qiymat', () => {
    const code = stripLineComments(TO_PAYLOAD);
    expect(code).toMatch(/year:\s*positive\(sci\?\.year\)/);
    expect(code).toMatch(/semester:\s*positive\(sci\?\.semester\)/);
    expect(code).toMatch(/v\s*&&\s*v\s*>\s*0\s*\?\s*v\s*:\s*undefined/);
  });

  it('P-36: "Qoralamaga saqlash" ro`yxatning «Qoralama» tabiga qaytaradi (?tab=draft)', () => {
    expect(HANDLE_SAVE_DRAFT).toMatch(/navigate\(DRAFT_LIST_PATH\)/);
    expect(SRC).toMatch(/DRAFT_LIST_PATH = '\/study-load\/syllabi\?tab=draft'/);
  });

  it('`status` maydoni hech qachon payloadga to`g`ridan-to`g`ri qo`shilmaydi (regressiya qulfi)', () => {
    expect(stripLineComments(TO_PAYLOAD)).not.toMatch(/\bstatus\s*:/);
    expect(stripLineComments(HANDLE_SUBMIT)).not.toMatch(/\bstatus\s*:\s*['"]/);
    expect(stripLineComments(HANDLE_SAVE_DRAFT)).not.toMatch(/\bstatus\s*:\s*['"]/);
  });

  it('izoh tozalagich CRLF bilan ham ishlaydi (Windows checkout)', () => {
    const crlf = "  const a = 1; // status: 'new' izohda\r\n  const b = 2;\r\n";
    expect(stripLineComments(crlf)).not.toMatch(/status\s*:/);
  });

  it('`SRC` da CRLF qolmagan', () => {
    expect(SRC).not.toMatch(/\r/);
  });

  it('skaner haqiqatan ishlaydi (o`z-o`zini tekshirish)', () => {
    const buzilgan = HANDLE_SUBMIT.replace(/finalize:\s*true/g, 'NOOP');
    expect(buzilgan).not.toMatch(/finalize:\s*true/);
    expect(slice('// boshqa fayl', 'const handleSubmit', 'X')).toBe('');
  });
});

describe('SyllabusFormPage — step-1 Yup: fan dasturi majburiy (ADR-011)', () => {
  it('`scienceProgram` tanlanmagan (bo`sh) → forma YUBORILMAYDI, validatsiya xatosi', async () => {
    await expect(
      step1Schema.validate({ science: 'sc-1', scienceProgram: '' }),
    ).rejects.toThrow('syllabus.validation.scienceProgramRequired');
  });

  it('`scienceProgram` maydoni umuman yo`q → validatsiya xatosi', async () => {
    await expect(step1Schema.validate({ science: 'sc-1' })).rejects.toThrow(
      'syllabus.validation.scienceProgramRequired',
    );
  });

  it('v259 dasturi tanlangan → validatsiya o`tadi (forma yuboriladi)', async () => {
    await expect(
      step1Schema.validate({ science: 'sc-1', scienceProgram: 'sp-259' }),
    ).resolves.toEqual({ science: 'sc-1', scienceProgram: 'sp-259' });
  });

  it('fan tanlanmagan bo`lsa avvalgi qoida ham saqlanadi (regressiya)', async () => {
    await expect(
      step1Schema.validate({ science: '', scienceProgram: 'sp-259' }),
    ).rejects.toThrow('syllabus.validation.scienceRequired');
  });

  it('payloadda `scienceProgram` `|| undefined` bilan YUBORILMAYDI (400 sababi)', () => {
    expect(stripLineComments(TO_PAYLOAD)).toMatch(
      /scienceProgram:\s*values\.scienceProgram,/,
    );
    expect(stripLineComments(TO_PAYLOAD)).not.toMatch(
      /scienceProgram:\s*values\.scienceProgram\s*\|\|/,
    );
  });

  it('backend 400 xabari foydalanuvchiga O`Z MATNI bilan ko`rsatiladi', () => {
    expect(HANDLE_SUBMIT).toMatch(/message\.error\(getApiErrorMessage\(e\)\)/);
    expect(HANDLE_SAVE_DRAFT).toMatch(/message\.error\(getApiErrorMessage\(e\)\)/);
  });
});
