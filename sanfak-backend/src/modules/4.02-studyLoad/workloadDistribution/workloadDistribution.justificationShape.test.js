jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.03-teacher/teacher/teacher.model");
jest.mock("#references/science/science.model");
jest.mock("./workloadDistribution.teacherNotify");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#references/group/group.model");
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const Science = require("#references/science/science.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const GroupModel = require("#references/group/group.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const suitabilityFlag = require("#modules/4.02-studyLoad/_services/suitabilityFlag");
const Controller = require("./workloadDistribution.controller");
const service = require("./workloadDistribution.service");

const EMPTY = { basis: null, note: null, declaredBy: null, declaredAt: null };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const selectLean = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

describe("suitabilityFlag.emptyJustification — kanonik shakl", () => {
  test("4 maydon, hammasi null", () => {
    expect(suitabilityFlag.emptyJustification()).toEqual(EMPTY);
  });

  test("har chaqiruvda YANGI obyekt qaytadi (bitta reference EMAS — aliasing xavfsizligi)", () => {
    const a = suitabilityFlag.emptyJustification();
    const b = suitabilityFlag.emptyJustification();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe("B6-item2 — uch yozuv nuqtasi YAGONA manbadan foydalanadi (regressiya qulfi)", () => {
  let spy;

  beforeEach(() => {
    jest.clearAllMocks();
    spy = jest.spyOn(suitabilityFlag, "emptyJustification");
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test("fillVacancy — match (kross emas) blok uchun emptyJustification() chaqiriladi", async () => {
    const dist = {
      _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      status: "draft",
      residueHour: 500,
      teachers: [
        {
          _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
          isVacant: true,
          teacher: "dddddddddddddddddddddddd",
          totalHour: 0,
          blocks: [{ _id: "111111111111111111111111", science: "444444444444444444444444" }],
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(dist);
    TeacherProfile.findOne = jest
      .fn()
      .mockReturnValue(selectLean({ department: "777777777777777777777777", active: true }));
    Science.findById = jest
      .fn()
      .mockReturnValue(selectLean({ department: "777777777777777777777777" }));

    const res = createRes();
    const next = jest.fn();
    await Controller.fillVacancy(
      {
        params: { id: dist._id, teacherEntryId: dist.teachers[0]._id },
        body: { teacher: "cccccccccccccccccccccccc" },
        scope: {},
        user: { _id: "eeeeeeeeeeeeeeeeeeeeeeee" },
      },
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    expect(dist.teachers[0].blocks[0].justification).toEqual(EMPTY);
  });

  test("addBlockToTeacher — unknown (kross emas) blok uchun emptyJustification() chaqiriladi", async () => {
    const WL_BLOCK_ID = "cccccccccccccccccccccccc";
    const distDoc = {
      _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      status: "draft",
      workload: "wl1",
      residueHour: 1000,
      teachers: [{ _id: "bbbbbbbbbbbbbbbbbbbbbbbb", teacher: "eeeeeeeeeeeeeeeeeeeeeeee", blocks: [] }],
    };
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(distDoc);
    WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue({});
    WorkloadDistribution.findById = jest.fn().mockResolvedValue({
      teachers: { id: jest.fn().mockReturnValue(null) },
      save: jest.fn().mockResolvedValue(undefined),
    });
    Workload.findById = jest.fn().mockResolvedValue({
      _id: "wl1",
      directions: [
        {
          blocks: [
            {
              _id: WL_BLOCK_ID,
              type: "lesson",
              science: "dddddddddddddddddddddddd",
              course: 2,
              totalHour: 150,
              studyWork: { semester: 1 },
            },
          ],
        },
      ],
    });
    GroupModel.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    TeacherProfile.findOne = jest.fn().mockReturnValue(selectLean(null));
    Science.findById = jest.fn().mockReturnValue(selectLean(null));

    const res = createRes();
    const next = jest.fn();
    await Controller.addBlockToTeacher(
      {
        params: { id: distDoc._id, teacherEntryId: distDoc.teachers[0]._id },
        body: { workloadBlockId: WL_BLOCK_ID, groups: [] },
        scope: {},
        user: { _id: "ffffffffffffffffffffffff" },
      },
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    const pushed =
      WorkloadDistribution.findOneAndUpdate.mock.calls[0]?.[1]?.$push?.["teachers.$.blocks"];
    expect(pushed.justification).toEqual(EMPTY);
  });

  test("applyElectiveChoice — unknown (kross emas) tanlov uchun emptyJustification() chaqiriladi", async () => {
    const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const BLOCK_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
    const SCI_MAIN = "333333333333333333333333";
    const SCI_ALT = "444444444444444444444444";
    const leanOf = (doc) => ({ lean: () => Promise.resolve(doc) });

    const block = {
      _id: BLOCK_ID,
      workloadBlockId: "ffffffffffffffffffffffff",
      section: "Tanlov fanlari",
      science: SCI_MAIN,
      electiveSlot: null,
      semester: 1,
      totalHour: 100,
    };
    WorkloadDistribution.findOne = jest.fn().mockReturnValue(
      leanOf({
        _id: DIST_ID,
        workload: "bbbbbbbbbbbbbbbbbbbbbbbb",
        department: "111111111111111111111111",
        status: "draft",
        teachers: [{ _id: "dddddddddddddddddddddddd", teacher: "777777777777777777777777", blocks: [block] }],
      }),
    );
    WorkloadDistribution.updateOne = jest
      .fn()
      .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    TeacherProfile.findOne = jest.fn().mockReturnValue(selectLean(null));
    Science.findById = jest.fn().mockReturnValue(selectLean(null));
    Workload.findById = jest.fn().mockReturnValue(
      leanOf({
        _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
        directions: [
          { workingPlan: "cccccccccccccccccccccccc", blocks: [{ _id: "ffffffffffffffffffffffff" }] },
        ],
      }),
    );
    WorkingPlan.findById = jest.fn().mockReturnValue(
      leanOf({
        _id: "cccccccccccccccccccccccc",
        semesters: {
          1: {
            blocks: [
              {
                blockCode: "TF2",
                title: "Tanlov fanlari",
                sciences: [
                  {
                    science: SCI_MAIN,
                    code: "TF-01",
                    title: "Asosiy",
                    department: "111111111111111111111111",
                    alternatives: [
                      {
                        science: SCI_ALT,
                        code: "ALT-01",
                        title: "Alternativ",
                        department: "111111111111111111111111",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      }),
    );

    const data = await service.applyElectiveChoice({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scienceId: SCI_ALT,
      scope: {},
    });

    expect(data.science).toBe(SCI_ALT);
    expect(spy).toHaveBeenCalled();
    const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
    expect(update.$set["teachers.$[t].blocks.$[b].justification"]).toEqual(EMPTY);
  });
});
