const {
  withTiebreaker,
  normalizePageParams,
  buildPaginateOptions,
} = require("#shared/paginate");
const { PAGINATION } = require("#config/constants");

describe("withTiebreaker()", () => {
  test("bitta kalitli sort'ga _id shu yo'nalishda qo'shiladi", () => {
    expect(withTiebreaker({ createdAt: -1 })).toEqual({ createdAt: -1, _id: -1 });
  });

  test("ijobiy (asc) yo'nalish ham saqlanadi", () => {
    expect(withTiebreaker({ createdAt: 1 })).toEqual({ createdAt: 1, _id: 1 });
  });

  test("sort allaqachon _id'ni o'z ichiga olsa — o'zgartirilmaydi", () => {
    const sort = { total: -1, assigneeId: 1 };
    expect(withTiebreaker(sort, "assigneeId")).toBe(sort);
  });

  test("boshqa tiebreaker maydoni ko'rsatilsa — o'sha ishlatiladi (masalan _id yo'q pipeline)", () => {
    expect(withTiebreaker({ completedAt: -1 }, "itemId")).toEqual({
      completedAt: -1,
      itemId: -1,
    });
  });

  test("bo'sh/noto'g'ri sort — o'zgarishsiz qaytadi", () => {
    expect(withTiebreaker(undefined)).toBeUndefined();
    expect(withTiebreaker(null)).toBeNull();
    expect(withTiebreaker({})).toEqual({});
  });
});

describe("normalizePageParams()", () => {
  test("to'g'ri page/limit o'zgarishsiz qaytadi", () => {
    expect(normalizePageParams({ page: 3, limit: 20 })).toEqual({ page: 3, limit: 20 });
  });

  test("page=0 — 1ga yumshoq normallashtiriladi (400 EMAS)", () => {
    expect(normalizePageParams({ page: 0, limit: 10 }).page).toBe(1);
  });

  test("manfiy page — 1ga normallashtiriladi", () => {
    expect(normalizePageParams({ page: -5, limit: 10 }).page).toBe(1);
  });

  test("page yo'q/NaN — default page", () => {
    expect(normalizePageParams({ limit: 10 }).page).toBe(PAGINATION.DEFAULT_PAGE);
    expect(normalizePageParams({ page: "abc", limit: 10 }).page).toBe(PAGINATION.DEFAULT_PAGE);
  });

  test("limit=100000 — MAX_LIMIT bilan cheklanadi (D-058d)", () => {
    expect(normalizePageParams({ page: 1, limit: 100000 }).limit).toBe(PAGINATION.MAX_LIMIT);
  });

  test("limit<=0/NaN — default limit", () => {
    expect(normalizePageParams({ page: 1, limit: 0 }).limit).toBe(PAGINATION.DEFAULT_LIMIT);
    expect(normalizePageParams({ page: 1, limit: "x" }).limit).toBe(PAGINATION.DEFAULT_LIMIT);
  });

  test("maxLimit/defaultLimit override qilinsa — o'shalar ishlatiladi", () => {
    expect(
      normalizePageParams({ page: 1, limit: 999 }, { maxLimit: 20 }).limit,
    ).toBe(20);
    expect(
      normalizePageParams({ limit: undefined }, { defaultLimit: 20 }).limit,
    ).toBe(20);
  });
});

describe("buildPaginateOptions()", () => {
  test("normalize + tiebreaker + lean:true birlashtiradi", () => {
    const opts = buildPaginateOptions({ page: 0, limit: 100000 }, { sort: { createdAt: -1 } });
    expect(opts).toEqual({
      page: 1,
      limit: PAGINATION.MAX_LIMIT,
      sort: { createdAt: -1, _id: -1 },
      lean: true,
    });
  });

  test("populate berilsa — options'ga qo'shiladi", () => {
    const populate = [{ path: "author", select: "firstName" }];
    const opts = buildPaginateOptions({ page: 1, limit: 10 }, { populate });
    expect(opts.populate).toBe(populate);
  });
});
