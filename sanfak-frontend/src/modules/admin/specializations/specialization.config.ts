import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const specializationConfig: ReferenceConfig = {
  section: 'specialization',
  root: '/specializations',
  basePath: '/admin/specializations',
  labels: {
    listTitleKey: 'admin.specialization.listTitle',
    newButtonKey: 'admin.specialization.newButton',
    createTitleKey: 'admin.specialization.createTitle',
    editTitleKey: 'admin.specialization.editTitle',
    searchPlaceholderKey: 'admin.specialization.searchPlaceholder',
  },
  columns: titleDescColumns('admin.specialization.columns.title'),
  fields: [
    { name: 'title', labelKey: 'admin.specialization.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.specialization.fields.title.placeholder' },
    { name: 'desc', labelKey: 'admin.specialization.fields.desc.label', type: 'textarea', placeholderKey: 'admin.specialization.fields.desc.placeholder' },
  ],
};
