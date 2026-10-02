import { REF_ROOTS } from '../../api/reference-api';
import type { LangCrudConfig } from './types';

export const directionsConfig: LangCrudConfig = {
  section: 'admissionDirection',
  root: REF_ROOTS.directions,
  titleKey: 'foreignAdmission.nav.directions',
  newButtonKey: 'foreignAdmission.directions.new',
  createTitleKey: 'foreignAdmission.directions.create',
  editTitleKey: 'foreignAdmission.directions.edit',
  searchPlaceholderKey: 'foreignAdmission.directions.search_ph',
  deleteTitleKey: 'foreignAdmission.directions.delete_title',
  columns: [{ key: 'title', titleKey: 'foreignAdmission.directions.name', langBase: 'title' }],
  langFields: [
    {
      name: 'title',
      labelKey: 'foreignAdmission.directions.name',
      required: true,
      placeholderKey: 'foreignAdmission.directions.name_ph',
    },
  ],
};

export const educationFormsConfig: LangCrudConfig = {
  section: 'admissionEducationForm',
  root: REF_ROOTS.educationForms,
  titleKey: 'foreignAdmission.nav.educationForms',
  newButtonKey: 'foreignAdmission.eduForms.new',
  createTitleKey: 'foreignAdmission.eduForms.create',
  editTitleKey: 'foreignAdmission.eduForms.edit',
  searchPlaceholderKey: 'foreignAdmission.eduForms.search_ph',
  deleteTitleKey: 'foreignAdmission.eduForms.delete_title',
  columns: [
    { key: 'title', titleKey: 'foreignAdmission.eduForms.name', langBase: 'title' },
    { key: 'description', titleKey: 'foreignAdmission.eduForms.desc', langBase: 'description' },
  ],
  langFields: [
    {
      name: 'title',
      labelKey: 'foreignAdmission.eduForms.name',
      required: true,
      placeholderKey: 'foreignAdmission.eduForms.name_ph',
    },
    {
      name: 'description',
      labelKey: 'foreignAdmission.eduForms.desc',
      type: 'textarea',
      placeholderKey: 'foreignAdmission.eduForms.desc_ph',
    },
  ],
};

export const educationLanguagesConfig: LangCrudConfig = {
  section: 'admissionEducationLanguage',
  root: REF_ROOTS.educationLanguages,
  titleKey: 'foreignAdmission.nav.educationLanguages',
  newButtonKey: 'foreignAdmission.eduLangs.new',
  createTitleKey: 'foreignAdmission.eduLangs.create',
  editTitleKey: 'foreignAdmission.eduLangs.edit',
  searchPlaceholderKey: 'foreignAdmission.eduLangs.search_ph',
  deleteTitleKey: 'foreignAdmission.eduLangs.delete_title',
  columns: [{ key: 'title', titleKey: 'foreignAdmission.eduLangs.name', langBase: 'title' }],
  langFields: [
    {
      name: 'title',
      labelKey: 'foreignAdmission.eduLangs.name',
      required: true,
      placeholderKey: 'foreignAdmission.eduLangs.name_ph',
    },
  ],
};

export const countriesConfig: LangCrudConfig = {
  section: 'admissionCountry',
  root: REF_ROOTS.countries,
  titleKey: 'foreignAdmission.nav.countries',
  newButtonKey: 'foreignAdmission.countries.new',
  createTitleKey: 'foreignAdmission.countries.create',
  editTitleKey: 'foreignAdmission.countries.edit',
  searchPlaceholderKey: 'foreignAdmission.countries.search_ph',
  deleteTitleKey: 'foreignAdmission.countries.delete_title',
  columns: [
    { key: 'flagUrl', titleKey: 'foreignAdmission.countries.flag', width: 90, kind: 'image' },
    { key: 'title', titleKey: 'foreignAdmission.countries.name', langBase: 'title' },
    { key: 'passportSample', titleKey: 'foreignAdmission.countries.passport', width: 160 },
    { key: 'phoneSample', titleKey: 'foreignAdmission.countries.phone', width: 190 },
  ],
  langFields: [
    {
      name: 'title',
      labelKey: 'foreignAdmission.countries.name',
      required: true,
      placeholderKey: 'foreignAdmission.countries.name_ph',
    },
  ],
  plainFields: [
    {
      name: 'passportSample',
      labelKey: 'foreignAdmission.countries.passport',
      placeholderKey: 'foreignAdmission.countries.passport_ph',
    },
    {
      name: 'phoneSample',
      labelKey: 'foreignAdmission.countries.phone',
      placeholderKey: 'foreignAdmission.countries.phone_ph',
    },
  ],
  imageUpload: {
    urlField: 'flagUrl',
    labelKey: 'foreignAdmission.countries.flag',
    hintKey: 'foreignAdmission.countries.flag_hint',
  },
};
