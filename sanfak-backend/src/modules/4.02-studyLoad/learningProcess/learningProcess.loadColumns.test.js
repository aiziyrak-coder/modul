const LearningProcess = require("./learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const Controller = require("./learningProcess.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const liveItems = () => [
  { slug: "soat", title: "soat", canonical: "hour", colNum: 4 },
  { slug: "foiz", title: "%", canonical: "percent", colNum: 5 },
  { slug: "jami", title: "Jami", canonical: "total", colNum: 6 },
  { slug: "maruza", title: "Ma’ruza", canonical: "lecture", colNum: 7 },
  { slug: "amaliy", title: "Amaliy", canonical: "practical", colNum: 8 },
  { slug: "laboratoriya", title: "Laboratoriya", canonical: "laboratory", colNum: 9 },
  { slug: "seminar", title: "Seminar", canonical: "seminar", colNum: 10 },
  { slug: "mustaqil_talim", title: "Mustaqil ta’lim", canonical: "independent", colNum: 12 },
];

const planDoc = (meta) => ({
  _id: "sp1",
  learningProcess: "lp1",
  meta,
  blocks: [
    {
      _id: "b1",
      blockCode: "MF1",
      title: "Majburiy fanlar",
      sciences: [{ _id: "s1", serialNumber: "1.01", code: "FA1", title: "Anatomiya", totalCredit: 4 }],
    },
  ],
});

const call = async (doc) => {
  jest.spyOn(LearningProcess, "findOne").mockReturnValue({
    lean: jest.fn().mockResolvedValue({ _id: "lp1" }),
  });
  jest.spyOn(StudyPlanModel, "findOne").mockReturnValue({
    lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) }),
  });
  const res = createRes();
  await Controller.findAllStudyPlan({ query: { learningProcess: "lp1" }, scope: {} }, res, jest.fn());
  return res.json.mock.calls[0][0];
};

describe("findAllStudyPlan — yuklama ustunlari to'ldiriladi", () => {
  afterEach(() => jest.restoreAllMocks());

  test("8 ustunli jonli hujjat → 10 ustun, Seminardan keyin Klinik o'quv amaliyoti va Kurs ishi", async () => {
    const out = await call(planDoc({ particles: { title: "P", items: liveItems() } }));
    const slugs = out.meta.particles.items.map((i) => i.slug);
    expect(slugs).toEqual([
      "soat",
      "foiz",
      "jami",
      "maruza",
      "amaliy",
      "laboratoriya",
      "seminar",
      "klinik_oquv_amaliyoti",
      "kurs_ishi",
      "mustaqil_talim",
    ]);
    expect(out.meta.particles.items[7].synthetic).toBe(true);
    expect(out.meta.particles.title).toBe("P");
    expect(out.blocks[0].sciences[0].rowType).toBe("subject");
  });

  test("meta.particles yo'q (eski hujjat) → 10 standart ustun; meta yo'q → hujjat o'zgarmaydi", async () => {
    const out = await call(planDoc({}));
    expect(out.meta.particles.items).toHaveLength(10);
    const out2 = await call({ _id: "sp2", learningProcess: "lp1", blocks: [] });
    expect(out2.meta).toBeUndefined();
  });
});
