jest.mock("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model", () => ({
  findOne: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve(null) }) })),
}));

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#references/group/group.model");
jest.mock("#references/department/department.model");
jest.mock("#references/direction/direction.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_services/staffPositionsCalculator", () => ({
  buildStaffPositions: jest
    .fn()
    .mockResolvedValue({ items: [], totalPositions: 0, hourly: 0 }),
}));

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
const WorkingScheduleModel = require(
  "#modules/4.02-studyLoad/workingSchedule/workingSchedule.model",
);
const GroupModel = require("#references/group/group.model");
const DirectionModel = require("#references/direction/direction.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { ROLES } = require("#config/constants");
const {
  onGroupStudentCountChange,
} = require("./workloadRecalculator");

const buildBlock = () => ({
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

const buildWorkload = (overrides = {}) => ({
  _id: "wl1",
  status: "draft",
  academicYear: "ay1",
  department: "dep1",
  needsRecalculation: false,
  directions: [{ direction: "dir1", blocks: [buildBlock()] }],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("workloadRecalculator — onGroupStudentCountChange (3 ta bug fix)", () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
    WorkloadDistributionModel.find = jest.fn().mockResolvedValue([]);
    DirectionModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ department: "dep1" }),
      }),
    });
    UserModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  test("direction/course berilmasa — DB'ga tegmasdan null qaytadi", async () => {
    jest.spyOn(WorkloadModel, "find");
    const result = await onGroupStudentCountChange({
      groupId: "g1",
      newCount: 30,
      oldCount: 10,
      direction: null,
      course: 1,
    });
    expect(result).toBeNull();
    expect(WorkloadModel.find).not.toHaveBeenCalled();
  });

  test("BUG #1 fix: to'g'ri yo'ldan (directions.direction) so'ralayotgani", async () => {
    jest.spyOn(WorkloadModel, "find").mockResolvedValue([]);
    await onGroupStudentCountChange({
      groupId: "g1",
      newCount: 30,
      oldCount: 10,
      direction: "dir1",
      course: 1,
    });
    expect(WorkloadModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        "directions.direction": "dir1",
        active: true,
      }),
    );
  });

  test("BUG #2 fix: directions[].blocks[] dan blok topiladi va PURE REBUILD bilan qayta hisoblanadi (ratio emas)", async () => {
    const wl = buildWorkload();
    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);

    await onGroupStudentCountChange({
      groupId: "g1",
      newCount: 30,
      oldCount: 10,
      direction: "dir1",
      course: 1,
      actorUserId: "u1",
    });

    const block = wl.directions[0].blocks[0];
    expect(block.totalHour).toBe(26);
    expect(block.studyWork.group).toBe(2);
    expect(block.studyWork.stream).toBe(1);
    expect(block.student).toBe(30);
    expect(wl.needsRecalculation).toBe(false);
    expect(wl.save).toHaveBeenCalledTimes(1);
  });

  test("ERI qulfi: status='approved' — QAYTA HISOBLANMAYDI, faqat needsRecalculation=true", async () => {
    const wl = buildWorkload({ status: "approved" });
    const before = wl.directions[0].blocks[0].totalHour;
    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);

    await onGroupStudentCountChange({
      groupId: "g1",
      newCount: 30,
      oldCount: 10,
      direction: "dir1",
      course: 1,
    });

    expect(wl.directions[0].blocks[0].totalHour).toBe(before);
    expect(wl.needsRecalculation).toBe(true);
    expect(wl.save).toHaveBeenCalledTimes(1);
    expect(WorkingScheduleModel.find).not.toHaveBeenCalled();
  });

  test("boshqa yo'nalishga tegishli direction blok — tegilmaydi", async () => {
    const wl = buildWorkload();
    wl.directions.push({ direction: "dir-boshqa", blocks: [buildBlock()] });
    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);

    await onGroupStudentCountChange({
      groupId: "g1",
      newCount: 30,
      oldCount: 10,
      direction: "dir1",
      course: 1,
    });

    expect(wl.directions[1].blocks[0].totalHour).toBe(0);
    expect(wl.directions[0].blocks[0].totalHour).toBe(26);
  });

  test("Distribution: needsRecalculation bilan belgilanadi (RATIO bilan yozilmaydi)", async () => {
    const wl = buildWorkload();
    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);
    const dist = {
      _id: "dist1",
      department: "dep1",
      needsRecalculation: false,
      teachers: [{ blocks: [{ course: 1, totalHour: 0 }] }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    WorkloadDistributionModel.find = jest.fn().mockResolvedValue([dist]);

    await onGroupStudentCountChange({
      groupId: "g1",
      newCount: 30,
      oldCount: 10,
      direction: "dir1",
      course: 1,
    });

    expect(dist.needsRecalculation).toBe(true);
    expect(dist.save).toHaveBeenCalledTimes(1);
    expect(dist.teachers[0].blocks[0].totalHour).toBe(0);
  });

  test("BUG #3 fix: role.title (name emas) bilan kafedra mudiri topiladi va bildirishnoma yuboriladi", async () => {
    const wl = buildWorkload();
    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);
    UserModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: "u-mudir", role: { title: ROLES.KAFEDRA_MUDIRI } },
            { _id: "u-boshqa", role: { title: "oqituvchi" } },
          ]),
        }),
      }),
    });

    await onGroupStudentCountChange({
      groupId: "g1",
      newCount: 30,
      oldCount: 10,
      direction: "dir1",
      course: 1,
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-mudir" }),
    );
  });

  test("qoldirilgan: eski (stale) qiymat e'tiborga olinmay, yangi kontingentga qarab qayta hisoblanadi", async () => {
    const wl = buildWorkload();
    wl.directions[0].blocks[0].studyWork.items = [
      { slug: "qoldirilgan", value: 999 },
    ];
    jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);

    await onGroupStudentCountChange({
      groupId: "g1",
      newCount: 30,
      oldCount: 10,
      direction: "dir1",
      course: 1,
      actorUserId: "u1",
    });

    expect(
      wl.directions[0].blocks[0].studyWork.items.find(
        (i) => i.slug === "qoldirilgan",
      ).value,
    ).toBe(3);
  });
});

describe("attachToGroupSchema — findOneAndUpdate shoxi (QA 2026-07-31)", () => {
  const { attachToGroupSchema } = require("./workloadRecalculator");

  const makeSchemaStub = () => {
    const pres = {};
    const posts = {};
    return {
      pre(name, fn) { (pres[name] = pres[name] || []).push(fn); },
      post(name, fn) { (posts[name] = posts[name] || []).push(fn); },
      pres,
      posts,
    };
  };

  test("`findOneAndUpdate` uchun pre VA post hooklari o'rnatiladi", () => {
    const schema = makeSchemaStub();
    attachToGroupSchema(schema);

    expect(schema.pres.findOneAndUpdate).toHaveLength(1);
    expect(schema.posts.findOneAndUpdate).toHaveLength(1);
    expect(schema.pres.save).toHaveLength(1);
    expect(schema.posts.save).toHaveLength(1);
  });

  test("pre-hook eski `studentNumber` ni o'qib oladi", async () => {
    const schema = makeSchemaStub();
    attachToGroupSchema(schema);

    const ctx = {
      getUpdate: () => ({ $set: { studentNumber: 60 } }),
      getQuery: () => ({ _id: "g1" }),
      model: {
        findOne: () => ({
          select: () => ({ lean: async () => ({ studentNumber: 50 }) }),
        }),
      },
    };
    const next = jest.fn();
    await schema.pres.findOneAndUpdate[0].call(ctx, next);

    expect(ctx._oldStudentNumber).toBe(50);
    expect(next).toHaveBeenCalled();
  });

  test("`studentNumber` tegilmasa — umuman aralashmaydi", async () => {
    const schema = makeSchemaStub();
    attachToGroupSchema(schema);

    const ctx = {
      getUpdate: () => ({ $set: { title: "Yangi nom" } }),
      getQuery: () => ({ _id: "g1" }),
      model: { findOne: jest.fn() },
    };
    const next = jest.fn();
    await schema.pres.findOneAndUpdate[0].call(ctx, next);

    expect(ctx._oldStudentNumber).toBeUndefined();
    expect(ctx.model.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe("attachToGroupSchema — timestamps bilan aralash update (QA 2026-07-31)", () => {
  const { attachToGroupSchema } = require("./workloadRecalculator");

  const makeSchemaStub = () => {
    const pres = {};
    const posts = {};
    return {
      pre(name, fn) { (pres[name] = pres[name] || []).push(fn); },
      post(name, fn) { (posts[name] = posts[name] || []).push(fn); },
      pres,
      posts,
    };
  };

  const runPre = async (update) => {
    const schema = makeSchemaStub();
    attachToGroupSchema(schema);
    const ctx = {
      getUpdate: () => update,
      getQuery: () => ({ _id: "g1" }),
      model: {
        findOne: () => ({
          select: () => ({ lean: async () => ({ studentNumber: 50 }) }),
        }),
      },
    };
    await schema.pres.findOneAndUpdate[0].call(ctx, jest.fn());
    return ctx;
  };

  test("TOP-LEVEL `studentNumber` + timestamps `$set` — hook ISHLAYDI", async () => {
    const ctx = await runPre({
      studentNumber: 82,
      $set: { updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    });
    expect(ctx._oldStudentNumber).toBe(50);
  });

  test("`$set` ichidagi `studentNumber` ham qo'llab-quvvatlanadi", async () => {
    const ctx = await runPre({ $set: { studentNumber: 82, updatedAt: new Date() } });
    expect(ctx._oldStudentNumber).toBe(50);
  });

  test("faqat timestamps o'zgarsa — aralashmaydi", async () => {
    const ctx = await runPre({ $set: { updatedAt: new Date() } });
    expect(ctx._oldStudentNumber).toBeUndefined();
  });
});
