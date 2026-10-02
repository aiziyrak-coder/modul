import { describe, it, expect } from 'vitest';
import { mapSource } from './source-mapper';

describe('mapSource', () => {
  it('course populate + fileDetails ni map qiladi', () => {
    const r = mapSource({
      _id: 's1',
      title: 'Kardiologiya qo\'llanma',
      course: { _id: 'c1', title: 'Kardiologiya', form: 1 },
      link: 'https://example.uz/doc',
      file: 'http://x/files/file/qualification-sources/1.pdf',
      fileDetails: { name: 'qollanma.pdf' },
      createdAt: '2026-06-01T00:00:00.000Z',
    });
    expect(r).toEqual({
      id: 's1',
      title: 'Kardiologiya qo\'llanma',
      courseTitle: 'Kardiologiya',
      form: 1,
      link: 'https://example.uz/doc',
      fileUrl: 'http://x/files/file/qualification-sources/1.pdf',
      fileName: 'qollanma.pdf',
      createdAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('course/link/fayl yo\'q bo\'lsa xavfsiz default', () => {
    const r = mapSource({ _id: 's2', title: 'X', file: '' });
    expect(r.courseTitle).toBeUndefined();
    expect(r.link).toBeNull();
    expect(r.fileUrl).toBe('#');
  });
});
