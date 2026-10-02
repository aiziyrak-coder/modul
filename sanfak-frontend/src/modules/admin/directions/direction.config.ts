import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn, refColumn } from '../lib/reference-crud/columns';

export const directionConfig: ReferenceConfig = {
  section: 'direction',
  root: '/directions',
  basePath: '/admin/directions',
  labels: {
    listTitleKey: 'admin.direction.listTitle',
    newButtonKey: 'admin.direction.newButton',
    createTitleKey: 'admin.direction.createTitle',
    editTitleKey: 'admin.direction.editTitle',
    searchPlaceholderKey: 'admin.direction.searchPlaceholder',
  },
  columns: [
    { key: 'directionCode', titleKey: 'admin.direction.columns.directionCode', width: 120, render: (r) => (r.directionCode ? String(r.directionCode) : '—') },
    { key: 'title', titleKey: 'admin.direction.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    refColumn('faculty', 'admin.direction.columns.faculty', 180),
    refColumn('level', 'admin.direction.columns.level', 140),
    refColumn('practiceDepartment', 'admin.direction.columns.practiceDepartment', 180),
    dateColumn(),
  ],
  fields: [
    { name: 'title', labelKey: 'admin.direction.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.direction.fields.title.placeholder', span: 16 },
    { name: 'directionCode', labelKey: 'admin.direction.fields.directionCode.label', type: 'text', requiredOnCreate: true, placeholderKey: 'admin.direction.fields.directionCode.placeholder', span: 8 },
    { name: 'knowledgeArea', labelKey: 'admin.direction.fields.knowledgeArea.label', type: 'text', placeholderKey: 'admin.direction.fields.knowledgeArea.placeholder', span: 12 },
    { name: 'educationArea', labelKey: 'admin.direction.fields.educationArea.label', type: 'text', placeholderKey: 'admin.direction.fields.educationArea.placeholder', span: 12 },
    { name: 'level', labelKey: 'admin.direction.fields.level.label', type: 'select', optionsRoot: '/academic-levels', placeholderKey: 'admin.direction.fields.level.placeholder', span: 12 },
    { name: 'faculty', labelKey: 'admin.direction.fields.faculty.label', type: 'select', optionsRoot: '/faculties', placeholderKey: 'admin.direction.fields.faculty.placeholder', span: 12 },
    { name: 'educationForm', labelKey: 'admin.direction.fields.educationForm.label', type: 'select', optionsRoot: '/education-forms', placeholderKey: 'admin.direction.fields.educationForm.placeholder', span: 12 },
    { name: 'specialization', labelKey: 'admin.direction.fields.specialization.label', type: 'select', optionsRoot: '/specializations', placeholderKey: 'admin.direction.fields.specialization.placeholder', span: 12 },
    { name: 'studyPeriod', labelKey: 'admin.direction.fields.studyPeriod.label', type: 'number', placeholderKey: 'admin.direction.fields.studyPeriod.placeholder', span: 12 },
    { name: 'teachingLanguages', labelKey: 'admin.direction.fields.teachingLanguages.label', type: 'multiselect', optionsRoot: '/language-of-instruction', required: true, placeholderKey: 'admin.direction.fields.teachingLanguages.placeholder', span: 12 },
    { name: 'international', labelKey: 'admin.direction.fields.international.label', type: 'switch' },
    { name: 'practiceDepartment', labelKey: 'admin.direction.fields.practiceDepartment.label', type: 'select', optionsRoot: '/departments', placeholderKey: 'admin.direction.fields.practiceDepartment.placeholder', span: 12 },
    { name: 'desc', labelKey: 'admin.direction.fields.desc.label', type: 'textarea', placeholderKey: 'admin.direction.fields.desc.placeholder' },
  ],
};
