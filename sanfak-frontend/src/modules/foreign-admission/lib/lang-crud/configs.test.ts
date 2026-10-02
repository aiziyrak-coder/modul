import { describe, expect, it } from 'vitest';
import manifest from '../../foreign-admission.module';
import {
  countriesConfig,
  directionsConfig,
  educationFormsConfig,
  educationLanguagesConfig,
} from './configs';
import {
  ACADEMIC_YEAR_PATTERN,
  SEASON_ORDER,
  SEASON_STATUS_ORDER,
  isSeasonEditable,
  isValidAcademicYear,
} from '../season-options';
import { pickLang, toOptions } from '../../model/content-lang';

const CONFIGS = [directionsConfig, educationFormsConfig, educationLanguagesConfig, countriesConfig];

const uz = manifest.i18n?.uz ?? {};
const ru = manifest.i18n?.ru ?? {};
const en = manifest.i18n?.en ?? {};

describe('ma`lumotnoma konfiguratsiyalari', () => {
  it('har birida MAJBURIY `title` maydoni bor (3 tilda talab qilinadi)', () => {
    CONFIGS.forEach((c) => {
      const title = c.langFields.find((f) => f.name === 'title');
      expect(title, c.section).toBeDefined();
      expect(title!.required, c.section).toBe(true);
    });
  });

  it('har config permission SECTION`i manifestda e`lon qilingan', () => {
    const declared = new Set((manifest.permissions ?? []).map((p) => p.key));
    CONFIGS.forEach((c) => {
      ['create', 'read', 'readAll', 'update', 'delete'].forEach((action) => {
        expect(declared.has(`${c.section}:${action}`), `${c.section}:${action}`).toBe(true);
      });
    });
  });

  it('backend endpointlari `admission-` prefiksi bilan (references bilan aralashmasin)', () => {
    CONFIGS.forEach((c) => expect(c.root.startsWith('/admission-'), c.root).toBe(true));
  });

  it('faqat davlatlar ma`lumotnomasida rasm yuklash bor', () => {
    expect(countriesConfig.imageUpload?.urlField).toBe('flagUrl');
    expect(directionsConfig.imageUpload).toBeUndefined();
    expect(educationFormsConfig.imageUpload).toBeUndefined();
    expect(educationLanguagesConfig.imageUpload).toBeUndefined();
  });
});

describe('manifest yaxlitligi', () => {
  it('har route permission bilan gate qilingan va public route YO`Q', () => {
    expect(manifest.routes.length).toBeGreaterThanOrEqual(10);
    manifest.routes.forEach((r) => {
      expect(r.permission, r.path ?? 'index').toBeTruthy();
      expect(r.public).toBeFalsy();
    });
  });

  it('konfiguratsiyalarda ishlatilgan i18n kalitlari uchala tilda ham bor', () => {
    const usedKeys = CONFIGS.flatMap((c) => [
      c.titleKey,
      c.newButtonKey,
      c.createTitleKey,
      c.editTitleKey,
      c.searchPlaceholderKey,
      c.deleteTitleKey,
      ...c.columns.map((col) => col.titleKey),
      ...c.langFields.flatMap((f) => [f.labelKey, f.placeholderKey ?? '']),
      ...(c.plainFields ?? []).flatMap((f) => [f.labelKey, f.placeholderKey ?? '']),
      ...(c.imageUpload ? [c.imageUpload.labelKey, c.imageUpload.hintKey] : []),
    ]).filter(Boolean);

    expect(usedKeys.length).toBeGreaterThan(20);
    usedKeys.forEach((k) => {
      expect(uz[k], `uz: ${k}`).toBeTruthy();
      expect(ru[k], `ru: ${k}`).toBeTruthy();
      expect(en[k], `en: ${k}`).toBeTruthy();
    });
  });

  it('mavsum va holat kalitlari uchala tilda ham tarjima qilingan', () => {
    [...SEASON_ORDER.map((s) => `foreignAdmission.season.${s}`),
     ...SEASON_STATUS_ORDER.map((s) => `foreignAdmission.seasonStatus.${s}`)].forEach((k) => {
      expect(uz[k], `uz: ${k}`).toBeTruthy();
      expect(ru[k], `ru: ${k}`).toBeTruthy();
      expect(en[k], `en: ${k}`).toBeTruthy();
    });
  });
});

describe('mavsum variantlari', () => {
  it('backend enum tartibi bilan bir xil', () => {
    expect(SEASON_ORDER).toEqual(['bahor', 'yoz', 'kuz', 'qish']);
    expect(SEASON_STATUS_ORDER).toEqual(['rejada', 'ochiq', 'yopiq']);
  });

  it('yopilgan mavsum tahrirlanmaydi (TERMINAL)', () => {
    expect(isSeasonEditable('rejada')).toBe(true);
    expect(isSeasonEditable('ochiq')).toBe(true);
    expect(isSeasonEditable('yopiq')).toBe(false);
  });

  it('o`quv yili ro`yxati KOD ichida generatsiya qilinmaydi', () => {
    expect(isValidAcademicYear('2025/2026')).toBe(true);
    expect(isValidAcademicYear(' 2026/2027 ')).toBe(true);
    expect(isValidAcademicYear('2026')).toBe(false);
    expect(isValidAcademicYear('26/27')).toBe(false);
    expect(isValidAcademicYear('2025-2026')).toBe(false);
    expect(ACADEMIC_YEAR_PATTERN.source).toBe(String.raw`^\d{4}\/\d{4}$`);
  });
});

describe('pickLang', () => {
  const record = { titleUz: 'Davolash ishi', titleRu: '', titleEn: 'General medicine' };

  it('interfeys tiliga mos qiymatni oladi', () => {
    expect(pickLang(record, 'title', 'en')).toBe('General medicine');
  });

  it('tarjima bo`sh bo`lsa O`ZBEKCHAGA qaytadi (bo`sh katak chiqmasin)', () => {
    expect(pickLang(record, 'title', 'ru')).toBe('Davolash ishi');
  });

  it('yozuv yo`q bo`lsa fallback', () => {
    expect(pickLang(null, 'title', 'uz')).toBe('—');
    expect(pickLang({}, 'title', 'uz', 'yo`q')).toBe('yo`q');
  });

  it('Select variantlari ham shu qoidaga bo`ysunadi', () => {
    const options = toOptions([{ id: 'a', titleUz: 'Kunduzgi', titleEn: 'Full-time' }], 'ru');
    expect(options).toEqual([{ value: 'a', label: 'Kunduzgi' }]);
  });
});
