import { describe, expect, it } from 'vitest';
import { mapCourseType } from './course-type-mapper';

describe('mapCourseType', () => {
  it('maps _id → id, kind 1 → sertifikat, template', () => {
    const r = mapCourseType({
      _id: 'ct-1',
      title: 'Sertifikat (72 soat)',
      kind: 1,
      template: 2,
    });
    expect(r.id).toBe('ct-1');
    expect(r.docKind).toBe('sertifikat');
    expect(r.template).toBe(2);
  });

  it('maps kind 2 → malumotnoma and defaults template to 1', () => {
    const r = mapCourseType({ _id: 'ct-2', title: "Ma'lumotnoma", kind: 2 });
    expect(r.docKind).toBe('malumotnoma');
    expect(r.template).toBe(1);
  });

  it('falls back to sertifikat for unknown kind and clamps bad template to 1', () => {
    const r = mapCourseType({ _id: 'ct-3', title: 'X', kind: 9, template: 7 });
    expect(r.docKind).toBe('sertifikat');
    expect(r.template).toBe(1);
  });
});
