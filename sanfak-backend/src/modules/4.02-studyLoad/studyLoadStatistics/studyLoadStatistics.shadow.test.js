const { shadowedIds, excludeShadow, DISTRIBUTION_GROUP } = require("./studyLoadStatistics.shadow");

const Model = (rows) => ({ aggregate: jest.fn().mockResolvedValue(rows) });

describe("shadowedIds (D-12)", () => {
  test("guruhda approved bor — shu guruhdagi draft/in_review chiqariladi", async () => {
    const M = Model([
      { _id: { department: "d1" }, docs: [{ id: "v1", status: "approved" }, { id: "v2", status: "draft" }] },
      { _id: { department: "d2" }, docs: [{ id: "x1", status: "in_review" }] },
    ]);
    expect(await shadowedIds(M, { active: true }, ["department", "academicYear"])).toEqual(["v2"]);
  });

  test("so'rov: superseded chiqariladi, guruh kaliti maydonlardan", async () => {
    const M = Model([]);
    await shadowedIds(M, { active: true, academicYear: "ay" }, DISTRIBUTION_GROUP);
    const [pipeline] = M.aggregate.mock.calls[0];
    expect(pipeline[0].$match).toEqual({ active: true, academicYear: "ay", status: { $ne: "superseded" } });
    expect(pipeline[1].$group._id).toEqual({
      department: "$department",
      academicYear: "$academicYear",
      course: "$course",
    });
  });

  test("approved yo'q guruh (yangi kafedra, faqat qoralama) — sanaladi, chiqarilmaydi", async () => {
    const M = Model([{ _id: {}, docs: [{ id: "a", status: "draft" }, { id: "b", status: "rejected" }] }]);
    expect(await shadowedIds(M, {}, ["department"])).toEqual([]);
  });
});

describe("excludeShadow", () => {
  test("ro'yxat bor — `_id $nin`; bo'sh — filtr o'zgarmaydi", () => {
    expect(excludeShadow({ active: true }, ["v2"])).toEqual({ active: true, _id: { $nin: ["v2"] } });
    expect(excludeShadow({ active: true }, [])).toEqual({ active: true });
  });
});
