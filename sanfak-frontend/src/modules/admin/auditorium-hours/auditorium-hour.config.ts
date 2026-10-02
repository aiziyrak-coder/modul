import type { ReferenceConfig } from '../lib/reference-crud/types';
import { dateColumn } from '../lib/reference-crud/columns';

export const auditoriumHourConfig: ReferenceConfig = {
  section: 'auditoriumHour',
  root: '/auditorium-hour',
  basePath: '/admin/auditorium-hours',
  searchable: false,
  labels: {
    listTitleKey: 'admin.auditoriumHour.listTitle',
    newButtonKey: 'admin.auditoriumHour.newButton',
    createTitleKey: 'admin.auditoriumHour.createTitle',
    editTitleKey: 'admin.auditoriumHour.editTitle',
    searchPlaceholderKey: 'admin.auditoriumHour.searchPlaceholder',
  },
  columns: [
    {
      key: 'auditoriumHour',
      titleKey: 'admin.auditoriumHour.columns.auditoriumHour',
      render: (r) => (r.auditoriumHour != null ? String(r.auditoriumHour) : '—'),
    },
    {
      key: 'allowedStakes',
      titleKey: 'admin.auditoriumHour.columns.allowedStakes',
      render: (r) => {
        const v = r.allowedStakes;
        return Array.isArray(v) && v.length > 0 ? v.map(String).join(' · ') : '—';
      },
    },
    dateColumn(),
  ],
  fields: [
    { name: 'auditoriumHour', labelKey: 'admin.auditoriumHour.fields.auditoriumHour.label', type: 'number', required: true, placeholderKey: 'admin.auditoriumHour.fields.auditoriumHour.placeholder' },
    { name: 'allowedStakes', labelKey: 'admin.auditoriumHour.fields.allowedStakes.label', type: 'numberlist', placeholderKey: 'admin.auditoriumHour.fields.allowedStakes.placeholder' },
  ],
};
