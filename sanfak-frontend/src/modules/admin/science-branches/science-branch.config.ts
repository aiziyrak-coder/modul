import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn } from '../lib/reference-crud/columns';

export const scienceBranchConfig: ReferenceConfig = {
  section: 'scienceBranch',
  root: '/science-branches',
  basePath: '/admin/science-branches',
  labels: {
    listTitleKey: 'admin.scienceBranch.listTitle',
    newButtonKey: 'admin.scienceBranch.newButton',
    createTitleKey: 'admin.scienceBranch.createTitle',
    editTitleKey: 'admin.scienceBranch.editTitle',
    searchPlaceholderKey: 'admin.scienceBranch.searchPlaceholder',
  },
  columns: [
    {
      key: 'code',
      titleKey: 'admin.scienceBranch.columns.code',
      width: 120,
      render: (r) => (r.code ? String(r.code) : '—'),
    },
    { key: 'title', titleKey: 'admin.scienceBranch.columns.title', render: (r) => (r.title ? String(r.title) : '—') },
    dateColumn(),
  ],
  fields: [
    { name: 'code', labelKey: 'admin.scienceBranch.fields.code.label', type: 'text', span: 8, placeholderKey: 'admin.scienceBranch.fields.code.placeholder' },
    {
      name: 'title',
      labelKey: 'admin.scienceBranch.fields.title.label',
      type: 'text',
      required: true,
      span: 16,
      placeholderKey: 'admin.scienceBranch.fields.title.placeholder',
    },
    { name: 'desc', labelKey: 'admin.scienceBranch.fields.desc.label', type: 'textarea', placeholderKey: 'admin.scienceBranch.fields.desc.placeholder' },
  ],
};
