const {
  backfill,
  buildPatch,
  resolveMeta,
  canonicalMeta,
  isEmptyValue,
  DOC_STATUS,
  AGREEMENT_FIELDS,
  PLAN_SPECIFIC_FIELDS,
} = require("./backfill-scienceprogram-meta");
const {
  META_FIELDS,
  buildScienceProgramMeta,
} = require("#modules/4.02-studyLoad/_services/scienceProgramMeta");

const SCI_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SCI_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const AY_ID = "cccccccccccccccccccccccc";

const particle = () => [
  { slug: "soat", title: "soat", canonical: "hour", value: 180 },
  { slug: "jami", title: "Jami", canonical: "total", value: 120 },
  { slug: "maruza", title: "Ma'ruza", canonical: "lecture", value: 30 },
  { slug: "seminar", title: "Seminar", canonical: "seminar", value: 20 },
  { slug: "amaliy_mashg_ulot", title: "Amaliy", canonical: "practical", value: 60 },
  { slug: "laboratoriya_mashg_uloti", title: "Lab", canonical: "laboratory", value: 10 },
  { slug: "mustaqil_ta_lim", title: "Mustaqil", canonical: "independent", value: 60 },
];

const sciRow = (over = {}) => ({
  science: SCI_A,
  serialNumber: "1.21",
  code: "FA120",
  totalCredit: 4,
  weeklyHours: 6,
  particle: particle(),
  ...over,
});

const wpFixture = (id = "wp1", sciOver = {}) => ({
  _id: id,
  workingSchedule: "ws1",
  semesters: {
    1: {
      blocks: [
        {
          blockCode: "TF2",
          title: "Tanlov fanlari",
          sciences: [sciRow(sciOver)],
        },
      ],
    },
  },
});

const scheduleFixture = () => ({ _id: "ws1", academicYear: AY_ID });

const spgFixture = (over = {}) => ({
  _id: "spg1",
  science: SCI_A,
  workingPlan: null,
  status: "approved",
  weeklyHours: 6,
  ...over,
});

const makeDb = (data) => {
  const calls = { updateOne: 0 };
  const rows = {
    scienceprograms: [],
    workingplans: [],
    workingschedules: [],
    ...data,
  };
  return {
    calls,
    collection(name) {
      return {
        find: () => ({ toArray: async () => rows[name] || [] }),
        updateOne: async () => {
          calls.updateOne += 1;
          return { modifiedCount: 1 };
        },
      };
    },
  };
};

const expectedMeta = (wp = wpFixture()) =>
  buildScienceProgramMeta({
    workingPlan: { ...wp, workingSchedule: scheduleFixture() },
    foundSci: wp.semesters[1].blocks[0].sciences[0],
    foundBlock: wp.semesters[1].blocks[0],
    semesterKey: "1",
  });

describe("backfill-scienceprogram-meta — DRY (default)", () => {
  test("bayroqsiz chaqiruvda DB ga HECH NARSA yozilmaydi", async () => {
    const db = makeDb({
      scienceprograms: [spgFixture()],
      workingplans: [wpFixture()],
      workingschedules: [scheduleFixture()],
    });
    const result = await backfill({ db });

    expect(db.calls.updateOne).toBe(0);
    expect(result.written).toBeNull();
    expect(result.stat[DOC_STATUS.FILLED]).toBe(1);
  });

  test("qulflangan (approved) hujjat alohida sanaladi", async () => {
    const db = makeDb({
      scienceprograms: [spgFixture()],
      workingplans: [wpFixture()],
      workingschedules: [scheduleFixture()],
    });
    const result = await backfill({ db });
    expect(result.stat.lockedTouched).toEqual({ approved: 1 });
  });
});

describe("MERGE — har maydon alohida", () => {
  test("bo'sh maydonlar to'ladi, qiymatlari YAGONA manbadan", () => {
    const meta = expectedMeta();
    const patch = buildPatch(spgFixture(), meta);

    expect(patch.code).toBe(meta.code);
    expect(patch.credits).toBe(meta.credits);
    expect(patch.moduleType).toBe(meta.moduleType);
    expect(patch.classroomHours).toBe(meta.classroomHours);
    expect(patch.hourItems).toEqual(meta.hourItems);
  });

  test("to'ldirilgan weeklyHours (backfill #2) TEGILMAYDI", () => {
    const patch = buildPatch(spgFixture({ weeklyHours: 6 }), expectedMeta());
    expect(patch).not.toHaveProperty("weeklyHours");
  });

  test("qo'lda kiritilgan maydon (credits) TEGILMAYDI", () => {
    const patch = buildPatch(spgFixture({ credits: 99 }), expectedMeta());
    expect(patch).not.toHaveProperty("credits");
  });

  test("`language` HECH QACHON patch'ga tushmaydi", () => {
    const patch = buildPatch(spgFixture(), expectedMeta());
    expect(patch).not.toHaveProperty("language");
    expect(META_FIELDS).not.toContain("language");
  });

  test("yangi qiymat bo'sh bo'lsa — yozilmaydi", () => {
    const meta = { ...expectedMeta(), code: null, hourItems: [] };
    const patch = buildPatch(spgFixture(), meta);
    expect(patch).not.toHaveProperty("code");
    expect(patch).not.toHaveProperty("hourItems");
  });

  test("bo'shlik mezoni: null / undefined / '' / bo'sh massiv", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue("Tanlov")).toBe(false);
  });

  test("idempotent — to'lgan hujjatda patch bo'sh", async () => {
    const meta = expectedMeta();
    const full = { ...spgFixture(), ...meta };
    expect(Object.keys(buildPatch(full, meta))).toHaveLength(0);

    const db = makeDb({
      scienceprograms: [full],
      workingplans: [wpFixture()],
      workingschedules: [scheduleFixture()],
    });
    const result = await backfill({ db });
    expect(result.stat[DOC_STATUS.FILLED]).toBe(0);
    expect(result.stat[DOC_STATUS.ALREADY]).toBe(1);
  });
});

describe("nomzod tanlash va KELISHUV (butun to'plam)", () => {
  const ctx = (wps) => ({
    wpById: new Map(wps.map((w) => [String(w._id), w])),
    allWps: wps,
    scheduleById: new Map([["ws1", scheduleFixture()]]),
    strict: false,
  });

  test("workingPlan ko'rsatkichi bor → to'g'ridan-to'g'ri", () => {
    const wps = [wpFixture()];
    const r = resolveMeta(spgFixture({ workingPlan: "wp1" }), ctx(wps));
    expect(r.status).toBe(DOC_STATUS.FILLED);
    expect(r.via).toBe("direct");
  });

  test("ko'rsatkich yo'q + nomzodlar AYNAN bir xil → kelishuv", () => {
    const wps = [wpFixture("wp1"), wpFixture("wp2")];
    const r = resolveMeta(spgFixture(), ctx(wps));
    expect(r.status).toBe(DOC_STATUS.FILLED);
    expect(r.via).toBe("agreed");
    expect(r.meta.code).toBe("FA120");
  });

  test("BITTA maydon farq qilsa — BUTUN hujjat o'tkazib yuboriladi", () => {
    const wps = [wpFixture("wp1"), wpFixture("wp2", { totalCredit: 6 })];
    const r = resolveMeta(spgFixture(), ctx(wps));
    expect(r.status).toBe(DOC_STATUS.AMBIGUOUS);
    expect(r.meta).toBeUndefined();
  });

  test("`academicYear` kelishuvga KIRMAYDI (reja xossasi) va yozilmaydi", () => {
    const wps = [wpFixture("wp1"), wpFixture("wp2")];
    const scheduleById = new Map([
      ["ws1", { _id: "ws1", academicYear: AY_ID }],
      ["ws2", { _id: "ws2", academicYear: "dddddddddddddddddddddddd" }],
    ]);
    wps[1].workingSchedule = "ws2";

    const r = resolveMeta(spgFixture(), {
      wpById: new Map(wps.map((w) => [String(w._id), w])),
      allWps: wps,
      scheduleById,
      strict: false,
    });
    expect(r.status).toBe(DOC_STATUS.FILLED);
    expect(r.via).toBe("agreed");
    expect(r.meta.academicYear).toBeNull();
    expect(PLAN_SPECIFIC_FIELDS).toEqual(["academicYear"]);
    expect(AGREEMENT_FIELDS).not.toContain("academicYear");
  });

  test("--strict: ko'rsatkichsiz hujjat umuman ishlanmaydi", () => {
    const wps = [wpFixture("wp1"), wpFixture("wp2")];
    const r = resolveMeta(spgFixture(), { ...ctx(wps), strict: true });
    expect(r.status).toBe(DOC_STATUS.NO_POINTER);
  });

  test("birorta rejada fan yo'q → NO_MATCH", () => {
    const r = resolveMeta(spgFixture({ science: SCI_B }), ctx([wpFixture()]));
    expect(r.status).toBe(DOC_STATUS.NO_MATCH);
  });

  test("canonicalMeta ObjectId'ni ham barqaror taqqoslaydi", () => {
    const a = expectedMeta();
    const b = { ...expectedMeta(), academicYear: { toString: () => AY_ID } };
    expect(canonicalMeta(a)).toBe(canonicalMeta(b));
  });
});

describe("academicYear — workingSchedule dan (hydrate)", () => {
  test("KO'RSATKICH BOR: jadval topilsa academicYear ko'chadi", async () => {
    const db = makeDb({
      scienceprograms: [spgFixture({ workingPlan: "wp1" })],
      workingplans: [wpFixture()],
      workingschedules: [scheduleFixture()],
    });
    const result = await backfill({ db });
    expect(result.updates[0].patch.academicYear).toBe(AY_ID);
  });

  test("KELISHUV YO'LI: academicYear yozilmaydi (qaysi reja — noaniq)", async () => {
    const db = makeDb({
      scienceprograms: [spgFixture()],
      workingplans: [wpFixture()],
      workingschedules: [scheduleFixture()],
    });
    const result = await backfill({ db });
    expect(result.updates[0].patch.code).toBe("FA120");
    expect(result.updates[0].patch).not.toHaveProperty("academicYear");
  });

  test("jadval topilmasa academicYear yozilmaydi (mavjud xulq)", async () => {
    const db = makeDb({
      scienceprograms: [spgFixture({ workingPlan: "wp1" })],
      workingplans: [wpFixture()],
      workingschedules: [],
    });
    const result = await backfill({ db });
    expect(result.updates[0].patch).not.toHaveProperty("academicYear");
  });
});
