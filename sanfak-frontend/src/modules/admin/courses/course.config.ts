import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const courseConfig: ReferenceConfig = {
  section: 'course',
  root: '/courses',
  basePath: '/admin/courses',
  labels: {
    listTitleKey: 'admin.course.listTitle',
    newButtonKey: 'admin.course.newButton',
    createTitleKey: 'admin.course.createTitle',
    editTitleKey: 'admin.course.editTitle',
    searchPlaceholderKey: 'admin.course.searchPlaceholder',
  },
  columns: titleDescColumns('admin.course.columns.title'),
  fields: [
    { name: 'title', labelKey: 'admin.course.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.course.fields.title.placeholder' },
    { name: 'desc', labelKey: 'admin.course.fields.desc.label', type: 'textarea', placeholderKey: 'admin.course.fields.desc.placeholder' },
  ],
};
