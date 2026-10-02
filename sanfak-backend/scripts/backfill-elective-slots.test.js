"use strict";

const {
  backfillSemesters,
  insertBlockInPlanOrder,
  globalSemKeyOf,
} = require("./backfill-elective-slots");
const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");

const electivePlanBlock = (over = {}) => ({
  blockCode: "TF2",
  serialNumber: "2",
  code: "TF2",
  title: "Tanlov fanlar",
  totalCredit: 24,
  particle: [
    { slug: "soat", canonical: "hour", title: "soat", value: 720, colNum: 4 },
    { slug: "jami", canonical: "total", title: "Jami", value: 360, colNum: 6 },
    { slug: "mustaqil_talim", canonical: "independent", title: "Mustaqil ta'lim", value: 360, colNum: 12 },
  ],
  semesters: {
    3: { hour: 3, credit: 3 },
    4: { hour: 5, credit: 5 },
    5: { hour: 5, credit: 5 },
    6: { hour: 3, credit: 3 },
    7: { hour: 2, credit: 2 },
    8: { hour: 4, credit: 4 },
    12: { hour: 2, credit: 2 },
  },
  sciences: [],
  ...over,
});

const mandatoryPlanBlock = () => ({
  blockCode: "MF1",
  serialNumber: "1",
  code: "MF1",
  title: "Majburiy fanlar",
  totalCredit: 200,
  particle: [],
  semesters: { 3: { hour: 20, credit: 20 }, 4: { hour: 20, credit: 20 } },
  sciences: [{ serialNumber: "1.01", code: "AN11", title: "Odam anatomiyasi" }],
});

const PLAN_BLOCKS = [mandatoryPlanBlock(), electivePlanBlock()];

const workingSemester = (semKey) => ({
  semester: semKey,
  blocks: [
    {
      blockCode: "MF1",
      serialNumber: "1",
      title: "Majburiy fanlar",
      sciences: [
        { serialNumber: "1.01", title: "Odam anatomiyasi", totalCredit: 6, weeklyHours: 4 },
        { serialNumber: "1.02", title: "Gistologiya", totalCredit: 4, weeklyHours: 3 },
      ],
    },
    {
      blockCode: "MA",
      serialNumber: null,
      title: "Malakaviy amaliyot",
      sciences: [{ serialNumber: null, title: "Ishlab chiqarish amaliyoti", totalCredit: 3, weeklyHours: 0 }],
    },
  ],
});

const course2Semesters = () => new Map([["1", workingSemester("1")], ["2", workingSemester("2")]]);

const blockOf = (semesters, semKey, code) =>
  semesters.get(semKey).blocks.find((b) => b.blockCode === code);
const slotsOf = (semesters, semKey, code) =>
  (blockOf(semesters, semKey, code)?.sciences || []).filter((s) => s.title === EMPTY_SLOT_TITLE);

describe("globalSemKeyOf — kurs ichidagi semestr → global kalit", () => {
  test.each([
    [1, "1", "1"],
    [1, "2", "2"],
    [2, "1", "3"],
    [2, "2", "4"],
    [6, "2", "12"],
  ])("kurs %s, ichki %s → global %s", (course, local, expected) => {
    expect(globalSemKeyOf(course, local)).toBe(expected);
  });
});

describe("backfillSemesters — kvota bor, blok yo'q (asosiy holat)", () => {
  test("ikkala semestrga bittadan slot qo'shiladi (kvota 3 va 5 kredit)", () => {
    const semesters = course2Semesters();
    const { added, changed } = backfillSemesters(semesters, PLAN_BLOCKS, 2);

    expect(changed).toBe(true);
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({ semKey: "1", globalSemKey: "3", blockCode: "TF2", credit: 3, hour: 3, createdBlock: true });
    expect(added[1]).toMatchObject({ semKey: "2", globalSemKey: "4", blockCode: "TF2", credit: 5, hour: 5, createdBlock: true });
  });

  test("slot qatori — nomi, bo'sh identiteti va soat taqsimoti (kredit×30, hafta×15)", () => {
    const semesters = course2Semesters();
    backfillSemesters(semesters, PLAN_BLOCKS, 2);
    const [slot] = slotsOf(semesters, "1", "TF2");

    expect(slot).toMatchObject({ title: EMPTY_SLOT_TITLE, science: null, code: null, department: null, totalCredit: 3, weeklyHours: 3 });
    const value = (canonical) => slot.particle.find((p) => p.canonical === canonical)?.value;
    expect(value("hour")).toBe(90);
    expect(value("total")).toBe(45);
    expect(value("independent")).toBe(45);
  });

  test("blok REJA TARTIBIDA joylashadi: MF1 → TF2 → MA (oxiriga emas)", () => {
    const semesters = course2Semesters();
    backfillSemesters(semesters, PLAN_BLOCKS, 2);
    expect(semesters.get("1").blocks.map((b) => b.blockCode)).toEqual(["MF1", "TF2", "MA"]);
  });

  test("blok sarlavhasi manba rejadan ko'chadi", () => {
    const semesters = course2Semesters();
    backfillSemesters(semesters, PLAN_BLOCKS, 2);
    expect(blockOf(semesters, "1", "TF2")).toMatchObject({ blockCode: "TF2", code: "TF2", serialNumber: "2", title: "Tanlov fanlar" });
  });
});

describe("backfillSemesters — mavjud ishga TEGMAYDI", () => {
  test("MF1 va MA bloklari (qatorlar, seriallar, matnlar) o'zgarmaydi", () => {
    const semesters = course2Semesters();
    const before = JSON.parse(JSON.stringify(semesters.get("1").blocks.filter((b) => b.blockCode !== "TF2")));
    backfillSemesters(semesters, PLAN_BLOCKS, 2);
    const after = semesters.get("1").blocks.filter((b) => b.blockCode !== "TF2");
    expect(after).toEqual(before);
  });

  test("majburiy blok (MF1) hech qachon slot olmaydi", () => {
    const semesters = course2Semesters();
    backfillSemesters(semesters, PLAN_BLOCKS, 2);
    expect(slotsOf(semesters, "1", "MF1")).toHaveLength(0);
    expect(slotsOf(semesters, "2", "MF1")).toHaveLength(0);
  });

  test("semestr hujjatda bo'lmasa — YARATILMAYDI", () => {
    const semesters = new Map([["1", workingSemester("1")]]);
    backfillSemesters(semesters, PLAN_BLOCKS, 2);
    expect([...semesters.keys()]).toEqual(["1"]);
  });
});

describe("backfillSemesters — idempotentlik va kvota yo'qligi", () => {
  test("ikkinchi yurgizish 0 ta o'zgarish beradi", () => {
    const semesters = course2Semesters();
    backfillSemesters(semesters, PLAN_BLOCKS, 2);
    const second = backfillSemesters(semesters, PLAN_BLOCKS, 2);
    expect(second).toEqual({ added: [], changed: false });
    expect(slotsOf(semesters, "1", "TF2")).toHaveLength(1);
  });

  test("legacy bo'sh slot allaqachon bo'lsa — tegilmaydi (dublikat yo'q)", () => {
    const semesters = course2Semesters();
    semesters.get("1").blocks.push({
      blockCode: "TF2",
      title: "Tanlov fanlar",
      sciences: [{ serialNumber: null, title: EMPTY_SLOT_TITLE, science: null, code: null, particle: [], totalCredit: 3, weeklyHours: 3 }],
    });
    const { added } = backfillSemesters(semesters, PLAN_BLOCKS, 2);
    expect(added.filter((a) => a.semKey === "1")).toHaveLength(0);
    expect(slotsOf(semesters, "1", "TF2")).toHaveLength(1);
  });

  test("kvotasiz kurs (1-kurs = global 1–2) — hech nima qo'shilmaydi", () => {
    const semesters = course2Semesters();
    const { added, changed } = backfillSemesters(semesters, PLAN_BLOCKS, 1);
    expect(changed).toBe(false);
    expect(added).toHaveLength(0);
    expect(semesters.get("1").blocks.map((b) => b.blockCode)).toEqual(["MF1", "MA"]);
  });

  test("o'quv rejada tanlov bloki bo'lmasa — hech nima qo'shilmaydi", () => {
    const semesters = course2Semesters();
    const { changed } = backfillSemesters(semesters, [mandatoryPlanBlock()], 2);
    expect(changed).toBe(false);
  });
});

describe("backfillSemesters — mavjud TF2 blokidagi qoldiq kvota", () => {
  const planWithOneElective = () => [
    mandatoryPlanBlock(),
    electivePlanBlock({
      sciences: [
        { serialNumber: "2.01", code: "TF001", title: "Tibbiy statistika", semesters: { 3: { hour: 2, credit: 2 } } },
      ],
    }),
  ];

  test("blok bor, slot yo'q — qoldiq kvota bo'yicha slot qo'shiladi", () => {
    const semesters = course2Semesters();
    semesters.get("1").blocks.splice(1, 0, {
      blockCode: "TF2",
      title: "Tanlov fanlar",
      sciences: [{ serialNumber: "2.01", title: "Tibbiy statistika", totalCredit: 2, weeklyHours: 2 }],
    });
    const { added } = backfillSemesters(semesters, planWithOneElective(), 2);

    const first = added.find((a) => a.semKey === "1");
    expect(first).toMatchObject({ blockCode: "TF2", credit: 1, hour: 1, createdBlock: false });
    expect(blockOf(semesters, "1", "TF2").sciences.map((s) => s.title)).toEqual(["Tibbiy statistika", EMPTY_SLOT_TITLE]);
  });

  test("slot seriali mavjud qatorlardan keyingi raqam (`2.02`)", () => {
    const semesters = course2Semesters();
    semesters.get("1").blocks.push({
      blockCode: "TF2",
      serialNumber: "2",
      title: "Tanlov fanlar",
      sciences: [{ serialNumber: "2.01", title: "Tibbiy statistika", totalCredit: 2, weeklyHours: 2 }],
    });
    backfillSemesters(semesters, planWithOneElective(), 2);
    expect(slotsOf(semesters, "1", "TF2")[0].serialNumber).toBe("2.02");
  });
});

describe("insertBlockInPlanOrder", () => {
  const newTf2 = () => ({ blockCode: "TF2", sciences: [] });

  test("rejada yo'q blok (MA) har doim oxirda qoladi", () => {
    const blocks = [{ blockCode: "MA" }];
    insertBlockInPlanOrder(blocks, newTf2(), PLAN_BLOCKS);
    expect(blocks.map((b) => b.blockCode)).toEqual(["TF2", "MA"]);
  });

  test("bo'sh semestrga qo'yilsa — yagona blok bo'ladi", () => {
    const blocks = [];
    insertBlockInPlanOrder(blocks, newTf2(), PLAN_BLOCKS);
    expect(blocks.map((b) => b.blockCode)).toEqual(["TF2"]);
  });

  test("oldingi bloklardan keyin (MF1 dan keyin) qo'yiladi", () => {
    const blocks = [{ blockCode: "MF1" }];
    insertBlockInPlanOrder(blocks, newTf2(), PLAN_BLOCKS);
    expect(blocks.map((b) => b.blockCode)).toEqual(["MF1", "TF2"]);
  });
});
