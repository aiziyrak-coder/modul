jest.mock("#modules/4.03-teacher/teacher/teacher.model", () => ({
  findOne: jest.fn(),
}));
jest.mock("#references/science/science.model", () => ({ findById: jest.fn() }));

const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const Science = require("#references/science/science.model");
const {
  evaluateSuitability,
  buildSuitability,
  buildSuitabilityFromDepartment,
  requiresJustification,
  collectCrossDepartmentBlocks,
} = require("./suitabilityFlag");

const TEACHER_DEPT = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SCIENCE_DEPT_OTHER = "bbbbbbbbbbbbbbbbbbbbbbbb";
const TEACHER_ID = "cccccccccccccccccccccccc";
const SCIENCE_ID = "dddddddddddddddddddddddd";

const selectLean = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

beforeEach(() => {
  jest.resetAllMocks();
});

describe("suitabilityFlag — evaluateSuitability (sof funksiya, DB'siz)", () => {
  test("ikkala kafedra bir xil — match", () => {
    expect(
      evaluateSuitability({
        teacherDepartmentId: TEACHER_DEPT,
        scienceDepartmentId: TEACHER_DEPT,
      }),
    ).toBe("match");
  });

  test("kafedralar farqli — crossDepartment", () => {
    expect(
      evaluateSuitability({
        teacherDepartmentId: TEACHER_DEPT,
        scienceDepartmentId: SCIENCE_DEPT_OTHER,
      }),
    ).toBe("crossDepartment");
  });

  test.each([
    ["teacherDepartmentId yo'q", null, SCIENCE_DEPT_OTHER],
    ["scienceDepartmentId yo'q", TEACHER_DEPT, null],
    ["ikkalasi ham yo'q", null, null],
  ])("%s — unknown (soxta qizil emas)", (_label, teacherDepartmentId, scienceDepartmentId) => {
    expect(evaluateSuitability({ teacherDepartmentId, scienceDepartmentId })).toBe(
      "unknown",
    );
  });

  test("ObjectId va string aralash — string bo'yicha solishtiradi", () => {
    expect(
      evaluateSuitability({
        teacherDepartmentId: { toString: () => TEACHER_DEPT },
        scienceDepartmentId: TEACHER_DEPT,
      }),
    ).toBe("match");
  });
});

describe("suitabilityFlag — buildSuitability (2 ta select-li so'rov)", () => {
  test("ikkala kafedra mos — match, ikkalasi ham `select`+`lean` bilan so'raladi", async () => {
    TeacherProfile.findOne.mockReturnValue(selectLean({ department: TEACHER_DEPT }));
    Science.findById.mockReturnValue(selectLean({ department: TEACHER_DEPT }));

    const result = await buildSuitability({
      teacherUserId: TEACHER_ID,
      scienceId: SCIENCE_ID,
    });

    expect(result.flag).toBe("match");
    expect(result.teacherDepartment).toBe(TEACHER_DEPT);
    expect(result.scienceDepartment).toBe(TEACHER_DEPT);
    expect(result.computedAt).toBeInstanceOf(Date);
    expect(TeacherProfile.findOne).toHaveBeenCalledWith({ user: TEACHER_ID });
    expect(Science.findById).toHaveBeenCalledWith(SCIENCE_ID);
  });

  test("kafedralar farqli — crossDepartment", async () => {
    TeacherProfile.findOne.mockReturnValue(selectLean({ department: TEACHER_DEPT }));
    Science.findById.mockReturnValue(selectLean({ department: SCIENCE_DEPT_OTHER }));

    const result = await buildSuitability({
      teacherUserId: TEACHER_ID,
      scienceId: SCIENCE_ID,
    });
    expect(result.flag).toBe("crossDepartment");
  });

  test("teacherUserId yo'q (vakant slot) — TeacherProfile so'ralmaydi, unknown", async () => {
    Science.findById.mockReturnValue(selectLean({ department: TEACHER_DEPT }));

    const result = await buildSuitability({ teacherUserId: null, scienceId: SCIENCE_ID });

    expect(result.flag).toBe("unknown");
    expect(TeacherProfile.findOne).not.toHaveBeenCalled();
  });

  test("scienceId yo'q (blok hali fansiz) — Science so'ralmaydi, unknown", async () => {
    TeacherProfile.findOne.mockReturnValue(selectLean({ department: TEACHER_DEPT }));

    const result = await buildSuitability({ teacherUserId: TEACHER_ID, scienceId: null });

    expect(result.flag).toBe("unknown");
    expect(Science.findById).not.toHaveBeenCalled();
  });

  test("profil topilmadi (department null) — unknown, xato tashlanmaydi", async () => {
    TeacherProfile.findOne.mockReturnValue(selectLean(null));
    Science.findById.mockReturnValue(selectLean({ department: TEACHER_DEPT }));

    const result = await buildSuitability({
      teacherUserId: TEACHER_ID,
      scienceId: SCIENCE_ID,
    });

    expect(result.flag).toBe("unknown");
    expect(result.teacherDepartment).toBeNull();
  });

  test("BEST-EFFORT: so'rov xato tashlasa ham funksiya yiqilmaydi — unknown", async () => {
    TeacherProfile.findOne.mockImplementation(() => {
      throw new Error("ulanish uzildi");
    });
    Science.findById.mockReturnValue(selectLean({ department: TEACHER_DEPT }));

    const result = await buildSuitability({
      teacherUserId: TEACHER_ID,
      scienceId: SCIENCE_ID,
    });

    expect(result.flag).toBe("unknown");
    expect(result.teacherDepartment).toBeNull();
    expect(result.scienceDepartment).toBeNull();
  });

  test("computedAt HAR DOIM to'ladi — ma'lumot yo'q holatda ham", async () => {
    const result = await buildSuitability({ teacherUserId: null, scienceId: null });
    expect(result.computedAt).toBeInstanceOf(Date);
    expect(result.flag).toBe("unknown");
  });
});

describe("suitabilityFlag — buildSuitabilityFromDepartment (N+1'siz, hoist)", () => {
  test("teacherDepartmentId oldindan berilgan — TeacherProfile UMUMAN so'ralmaydi", async () => {
    Science.findById.mockReturnValue(selectLean({ department: TEACHER_DEPT }));

    const result = await buildSuitabilityFromDepartment({
      teacherDepartmentId: TEACHER_DEPT,
      scienceId: SCIENCE_ID,
    });

    expect(result.flag).toBe("match");
    expect(result.teacherDepartment).toBe(TEACHER_DEPT);
    expect(result.scienceDepartment).toBe(TEACHER_DEPT);
    expect(result.computedAt).toBeInstanceOf(Date);
    expect(TeacherProfile.findOne).not.toHaveBeenCalled();
    expect(Science.findById).toHaveBeenCalledWith(SCIENCE_ID);
  });

  test("kafedralar farqli — crossDepartment", async () => {
    Science.findById.mockReturnValue(selectLean({ department: SCIENCE_DEPT_OTHER }));

    const result = await buildSuitabilityFromDepartment({
      teacherDepartmentId: TEACHER_DEPT,
      scienceId: SCIENCE_ID,
    });

    expect(result.flag).toBe("crossDepartment");
  });

  test("scienceId yo'q — Science so'ralmaydi, unknown", async () => {
    const result = await buildSuitabilityFromDepartment({
      teacherDepartmentId: TEACHER_DEPT,
      scienceId: null,
    });

    expect(result.flag).toBe("unknown");
    expect(Science.findById).not.toHaveBeenCalled();
  });

  test("teacherDepartmentId yo'q (profilsiz) — unknown", async () => {
    Science.findById.mockReturnValue(selectLean({ department: TEACHER_DEPT }));

    const result = await buildSuitabilityFromDepartment({
      teacherDepartmentId: null,
      scienceId: SCIENCE_ID,
    });

    expect(result.flag).toBe("unknown");
    expect(result.teacherDepartment).toBeNull();
  });

  test("BEST-EFFORT: Science so'rovi xato tashlasa ham funksiya yiqilmaydi — unknown", async () => {
    Science.findById.mockImplementation(() => {
      throw new Error("ulanish uzildi");
    });

    const result = await buildSuitabilityFromDepartment({
      teacherDepartmentId: TEACHER_DEPT,
      scienceId: SCIENCE_ID,
    });

    expect(result.flag).toBe("unknown");
    expect(result.scienceDepartment).toBeNull();
  });
});

describe("suitabilityFlag — requiresJustification (409 darvozasi, Faza 2 §B.1)", () => {
  test("crossDepartment — true", () => {
    expect(requiresJustification("crossDepartment")).toBe(true);
  });

  test.each([["match"], ["unknown"], [undefined], [null], [""]])(
    "%s — HECH QACHON true qaytmaydi (soxta qizil emas)",
    (flag) => {
      expect(requiresJustification(flag)).toBe(false);
    },
  );
});

describe("suitabilityFlag — collectCrossDepartmentBlocks (submit yig'ma ogohlantirish, §B.6)", () => {
  const ENTRY_A = "111111111111111111111111";
  const BLOCK_A = "222222222222222222222222";
  const BLOCK_B = "333333333333333333333333";

  test("faqat crossDepartment bloklar yig'iladi — match/unknown chetlab o'tiladi", () => {
    const doc = {
      teachers: [
        {
          _id: ENTRY_A,
          blocks: [
            { _id: BLOCK_A, suitability: { flag: "crossDepartment" }, justification: null },
            { _id: BLOCK_B, suitability: { flag: "match" } },
            { _id: "444444444444444444444444", suitability: { flag: "unknown" } },
          ],
        },
      ],
    };

    const warnings = collectCrossDepartmentBlocks(doc);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toEqual({
      type: "suitability",
      severity: "warning",
      teacherEntryId: ENTRY_A,
      blockId: BLOCK_A,
      flag: "crossDepartment",
      declared: false,
      basis: null,
    });
  });

  test("declared:true + basis — bayonnoma bor blokda ko'rinadi", () => {
    const doc = {
      teachers: [
        {
          _id: ENTRY_A,
          blocks: [
            {
              _id: BLOCK_A,
              suitability: { flag: "crossDepartment" },
              justification: { basis: "ish_tajribasi", note: "10 yillik tajriba" },
            },
          ],
        },
      ],
    };

    const [warning] = collectCrossDepartmentBlocks(doc);

    expect(warning.declared).toBe(true);
    expect(warning.basis).toBe("ish_tajribasi");
  });

  test("kross blok yo'q — bo'sh massiv", () => {
    const doc = {
      teachers: [{ _id: ENTRY_A, blocks: [{ _id: BLOCK_A, suitability: { flag: "match" } }] }],
    };
    expect(collectCrossDepartmentBlocks(doc)).toEqual([]);
  });

  test("teachers/blocks yo'q hujjat — yiqilmaydi, bo'sh massiv", () => {
    expect(collectCrossDepartmentBlocks({})).toEqual([]);
    expect(collectCrossDepartmentBlocks(null)).toEqual([]);
  });

  test("id'lar STRING sifatida qaytadi (ObjectId kirsa ham)", () => {
    const objectIdLike = { toString: () => BLOCK_A };
    const doc = {
      teachers: [
        {
          _id: { toString: () => ENTRY_A },
          blocks: [{ _id: objectIdLike, suitability: { flag: "crossDepartment" } }],
        },
      ],
    };
    const [warning] = collectCrossDepartmentBlocks(doc);
    expect(warning.teacherEntryId).toBe(ENTRY_A);
    expect(warning.blockId).toBe(BLOCK_A);
    expect(typeof warning.teacherEntryId).toBe("string");
  });
});
