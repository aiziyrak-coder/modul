import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const assessmentTypeConfig: ReferenceConfig = {
  section: 'assessmentType',
  root: '/assessment-types',
  basePath: '/admin/assessment-types',
  labels: {
    listTitleKey: 'admin.assessmentType.listTitle',
    newButtonKey: 'admin.assessmentType.newButton',
    createTitleKey: 'admin.assessmentType.createTitle',
    editTitleKey: 'admin.assessmentType.editTitle',
    searchPlaceholderKey: 'admin.assessmentType.searchPlaceholder',
  },
  columns: titleDescColumns('admin.assessmentType.columns.title'),
  fields: [
    {
      name: 'title',
      labelKey: 'admin.assessmentType.fields.title.label',
      type: 'text',
      required: true,
      placeholderKey: 'admin.assessmentType.fields.title.placeholder',
    },
    { name: 'desc', labelKey: 'admin.assessmentType.fields.desc.label', type: 'textarea', placeholderKey: 'admin.assessmentType.fields.desc.placeholder' },
  ],
};
