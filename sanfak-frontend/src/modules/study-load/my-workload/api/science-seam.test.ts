import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapMyDistribution, flattenToRows, type BackendMyDistribution } from './mapper';

const backendDoc = (science: Record<string, unknown> | null): BackendMyDistribution => ({
  _id: 'd1',
  academicYear: { _id: 'ay1', title: '2027/2028' },
  course: 2,
  totalHour: 2121,
  status: 'approved',
  date: '28/07/2026',
  myEntries: [
    {
      teacherEntryId: 'e1',
      acceptanceStatus: 'accepted',
      stavka: 1,
      totalHour: 618,
      blocks: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { science: science as any, course: 2, semester: 1, totalHour: 150, type: 'lesson' },
      ],
    },
  ],
});

describe('my-workload — entry id seam (DEFEKT #9)', () => {
  it('backend `teacherEntryId` o`qiladi (`_id` EMAS)', () => {
    const mapped = mapMyDistribution(backendDoc({ _id: 's1', title: 'Ekologiya' }));
    expect(mapped.myEntries[0]?.teacherEntryId).toBe('e1');
    expect(mapped.myEntries[0]?.teacherEntryId).toBeDefined();
  });
});

describe('my-workload — science seam (DEFEKT #5)', () => {
  it('backend `science.title` → `scienceName`', () => {
    const mapped = mapMyDistribution(backendDoc({ _id: 's1', title: 'Ekologiya' }));
    expect(mapped.myEntries[0]?.blocks[0]?.scienceName).toBe('Ekologiya');
  });

  it('`science` bo`lmasa null (UI "—" ko`rsatadi, qulamaydi)', () => {
    const mapped = mapMyDistribution(backendDoc(null));
    expect(mapped.myEntries[0]?.blocks[0]?.scienceName).toBeNull();
  });

  it('ESKI `name` shakli ENDI ishlamaydi — seam `title` ga bog`langan', () => {
    const mapped = mapMyDistribution(backendDoc({ _id: 's1', name: 'Ekologiya' }));
    expect(mapped.myEntries[0]?.blocks[0]?.scienceName).toBeNull();
  });
});

describe('my-workload — qator soati (DEFEKT #6)', () => {
  it('qator BLOK soatini beradi, entry yig`indisini ham alohida saqlaydi', () => {
    const rows = flattenToRows([mapMyDistribution(backendDoc({ _id: 's1', title: 'Ekologiya' }))]);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toBeDefined();
    expect(row?.blockTotalHour).toBe(150);
    expect(row?.entryTotalHour).toBe(618);
  });

  it('jadval ustuni AYNAN `blockTotalHour` ni chiqaradi (ulanish guard`i)', () => {
    const page = readFileSync(
      join(__dirname, '..', 'pages', 'my-workload-list-page.tsx'),
      'utf8',
    );
    const col = page.slice(page.indexOf("id: 'totalHour'"), page.indexOf("id: 'totalHour'") + 600);
    expect(col).toMatch(/row\.original\.blockTotalHour/);
    expect(col).not.toMatch(/row\.original\.entryTotalHour/);
  });
});
