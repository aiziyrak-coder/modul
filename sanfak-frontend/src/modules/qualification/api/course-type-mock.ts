import type { Paginated } from '@/shared/api';
import type { BackendCourseType } from './course-type-mapper';
import type { CourseTypeInput } from '../model/course-type.types';
import { DOC_TO_KIND } from '../model/course-type.types';

let items: BackendCourseType[] = [
  { _id: 'ct-1', title: 'Malaka oshirish (72 soat)', kind: 1, template: 1, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-01-10T09:00:00Z' },
  { _id: 'ct-2', title: 'Malaka oshirish (144 soat)', kind: 1, template: 2, createdAt: '2026-01-12T09:00:00Z', updatedAt: '2026-01-12T09:00:00Z' },
  { _id: 'ct-3', title: 'Qayta tayyorlash (504 soat)', kind: 2, template: 1, createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-01-15T09:00:00Z' },
  { _id: 'ct-4', title: 'Qisqa muddatli kurs (36 soat)', kind: 2, template: 3, createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-02-01T09:00:00Z' },
];

let seq = items.length + 1;
const delay = <T>(value: T, ms = 200): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));

const sorted = (): BackendCourseType[] =>
  [...items].sort((a, b) => ((b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1));

export const courseTypeMock = {
  paginate(filter: { page: number; limit: number; kind?: number }): Promise<Paginated<BackendCourseType>> {
    const all = filter.kind ? sorted().filter((i) => i.kind === filter.kind) : sorted();
    const start = (filter.page - 1) * filter.limit;
    const docs = all.slice(start, start + filter.limit);
    return delay({
      docs,
      totalDocs: all.length,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.max(1, Math.ceil(all.length / filter.limit)),
      hasNextPage: start + filter.limit < all.length,
      hasPrevPage: filter.page > 1,
      nextPage: null,
      prevPage: null,
    });
  },

  create(input: CourseTypeInput): Promise<BackendCourseType> {
    const id = `ct-${seq++}`;
    const now = new Date().toISOString();
    const rec: BackendCourseType = {
      _id: id,
      title: input.title,
      kind: DOC_TO_KIND[input.docKind],
      template: input.template,
      createdAt: now,
      updatedAt: now,
    };
    items = [rec, ...items];
    return delay(rec);
  },

  remove(id: string): Promise<{ message: string }> {
    items = items.filter((i) => i._id !== id);
    return delay({ message: 'ok' });
  },
};
