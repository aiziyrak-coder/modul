import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const facultyConfig: ReferenceConfig = {
  section: 'faculty',
  root: '/faculties',
  basePath: '/admin/faculties',
  labels: {
    listTitleKey: 'admin.faculty.listTitle',
    newButtonKey: 'admin.faculty.newButton',
    createTitleKey: 'admin.faculty.createTitle',
    editTitleKey: 'admin.faculty.editTitle',
    searchPlaceholderKey: 'admin.faculty.searchPlaceholder',
  },
  columns: titleDescColumns('admin.faculty.columns.title'),
  fields: [
    { name: 'title', labelKey: 'admin.faculty.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.faculty.fields.title.placeholder' },
    { name: 'desc', labelKey: 'admin.faculty.fields.desc.label', type: 'textarea', placeholderKey: 'admin.faculty.fields.desc.placeholder' },
  ],
};
