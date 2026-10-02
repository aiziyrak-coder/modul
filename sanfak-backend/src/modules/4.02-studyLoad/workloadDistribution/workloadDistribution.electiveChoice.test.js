jest.mock("./workloadDistribution.model", () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/workload/workload.model", () => ({
  findById: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model", () => ({
  findById: jest.fn(),
}));
jest.mock("#references/science/science.model", () => ({ findById: jest.fn() }));
jest.mock("#modules/4.03-teacher/teacher/teacher.model", () => ({ findOne: jest.fn() }));

const WorkloadDistribution = require("./workloadDistribution.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const Science = require("#references/science/science.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const {
  EDITABLE_STATUSES,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");
const service = require("./workloadDistribution.service");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const WORKLOAD_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const PLAN_ID = "cccccccccccccccccccccccc";
const ENTRY_ID = "dddddddddddddddddddddddd";
const BLOCK_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const WL_BLOCK_ID = "ffffffffffffffffffffffff";
const DEPT_OWN = "111111111111111111111111";
const DEPT_OTHER = "222222222222222222222222";
const SCI_MAIN = "333333333333333333333333";
const SCI_ALT_OWN = "444444444444444444444444";
const SCI_ALT_OTHER = "555555555555555555555555";
const SCI_OUTSIDER = "666666666666666666666666";
const TEACHER_ID = "777777777777777777777777";

const BLOCK_HOUR = 120;

const leanOf = (doc) => ({ lean: () => Promise.resolve(doc) });
const selectLeanOf = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

const wire = (o = {}) => {
  const block = {
    _id: BLOCK_ID,
    workloadBlockId: WL_BLOCK_ID,
    section: "Tanlov fanlari",
    science: SCI_MAIN,
    electiveSlot: null,
    semester: 1,
    totalHour: BLOCK_HOUR,
    ...(o.block || {}),
  };

  const dist =
    o.distDoc !== undefined
      ? o.distDoc
      : {
          _id: DIST_ID,
          workload: WORKLOAD_ID,
          department: DEPT_OWN,
          status: "draft",
          teachers: [{ _id: ENTRY_ID, teacher: TEACHER_ID, blocks: [block] }],
          ...(o.dist || {}),
        };

  WorkloadDistribution.findOne.mockReturnValue(leanOf(dist));
  WorkloadDistribution.updateOne.mockResolvedValue({
    matchedCount: 1,
    modifiedCount: 1,
  });
  TeacherProfile.findOne.mockReturnValue(selectLeanOf(null));
  Science.findById.mockReturnValue(selectLeanOf(null));

  Workload.findById.mockReturnValue(
    leanOf({
      _id: WORKLOAD_ID,
      directions: [
        {
          workingPlan:
            o.workingPlan !== undefined ? o.workingPlan : PLAN_ID,
          blocks: [{ _id: WL_BLOCK_ID }],
        },
      ],
    }),
  );

  const row = {
    science: SCI_MAIN,
    code: "TF-01",
    title: "Asosiy tanlov fani",
    department: DEPT_OWN,
    alternatives: [
      {
        science: SCI_ALT_OWN,
        code: "ALT-01",
        title: "O'z kafedra alternativi",
        department: DEPT_OWN,
      },
      {
        science: SCI_ALT_OTHER,
        code: "ALT-02",
        title: "Boshqa kafedra alternativi",
        department: DEPT_OTHER,
      },
    ],
    ...(o.row || {}),
  };

  const plan =
    o.plan !== undefined
      ? o.plan
      : {
          _id: PLAN_ID,
          semesters: {
            1: {
              blocks: [
                {
                  blockCode: "TF2",
                  title: "Tanlov fanlari",
                  sciences: [row],
                  ...(o.planBlock || {}),
                },
              ],
            },
          },
        };

  WorkingPlan.findById.mockReturnValue(leanOf(plan));

  return { block, dist, row, plan };
};

const call = async (fn, args) => {
  try {
    return { data: await fn(args), err: null };
  } catch (err) {
    return { data: null, err };
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getElectiveOptions — variantlar ro'yxati", () => {
  test("tanlov blokida asosiy fan + alternativlar qaytadi", async () => {
    wire();

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    expect(data.main.science).toBe(SCI_MAIN);
    expect(data.main.code).toBe("TF-01");
    expect(data.main.department).toBe(DEPT_OWN);
    expect(data.alternatives).toHaveLength(2);
    expect(data.alternatives.map((a) => a.science)).toEqual([
      SCI_ALT_OWN,
      SCI_ALT_OTHER,
    ]);
  });

  test("🔴 Variant A — boshqa kafedra alternativi selectable:false + reason", async () => {
    wire();

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    const own = data.alternatives.find((a) => a.science === SCI_ALT_OWN);
    const other = data.alternatives.find((a) => a.science === SCI_ALT_OTHER);

    expect(own.selectable).toBe(true);
    expect(own.reason).toBeNull();

    expect(other.selectable).toBe(false);
    expect(typeof other.reason).toBe("string");
    expect(other.reason.length).toBeGreaterThan(0);
  });

  test("tanlov bo'lmagan (majburiy) blokda BO'SH ro'yxat — xato emas", async () => {
    wire({
      block: { section: "Majburiy fanlar" },
      planBlock: { blockCode: "MFI", title: "Majburiy fanlar" },
    });

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    expect(data).toEqual({ main: null, alternatives: [] });
  });

  test("legacy blok (`workloadBlockId: null`) — BO'SH ro'yxat, xato yo'q", async () => {
    wire({ block: { workloadBlockId: null } });

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    expect(data).toEqual({ main: null, alternatives: [] });
    expect(Workload.findById).not.toHaveBeenCalled();
    expect(WorkingPlan.findById).not.toHaveBeenCalled();
  });

  test("ishchi reja topilmasa — BO'SH ro'yxat, xato yo'q", async () => {
    wire({ plan: null });

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    expect(data).toEqual({ main: null, alternatives: [] });
  });

  test("🔴 MO'RTLIK: reja bloki `title` siz (section=\"TF2\") bo'lsa ham tanlov ANIQLANADI", async () => {
    wire({
      block: { section: "TF2" },
      planBlock: { blockCode: "TF2", title: null },
    });

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    expect(data.main.science).toBe(SCI_MAIN);
    expect(data.alternatives).toHaveLength(2);
  });

  test("blok topilmasa — 404", async () => {
    wire();

    const { err } = await call(service.getElectiveOptions, {
      id: DIST_ID,
      blockId: SCI_OUTSIDER,
      scope: {},
    });

    expect(err.statusCode).toBe(404);
  });

  test("scope MAJBURIY — filtrga uzatiladi, begona taqsimot 404", async () => {
    wire({ distDoc: null });

    const { err } = await call(service.getElectiveOptions, {
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: { department: DEPT_OWN },
    });

    expect(err.statusCode).toBe(404);
    expect(WorkloadDistribution.findOne.mock.calls[0][0]).toEqual({
      _id: DIST_ID,
      department: DEPT_OWN,
    });
  });
});

describe("getElectiveOptions — suitability variantda (Faza 2, hoist)", () => {
  test("har variantda (main+alternatives) suitability maydoni bor — 3 qiymatdan biri", async () => {
    wire();
    TeacherProfile.findOne.mockReturnValue(selectLeanOf({ department: DEPT_OWN }));

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    expect(["match", "crossDepartment", "unknown"]).toContain(data.main.suitability);
    expect(data.main.suitability).toBe("match");
    for (const alt of data.alternatives) {
      expect(["match", "crossDepartment", "unknown"]).toContain(alt.suitability);
    }
    const own = data.alternatives.find((a) => a.science === SCI_ALT_OWN);
    const other = data.alternatives.find((a) => a.science === SCI_ALT_OTHER);
    expect(own.suitability).toBe("match");
    expect(other.suitability).toBe("crossDepartment");
  });

  test("o'qituvchi profili BIR MARTA so'raladi — nechta variant bo'lishidan qat'i nazar", async () => {
    wire();
    TeacherProfile.findOne.mockReturnValue(selectLeanOf({ department: DEPT_OWN }));

    await service.getElectiveOptions({ id: DIST_ID, blockId: BLOCK_ID, scope: {} });

    expect(TeacherProfile.findOne).toHaveBeenCalledTimes(1);
    expect(TeacherProfile.findOne).toHaveBeenCalledWith({ user: TEACHER_ID });
  });

  test("entry.teacher yo'q (vakant) — TeacherProfile so'ralmaydi, hammasi unknown", async () => {
    const { block } = wire();
    WorkloadDistribution.findOne.mockReturnValue(
      leanOf({
        _id: DIST_ID,
        workload: WORKLOAD_ID,
        department: DEPT_OWN,
        status: "draft",
        teachers: [{ _id: ENTRY_ID, teacher: null, blocks: [block] }],
      }),
    );

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    expect(TeacherProfile.findOne).not.toHaveBeenCalled();
    expect(data.main.suitability).toBe("unknown");
    expect(data.alternatives.every((a) => a.suitability === "unknown")).toBe(true);
  });

  test("BEST-EFFORT: TeacherProfile so'rovi xato tashlasa ham funksiya yiqilmaydi — unknown", async () => {
    wire();
    TeacherProfile.findOne = jest.fn(() => {
      throw new Error("ulanish uzildi");
    });

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    expect(data.main.suitability).toBe("unknown");
  });

  test("mavjud selectable/reason maydonlari o'zgarmagan — additive kengaytma", async () => {
    wire();
    TeacherProfile.findOne.mockReturnValue(selectLeanOf(null));

    const data = await service.getElectiveOptions({
      id: DIST_ID,
      blockId: BLOCK_ID,
      scope: {},
    });

    const other = data.alternatives.find((a) => a.science === SCI_ALT_OTHER);
    expect(other.selectable).toBe(false);
    expect(typeof other.reason).toBe("string");
  });
});

describe("applyElectiveChoice — tanlovni saqlash", () => {
  const choose = (scienceId, args = {}) =>
    call(service.applyElectiveChoice, {
      id: DIST_ID,
      blockId: BLOCK_ID,
      scienceId,
      scope: {},
      ...args,
    });

  test("o'z kafedra alternativi tanlanadi — AYNAN to'rt maydon yoziladi (Faza 2: + justification)", async () => {
    wire();

    const { data, err } = await choose(SCI_ALT_OWN);

    expect(err).toBeNull();
    expect(WorkloadDistribution.updateOne).toHaveBeenCalledTimes(1);

    const [filter, update, opts] = WorkloadDistribution.updateOne.mock.calls[0];
    expect(Object.keys(update)).toEqual(["$set"]);
    expect(Object.keys(update.$set).sort()).toEqual([
      "teachers.$[t].blocks.$[b].electiveSlot",
      "teachers.$[t].blocks.$[b].justification",
      "teachers.$[t].blocks.$[b].science",
      "teachers.$[t].blocks.$[b].suitability",
    ]);
    expect(update.$set["teachers.$[t].blocks.$[b].science"]).toBe(SCI_ALT_OWN);
    expect(update.$set["teachers.$[t].blocks.$[b].suitability"].flag).toBe(
      "unknown",
    );
    expect(update.$set["teachers.$[t].blocks.$[b].justification"]).toEqual({
      basis: null,
      note: null,
      declaredBy: null,
      declaredAt: null,
    });
    expect(filter._id).toBe(DIST_ID);
    expect(opts.arrayFilters).toEqual([
      { "t._id": ENTRY_ID },
      { "b._id": BLOCK_ID },
    ]);
    expect(data.science).toBe(SCI_ALT_OWN);
  });

  test("ADR-042: katalogda «Tanlov fani» deb belgilanmagan alternativ ham tanlanadi", async () => {
    wire();
    Science.findById.mockReturnValue(selectLeanOf({ department: DEPT_OWN, isElective: false }));

    const { data, err } = await choose(SCI_ALT_OWN);

    expect(err).toBeNull();
    expect(WorkloadDistribution.updateOne).toHaveBeenCalledTimes(1);
    expect(data.science).toBe(SCI_ALT_OWN);
  });

  test("Faza 1: moslik belgisi hisoblanadi va $set ichiga yoziladi (match)", async () => {
    wire();
    TeacherProfile.findOne.mockReturnValue(selectLeanOf({ department: DEPT_OWN }));
    Science.findById.mockReturnValue(selectLeanOf({ department: DEPT_OWN }));

    await choose(SCI_ALT_OWN);

    const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
    const suitability = update.$set["teachers.$[t].blocks.$[b].suitability"];
    expect(suitability.flag).toBe("match");
    expect(suitability.teacherDepartment).toBe(DEPT_OWN);
    expect(suitability.scienceDepartment).toBe(DEPT_OWN);
    expect(suitability.computedAt).toBeInstanceOf(Date);
    expect(TeacherProfile.findOne).toHaveBeenCalledWith({ user: TEACHER_ID });
    expect(Science.findById).toHaveBeenCalledWith(SCI_ALT_OWN);
  });

  test("Faza 1: o'qituvchi boshqa kafedradan (nazariy) — crossDepartment belgi (Faza 2: sabab bilan o'tadi)", async () => {
    wire();
    TeacherProfile.findOne.mockReturnValue(selectLeanOf({ department: DEPT_OTHER }));
    Science.findById.mockReturnValue(selectLeanOf({ department: DEPT_OWN }));

    await choose(SCI_ALT_OWN, {
      suitabilityBasis: "ish_tajribasi",
      suitabilityNote: "10 yillik amaliy tajribaga ega",
    });

    const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
    expect(update.$set["teachers.$[t].blocks.$[b].suitability"].flag).toBe(
      "crossDepartment",
    );
  });

  describe("Faza 2 — kross-kafedra bayonnomasi (409 gate + izchillik)", () => {
    const crossWire = () => {
      wire();
      TeacherProfile.findOne.mockReturnValue(selectLeanOf({ department: DEPT_OTHER }));
      Science.findById.mockReturnValue(selectLeanOf({ department: DEPT_OWN }));
    };

    test("crossDepartment + sabab YO'Q — 409 SUITABILITY_BASIS_REQUIRED, yozuv YO'Q", async () => {
      crossWire();

      const { err } = await choose(SCI_ALT_OWN);

      expect(err.statusCode).toBe(409);
      expect(err.meta).toMatchObject({
        code: "SUITABILITY_BASIS_REQUIRED",
        suitability: "crossDepartment",
        blockIds: [BLOCK_ID],
      });
      expect(WorkloadDistribution.updateOne).not.toHaveBeenCalled();
    });

    test("crossDepartment + sabab berilgan — saqlanadi {basis,note,declaredBy,declaredAt}", async () => {
      crossWire();
      const user = { _id: "999999999999999999999999" };

      const { err } = await choose(SCI_ALT_OWN, {
        user,
        suitabilityBasis: "ish_tajribasi",
        suitabilityNote: "10 yillik amaliy tajribaga ega",
      });

      expect(err).toBeNull();
      const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
      const justification = update.$set["teachers.$[t].blocks.$[b].justification"];
      expect(justification.basis).toBe("ish_tajribasi");
      expect(justification.note).toBe("10 yillik amaliy tajribaga ega");
      expect(justification.declaredBy).toBe(user._id);
      expect(justification.declaredAt).toBeInstanceOf(Date);
    });

    test("declaredBy klientdan uzatilmaydi — faqat `user._id` dan olinadi (service qatlamida)", async () => {
      crossWire();

      const { err } = await choose(SCI_ALT_OWN, {
        user: { _id: "888888888888888888888888" },
        suitabilityBasis: "ish_tajribasi",
        suitabilityNote: "10 yillik amaliy tajribaga ega",
      });

      expect(err).toBeNull();
      const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
      expect(
        update.$set["teachers.$[t].blocks.$[b].justification"].declaredBy,
      ).toBe("888888888888888888888888");
    });

    test("match/unknown — eski bayonnoma TOZALANADI (meros qolmaydi)", async () => {
      wire({ block: { justification: { basis: "boshqa", note: "eski fan haqida" } } });

      const { err } = await choose(SCI_ALT_OWN);

      expect(err).toBeNull();
      const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
      expect(update.$set["teachers.$[t].blocks.$[b].justification"]).toEqual({
        basis: null,
        note: null,
        declaredBy: null,
        declaredAt: null,
      });
    });

    test("🔴 SOAT INVARIANTI saqlanadi: justification qo'shilishi totalHour'ga tegmaydi", async () => {
      crossWire();

      const { data } = await choose(SCI_ALT_OWN, {
        suitabilityBasis: "ish_tajribasi",
        suitabilityNote: "10 yillik amaliy tajribaga ega",
      });

      expect(data.totalHour).toBe(BLOCK_HOUR);
      const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
      expect(update.$inc).toBeUndefined();
    });
  });

  test("🔴 LAZY BACKFILL: `electiveSlot` null bo'lgan blokda birinchi tanlov ishlaydi", async () => {
    wire({ block: { electiveSlot: null, science: SCI_MAIN } });

    const { data, err } = await choose(SCI_ALT_OWN);

    expect(err).toBeNull();
    const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
    expect(update.$set["teachers.$[t].blocks.$[b].electiveSlot"]).toBe(SCI_MAIN);
    expect(data.electiveSlot).toBe(SCI_MAIN);
  });

  test("🔴 LAZY BACKFILL: backfill'dan keyin ASOSIY FANGA QAYTISH mumkin", async () => {
    wire({ block: { electiveSlot: SCI_MAIN, science: SCI_ALT_OWN } });

    const { data, err } = await choose(SCI_MAIN);

    expect(err).toBeNull();
    const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
    expect(update.$set["teachers.$[t].blocks.$[b].science"]).toBe(SCI_MAIN);
    expect(update.$set["teachers.$[t].blocks.$[b].electiveSlot"]).toBe(SCI_MAIN);
    expect(data.science).toBe(SCI_MAIN);
  });

  test("🔴 ikkinchi tanlov (alternativdan boshqa alternativga) ham ishlaydi", async () => {
    wire({ block: { electiveSlot: SCI_MAIN, science: SCI_ALT_OTHER } });

    const { err } = await choose(SCI_ALT_OWN);

    expect(err).toBeNull();
    const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
    expect(update.$set["teachers.$[t].blocks.$[b].science"]).toBe(SCI_ALT_OWN);
  });

  test("🔴 SOAT INVARIANTI: `$set` da soat/kredit maydonlari YO'Q, totalHour o'zgarmaydi", async () => {
    wire();

    const { data } = await choose(SCI_ALT_OWN);

    const [, update] = WorkloadDistribution.updateOne.mock.calls[0];
    const keys = Object.keys(update.$set).join("|");
    expect(keys).not.toMatch(/totalHour|studyWork|nonAuditHour|student|credit/i);
    expect(update.$inc).toBeUndefined();
    expect(data.totalHour).toBe(BLOCK_HOUR);
  });

  test("🔴 ro'yxatdan TASHQARI scienceId — 400, yozuv YO'Q", async () => {
    wire();

    const { err } = await choose(SCI_OUTSIDER);

    expect(err.statusCode).toBe(400);
    expect(WorkloadDistribution.updateOne).not.toHaveBeenCalled();
  });

  test("🔴 Variant A: boshqa kafedra fani — 400, yozuv YO'Q", async () => {
    wire();

    const { err } = await choose(SCI_ALT_OTHER);

    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/kafedra/i);
    expect(WorkloadDistribution.updateOne).not.toHaveBeenCalled();
  });

  test("qulflangan status (`in_review`) — 400, yozuv YO'Q", async () => {
    wire({ dist: { status: "in_review" } });

    const { err } = await choose(SCI_ALT_OWN);

    expect(err.statusCode).toBe(400);
    expect(WorkloadDistribution.updateOne).not.toHaveBeenCalled();
  });

  test("tasdiqlangan status (`approved`) — 400, yozuv YO'Q", async () => {
    wire({ dist: { status: "approved" } });

    const { err } = await choose(SCI_ALT_OWN);

    expect(err.statusCode).toBe(400);
    expect(WorkloadDistribution.updateOne).not.toHaveBeenCalled();
  });

  test("scope buzilishi (begona kafedra) — 404, yozuv YO'Q", async () => {
    wire({ distDoc: null });

    const { err } = await choose(SCI_ALT_OWN, {
      scope: { department: DEPT_OTHER },
    });

    expect(err.statusCode).toBe(404);
    expect(WorkloadDistribution.updateOne).not.toHaveBeenCalled();
  });

  test("scope YOZUV filtriga ham qo'shiladi (TOCTOU himoyasi)", async () => {
    wire();

    await choose(SCI_ALT_OWN, { scope: { department: DEPT_OWN } });

    const [filter] = WorkloadDistribution.updateOne.mock.calls[0];
    expect(filter.department).toBe(DEPT_OWN);
    expect(filter.status).toEqual({ $in: EDITABLE_STATUSES });
  });

  test("majburiy (tanlov bo'lmagan) blok — 400, yozuv YO'Q", async () => {
    wire({
      block: { section: "Majburiy fanlar" },
      planBlock: { blockCode: "MFI", title: "Majburiy fanlar" },
    });

    const { err } = await choose(SCI_ALT_OWN);

    expect(err.statusCode).toBe(400);
    expect(WorkloadDistribution.updateOne).not.toHaveBeenCalled();
  });

  test("legacy blok (`workloadBlockId: null`) — 400, yozuv YO'Q", async () => {
    wire({ block: { workloadBlockId: null } });

    const { err } = await choose(SCI_ALT_OWN);

    expect(err.statusCode).toBe(400);
    expect(WorkloadDistribution.updateOne).not.toHaveBeenCalled();
  });

  test("blok topilmasa — 404", async () => {
    wire();

    const { err } = await choose(SCI_ALT_OWN, { blockId: SCI_OUTSIDER });

    expect(err.statusCode).toBe(404);
  });

  test("yozuv paytida hujjat imzoga ketib qolsa (matchedCount 0) — 409", async () => {
    wire();
    WorkloadDistribution.updateOne.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
    });

    const { err } = await choose(SCI_ALT_OWN);

    expect(err.statusCode).toBe(409);
  });
});

describe("resolveElectiveSlot — generatsiyada to'ldirish", () => {
  test("tanlov blokidan kelgan fan — slot ko'rsatkichi qaytadi", async () => {
    wire();

    const slot = await service.resolveElectiveSlot({
      workingPlanId: PLAN_ID,
      semester: 1,
      section: "Tanlov fanlari",
      science: SCI_MAIN,
    });

    expect(slot).toBe(SCI_MAIN);
  });

  test("majburiy blokdan kelgan fan — null (xulq o'zgarmaydi)", async () => {
    wire({ planBlock: { blockCode: "MFI", title: "Majburiy fanlar" } });

    const slot = await service.resolveElectiveSlot({
      workingPlanId: PLAN_ID,
      semester: 1,
      section: "Majburiy fanlar",
      science: SCI_MAIN,
    });

    expect(slot).toBeNull();
  });

  test("ishchi reja ko'rsatkichi yo'q — null, DB'ga so'rov ham yo'q", async () => {
    wire();

    const slot = await service.resolveElectiveSlot({
      workingPlanId: null,
      semester: 1,
      section: "Tanlov fanlari",
      science: SCI_MAIN,
    });

    expect(slot).toBeNull();
    expect(WorkingPlan.findById).not.toHaveBeenCalled();
  });
});
