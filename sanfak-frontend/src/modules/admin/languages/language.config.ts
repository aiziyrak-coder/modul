import type { ReferenceConfig } from '../lib/reference-crud/types';
import { titleDescColumns } from '../lib/reference-crud/columns';

export const languageConfig: ReferenceConfig = {
  section: 'languageOfInstruction',
  root: '/language-of-instruction',
  basePath: '/admin/languages',
  labels: {
    listTitleKey: 'admin.language.listTitle',
    newButtonKey: 'admin.language.newButton',
    createTitleKey: 'admin.language.createTitle',
    editTitleKey: 'admin.language.editTitle',
    searchPlaceholderKey: 'admin.language.searchPlaceholder',
  },
  columns: titleDescColumns('admin.language.columns.title'),
  fields: [
    { name: 'title', labelKey: 'admin.language.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.language.fields.title.placeholder' },
  ],
};
