jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#references/group/group.model");
jest.mock("#modules/4.02-studyLoad/_services/staffPositionsCalculator", () => ({
  buildStaffPositions: jest
    .fn()
    .mockResolvedValue({ items: [], totalPositions: 0, hourly: 0 }),
}));
jest.mock("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model", () => ({
  findOne: jest.fn(),
}));

const ContingentModel = require("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model");
const contingentReturns = (doc) =>
  ContingentModel.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(doc) }) });
const WorkloadModel = require("./workload.model");
const WorkingScheduleModel = require(
  "#modules/4.02-studyLoad/workingSchedule/workingSchedule.model",
);
const GroupModel = require("#references/group/group.model");
const Controller = require("./workload.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildDraftBlock = () => ({
  section: "s1",
  type: "lesson",
  science: null,
  course: 1,
  student: 0,
  studyWork: {
    group: 0,
    stream: 0,
    semester: 1,
    thisSemester: { totalHour: 0, auditoriumHour: 0 },
    classTypes: [
      { slug: "maruza", stream: 10, total: 0 },
      { slug: "amaliy", stream: 5, total: 0 },
    ],
    items: [{ slug: "malakaviy", value: 2 }],
  },
  otherWork: { items: [{ slug: "qabul", value: 3 }] },
  leadership: 1,
  totalHour: 0,
});

const buildDraftWorkload = () => ({
  _id: "draft1",
  status: "draft",
  department: "dep1",
  academicYear: "ay1",
  needsRecalculation: false,
  directions: [
    { direction: "dir1", blocks: [buildDraftBlock()] },
  ],
  save: jest.fn().mockResolvedValue(undefined),
});

const buildApprovedWorkload = () => ({
  _id: "approved1",
  status: "approved",
  department: "dep1",
  academicYear: "ay1",
  needsRecalculation: false,
  directions: [
    {
      direction: "dir2",
      blocks: [{ ...buildDraftBlock(), totalHour: 999 }],
    },
  ],
  save: jest.fn().mockResolvedValue(undefined),
});

describe("REGRESSION-GUARD — recalculateBulk (directions[].blocks[], ERI qulfi, scope)", () => {
  let draftWl;
  let approvedWl;

  beforeEach(() => {
    jest.clearAllMocks();
    draftWl = buildDraftWorkload();
    approvedWl = buildApprovedWorkload();

    jest.spyOn(WorkloadModel, "find").mockResolvedValue([draftWl, approvedWl]);

    WorkingScheduleModel.find = jest.fn().mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue([
          { _id: "ws1", currentCourse: 1, groups: ["g1", "g2"] },
        ]),
    });
    GroupModel.find = jest
      .fn()
      .mockResolvedValue([
        { studentNumber: 20, lang: "l1" },
        { studentNumber: 10, lang: "l1" },
      ]);
    contingentReturns(null);
  });

  test("draft: to'g'ri yo'ldan (directions[].blocks[]) blok topiladi va qayta hisoblanadi", async () => {
    const req = { body: { all: true }, scope: {}, user: { _id: "u1" } };
    const res = createRes();
    await Controller.recalculateBulk(req, res, jest.fn());

    const block = draftWl.directions[0].blocks[0];
    expect(block.totalHour).toBe(26);
    expect(block.studyWork.group).toBe(2);
    expect(block.studyWork.stream).toBe(1);
    expect(block.student).toBe(30);
    expect(draftWl.needsRecalculation).toBe(false);
    expect(draftWl.save).toHaveBeenCalledTimes(1);
    expect(ContingentModel.findOne).toHaveBeenCalledWith({ department: "dep1", academicYear: "ay1", active: true });
    expect(res.json.mock.calls[0][0].warnings).toEqual([]);
  });

  test("approved: QAYTA HISOBLANMAYDI — totalHour o'zgarmaydi, faqat needsRecalculation=true", async () => {
    const req = { body: { all: true }, scope: {}, user: { _id: "u1" } };
    const res = createRes();
    await Controller.recalculateBulk(req, res, jest.fn());

    const block = approvedWl.directions[0].blocks[0];
    expect(block.totalHour).toBe(999);
    expect(approvedWl.needsRecalculation).toBe(true);
    expect(approvedWl.save).toHaveBeenCalledTimes(1);
    expect(WorkingScheduleModel.find).not.toHaveBeenCalledWith(
      expect.objectContaining({ direction: "dir2" }),
    );
  });

  test("scope: req.scope filtrga qo'shiladi (department-scoped foydalanuvchi)", async () => {
    const req = {
      body: { all: true },
      scope: { department: "dep1" },
      user: { _id: "u1" },
    };
    await Controller.recalculateBulk(req, createRes(), jest.fn());

    expect(WorkloadModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, department: "dep1" }),
    );
  });

  test("body bo'sh bo'lsa — 400 (workloadIds/needsRecalculation/all majburiy)", async () => {
    const next = jest.fn();
    await Controller.recalculateBulk(
      { body: {}, scope: {}, user: { _id: "u1" } },
      createRes(),
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(WorkloadModel.find).not.toHaveBeenCalled();
  });
});

describe("recalculateBulk — kontingent kurs bo'yicha ajratiladi", () => {
  test("1- va 3-kurs bloklari HAR BIRI o'z kohortasining kontingentini oladi", async () => {
    const b1 = { ...buildDraftBlock(), course: 1 };
    const b3 = { ...buildDraftBlock(), course: 3 };
    const wl = {
      _id: "multi1",
      status: "draft",
      academicYear: "ay1",
      needsRecalculation: false,
      directions: [{ direction: "dir1", blocks: [b1, b3] }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);

    WorkingScheduleModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([
        { _id: "ws-k1", currentCourse: 1, groups: ["g1", "g2"] },
        { _id: "ws-k3", currentCourse: 3, groups: [] },
      ]),
    });
    GroupModel.find = jest.fn().mockResolvedValue([
      { studentNumber: 15, lang: "uz" },
      { studentNumber: 15, lang: "uz" },
    ]);

    await Controller.recalculateBulk(
      { body: { workloadIds: ["multi1"] }, user: { _id: "u1" }, scope: {} },
      createRes(),
      jest.fn(),
    );

    expect(b1.student).toBe(30);
    expect(b1.studyWork.group).toBe(2);
    expect(b1.totalHour).toBeGreaterThan(0);

    expect(b3.student).toBe(0);
    expect(b3.studyWork.group).toBe(0);

    expect(b3.totalHour).toBe(6);
    expect(b3.totalHour).toBeLessThan(b1.totalHour);
  });
});

describe("recalculateBulk — SHART #4c: qo'lda kiritilgan 4 maydon TEGILMAYDI", () => {
  test("classTypes[].stream / items[].value (auto-slug EMAS) / otherWork.items[].value / leadership — draft recalc'dan keyin ham AYNAN saqlanadi", async () => {
    const block = buildDraftBlock();
    block.studyWork.classTypes = [
      { slug: "maruza", stream: 17, total: 0 },
      { slug: "amaliy", stream: 9, total: 0 },
    ];
    block.studyWork.items = [{ slug: "malakaviy", value: 6 }];
    block.otherWork = { items: [{ slug: "qabul", value: 8 }] };
    block.leadership = 4;

    const wl = {
      _id: "lockcheck1",
      status: "draft",
      academicYear: "ay1",
      needsRecalculation: false,
      directions: [{ direction: "dir1", blocks: [block] }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);
    WorkingScheduleModel.find = jest.fn().mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue([
          { _id: "ws1", currentCourse: 1, groups: ["g1", "g2"] },
        ]),
    });
    GroupModel.find = jest
      .fn()
      .mockResolvedValue([
        { studentNumber: 20, lang: "l1" },
        { studentNumber: 10, lang: "l1" },
      ]);

    await Controller.recalculateBulk(
      { body: { workloadIds: ["lockcheck1"] }, scope: {}, user: { _id: "u1" } },
      createRes(),
      jest.fn(),
    );

    expect(block.studyWork.classTypes[0].stream).toBe(17);
    expect(block.studyWork.classTypes[1].stream).toBe(9);
    expect(block.studyWork.items[0].value).toBe(6);
    expect(block.otherWork.items[0].value).toBe(8);
    expect(block.leadership).toBe(4);

    expect(block.student).toBe(30);
    expect(block.studyWork.group).toBe(2);
    expect(block.studyWork.stream).toBe(1);
  });
});

describe("recalculateBulk — ON/YAN kontingent o'zgarganda QAYTA HISOBLANADI", () => {
  test("eski (stale) ON/YAN qiymati e'tiborga olinmay, yangi kontingentga qarab qayta hisoblanadi", async () => {
    const block = buildDraftBlock();
    block.studyWork.classTypes = [{ slug: "maruza", stream: 90, total: 0 }];
    block.studyWork.items = [
      { slug: "on", value: 999 },
      { slug: "yan", value: 999 },
    ];
    block.otherWork = { items: [] };
    block.leadership = 0;

    const wl = {
      _id: "onyanrecalc1",
      status: "draft",
      academicYear: "ay1",
      needsRecalculation: false,
      directions: [{ direction: "dir1", blocks: [block] }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);
    WorkingScheduleModel.find = jest.fn().mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue([
          { _id: "ws1", currentCourse: 1, groups: ["g1", "g2"] },
        ]),
    });
    GroupModel.find = jest
      .fn()
      .mockResolvedValue([
        { studentNumber: 20, lang: "l1" },
        { studentNumber: 10, lang: "l1" },
      ]);

    await Controller.recalculateBulk(
      { body: { workloadIds: ["onyanrecalc1"] }, scope: {}, user: { _id: "u1" } },
      createRes(),
      jest.fn(),
    );

    expect(block.studyWork.items.find((i) => i.slug === "on").value).toBe(6);
    expect(block.studyWork.items.find((i) => i.slug === "yan").value).toBe(5);
  });

  test("`overridden` belgilangan ON/YAN — recalc uni BOSIB O'TMAYDI", async () => {
    const block = buildDraftBlock();
    block.studyWork.classTypes = [{ slug: "maruza", stream: 90, total: 0 }];
    block.studyWork.items = [
      { slug: "on", value: 42, overridden: true },
      { slug: "yan", value: 999 },
    ];
    block.otherWork = { items: [] };
    block.leadership = 0;

    const wl = {
      _id: "onyanoverride1",
      status: "draft",
      academicYear: "ay1",
      needsRecalculation: false,
      directions: [{ direction: "dir1", blocks: [block] }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);
    WorkingScheduleModel.find = jest.fn().mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue([
          { _id: "ws1", currentCourse: 1, groups: ["g1", "g2"] },
        ]),
    });
    GroupModel.find = jest
      .fn()
      .mockResolvedValue([
        { studentNumber: 20, lang: "l1" },
        { studentNumber: 10, lang: "l1" },
      ]);

    await Controller.recalculateBulk(
      {
        body: { workloadIds: ["onyanoverride1"] },
        scope: {},
        user: { _id: "u1" },
      },
      createRes(),
      jest.fn(),
    );

    expect(block.studyWork.items.find((i) => i.slug === "on").value).toBe(42);
    expect(block.studyWork.items.find((i) => i.slug === "yan").value).toBe(5);
  });
});

describe("recalculateBulk — qoldirilgan kontingent o'zgarganda QAYTA HISOBLANADI", () => {
  test("eski (stale) qoldirilgan qiymati e'tiborga olinmay, yangi kontingentga qarab qayta hisoblanadi", async () => {
    const block = buildDraftBlock();
    block.studyWork.classTypes = [{ slug: "maruza", stream: 90, total: 0 }];
    block.studyWork.items = [{ slug: "qoldirilgan", value: 999 }];
    block.otherWork = { items: [] };
    block.leadership = 0;

    const wl = {
      _id: "qoldirilganrecalc1",
      status: "draft",
      academicYear: "ay1",
      needsRecalculation: false,
      directions: [{ direction: "dir1", blocks: [block] }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);
    WorkingScheduleModel.find = jest.fn().mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue([
          { _id: "ws1", currentCourse: 1, groups: ["g1", "g2"] },
        ]),
    });
    GroupModel.find = jest
      .fn()
      .mockResolvedValue([
        { studentNumber: 20, lang: "l1" },
        { studentNumber: 10, lang: "l1" },
      ]);

    await Controller.recalculateBulk(
      { body: { workloadIds: ["qoldirilganrecalc1"] }, scope: {}, user: { _id: "u1" } },
      createRes(),
      jest.fn(),
    );

    expect(
      block.studyWork.items.find((i) => i.slug === "qoldirilgan").value,
    ).toBe(3);
  });

  test("`overridden` belgilangan qoldirilgan — recalc uni BOSIB O'TMAYDI", async () => {
    const block = buildDraftBlock();
    block.studyWork.classTypes = [{ slug: "maruza", stream: 90, total: 0 }];
    block.studyWork.items = [
      { slug: "qoldirilgan", value: 42, overridden: true },
    ];
    block.otherWork = { items: [] };
    block.leadership = 0;

    const wl = {
      _id: "qoldirilganoverride1",
      status: "draft",
      academicYear: "ay1",
      needsRecalculation: false,
      directions: [{ direction: "dir1", blocks: [block] }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);
    WorkingScheduleModel.find = jest.fn().mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue([
          { _id: "ws1", currentCourse: 1, groups: ["g1", "g2"] },
        ]),
    });
    GroupModel.find = jest
      .fn()
      .mockResolvedValue([
        { studentNumber: 20, lang: "l1" },
        { studentNumber: 10, lang: "l1" },
      ]);

    await Controller.recalculateBulk(
      {
        body: { workloadIds: ["qoldirilganoverride1"] },
        scope: {},
        user: { _id: "u1" },
      },
      createRes(),
      jest.fn(),
    );

    expect(
      block.studyWork.items.find((i) => i.slug === "qoldirilgan").value,
    ).toBe(42);
  });
});
