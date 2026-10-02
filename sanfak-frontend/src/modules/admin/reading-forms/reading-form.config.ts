import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const readingFormConfig: ReferenceConfig = {
  section: 'readingForm',
  root: '/reading-forms',
  basePath: '/admin/reading-forms',
  labels: {
    listTitleKey: 'admin.readingForm.listTitle',
    newButtonKey: 'admin.readingForm.newButton',
    createTitleKey: 'admin.readingForm.createTitle',
    editTitleKey: 'admin.readingForm.editTitle',
    searchPlaceholderKey: 'admin.readingForm.searchPlaceholder',
  },
  columns: titleDescColumns('admin.readingForm.columns.title'),
  fields: [
    { name: 'title', labelKey: 'admin.readingForm.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.readingForm.fields.title.placeholder' },
    { name: 'desc', labelKey: 'admin.readingForm.fields.desc.label', type: 'textarea', placeholderKey: 'admin.readingForm.fields.desc.placeholder' },
  ],
};
