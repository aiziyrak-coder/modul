import dayjs from 'dayjs';
import type { ReferenceColumn } from './types';
import type { ReferenceRecord } from './reference-types';

export const dateColumn = (titleKey = 'admin.common.dateColumn'): ReferenceColumn => ({
  key: 'date',
  titleKey,
  width: 180,
  render: (r: ReferenceRecord) => {
    const d = (r.date ?? r.createdAt) as string | undefined;
    return d ? dayjs(d).format('DD/MM/YYYY') : '—';
  },
});

export const titleDescColumns = (titleKey: string): ReferenceColumn[] => [
  { key: 'title', titleKey, render: (r) => (r.title ? String(r.title) : '—') },
  dateColumn(),
];

export const refColumn = (key: string, titleKey: string, width?: number): ReferenceColumn => ({
  key,
  titleKey,
  width,
  render: (r) => {
    const v = r[key];
    if (v && typeof v === 'object' && 'title' in (v as Record<string, unknown>)) {
      return String((v as { title: unknown }).title ?? '—');
    }
    return v ? String(v) : '—';
  },
});
