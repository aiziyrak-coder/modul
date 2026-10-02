import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn, refColumn } from '../lib/reference-crud/columns';

export const scienceConfig: ReferenceConfig = {
  section: 'science',
  root: '/sciences',
  basePath: '/admin/sciences',
  labels: {
    listTitleKey: 'admin.science.listTitle',
    newButtonKey: 'admin.science.newButton',
    createTitleKey: 'admin.science.createTitle',
    editTitleKey: 'admin.science.editTitle',
    searchPlaceholderKey: 'admin.science.searchPlaceholder',
  },
  columns: [
    { key: 'scienceCode', titleKey: 'admin.science.columns.scienceCode', width: 130, render: (r) => (r.scienceCode ? String(r.scienceCode) : '—') },
    { key: 'title', titleKey: 'admin.science.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    refColumn('department', 'admin.science.columns.department', 200),
    {
      key: 'isElective',
      titleKey: 'admin.science.columns.isElective',
      width: 120,
      render: (r) => (r.isElective ? 'Ha' : "Yo'q"),
    },
    dateColumn(),
  ],
  fields: [
    { name: 'title', labelKey: 'admin.science.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.science.fields.title.placeholder', span: 16 },
    { name: 'scienceCode', labelKey: 'admin.science.fields.scienceCode.label', type: 'text', placeholderKey: 'admin.science.fields.scienceCode.placeholder', span: 8 },
    { name: 'department', labelKey: 'admin.science.fields.department.label', type: 'select', optionsRoot: '/departments', placeholderKey: 'admin.science.fields.department.placeholder' },
    { name: 'desc', labelKey: 'admin.science.fields.desc.label', type: 'textarea', placeholderKey: 'admin.science.fields.desc.placeholder' },
    { name: 'isElective', labelKey: 'admin.science.fields.isElective.label', type: 'switch' },
  ],
};
