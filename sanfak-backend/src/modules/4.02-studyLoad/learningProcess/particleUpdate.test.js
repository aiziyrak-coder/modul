const mongoose = require("mongoose");
const { planParticleWrites, normalizeItem } = require("./particleUpdate");

const oid = () => new mongoose.Types.ObjectId();

const existingRow = () => {
  const ids = { soat: oid(), maruza: oid(), seminar: oid() };
  return {
    ids,
    particle: [
      { _id: ids.soat, slug: "soat", title: "soat", value: 120 },
      { _id: ids.maruza, slug: "maruza", title: "Ma'ruza", value: 30 },
      { _id: ids.seminar, slug: "seminar", title: "Seminar", value: 30 },
    ],
  };
};

describe("normalizeItem — frontend shakli", () => {
  test("`_id` slug bo'lsa — slug shu, id yo'q", () => {
    expect(normalizeItem({ _id: "soat", soat: 120 })).toEqual({ id: null, slug: "soat", value: 120 });
  });
  test("`_id` ObjectId bo'lsa — id olinadi, slug qiymat kalitidan", () => {
    const id = String(oid());
    expect(normalizeItem({ _id: id, maruza: 12 })).toEqual({ id, slug: "maruza", value: 12 });
  });
  test("bo'sh/buzuq element → null", () => {
    expect(normalizeItem(null)).toBeNull();
    expect(normalizeItem({ _id: "x" })).toBeNull();
  });
});

describe("planParticleWrites", () => {
  test("mavjud slug'lar `_id` bo'yicha $set (frontend `_id: slug` bilan ham)", () => {
    const { ids, particle } = existingRow();
    const plan = planParticleWrites(particle, [
      { _id: "soat", soat: 150 },
      { _id: String(ids.maruza), maruza: "36" },
    ]);
    expect(plan.sets).toEqual([
      { particleId: String(ids.soat), value: 150 },
      { particleId: String(ids.maruza), value: 36 },
    ]);
    expect(plan.pushes).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });

  test("qatorda YO'Q standart ustun (Kurs ishi) qiymat bilan → $push (slug/title/canonical ro'yxatdan)", () => {
    const { particle } = existingRow();
    const plan = planParticleWrites(particle, [{ _id: "kurs_ishi", kurs_ishi: 10 }]);
    expect(plan.sets).toEqual([]);
    expect(plan.pushes).toHaveLength(1);
    expect(plan.pushes[0]).toMatchObject({
      slug: "kurs_ishi",
      title: "Kurs ishi",
      canonical: "courseWork",
      value: 10,
      colNum: null,
    });
    expect(mongoose.isValidObjectId(plan.pushes[0]._id)).toBe(true);
  });

  test("qatorda yo'q standart ustun 0/bo'sh qiymat bilan → hech narsa (jadval bo'sh qoladi)", () => {
    const { particle } = existingRow();
    const plan = planParticleWrites(particle, [
      { _id: "klinik_oquv_amaliyoti", klinik_oquv_amaliyoti: 0 },
      { _id: "kurs_ishi", kurs_ishi: "" },
    ]);
    expect(plan.sets).toEqual([]);
    expect(plan.pushes).toEqual([]);
  });

  test("noma'lum slug → skipped (xato emas)", () => {
    const { particle } = existingRow();
    const plan = planParticleWrites(particle, [{ _id: "boshqa", boshqa: 5 }]);
    expect(plan.skipped).toEqual(["boshqa"]);
    expect(plan.sets).toEqual([]);
    expect(plan.pushes).toEqual([]);
  });

  test("bo'sh kirish → bo'sh reja", () => {
    expect(planParticleWrites(undefined, undefined)).toEqual({ sets: [], pushes: [], skipped: [] });
  });
});
