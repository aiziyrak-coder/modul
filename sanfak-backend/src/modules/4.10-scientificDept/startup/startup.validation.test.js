const {
  createStartupSchema,
  updateStartupSchema,
  startupPaginateSchema,
} = require("./startup.validation");
const Startup = require("./startup.model");

const validBase = {
  type: "64b2f0c2a1b2c3d4e5f60718",
  title: "Tibbiy telemonitoring platformasi",
};

describe("startup.validation — createStartupSchema", () => {
  test("to'g'ri payload qabul qilinadi", () => {
    expect(createStartupSchema.validate(validBase).error).toBeUndefined();
  });

  test("loyiha turi majburiy va ObjectId bo'lishi shart", () => {
    const { type: _omit, ...noType } = validBase;
    expect(createStartupSchema.validate(noType).error).toBeDefined();
    expect(
      createStartupSchema.validate({ ...validBase, type: "shunchaki-matn" }).error,
    ).toBeDefined();
  });

  test("loyiha nomi majburiy", () => {
    const { title: _omit, ...noTitle } = validBase;
    expect(createStartupSchema.validate(noTitle).error).toBeDefined();
    expect(createStartupSchema.validate({ ...validBase, title: "" }).error).toBeDefined();
  });

  test("fayllar Joi'da emas — `fileSlots`/`media` uploadFiles orqali keladi", () => {
    const { error } = createStartupSchema.validate({
      ...validBase,
      fileSlots: JSON.stringify(["passport", "application"]),
      media: [{ image: "http://x/files/a.pdf" }],
    });
    expect(error).toBeUndefined();
  });
});

describe("startup.validation — updateStartupSchema", () => {
  test("bo'sh update xato (kamida 1 maydon)", () => {
    expect(updateStartupSchema.validate({}).error).toBeDefined();
  });

  test("qisman update qabul qilinadi", () => {
    expect(updateStartupSchema.validate({ title: "Yangi nom" }).error).toBeUndefined();
  });
});

describe("startup.validation — paginate", () => {
  test("page/limit majburiy", () => {
    expect(startupPaginateSchema.validate({}).error).toBeDefined();
    expect(startupPaginateSchema.validate({ page: 1, limit: 12 }).error).toBeUndefined();
  });

  test("limit chegarasi 200", () => {
    expect(startupPaginateSchema.validate({ page: 1, limit: 500 }).error).toBeDefined();
  });
});

describe("startup — fayl slotlari", () => {
  test("TZ dagi to'rtta slot (pasport, ariza, taqdimot, sertifikat)", () => {
    expect(Startup.STARTUP_FILE_SLOTS).toEqual([
      "passport",
      "application",
      "presentation",
      "certificate",
    ]);
  });

  test("tasdiqlash oqimi YO'Q — modelda status maydoni ham yo'q", () => {
    const paths = Object.keys(Startup.schema.paths);
    expect(paths).not.toContain("status");
    expect(paths).not.toContain("approvedBy");
    expect(paths).not.toContain("rejectionReason");
  });
});
