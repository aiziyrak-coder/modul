import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const academicLevelConfig: ReferenceConfig = {
  section: 'academicLevel',
  root: '/academic-levels',
  basePath: '/admin/academic-levels',
  labels: {
    listTitleKey: 'admin.academicLevel.listTitle',
    newButtonKey: 'admin.academicLevel.newButton',
    createTitleKey: 'admin.academicLevel.createTitle',
    editTitleKey: 'admin.academicLevel.editTitle',
    searchPlaceholderKey: 'admin.academicLevel.searchPlaceholder',
  },
  columns: titleDescColumns('admin.academicLevel.columns.title'),
  fields: [
    { name: 'title', labelKey: 'admin.academicLevel.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.academicLevel.fields.title.placeholder' },
    { name: 'desc', labelKey: 'admin.academicLevel.fields.desc.label', type: 'textarea', placeholderKey: 'admin.academicLevel.fields.desc.placeholder' },
  ],
};
