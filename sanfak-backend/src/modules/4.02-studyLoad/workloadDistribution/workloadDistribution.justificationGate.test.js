jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#references/group/group.model");
jest.mock("#references/science/science.model");
jest.mock("./workloadDistribution.teacherNotify");
jest.mock("#modules/4.03-teacher/teacher/teacher.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const GroupModel = require("#references/group/group.model");
const Science = require("#references/science/science.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
Workload.calculateBlockTotal =
  jest.requireActual("#modules/4.02-studyLoad/workload/workload.model")
    .calculateBlockTotal;
const Controller = require("./workloadDistribution.controller");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const WL_BLOCK_ID = "cccccccccccccccccccccccc";
const SCIENCE_ID = "dddddddddddddddddddddddd";
const TEACHER_USER_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const REQ_USER_ID = "ffffffffffffffffffffffff";
const TEACHER_DEPT = "111111111111111111111111";
const SCIENCE_DEPT_OTHER = "222222222222222222222222";

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
          _id: WL_BLOCK_ID,
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

const distDoc = () => ({
  _id: DIST_ID,
  status: "draft",
  workload: "wl1",
  residueHour: 1000,
  teachers: [{ _id: ENTRY_ID, teacher: TEACHER_USER_ID, blocks: [] }],
});

const selectLean = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

const callAdd = async (body, { teacherDept = null, scienceDept = null } = {}) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(distDoc());
  WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue({});
  WorkloadDistribution.findById = jest.fn().mockResolvedValue({
    teachers: { id: jest.fn().mockReturnValue(null) },
    save: jest.fn().mockResolvedValue(undefined),
  });
  Workload.findById = jest.fn().mockResolvedValue(workloadDoc());
  GroupModel.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  TeacherProfile.findOne = jest
    .fn()
    .mockReturnValue(selectLean(teacherDept ? { department: teacherDept } : null));
  Science.findById = jest
    .fn()
    .mockReturnValue(selectLean(scienceDept ? { department: scienceDept } : null));

  const res = createRes();
  const next = jest.fn();
  await Controller.addBlockToTeacher(
    {
      params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
      body: { workloadBlockId: WL_BLOCK_ID, groups: [], ...body },
      scope: {},
      user: { _id: REQ_USER_ID },
    },
    res,
    next,
  );
  return { res, next };
};

const pushedBlock = () =>
  WorkloadDistribution.findOneAndUpdate.mock.calls[0]?.[1]?.$push?.["teachers.$.blocks"];

describe("addBlockToTeacher — Faza 2 kross-kafedra 409 darvozasi", () => {
  afterEach(() => jest.resetAllMocks());

  test("crossDepartment + sabab YO'Q — 409 SUITABILITY_BASIS_REQUIRED, blok YOZILMAGAN", async () => {
    const { next } = await callAdd(
      {},
      { teacherDept: TEACHER_DEPT, scienceDept: SCIENCE_DEPT_OTHER },
    );

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.meta).toMatchObject({
      code: "SUITABILITY_BASIS_REQUIRED",
      suitability: "crossDepartment",
    });
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("crossDepartment + sabab bilan — 201, justification DB'da {basis,note,declaredBy,declaredAt}", async () => {
    const { res, next } = await callAdd(
      {
        suitabilityBasis: "ish_tajribasi",
        suitabilityNote: "10 yillik amaliy tajribaga ega",
      },
      { teacherDept: TEACHER_DEPT, scienceDept: SCIENCE_DEPT_OTHER },
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    const pushed = pushedBlock();
    expect(pushed.justification).toEqual({
      basis: "ish_tajribasi",
      note: "10 yillik amaliy tajribaga ega",
      declaredBy: REQ_USER_ID,
      declaredAt: expect.any(Date),
    });
  });

  const EMPTY_JUSTIFICATION = {
    basis: null,
    note: null,
    declaredBy: null,
    declaredAt: null,
  };

  test("unknown (kafedralar aniqlanmagan) — sabab so'ralmaydi, 201, justification bo'sh (4 maydon null)", async () => {
    const { res, next } = await callAdd({}, { teacherDept: null, scienceDept: null });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(pushedBlock().justification).toEqual(EMPTY_JUSTIFICATION);
  });

  test("match (bir xil kafedra) — sabab so'ralmaydi, 201, justification bo'sh (4 maydon null)", async () => {
    const { res, next } = await callAdd(
      {},
      { teacherDept: TEACHER_DEPT, scienceDept: TEACHER_DEPT },
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(pushedBlock().justification).toEqual(EMPTY_JUSTIFICATION);
  });
});
