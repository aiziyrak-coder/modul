import type { AchievementCategory } from './types';

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  {
    key: 'degrees',
    root: '/scientific-degrees',
    section: 'scientificDegree',
    labelKey: 'ach.degrees.label',
    tabKey: 'ach.degrees.tab',
    icon: 'trophy',
    color: 'var(--brand-primary)',
    fields: [
      {
        name: 'degreeType',
        labelKey: 'ach.f.degreeType',
        kind: 'ref',
        refSource: 'academicLevels',
      },
      {
        name: 'specialty',
        labelKey: 'ach.f.specialty',
        kind: 'ref',
        refSource: 'specialties',
      },
      { name: 'dissertationTopic', labelKey: 'ach.f.dissertationTopic', kind: 'text' },
      { name: 'awardedDate', labelKey: 'ach.f.awardedDate', kind: 'date' },
      { name: 'defenseDate', labelKey: 'ach.f.defenseDate', kind: 'date' },
      { name: 'councilName', labelKey: 'ach.f.councilName', kind: 'text' },
      {
        name: 'councilNumber',
        labelKey: 'ach.f.councilNumber',
        kind: 'text',
        placeholder: '12',
      },
      { name: 'academicYear', labelKey: 'ach.f.academicYear', kind: 'year' },
    ],
  },
  {
    key: 'titles',
    root: '/scientific-titles',
    section: 'scientificTitle',
    labelKey: 'ach.titles.label',
    tabKey: 'ach.titles.tab',
    icon: 'book',
    color: '#d97706',
    fields: [
      {
        name: 'titleType',
        labelKey: 'ach.f.titleType',
        kind: 'ref',
        refSource: 'academicTitles',
      },
      {
        name: 'specialty',
        labelKey: 'ach.f.specialtyTitle',
        kind: 'ref',
        refSource: 'specialties',
      },
      { name: 'diplomaSeries', labelKey: 'ach.f.diplomaSeries', kind: 'text', placeholder: 'FD-1234' },
      { name: 'diplomaNumber', labelKey: 'ach.f.diplomaNumber', kind: 'text', placeholder: '0012345' },
      { name: 'date', labelKey: 'ach.f.date', kind: 'date' },
      { name: 'academicYear', labelKey: 'ach.f.academicYear', kind: 'year' },
    ],
  },
  {
    key: 'defense',
    root: '/defenses',
    section: 'defense',
    labelKey: 'ach.defense.label',
    tabKey: 'ach.defense.tab',
    icon: 'safety',
    color: '#7c3aed',
    fields: [
      {
        name: 'degreeType',
        labelKey: 'ach.f.degreeType',
        kind: 'ref',
        refSource: 'academicLevels',
      },
      {
        name: 'scienceBranch',
        labelKey: 'ach.f.scienceBranch',
        kind: 'ref',
        refSource: 'scienceBranches',
      },
      {
        name: 'specialty',
        labelKey: 'ach.f.specialty',
        kind: 'ref',
        refSource: 'specialties',
      },
      { name: 'diplomaSeries', labelKey: 'ach.f.diplomaSeries', kind: 'text', placeholder: 'FD-1234' },
      { name: 'diplomaNumber', labelKey: 'ach.f.diplomaNumber', kind: 'text', placeholder: '0012345' },
      { name: 'defenseDate', labelKey: 'ach.f.defenseDate', kind: 'date' },
      { name: 'councilName', labelKey: 'ach.f.councilName', kind: 'text' },
      { name: 'councilNumber', labelKey: 'ach.f.councilNumber', kind: 'text', placeholder: '12' },
      { name: 'academicYear', labelKey: 'ach.f.academicYear', kind: 'year' },
    ],
  },
  {
    key: 'patents',
    root: '/patents',
    section: 'patent',
    labelKey: 'ach.patents.label',
    tabKey: 'ach.patents.tab',
    icon: 'safety',
    color: '#2563eb',
    fields: [
      { name: 'title', labelKey: 'ach.f.patentName', kind: 'text' },
      { name: 'registrationNumber', labelKey: 'ach.f.regNumber', kind: 'text', placeholder: 'FAP 01234' },
      { name: 'date', labelKey: 'ach.f.issueDate', kind: 'date' },
      { name: 'academicYear', labelKey: 'ach.f.academicYear', kind: 'year' },
    ],
  },
  {
    key: 'certificates',
    root: '/copyrights',
    section: 'copyright',
    labelKey: 'ach.certificates.label',
    tabKey: 'ach.certificates.tab',
    icon: 'file',
    color: '#9333ea',
    fields: [
      { name: 'title', labelKey: 'ach.f.materialName', kind: 'text' },
      { name: 'authors', labelKey: 'ach.f.authors', kind: 'text' },
      { name: 'institutionName', labelKey: 'ach.f.institution', kind: 'text' },
      { name: 'registrationNumber', labelKey: 'ach.f.regNumber', kind: 'text', placeholder: 'DGU 08000' },
      { name: 'date', labelKey: 'ach.f.issueDate', kind: 'date' },
      { name: 'academicYear', labelKey: 'ach.f.academicYear', kind: 'year' },
    ],
  },
];

export const categoryByKey = (key: string): AchievementCategory | undefined =>
  ACHIEVEMENT_CATEGORIES.find((c) => c.key === key);

export const ACHIEVEMENT_PAGE_PATH: Record<string, string> = {
  degrees: '/scientific-department/scientific-degrees',
  titles: '/scientific-department/scientific-titles',
  defense: '/scientific-department/defense',
  patents: '/scientific-department/patents',
  certificates: '/scientific-department/certificates',
};

export const ACHIEVEMENT_SLUG_KEY: Record<string, string> = {
  'scientific-degrees': 'degrees',
  'my-degrees': 'degrees',
  'scientific-titles': 'titles',
  'my-titles': 'titles',
  defense: 'defense',
  'my-defense': 'defense',
  patents: 'patents',
  'my-patents': 'patents',
  certificates: 'certificates',
  'my-certificates': 'certificates',
};

const WITH_AUTO_ABSTRACT = new Set(['degrees', 'defense']);

export const hasAutoAbstract = (key: string | undefined): boolean =>
  !!key && WITH_AUTO_ABSTRACT.has(key);

export const midSentence = (name: string): string =>
  /^\p{Lu}\p{Lu}/u.test(name)
    ? name
    : name.charAt(0).toLocaleLowerCase() + name.slice(1);
