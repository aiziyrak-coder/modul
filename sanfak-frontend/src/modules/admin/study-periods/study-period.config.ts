import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const studyPeriodConfig: ReferenceConfig = {
  section: 'studyPeriod',
  root: '/studyPeriods',
  basePath: '/admin/study-periods',
  labels: {
    listTitleKey: 'admin.studyPeriod.listTitle',
    newButtonKey: 'admin.studyPeriod.newButton',
    createTitleKey: 'admin.studyPeriod.createTitle',
    editTitleKey: 'admin.studyPeriod.editTitle',
    searchPlaceholderKey: 'admin.studyPeriod.searchPlaceholder',
  },
  columns: titleDescColumns('admin.studyPeriod.columns.title'),
  fields: [
    { name: 'title', labelKey: 'admin.studyPeriod.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.studyPeriod.fields.title.placeholder' },
    { name: 'desc', labelKey: 'admin.studyPeriod.fields.desc.label', type: 'textarea', placeholderKey: 'admin.studyPeriod.fields.desc.placeholder' },
  ],
};
