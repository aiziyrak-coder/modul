import { describe, expect, it } from 'vitest';
import { toIndicator } from '../api/indicator-mapper';
import { FIELD_LABELS, FIELD_OPTIONS, fieldLabel, fieldOptions } from './field-labels';

const SEED_FIELD_NAMES = [
  'activityName', 'antiplagiatReport', 'articleFile', 'articleTitle',
  'authors', 'authorsCount', 'authorsName', 'basisType',
  'certificateFile', 'certificateName', 'citationCount', 'comment',
  'competitionName', 'conferenceName', 'contractFile', 'cooperationDocName',
  'councilCertificate', 'councilDecision', 'country', 'currentYearAmount',
  'date', 'departmentMinutes', 'diplomaFile', 'diplomaNumber',
  'diplomaSeries', 'directionName', 'dissertationTopic', 'doctorDiplomaNumber',
  'doctorDiplomaSeries', 'dscNumber', 'dscSeries', 'duration',
  'expiryDate', 'externalReview', 'foreignOtm', 'googleScholarUrl',
  'grantName', 'grantTopic', 'internalReview', 'invitationFile',
  'isbn', 'issuedDate', 'journalName', 'level',
  'manualFile', 'manualName', 'ministerCertFile', 'ministerOrderFile',
  'monographFile', 'monographTitle', 'orderName', 'otmName',
  'pages', 'participationType', 'passportStampFile', 'patentName',
  'phdNumber', 'phdSeries', 'place', 'professorDiplomaNumber',
  'professorDiplomaSeries', 'programFile', 'publishLicenseFile', 'publishYear',
  'publisher', 'rankObtainedDate', 'receiptFile', 'rectorOrderFile',
  'referralFile', 'registrationNumber', 'reportFile', 'rewardOrderFile',
  'scopusUrl', 'signedDate', 'specialty', 'specialtyCode',
  'ssvConclusion', 'studentName', 'teacherName', 'textbookName',
  'thesisFile', 'thesisTitle', 'titleFile', 'topic',
  'totalAmount', 'url', 'venue', 'ziyonetCert',
] as const;

describe('4.12 maydon yorliqlari (localization)', () => {
  it('backend seeddagi 88 ta maydon nomi lug\'atda bor', () => {
    expect(SEED_FIELD_NAMES).toHaveLength(88);
    const missing = SEED_FIELD_NAMES.filter((name) => !FIELD_LABELS[name]);
    expect(missing).toEqual([]);
  });

  it('hech bir yorliq bo\'sh emas va xom kalitning o\'zi emas (ya\'ni tarjima qilingan)', () => {
    const untranslated = Object.entries(FIELD_LABELS).filter(
      ([key, label]) => !label.trim() || label === key,
    );
    expect(untranslated).toEqual([]);
  });

  it('`select` maydonlari variantlarga ega (dropdown bo\'sh qolmaydi)', () => {
    expect(fieldOptions('participationType')).toEqual(['Onlayn', 'Oflayn']);
    expect(fieldOptions('basisType')).toEqual(['Buyruq', 'Qaror', 'Shartnoma']);
    for (const opts of Object.values(FIELD_OPTIONS)) expect(opts.length).toBeGreaterThan(0);
  });

  it('`fieldOptions` nusxa qaytaradi — chaqiruvchi lug\'atni o\'zgartira olmaydi', () => {
    const first = fieldOptions('basisType');
    first?.push('BUZILDI');
    expect(fieldOptions('basisType')).toEqual(['Buyruq', 'Qaror', 'Shartnoma']);
  });

  it('noma\'lum kalit camelCase\'dan o\'qiladigan matnga aylanadi (fallback)', () => {
    expect(fieldLabel('someNewField')).toBe('Some new field');
    expect(fieldLabel('googleScholarUrl')).toBe('Google Scholar havolasi');
    expect(fieldLabel('field_0')).toBe('Field 0');
    expect(fieldLabel('')).toBe('');
  });
});

describe('indicator-mapper yorliqni qo\'llaydi', () => {
  const raw = {
    _id: 'i1',
    title: 'Test',
    dataFields: [
      { fieldName: 'otmName', fieldType: 'text', required: true },
      { fieldName: 'participationType', fieldType: 'select', required: true },
      { fieldName: 'notInDictionary', fieldType: 'text', required: false },
    ],
  };

  it('xom `fieldName` o\'rniga o\'zbekcha `label` beradi', () => {
    const labels = toIndicator(raw).dataFields.map((f) => f.label);
    expect(labels).toEqual(['OTM nomi', 'Ishtirok turi', 'Not in dictionary']);
  });

  it('`key` O\'ZGARMAYDI — backend `fieldName` shu kalit bilan qaytadi', () => {
    const fields = toIndicator(raw).dataFields;
    expect(fields.map((f) => f.key)).toEqual([
      'otmName',
      'participationType',
      'notInDictionary',
    ]);
  });

  it('faqat `select` maydonga `options` qo\'shiladi', () => {
    const opts = toIndicator(raw).dataFields.map((f) => f.options);
    expect(opts).toEqual([undefined, ['Onlayn', 'Oflayn'], undefined]);
  });
});
