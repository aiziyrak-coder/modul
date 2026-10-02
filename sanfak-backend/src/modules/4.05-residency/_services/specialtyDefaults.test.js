"use strict";

const mockFindById = jest.fn();

jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    isValidObjectId: actual.isValidObjectId,
    Types: actual.Types,
    model: () => ({ findById: mockFindById }),
  };
});

jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const {
  applySpecialtyDefaults,
  derivedWarnings,
  SPECIALTY_FIELDS,
} = require("./specialtyDefaults");

const SPEC = "6a5a0acbd34b3c21a575d59d";

const chain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFindById.mockReturnValue(chain({ studyPeriod: 3 }));
});

describe("muddat mutaxassislikdan olinadi", () => {
  it("yaratishda bo'sh muddat to'ldiriladi", async () => {
    const out = await applySpecialtyDefaults({ specialty: SPEC, fullName: "A" });

    expect(out.body.studyPeriod).toBe(3);
    expect(out.derived).toEqual(["studyPeriod"]);
    expect(out.body).not.toBe(undefined);
  });

  it("tahrirlashda mutaxassislik almashsa va muddat BO'SH bo'lsa — to'ldiriladi", async () => {
    const out = await applySpecialtyDefaults({ specialty: SPEC }, { studyPeriod: null });
    expect(out.body.studyPeriod).toBe(3);
  });

  it("mavjud yozuvdagi mutaxassislik ishlatiladi (payloadda kelmasa ham)", async () => {
    const out = await applySpecialtyDefaults({ courseNumber: 2 }, { specialty: SPEC });
    expect(out.body.studyPeriod).toBe(3);
  });
});

describe("🔴 bosib o'tmaydi", () => {
  it("mijoz ANIQ qiymat bergan bo'lsa — TEGILMAYDI", async () => {
    const out = await applySpecialtyDefaults({ specialty: SPEC, studyPeriod: 5 });

    expect(out.body.studyPeriod).toBe(5);
    expect(out.derived).toEqual([]);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("yozuvda ALLAQACHON muddat bor bo'lsa — TEGILMAYDI", async () => {
    const out = await applySpecialtyDefaults({ specialty: SPEC }, { studyPeriod: 4 });

    expect(out.body.studyPeriod).toBeUndefined();
    expect(out.derived).toEqual([]);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("`0` ham ANIQ qiymat sanaladi", async () => {
    const out = await applySpecialtyDefaults({ specialty: SPEC, studyPeriod: 0 });
    expect(out.derived).toEqual([]);
  });
});

describe("hosila majburiy emas", () => {
  it("mutaxassislik yo'q -> tegilmaydi, DBga borilmaydi", async () => {
    const out = await applySpecialtyDefaults({ fullName: "A" });
    expect(out.derived).toEqual([]);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("noto'g'ri id -> tegilmaydi", async () => {
    const out = await applySpecialtyDefaults({ specialty: "shunchaki-matn" });
    expect(out.derived).toEqual([]);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("mutaxassislik topilmadi -> tegilmaydi", async () => {
    mockFindById.mockReturnValue(chain(null));
    expect((await applySpecialtyDefaults({ specialty: SPEC })).derived).toEqual([]);
  });

  it("mutaxassislikda muddat belgilanmagan -> tegilmaydi", async () => {
    mockFindById.mockReturnValue(chain({ studyPeriod: null }));
    expect((await applySpecialtyDefaults({ specialty: SPEC })).derived).toEqual([]);
  });

  it("DB yiqilsa istisno TASHLANMAYDI (yozuv saqlanaveradi)", async () => {
    mockFindById.mockImplementation(() => {
      throw new Error("mongo down");
    });

    const out = await applySpecialtyDefaults({ specialty: SPEC, fullName: "A" });

    expect(out.derived).toEqual([]);
    expect(out.body.fullName).toBe("A");
  });
});

describe("mutaxassislikdan faqat KERAKLI maydon o'qiladi", () => {
  it("`select` da boshqa hech narsa yo'q", async () => {
    const c = chain({ studyPeriod: 3 });
    mockFindById.mockReturnValue(c);

    await applySpecialtyDefaults({ specialty: SPEC });

    expect(c.select).toHaveBeenCalledWith(SPECIALTY_FIELDS);
    expect(SPECIALTY_FIELDS).toBe("studyPeriod");
  });
});

describe("derivedWarnings — yaratish va tahrirlash bir xil gapiradi", () => {
  it("hosila bo'lsa matn qaytadi", () => {
    expect(derivedWarnings(["studyPeriod"], { studyPeriod: 3 })).toEqual([
      "O'qish muddati mutaxassislikdan olindi: 3 yil",
    ]);
  });

  it("hosila bo'lmasa BO'SH", () => {
    expect(derivedWarnings([], { studyPeriod: 3 })).toEqual([]);
    expect(derivedWarnings()).toEqual([]);
  });

  it("boshqa hosila maydoni `studyPeriod` matnini chiqarmaydi", () => {
    expect(derivedWarnings(["department"], { studyPeriod: 3 })).toEqual([]);
  });

  it("🔴 `applySpecialtyDefaults` natijasi bilan to'g'ridan-to'g'ri ishlaydi", async () => {
    mockFindById.mockReturnValue(chain({ studyPeriod: 2 }));

    const out = await applySpecialtyDefaults({ specialty: SPEC });

    expect(derivedWarnings(out.derived, out.body)).toEqual([
      "O'qish muddati mutaxassislikdan olindi: 2 yil",
    ]);
  });
});
