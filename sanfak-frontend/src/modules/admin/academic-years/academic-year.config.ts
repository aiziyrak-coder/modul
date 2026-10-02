import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn } from '../lib/reference-crud/columns';

export const academicYearConfig: ReferenceConfig = {
  section: 'academicYear',
  root: '/academic-years',
  basePath: '/admin/academic-years',
  labels: {
    listTitleKey: 'admin.academicYear.listTitle',
    newButtonKey: 'admin.academicYear.newButton',
    createTitleKey: 'admin.academicYear.createTitle',
    editTitleKey: 'admin.academicYear.editTitle',
    searchPlaceholderKey: 'admin.academicYear.searchPlaceholder',
  },
  columns: [
    { key: 'title', titleKey: 'admin.academicYear.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    dateColumn(),
  ],
  fields: [
    {
      name: 'title',
      labelKey: 'admin.academicYear.fields.title.label',
      type: 'text',
      required: true,
      placeholderKey: 'admin.academicYear.fields.title.placeholder',
    },
  ],
};
