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
const OTHER_ENTRY_ID = "111111111111111111111111";
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
              { slug: "maruza", canonical: "lecture", stream: 2, total: 0 },
              { slug: "amaliy", canonical: null, stream: 3, total: 0 },
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

const distDoc = (existing = [], { residueHour = 1000 } = {}) => ({
  _id: DIST_ID,
  status: "draft",
  workload: "wl1",
  residueHour,
  teachers: [{ _id: ENTRY_ID, blocks: existing }],
});

const callAdd = async (dist, body, wlDoc = workloadDoc()) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue({});
  WorkloadDistribution.findById = jest
    .fn()
    .mockResolvedValue({ save: jest.fn().mockResolvedValue(undefined) });
  Workload.findById = jest.fn().mockResolvedValue(wlDoc);

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
  WorkloadDistribution.findOneAndUpdate.mock.calls[0][1].$push[
    "teachers.$.blocks"
  ];

describe("workloadDistribution — addBlockToTeacher: skoplangan soat hisobi (ADR-005)", () => {
  afterEach(() => jest.resetAllMocks());

  test("GOLDEN: 2 guruh (55 talaba, 1 oqim) — lecture→oqim, amaliy→guruh, ON/YAN skoplangan", async () => {
    GroupModel.find = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([
          { _id: G1, studentNumber: 30 },
          { _id: G2, studentNumber: 25 },
        ]),
    });

    const { res } = await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      groups: [G1, G2],
      streams: [{ number: 1, groups: [G1, G2] }],
    });

    expect(res.status).toHaveBeenCalledWith(201);
    const block = pushedBlock();

    expect(block.studyWork.classTypes[0].total).toBe(2);
    expect(block.studyWork.classTypes[1].total).toBe(6);
    expect(block.studyWork.items[0].value).toBe(0);
    expect(block.studyWork.items[1].value).toBe(8);
    expect(block.nonAuditHour).toBe(15);
    expect(block.totalHour).toBe(31);
    expect(block.student).toBe(55);
    expect(block.studyWork.thisSemester.auditoriumHour).toBe(5);
    expect(block.studyWork.thisSemester.teachingAuditoriumHour).toBe(8);
    expect(calcEntryAuditoriumHour({ blocks: [block] })).toBe(8);

    expect(GroupModel.find).toHaveBeenCalledWith(
      { _id: { $in: [G1, G2] } },
      { studentNumber: 1 },
    );
  });

  test("GOLDEN: BOSHQA guruh bilan IKKINCHI biriktirish — kichikroq soat, nonAuditHour endi 0", async () => {
    GroupModel.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: G3, studentNumber: 20 }]),
    });

    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 51 },
    ];
    const { res } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      groups: [G3],
      streams: [{ number: 1, groups: [G3] }],
    });

    expect(res.status).toHaveBeenCalledWith(201);
    const block = pushedBlock();

    expect(block.studyWork.classTypes[0].total).toBe(2);
    expect(block.studyWork.classTypes[1].total).toBe(3);
    expect(block.studyWork.items[0].value).toBe(0);
    expect(block.studyWork.items[1].value).toBe(3);
    expect(block.nonAuditHour).toBe(0);
    expect(block.totalHour).toBe(8);
    expect(block.studyWork.thisSemester.teachingAuditoriumHour).toBe(5);
    expect(calcEntryAuditoriumHour({ blocks: [block] })).toBe(5);
  });

  test("kesishmaydigan guruhlar (D27 ruxsat etgan holat) — SOAT ENDI DUBLIKATLANMAYDI", async () => {
    GroupModel.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: G3, studentNumber: 20 }]),
    });
    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [G1, G2], totalHour: 51 },
    ];
    const { res } = await callAdd(distDoc(existing, { residueHour: 900 }), {
      workloadBlockId: BLOCK_ID,
      groups: [G3],
    });

    expect(res.status).toHaveBeenCalledWith(201);
    const block = pushedBlock();
    expect(block.totalHour).toBe(6);
    expect(block.totalHour).not.toBe(500);
    expect(block.studyWork.thisSemester.auditoriumHour).toBe(5);
    expect(block.studyWork.thisSemester.teachingAuditoriumHour).toBe(3);
    expect(calcEntryAuditoriumHour({ blocks: [block] })).toBe(3);
  });

  test("groups/streams IKKALASI HAM BO'SH → ESKI XATTI-HARAKAT (manbadan to'liq nusxa)", async () => {
    const { res } = await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      subGroup: 0,
    });

    expect(res.status).toHaveBeenCalledWith(201);
    const block = pushedBlock();

    expect(block.totalHour).toBe(500);
    expect(block.student).toBe(999);
    expect(block.nonAuditHour).toBe(0);
    expect(block.studyWork.thisSemester).toBeUndefined();
    expect(calcEntryAuditoriumHour({ blocks: [block] })).toBe(0);
    expect(GroupModel.find).not.toHaveBeenCalled();
  });

  test("manba item overridden:true — skoplangan nusxaga TO'LIQ KO'CHIRILMAYDI, skoplangan talaba soniga qarab QAYTA HISOBLANADI", async () => {
    GroupModel.find = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([
          { _id: G1, studentNumber: 30 },
          { _id: G2, studentNumber: 25 },
        ]),
    });

    const wl = workloadDoc();
    wl.directions[0].blocks[0].studyWork.classTypes = [
      { slug: "amaliy", canonical: null, stream: 90, total: 0 },
    ];
    wl.directions[0].blocks[0].studyWork.items = [
      { slug: "on", title: "ON", value: 999, overridden: true },
      { slug: "yan", title: "YAN", value: 0 },
    ];

    const { res } = await callAdd(
      distDoc([]),
      {
        workloadBlockId: BLOCK_ID,
        groups: [G1, G2],
        streams: [{ number: 1, groups: [G1, G2] }],
      },
      wl,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const block = pushedBlock();

    const onItem = block.studyWork.items.find((i) => i.slug === "on");
    expect(onItem.value).toBe(11);
    expect(onItem.value).not.toBe(999);
    expect(onItem.overridden).toBe(false);
    expect(block.studyWork.items.find((i) => i.slug === "yan").value).toBe(8);
    expect(block.totalHour).toBe(214);
  });

  test("residueHour yetarli emas → 400, yozuv YO'Q", async () => {
    GroupModel.find = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([
          { _id: G1, studentNumber: 30 },
          { _id: G2, studentNumber: 25 },
        ]),
    });

    const { res, next } = await callAdd(distDoc([], { residueHour: 10 }), {
      workloadBlockId: BLOCK_ID,
      groups: [G1, G2],
      streams: [{ number: 1, groups: [G1, G2] }],
    });

    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
