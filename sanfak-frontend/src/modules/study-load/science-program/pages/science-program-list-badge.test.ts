import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(join(__dirname, 'science-program-list-page.tsx'), 'utf8');
const TAG = readFileSync(
  join(__dirname, '..', 'components', 'form-version-tag', 'index.tsx'),
  'utf8',
);
const MANIFEST = readFileSync(join(__dirname, '..', '..', 'study-load.module.tsx'), 'utf8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('science-program — formVersion markirovkasi (manba qulfi)', () => {
  it("belgi FAQAT musbat `=== 'v142'` shartida hisoblanadi (`!== 'v259'` EMAS)", () => {
    const tagCode = stripComments(TAG);
    const pageCode = stripComments(SRC);

    expect(tagCode).toMatch(/version === 'v142'/);
    expect(tagCode).not.toMatch(/!== 'v259'/);
    expect(pageCode).not.toMatch(/!== 'v259'/);
  });

  it('belgi IKKALA ustunda ham chiziladi — Faol va Qoralama (v259 ham teglanadi)', () => {
    const uses = SRC.match(/<FormVersionTag version=\{row\.original\.formVersion\} \/>/g);
    expect(uses?.length).toBe(2);
  });

  it('badge matni i18n orqali keladi (hardcode matn emas) — v142 va v259', () => {
    expect(TAG).toMatch(/'studyLoad\.scienceProgram\.formVersionBadgeV142'/);
    expect(TAG).toMatch(/'studyLoad\.scienceProgram\.formVersionBadgeV259'/);
  });

  it('ikkala tegda ham rekvizit tooltip bor (259-son / 142-son buyruq)', () => {
    expect(TAG).toMatch(/<Tooltip/);
    expect(TAG).toMatch(/'studyLoad\.scienceProgram\.formVersionTooltipV259'/);
    expect(TAG).toMatch(/'studyLoad\.scienceProgram\.formVersionTooltipV142'/);
  });

  it("i18n kalitlari uchala tilda ham bor (uz/ru/en)", () => {
    for (const key of [
      'studyLoad.scienceProgram.formVersionBadgeV259',
      'studyLoad.scienceProgram.formVersionTooltipV259',
      'studyLoad.scienceProgram.formVersionTooltipV142',
      'studyLoad.scienceProgram.filter.allFormVersions',
    ]) {
      const hits = MANIFEST.split(`'${key}'`).length - 1;
      expect(hits, key).toBe(3);
    }
  });

  it("'876' raqami ISHLATILMAYDI — u rezolyutsiya, buyruq raqami emas", () => {
    expect(TAG).not.toMatch(/876/);
    expect(SRC).not.toMatch(/876/);
  });

  it("ro'yxatda 'Tartib' filtri bor — Barcha / 259-son / 142-son", () => {
    expect(SRC).toMatch(/key: 'formVersion'/);
    expect(SRC).toMatch(/'studyLoad\.scienceProgram\.filter\.allFormVersions'/);
    expect(SRC).toMatch(/value: 'v259'/);
    expect(SRC).toMatch(/value: 'v142'/);
  });

  it('filtr `displayedItems` ichida qo`llanadi (tab filtri saqlangan holda)', () => {
    expect(SRC).toMatch(/filterByFormVersion\(byTab, formVersion\)/);
    expect(SRC).toMatch(/items\.filter\(\(i\) => i\.status !== 'draft'\)/);
    expect(SRC).toMatch(/items\.filter\(\(i\) => i\.status === 'draft'\)/);
  });

  it('yaratish tugmasi ikki variant taklif qiladi — v259 (amaldagi) va v142 (142-son buyruq)', () => {
    expect(SRC).toMatch(/key: 'v259', label: t\('studyLoad\.scienceProgram\.createV259'\)/);
    expect(SRC).toMatch(/key: 'v142', label: t\('studyLoad\.scienceProgram\.createV142'\)/);
  });

  it("v142 tanlansa ALOHIDA `new-142` wizard route'iga o'tadi (query param EMAS)", () => {
    expect(SRC).toMatch(/\/study-load\/science-programs\/new-142/);
    expect(SRC).not.toMatch(/\/study-load\/science-programs\/new\?form=v142/);
  });

  it("tahrirlash: `formVersion === 'v142'` qator `edit-142`, boshqasi `edit` (musbat tekshiruv)", () => {
    expect(SRC).toMatch(/item\.formVersion === 'v142' \? 'edit-142' : 'edit'/);
  });

  it("qidiruv (search) va status badge'lar joyida qoladi", () => {
    expect(SRC).toMatch(/searchPlaceholder=\{t\('studyLoad\.syllabus\.searchPlaceholder'\)\}/);
    expect(SRC).toMatch(/<StatusBadge status=\{item\.status\} \/>/);
  });

  it('skaner haqiqatan ishlaydi (o`z-o`zini tekshirish)', () => {
    const buzilgan = TAG.replace(/formVersionBadgeV142/g, 'NOOP');
    expect(buzilgan).not.toMatch(/'studyLoad\.scienceProgram\.formVersionBadgeV142'/);
  });
});
