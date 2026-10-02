import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn } from '../lib/reference-crud/columns';

export const educationActivityTypeConfig: ReferenceConfig = {
  section: 'educationActivityType',
  root: '/education-activity-types',
  basePath: '/admin/education-activity-types',
  labels: {
    listTitleKey: 'admin.educationActivityType.listTitle',
    newButtonKey: 'admin.educationActivityType.newButton',
    createTitleKey: 'admin.educationActivityType.createTitle',
    editTitleKey: 'admin.educationActivityType.editTitle',
    searchPlaceholderKey: 'admin.educationActivityType.searchPlaceholder',
  },
  columns: [
    { key: 'title', titleKey: 'admin.educationActivityType.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    {
      key: 'flow',
      titleKey: 'admin.educationActivityType.columns.flow',
      width: 160,
      render: (r) => (r.flow ? 'Ha' : "Yo'q"),
    },
    dateColumn(),
  ],
  fields: [
    {
      name: 'title',
      labelKey: 'admin.educationActivityType.fields.title.label',
      type: 'text',
      required: true,
      placeholderKey: 'admin.educationActivityType.fields.title.placeholder',
    },
    {
      name: 'desc',
      labelKey: 'admin.educationActivityType.fields.desc.label',
      type: 'textarea',
      placeholderKey: 'admin.educationActivityType.fields.desc.placeholder',
    },
    {
      name: 'flow',
      labelKey: 'admin.educationActivityType.fields.flow.label',
      type: 'switch',
    },
  ],
};
