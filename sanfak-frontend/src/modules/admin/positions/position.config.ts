import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const positionConfig: ReferenceConfig = {
  section: 'position',
  root: '/positions',
  basePath: '/admin/positions',
  labels: {
    listTitleKey: 'admin.position.listTitle',
    newButtonKey: 'admin.position.newButton',
    createTitleKey: 'admin.position.createTitle',
    editTitleKey: 'admin.position.editTitle',
    searchPlaceholderKey: 'admin.position.searchPlaceholder',
  },
  columns: titleDescColumns('admin.position.columns.title'),
  fields: [
    { name: 'title', labelKey: 'admin.position.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.position.fields.title.placeholder' },
    { name: 'desc', labelKey: 'admin.position.fields.desc.label', type: 'textarea', placeholderKey: 'admin.position.fields.desc.placeholder' },
  ],
};
