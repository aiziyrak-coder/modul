import { describe, it, expect } from 'vitest';
import { toCriterionPayload } from './mapper';

const OID_A = '6a7efdac5916905f06cebea6';
const OID_B = '6a7efdac5916905f06cebea7';

type Cat = { id: string; name: string; points: number; active: boolean };
const cat = (id: string, name: string, points = 10): Cat => ({
  id,
  name,
  points,
  active: true,
});

describe('toCriterionPayload — kategoriya `_id`', () => {
  it('MAVJUD kategoriya `_id` bilan yuboriladi', () => {
    const payload = toCriterionPayload({
      name: 'Ilmiy konferensiya',
      categories: [cat(OID_A, 'Xalqaro konferensiya', 30)],
    });
    const cats = payload.categories as Array<Record<string, unknown>>;
    expect(cats[0]?._id).toBe(OID_A);
    expect(cats[0]?.name).toBe('Xalqaro konferensiya');
    expect(cats[0]?.points).toBe(30);
  });

  it('YANGI kategoriyaning vaqtinchalik `CC-…` id si YUBORILMAYDI', () => {
    const payload = toCriterionPayload({
      name: 'Ilmiy konferensiya',
      categories: [cat('CC-1787000000000', 'Yangi kategoriya')],
    });
    const cats = payload.categories as Array<Record<string, unknown>>;
    expect(cats[0]?._id).toBeUndefined();
    expect(cats[0]?.name).toBe('Yangi kategoriya');
  });

  it('aralash ro`yxat: mavjudlar id ni saqlaydi, yangisi id siz ketadi', () => {
    const payload = toCriterionPayload({
      name: 'Ilmiy konferensiya',
      categories: [
        cat(OID_A, 'Xalqaro konferensiya', 30),
        cat(OID_B, 'Respublika konferensiyasi', 15),
        cat('CC-1787000000001', 'Yangi kategoriya', 10),
      ],
    });
    const cats = payload.categories as Array<Record<string, unknown>>;
    expect(cats.map((c) => c._id)).toEqual([OID_A, OID_B, undefined]);
  });

  it('id bo`lmasa ham yiqilmaydi', () => {
    const payload = toCriterionPayload({
      name: 'x',
      categories: [{ name: 'A', points: 5, active: true } as Cat],
    });
    const cats = payload.categories as Array<Record<string, unknown>>;
    expect(cats[0]?._id).toBeUndefined();
  });

  it('kategoriyasiz mezon (`ball`) `maxPoints` ga o`giriladi', () => {
    const payload = toCriterionPayload({ name: 'Ixtiro patenti', ball: 25 });
    expect(payload.maxPoints).toBe(25);
    expect(payload.categories).toEqual([]);
  });
});
