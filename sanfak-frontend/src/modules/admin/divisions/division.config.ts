import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn, refColumn } from '../lib/reference-crud/columns';

export const divisionConfig: ReferenceConfig = {
  section: 'division',
  root: '/divisions',
  basePath: '/admin/divisions',
  labels: {
    listTitleKey: 'admin.division.listTitle',
    newButtonKey: 'admin.division.newButton',
    createTitleKey: 'admin.division.createTitle',
    editTitleKey: 'admin.division.editTitle',
    searchPlaceholderKey: 'admin.division.searchPlaceholder',
  },
  columns: [
    { key: 'title', titleKey: 'admin.division.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    refColumn('faculty', 'admin.division.columns.faculty', 200),
    refColumn('department', 'admin.division.columns.department', 200),
    dateColumn(),
  ],
  fields: [
    { name: 'title', labelKey: 'admin.division.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.division.fields.title.placeholder' },
    { name: 'faculty', labelKey: 'admin.division.fields.faculty.label', type: 'select', optionsRoot: '/faculties', placeholderKey: 'admin.division.fields.faculty.placeholder', span: 12 },
    { name: 'department', labelKey: 'admin.division.fields.department.label', type: 'select', optionsRoot: '/departments', placeholderKey: 'admin.division.fields.department.placeholder', span: 12 },
    { name: 'desc', labelKey: 'admin.division.fields.desc.label', type: 'textarea', placeholderKey: 'admin.division.fields.desc.placeholder' },
  ],
};
