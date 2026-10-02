import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn, refColumn } from '../lib/reference-crud/columns';

export const departmentConfig: ReferenceConfig = {
  section: 'department',
  root: '/departments',
  basePath: '/admin/departments',
  labels: {
    listTitleKey: 'admin.department.listTitle',
    newButtonKey: 'admin.department.newButton',
    createTitleKey: 'admin.department.createTitle',
    editTitleKey: 'admin.department.editTitle',
    searchPlaceholderKey: 'admin.department.searchPlaceholder',
  },
  columns: [
    { key: 'title', titleKey: 'admin.department.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    refColumn('faculty', 'admin.department.columns.faculty', 220),
    dateColumn(),
  ],
  fields: [
    { name: 'title', labelKey: 'admin.department.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.department.fields.title.placeholder' },
    { name: 'faculty', labelKey: 'admin.department.fields.faculty.label', type: 'select', optionsRoot: '/faculties', placeholderKey: 'admin.department.fields.faculty.placeholder' },
    { name: 'desc', labelKey: 'admin.department.fields.desc.label', type: 'textarea', placeholderKey: 'admin.department.fields.desc.placeholder' },
  ],
};
