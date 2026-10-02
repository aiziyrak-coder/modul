const { buildFilter } = require("./task.service");

const searchBranch = (filter) => {
  if (filter.$and) return filter.$and[1].$or;
  return filter.$or;
};

describe("buildFilter — `search`", () => {
  test("qism-satr bo'yicha, registrga sezgir emas (anchor YO'Q)", () => {
    const or = searchBranch(buildFilter({}, { search: "hisobot" }));

    expect(or).toEqual([
      { title: { $regex: "hisobot", $options: "i" } },
      { code: { $regex: "hisobot", $options: "i" } },
    ]);
    expect(or[0].title.$regex).not.toMatch(/^\^/);
    expect(or[0].title.$regex).not.toMatch(/\$$/);
  });

  test("bitta harf ham filtr quradi (jadval bo'shab qolmaydi)", () => {
    const or = searchBranch(buildFilter({}, { search: "h" }));
    expect(or[0]).toEqual({ title: { $regex: "h", $options: "i" } });
  });

  test("bosh/oxirgi bo'shliq olib tashlanadi, ichkarisi bittaga siqiladi", () => {
    const or = searchBranch(buildFilter({}, { search: "  yillik   hisobot  " }));
    expect(or[0].title.$regex).toBe("yillik hisobot");
  });

  test("faqat bo'shliqdan iborat so'rov FILTR QO'YMAYDI", () => {
    const filter = buildFilter({}, { search: "   " });
    expect(filter.$or).toBeUndefined();
    expect(filter.$and).toBeUndefined();
  });

  test("bo'sh satr filtr qo'ymaydi (tenglik `\"\"` ga aylanmaydi)", () => {
    expect(buildFilter({}, { search: "" }).$or).toBeUndefined();
  });

  test("regex metakarakterlari qochiriladi — mongod Location51091 bermaydi", () => {
    const BS = String.fromCharCode(92);
    const term = `hisobot (2026) [a+b]${BS}`;
    const or = searchBranch(buildFilter({}, { search: term }));
    const rx = or[0].title.$regex;

    expect(rx).not.toBe(term);
    expect(() => new RegExp(rx)).not.toThrow();
    expect(new RegExp(rx, "i").test(`Yillik ${term} tayyor`)).toBe(true);
  });

  test("kirill registri `i` bayrog'i bilan hal bo'ladi", () => {
    const or = searchBranch(buildFilter({}, { search: "ҲИСОБОТ" }));
    expect(or[0].title.$options).toBe("i");
    expect(new RegExp(or[0].title.$regex, "i").test("йиллик ҳисобот")).toBe(true);
  });

  test("doira `$or`i qidiruv `$or`i bilan almashmaydi (`$and` ostida)", () => {
    const scope = { $or: [{ createdBy: "u1" }, { assignee: "u1" }] };
    const filter = buildFilter(scope, { search: "hisobot" });

    expect(filter.$or).toBeUndefined();
    expect(filter.$and).toHaveLength(2);
    expect(filter.$and[0].$or).toEqual(scope.$or);
    expect(filter.$and[1].$or[0].title.$regex).toBe("hisobot");
  });

  test("bo'shliqli so'rov doira `$or`ini BUZMAYDI", () => {
    const scope = { $or: [{ createdBy: "u1" }, { assignee: "u1" }] };
    const filter = buildFilter(scope, { search: "  " });

    expect(filter.$and).toBeUndefined();
    expect(filter.$or).toEqual(scope.$or);
  });
});
