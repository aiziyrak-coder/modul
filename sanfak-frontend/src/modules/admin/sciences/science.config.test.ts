import { describe, it, expect } from 'vitest';
import { scienceConfig } from './science.config';

describe("Fanlar ma'lumotnomasi — «Tanlov fani» belgisi", () => {
  it('formada `isElective` switch maydoni bor', () => {
    const field = scienceConfig.fields.find((f) => f.name === 'isElective');
    expect(field).toMatchObject({ type: 'switch', labelKey: 'admin.science.fields.isElective.label' });
  });

  it("ro'yxatda «Tanlov fani» ustuni: belgili — «Ha», belgisiz (maydoni yo'q eski yozuv ham) — «Yo'q»", () => {
    const column = scienceConfig.columns.find((c) => c.key === 'isElective');
    expect(column?.titleKey).toBe('admin.science.columns.isElective');
    expect(column?.render?.({ id: 's1', isElective: true })).toBe('Ha');
    expect(column?.render?.({ id: 's2', isElective: false })).toBe("Yo'q");
    expect(column?.render?.({ id: 's3' })).toBe("Yo'q");
  });
});
