jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#references/group/group.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const GroupModel = require("#references/group/group.model");

Workload.calculateBlockTotal =
  jest.requireActual("#modules/4.02-studyLoad/workload/workload.model")
    .calculateBlockTotal;

const Controller = require("./workloadDistribution.controller");
const {
  calcEntryAuditoriumHour,
} = require("#modules/4.02-studyLoad/_services/workloadValidator");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const ENTRY_B = "111111111111111111111111";
const BLOCK_ID = "cccccccccccccccccccccccc";
const G1 = "111111111111111111111112";
const G2 = "111111111111111111111113";
const G3 = "111111111111111111111114";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const workloadDoc = () => ({
  _id: "wl1",
  directions: [
    {
      blocks: [
        {
          _id: BLOCK_ID,
          section: "Majburiy fanlar",
          type: "lesson",
          science: null,
          course: 2,
          student: 999,
          totalHour: 500,
          studyWork: {
            semester: 3,
            classTypes: [
              { slug: "maruza", title: "Ma'ruza", canonical: "lecture", stream: 2, total: 0 },
              { slug: "seminar", title: "Seminar", stream: 0, total: 0 },
              { slug: "amaliy", title: "Amaliy mashg'ulot", canonical: null, stream: 3, total: 0 },
            ],
            items: [
              { slug: "on", title: "ON", value: 0 },
              { slug: "yan", title: "YAN", value: 0 },
            ],
          },
          otherWork: { items: [{ slug: "special", value: 10 }] },
          leadership: 5,
        },
      ],
    },
  ],
});

const distDoc = (existing = [], { residueHour = 1000, otherEntryBlocks = null } = {}) => ({
  _id: DIST_ID,
  status: "draft",
  workload: "wl1",
  residueHour,
  teachers: [
    { _id: ENTRY_ID, blocks: existing },
    ...(otherEntryBlocks ? [{ _id: ENTRY_B, blocks: otherEntryBlocks }] : []),
  ],
});

const callAdd = async (dist, body) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue({});
  WorkloadDistribution.findById = jest
    .fn()
    .mockResolvedValue({ save: jest.fn().mockResolvedValue(undefined) });
  Workload.findById = jest.fn().mockResolvedValue(workloadDoc());
  GroupModel.find = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue([
      { _id: G1, studentNumber: 30 },
      { _id: G2, studentNumber: 25 },
      { _id: G3, studentNumber: 20 },
    ].filter((g) => (body.groups || []).includes(g._id))),
  });
  const res = createRes();
  const next = jest.fn();
  await Controller.addBlockToTeacher(
    { params: { id: DIST_ID, teacherEntryId: ENTRY_ID }, body, scope: {} },
    res,
    next,
  );
  return { res, next };
};
const pushedBlock = () =>
  WorkloadDistribution.findOneAndUpdate.mock.calls[0][1].$push["teachers.$.blocks"];
const errorOf = (next) => next.mock.calls[0] && next.mock.calls[0][0];
const fullScope = { groups: [G1, G2], streams: [{ number: 1, groups: [G1, G2] }] };

describe("ADR-034 — addBlockToTeacher: dars turi kesimi (soat hisobi, SHART #1)", () => {
  afterEach(() => jest.resetAllMocks());

  test("ma'ruza qismi (A, birinchi biriktirish): 2 + skalyar 0 + ma'ruza tabiatli boshqa ish 10 = 12; hosila maydonlar faqat ma'ruza", async () => {
    const { res } = await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["maruza"],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    const block = pushedBlock();
    expect(block.classTypeSlugs).toEqual(["maruza"]);
    expect(block.studyWork.classTypes.map((c) => [c.slug, c.stream, c.total])).toEqual([
      ["maruza", 2, 2],
      ["seminar", 0, 0],
      ["amaliy", 0, 0],
    ]);
    expect(block.studyWork.items.map((it) => it.value)).toEqual([0, 0]);
    expect(block.nonAuditHour).toBe(10);
    expect(block.totalHour).toBe(12);
    expect(block.studyWork.thisSemester.auditoriumHour).toBe(2);
    expect(block.studyWork.thisSemester.teachingAuditoriumHour).toBe(2);
    expect(calcEntryAuditoriumHour({ blocks: [block] })).toBe(2);
  });

  test("amaliy qismi (B, ikkinchi biriktirish, bir xil guruhlar): 6 + YAN 8 + leadership 5 = 19; A + B = 31 (to'liq)", async () => {
    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 12, classTypeSlugs: ["maruza"] },
    ];
    const { res } = await callAdd(distDoc([], { otherEntryBlocks: existing }), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["amaliy"],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    const block = pushedBlock();
    expect(block.classTypeSlugs).toEqual(["amaliy"]);
    expect(block.studyWork.classTypes.map((c) => c.total)).toEqual([0, 0, 6]);
    expect(block.studyWork.items.map((it) => it.value)).toEqual([0, 8]);
    expect(block.nonAuditHour).toBe(5);
    expect(block.totalHour).toBe(19);
    expect(12 + block.totalHour).toBe(31);
    expect(block.studyWork.thisSemester.auditoriumHour).toBe(3);
    expect(block.studyWork.thisSemester.teachingAuditoriumHour).toBe(6);
  });

});

describe("ADR-034 — boshqa ish turlari (nonAuditHour) bo'lingan blokda — «B» qoidasi", () => {
  afterEach(() => jest.resetAllMocks());

  test("TESKARI tartib: avval amaliy (B) → leadership 5; keyin ma'ruza (A) → `special` 10 — A+B yana 31", async () => {
    const first = await callAdd(distDoc([]), { workloadBlockId: BLOCK_ID, ...fullScope, classTypeSlugs: ["amaliy"] });
    expect(first.res.status).toHaveBeenCalledWith(201);
    const b = pushedBlock();
    expect(b.nonAuditHour).toBe(5);
    expect(b.totalHour).toBe(19);
    jest.resetAllMocks();
    const existing = [{ workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 19, classTypeSlugs: ["amaliy"] }];
    const second = await callAdd(distDoc([], { otherEntryBlocks: existing }), {
      workloadBlockId: BLOCK_ID, ...fullScope, classTypeSlugs: ["maruza"],
    });
    expect(second.res.status).toHaveBeenCalledWith(201);
    const a = pushedBlock();
    expect(a.nonAuditHour).toBe(10);
    expect(a.totalHour).toBe(12);
  });

  test("mavjud TO'LIQ ([]) biriktirish boshqa guruhlarda hammasini olgan → bo'lingan qismlarga 0 (ADR-005 saqlanadi)", async () => {
    const existing = [{ workloadBlockId: BLOCK_ID, groups: [G3], totalHour: 31, classTypeSlugs: [] }];
    const { res } = await callAdd(distDoc([], { otherEntryBlocks: existing }), {
      workloadBlockId: BLOCK_ID, ...fullScope, classTypeSlugs: ["maruza"],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(pushedBlock().nonAuditHour).toBe(0);
  });

  test("A ma'ruza (G1,G2) → B TO'LIQ ([], G3) egasi qismini oladi (5) → C amaliy (G1,G2) 0 — yetim yo'q", async () => {
    const afterA = [{ workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 12, classTypeSlugs: ["maruza"] }];
    const b = await callAdd(distDoc([], { otherEntryBlocks: afterA }), {
      workloadBlockId: BLOCK_ID, groups: [G3], streams: [{ number: 1, groups: [G3] }],
    });
    expect(b.res.status).toHaveBeenCalledWith(201);
    expect(pushedBlock().nonAuditHour).toBe(5);
    jest.resetAllMocks();
    const afterB = [...afterA, { workloadBlockId: BLOCK_ID, groups: [G3], totalHour: 13, classTypeSlugs: [] }];
    const c = await callAdd(distDoc([], { otherEntryBlocks: afterB }), {
      workloadBlockId: BLOCK_ID, ...fullScope, classTypeSlugs: ["amaliy"],
    });
    expect(c.res.status).toHaveBeenCalledWith(201);
    expect(pushedBlock().nonAuditHour).toBe(0);
  });

  test("ikki ma'ruza biriktirishi (turli oqimlar): ma'ruza tabiatli qism FAQAT birinchisiga", async () => {
    const existing = [{ workloadBlockId: BLOCK_ID, groups: [G3], totalHour: 12, classTypeSlugs: ["maruza"] }];
    const { res } = await callAdd(distDoc([], { otherEntryBlocks: existing }), {
      workloadBlockId: BLOCK_ID, ...fullScope, classTypeSlugs: ["maruza"],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(pushedBlock().nonAuditHour).toBe(0);
  });
});

describe("ADR-034 — «E»: ma'ruza uchun oqim shart (bo'lingan rejimda)", () => {
  afterEach(() => jest.resetAllMocks());

  test("classTypeSlugs ['maruza'] + faqat groups (oqimsiz) → 400, yozuv yo'q", async () => {
    const { next } = await callAdd(distDoc([]), { workloadBlockId: BLOCK_ID, groups: [G1, G2], classTypeSlugs: ["maruza"] });
    expect(errorOf(next).statusCode).toBe(400);
    expect(errorOf(next).message).toMatch(/Ma'ruza uchun oqim tanlanishi shart/);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("faqat amaliy (oqimsiz) → RUXSAT; bo'linmagan `[]` + faqat groups → avvalgidek RUXSAT (eski xulq)", async () => {
    const a = await callAdd(distDoc([]), { workloadBlockId: BLOCK_ID, groups: [G1, G2], classTypeSlugs: ["amaliy"] });
    expect(a.res.status).toHaveBeenCalledWith(201);
    jest.resetAllMocks();
    const b = await callAdd(distDoc([]), { workloadBlockId: BLOCK_ID, groups: [G1, G2] });
    expect(b.res.status).toHaveBeenCalledWith(201);
    expect(pushedBlock().studyWork.classTypes[0].total).toBe(0);
  });
});

describe("ADR-034 — addBlockToTeacher: `[]` va normalizatsiya (SHART #1, #3)", () => {
  afterEach(() => jest.resetAllMocks());

  test("`[]` / maydon yo'q — BAYT-BAYT eski natija (31), `classTypeSlugs: []` saqlanadi", async () => {
    await callAdd(distDoc([]), { workloadBlockId: BLOCK_ID, ...fullScope });
    const plain = pushedBlock();
    jest.resetAllMocks();
    await callAdd(distDoc([]), { workloadBlockId: BLOCK_ID, ...fullScope, classTypeSlugs: [] });
    const withEmpty = pushedBlock();
    expect(plain.totalHour).toBe(31);
    expect(plain.classTypeSlugs).toEqual([]);
    const stable = (b) => JSON.stringify({ ...b, suitability: { ...b.suitability, computedAt: null } });
    expect(stable(withEmpty)).toBe(stable(plain));
  });

  test("SHART #3: barcha SOATLI turlar tanlansa (maruza + amaliy) → `[]` bilan bir xil (31)", async () => {
    await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["amaliy", "maruza"],
    });
    const block = pushedBlock();
    expect(block.classTypeSlugs).toEqual([]);
    expect(block.totalHour).toBe(31);
  });
});

describe("ADR-034 — addBlockToTeacher: 400 darvozalari (SHART #2, #3)", () => {
  afterEach(() => jest.resetAllMocks());

  test("tur ko'rsatilgan, guruh/oqim YO'Q → 400, yozuv yo'q (SHART #2)", async () => {
    const { next } = await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      classTypeSlugs: ["maruza"],
    });
    expect(errorOf(next).statusCode).toBe(400);
    expect(errorOf(next).message).toBe(
      "Dars turi bo'yicha bo'lish uchun guruh yoki oqim tanlanishi shart",
    );
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("manba blokda yo'q slug → 400; rejada soatsiz tur (seminar, stream 0) → 400", async () => {
    const a = await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["laboratoriya"],
    });
    expect(errorOf(a.next).message).toBe("Dars turi topilmadi / rejalashtirilmagan: laboratoriya");
    jest.resetAllMocks();
    const b = await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["seminar"],
    });
    expect(errorOf(b.next).message).toBe("Dars turi topilmadi / rejalashtirilmagan: seminar");
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("ADR-034 — D27 uchlik (manba blok, guruhlar, dars turlari) — SHART #4", () => {
  afterEach(() => jest.resetAllMocks());
  const lectureExisting = () => [
    { workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 17, classTypeSlugs: ["maruza"] },
  ];

  test("(a) bir xil guruhlar, ma'ruza bor → amaliy — RUXSAT (201)", async () => {
    const { res, next } = await callAdd(distDoc(lectureExisting()), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["amaliy"],
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("(b) bir xil guruhlar, ma'ruza bor → yana ma'ruza — 400, matnda dars turi", async () => {
    const { next } = await callAdd(distDoc(lectureExisting()), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["maruza"],
    });
    expect(errorOf(next).statusCode).toBe(400);
    expect(errorOf(next).message).toBe(
      "Bu blok 2 ta guruh bilan shu dars turlarida (Ma'ruza) allaqachon " +
        "biriktirilgan — o'sha guruhlar soati ikki marta hisoblanadi. Boshqa guruhlarni tanlang.",
    );
  });

});

describe("ADR-034 — D27 uchlik: `[]`, eski yozuv, boshqa guruhlar (SHART #4, davomi)", () => {
  afterEach(() => jest.resetAllMocks());
  const lectureExisting = () => [
    { workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 17, classTypeSlugs: ["maruza"] },
  ];

  test("(c) mavjud TO'LIQ ([]) blok, yangisi ma'ruza — 400 (`[]` hamma tur bilan kesishadi)", async () => {
    const existing = [{ workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 31, classTypeSlugs: [] }];
    const { next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["maruza"],
    });
    expect(errorOf(next).statusCode).toBe(400);
    expect(errorOf(next).message).toContain("shu dars turlarida (Ma'ruza)");
  });

  test("(d) mavjud ma'ruza, yangisi tur ko'rsatilmagan — 400, ESKI matn (o'zgarmagan)", async () => {
    const { next } = await callAdd(distDoc(lectureExisting()), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
    });
    expect(errorOf(next).statusCode).toBe(400);
    expect(errorOf(next).message).toBe(
      "Bu blok 2 ta guruh bilan allaqachon biriktirilgan — o'sha guruhlar soati " +
        "ikki marta hisoblanadi. Boshqa guruhlarni tanlang.",
    );
  });

  test("(e) eski yozuv (`classTypeSlugs` maydoni YO'Q) — hamma tur deb olinadi (400)", async () => {
    const existing = [{ workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 31 }];
    const { next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      ...fullScope,
      classTypeSlugs: ["amaliy"],
    });
    expect(errorOf(next).statusCode).toBe(400);
  });

  test("(f) BOSHQA guruhlar, bir xil tur — avvalgidek RUXSAT", async () => {
    const { res, next } = await callAdd(distDoc(lectureExisting()), {
      workloadBlockId: BLOCK_ID,
      groups: [G3],
      streams: [{ number: 1, groups: [G3] }],
      classTypeSlugs: ["maruza"],
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("ADR-034 — GET /my: `classTypeSlugs ?? []` (.lean() tuzog'i, SHART #7)", () => {
  afterEach(() => jest.resetAllMocks());

  test("bo'lingan blok o'z turi bilan, eski blok (maydonsiz) `[]` bilan keladi", async () => {
    const userId = "eeeeeeeeeeeeeeeeeeeeeeee";
    const docs = [
      {
        _id: DIST_ID,
        academicYear: { title: "2024/2025" },
        course: 2,
        totalHour: 31,
        status: "draft",
        teachers: [
          {
            _id: ENTRY_ID,
            teacher: userId,
            acceptanceStatus: "pending",
            stavka: 1,
            totalHour: 17,
            blocks: [
              { _id: "b1", science: null, course: 2, semester: 1, totalHour: 17, type: "lesson", classTypeSlugs: ["maruza"] },
              { _id: "b0", science: null, course: 2, semester: 1, totalHour: 31, type: "lesson" },
            ],
          },
        ],
      },
    ];
    const chain = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(docs),
    };
    WorkloadDistribution.find = jest.fn().mockReturnValue(chain);
    const res = createRes();
    const next = jest.fn();
    await Controller.getMyDistributions({ user: { _id: userId }, scope: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    const blocks = body[0].myEntries[0].blocks;
    expect(blocks[0].classTypeSlugs).toEqual(["maruza"]);
    expect(blocks[1].classTypeSlugs).toEqual([]);
  });
});
