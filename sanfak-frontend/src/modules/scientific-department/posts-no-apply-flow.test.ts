import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./pages/**/index.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const read = (name: string) => {
  const entry = Object.entries(sources).find(([p]) => p.includes(`/pages/${name}/`));
  expect(entry, `${name} topilmadi`).toBeDefined();
  return entry![1];
};

describe("e'lonlarda ariza oqimi yo`q", () => {
  it("e'lon kartochkasida tugma YO`Q", () => {
    const src = read('posts');

    expect(src).toContain('recipientText');
    expect(src).not.toContain('applyCode');
    expect(src).not.toContain('posts.apply');
  });

  it("e'lon formasida mutaxassislik maydoni YO`Q", () => {
    const src = read('posts');

    expect(src).toContain('name="recipients"');
    expect(src).not.toContain('specialtyCode');
    expect(src).not.toContain('useOpenSpecialties');
  });

  it('malakaviy imtihon sahifasida avto-ochilish effekti YO`Q', () => {
    const src = read('qualification-exam');

    expect(src).toContain('useApplicantsPaginate');
    expect(src).not.toContain('applyCode');
    expect(src).not.toContain('location.state');
  });
});
