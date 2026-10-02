import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn } from '../lib/reference-crud/columns';

export const educationFormConfig: ReferenceConfig = {
  section: 'educationForm',
  root: '/education-forms',
  basePath: '/admin/education-forms',
  labels: {
    listTitleKey: 'admin.educationForm.listTitle',
    newButtonKey: 'admin.educationForm.newButton',
    createTitleKey: 'admin.educationForm.createTitle',
    editTitleKey: 'admin.educationForm.editTitle',
    searchPlaceholderKey: 'admin.educationForm.searchPlaceholder',
  },
  columns: [
    { key: 'title', titleKey: 'admin.educationForm.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    {
      key: 'isInternational',
      titleKey: 'admin.educationForm.columns.isInternational',
      width: 120,
      render: (r) => (r.isInternational ? 'Ha' : "Yo'q"),
    },
    dateColumn(),
  ],
  fields: [
    { name: 'title', labelKey: 'admin.educationForm.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.educationForm.fields.title.placeholder' },
    { name: 'desc', labelKey: 'admin.educationForm.fields.desc.label', type: 'textarea', placeholderKey: 'admin.educationForm.fields.desc.placeholder' },
    { name: 'isInternational', labelKey: 'admin.educationForm.fields.isInternational.label', type: 'switch' },
  ],
};
