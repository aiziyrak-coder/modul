import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn, refColumn } from '../lib/reference-crud/columns';

export const academicTitleConfig: ReferenceConfig = {
  section: 'academicTitle',
  root: '/academic-titles',
  basePath: '/admin/academic-titles',
  labels: {
    listTitleKey: 'admin.academicTitle.listTitle',
    newButtonKey: 'admin.academicTitle.newButton',
    createTitleKey: 'admin.academicTitle.createTitle',
    editTitleKey: 'admin.academicTitle.editTitle',
    searchPlaceholderKey: 'admin.academicTitle.searchPlaceholder',
  },
  columns: [
    { key: 'title', titleKey: 'admin.academicTitle.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    refColumn('position', 'admin.academicTitle.columns.position', 200),
    { key: 'rateTime', titleKey: 'admin.academicTitle.columns.rateTime', width: 140, render: (r) => (r.rateTime != null ? String(r.rateTime) : '—') },
    dateColumn(),
  ],
  fields: [
    { name: 'title', labelKey: 'admin.academicTitle.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.academicTitle.fields.title.placeholder' },
    { name: 'position', labelKey: 'admin.academicTitle.fields.position.label', type: 'select', optionsRoot: '/positions', placeholderKey: 'admin.academicTitle.fields.position.placeholder', span: 12 },
    { name: 'rateTime', labelKey: 'admin.academicTitle.fields.rateTime.label', type: 'number', required: true, placeholderKey: 'admin.academicTitle.fields.rateTime.placeholder', span: 12 },
  ],
};
