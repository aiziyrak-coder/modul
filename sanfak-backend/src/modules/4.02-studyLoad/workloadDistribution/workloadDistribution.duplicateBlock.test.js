jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#references/group/group.model");
jest.mock("#references/science/science.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const GroupModel = require("#references/group/group.model");
Workload.calculateBlockTotal =
  jest.requireActual("#modules/4.02-studyLoad/workload/workload.model")
    .calculateBlockTotal;
const Controller = require("./workloadDistribution.controller");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const BLOCK_ID = "cccccccccccccccccccccccc";
const SCIENCE_ID = "dddddddddddddddddddddddd";
const GROUP_A = "eeeeeeeeeeeeeeeeeeeeeeee";
const GROUP_B = "ffffffffffffffffffffffff";
const GROUP_C = "dddddddddddddddddddddddd";

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
          science: SCIENCE_ID,
          course: 2,
          totalHour: 150,
          studyWork: { semester: 3 },
        },
      ],
    },
  ],
});

const distDoc = (existing = []) => ({
  _id: DIST_ID,
  status: 'draft',
  workload: "wl1",
  residueHour: 1000,
  teachers: [{ _id: ENTRY_ID, blocks: existing }],
});

const callAdd = async (dist, body) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
  WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue({});
  WorkloadDistribution.findById = jest.fn().mockResolvedValue({
    teachers: { id: jest.fn().mockReturnValue(null) },
    save: jest.fn().mockResolvedValue(undefined),
  });
  Workload.findById = jest.fn().mockResolvedValue(workloadDoc());
  GroupModel.find = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue([
      { _id: GROUP_A, studentNumber: 10 },
      { _id: GROUP_B, studentNumber: 10 },
      { _id: GROUP_C, studentNumber: 10 },
    ]),
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

const is400 = (res, next) =>
  res.status.mock.calls.some((c) => c[0] === 400) ||
  next.mock.calls.some((c) => c[0]?.statusCode === 400);

describe("workloadDistribution — addBlockToTeacher takroriy biriktirish", () => {
  afterEach(() => jest.resetAllMocks());

  test("birinchi biriktirish — RUXSAT (201) va manba id saqlanadi", async () => {
    const { res, next } = await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_A],
    });

    expect(is400(res, next)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(201);

    const pushed =
      WorkloadDistribution.findOneAndUpdate.mock.calls[0][1].$push[
        "teachers.$.blocks"
      ];
    expect(String(pushed.workloadBlockId)).toBe(BLOCK_ID);
  });

  test("AYNAN bir xil blok + bir xil guruhlar — TAQIQ (400), soat oshmaydi", async () => {
    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [GROUP_A], totalHour: 150 },
    ];
    const { res, next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_A],
    });

    expect(is400(res, next)).toBe(true);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("guruhlar tartibi boshqacha bo'lsa ham AYNAN bir xil deb topiladi (400)", async () => {
    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [GROUP_B, GROUP_A], totalHour: 150 },
    ];
    const { res, next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_A, GROUP_B],
    });

    expect(is400(res, next)).toBe(true);
  });

  test("bir xil blok, BOSHQA guruhlar — RUXSAT (TZ: blok guruhlar bo'yicha bo'linadi)", async () => {
    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [GROUP_A], totalHour: 150 },
    ];
    const { res, next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_B],
    });

    expect(is400(res, next)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("ESKI yozuv (workloadBlockId yo'q) — mazmun imzosi bilan ushlanadi (400)", async () => {
    const legacy = [
      {
        workloadBlockId: null,
        science: SCIENCE_ID,
        course: 2,
        type: "lesson",
        totalHour: 150,
        groups: [],
      },
    ];
    const { res, next } = await callAdd(distDoc(legacy), {
      workloadBlockId: BLOCK_ID,
      groups: [],
    });

    expect(is400(res, next)).toBe(true);
  });

  test("BOSHQA o'qituvchiga bir xil blok+guruhlar — TAQIQ (soat ikki marta hisoblanmasin)", async () => {
    const dist = distDoc([]);
    dist.teachers.push({
      _id: "other-entry",
      blocks: [{ workloadBlockId: BLOCK_ID, groups: [GROUP_A], totalHour: 150 }],
    });

    const { res, next } = await callAdd(dist, {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_A],
    });

    expect(is400(res, next)).toBe(true);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("QISMAN kesishuv (A,B) vs (B,C) — TAQIQ (400)", async () => {
    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [GROUP_A, GROUP_B], totalHour: 150 },
    ];
    const { res, next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_B, GROUP_C],
    });

    expect(is400(res, next)).toBe(true);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
    const msg = next.mock.calls[0][0].message;
    expect(msg).toContain("1 ta guruh");
  });

  test("QISMAN kesishuv BOSHQA o'qituvchida ham — TAQIQ (400)", async () => {
    const dist = distDoc([]);
    dist.teachers.push({
      _id: "other-entry",
      blocks: [
        { workloadBlockId: BLOCK_ID, groups: [GROUP_B, GROUP_C], totalHour: 150 },
      ],
    });

    const { res, next } = await callAdd(dist, {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_A, GROUP_B],
    });

    expect(is400(res, next)).toBe(true);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("kesishmaydigan to'plamlar (A,B) vs (C) — RUXSAT", async () => {
    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [GROUP_A, GROUP_B], totalHour: 150 },
    ];
    const { res, next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_C],
    });

    expect(is400(res, next)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(201);

    const pushed =
      WorkloadDistribution.findOneAndUpdate.mock.calls[0][1].$push[
        "teachers.$.blocks"
      ];
    expect(pushed.totalHour).not.toBe(150);
    expect(pushed.totalHour).toBe(0);
  });

  test("D-1: mavjudda guruh bor, yangisida YO'Q — TAQIQ (400), soat ikki marta hisoblanmaydi", async () => {
    const existing = [
      { workloadBlockId: BLOCK_ID, groups: [GROUP_A], totalHour: 150 },
    ];
    const { res, next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      groups: [],
    });

    expect(is400(res, next)).toBe(true);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toContain("guruhsiz (butun blok)");
  });

  test("D-1: mavjud BUTUN blok (guruhsiz), yangisi guruhli — TAQIQ (400)", async () => {
    const dist = distDoc([]);
    dist.teachers.push({
      _id: "other-entry",
      blocks: [{ workloadBlockId: BLOCK_ID, groups: [], streams: [], totalHour: 150 }],
    });

    const { res, next } = await callAdd(dist, {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_B],
    });

    expect(is400(res, next)).toBe(true);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("D-1: oqim guruhlari ham qamrovga kiradi — mavjud oqim (A,B), yangi guruh A — TAQIQ", async () => {
    const existing = [
      {
        workloadBlockId: BLOCK_ID,
        groups: [],
        streams: [{ number: 1, groups: [GROUP_A, GROUP_B] }],
        totalHour: 150,
      },
    ];
    const { res, next } = await callAdd(distDoc(existing), {
      workloadBlockId: BLOCK_ID,
      groups: [GROUP_A],
    });

    expect(is400(res, next)).toBe(true);
    expect(next.mock.calls[0][0].message).toContain("1 ta guruh");
  });

  test("birinchi biriktirish guruhsiz — RUXSAT, soat TO'LIQ (ADR-005 fallback)", async () => {
    const { res, next } = await callAdd(distDoc([]), {
      workloadBlockId: BLOCK_ID,
      groups: [],
    });

    expect(is400(res, next)).toBe(false);

    const pushed =
      WorkloadDistribution.findOneAndUpdate.mock.calls[0][1].$push[
        "teachers.$.blocks"
      ];
    expect(pushed.totalHour).toBe(150);
  });
});

describe("addBlockToTeacher — hosila (rollup) qayta hisoblanadi (F-2a-2)", () => {
  afterEach(() => jest.resetAllMocks());

  test("'accepted' entry'ga yangi (pending) blok qo'shilsa — entry 'pending'ga tushadi", async () => {
    const dist = distDoc([]);
    dist.teachers[0].acceptanceStatus = "accepted";

    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
    WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue({});
    Workload.findById = jest.fn().mockResolvedValue(workloadDoc());
    GroupModel.find = jest
      .fn()
      .mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const updatedEntry = {
      _id: ENTRY_ID,
      acceptanceStatus: "accepted",
      rejectionReason: null,
      respondedAt: null,
      blocks: [{ _id: "newblock1", acceptanceStatus: "pending" }],
    };
    const updatedDoc = {
      teachers: { id: jest.fn().mockReturnValue(updatedEntry) },
      save: jest.fn().mockResolvedValue(undefined),
    };
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(updatedDoc);

    const res = createRes();
    await Controller.addBlockToTeacher(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
        body: { workloadBlockId: BLOCK_ID, groups: [] },
        scope: {},
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(updatedEntry.acceptanceStatus).toBe("pending");
    expect(updatedDoc.save).toHaveBeenCalled();
  });
});

describe("removeBlockFromTeacher — hosila (rollup) qayta hisoblanadi (F-2a-2)", () => {
  afterEach(() => jest.resetAllMocks());

  test("yagona 'rejected' blok olib tashlansa — entry 2-yozuvda 'accepted'ga qaytadi", async () => {
    const REMOVE_BLOCK = "333333333333333333333333";
    const KEEP_BLOCK = "444444444444444444444444";

    const dist = {
      _id: DIST_ID,
      status: "draft",
      teachers: [
        {
          _id: ENTRY_ID,
          blocks: [
            { _id: REMOVE_BLOCK, totalHour: 50, acceptanceStatus: "rejected" },
            { _id: KEEP_BLOCK, totalHour: 30, acceptanceStatus: "accepted" },
          ],
        },
      ],
    };
    dist.teachers.find = Array.prototype.find.bind(dist.teachers);
    dist.teachers[0].blocks.find = Array.prototype.find.bind(dist.teachers[0].blocks);
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);

    const afterPullDoc = {
      teachers: [
        {
          _id: ENTRY_ID,
          acceptanceStatus: "rejected",
          blocks: [{ _id: KEEP_BLOCK, totalHour: 30, acceptanceStatus: "accepted" }],
        },
      ],
    };
    WorkloadDistribution.findOneAndUpdate = jest
      .fn()
      .mockResolvedValueOnce(afterPullDoc)
      .mockResolvedValueOnce({});

    const res = createRes();
    await Controller.removeBlockFromTeacher(
      {
        params: { id: DIST_ID, teacherEntryId: ENTRY_ID, blockId: REMOVE_BLOCK },
        scope: {},
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(WorkloadDistribution.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const [, update2] = WorkloadDistribution.findOneAndUpdate.mock.calls[1];
    expect(update2.$set["teachers.$.acceptanceStatus"]).toBe("accepted");
  });
});
