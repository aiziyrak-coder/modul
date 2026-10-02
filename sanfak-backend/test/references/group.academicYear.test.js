const {
  createGroupSchema,
  updateGroupGroupSchema,
} = require("#references/group/group.validation");
const GroupModel = require("#references/group/group.model");

const VALID_ID = "507f1f77bcf86cd799439011";

describe("group.validation — academicYear (TZ 4.2.2)", () => {
  test("create: to'g'ri ObjectId QABUL qilinadi", () => {
    const { error, value } = createGroupSchema.validate({
      title: "101-guruh",
      academicYear: VALID_ID,
    });

    expect(error).toBeUndefined();
    expect(value.academicYear).toBe(VALID_ID);
  });

  test("update: to'g'ri ObjectId QABUL qilinadi", () => {
    const { error } = updateGroupGroupSchema.validate({
      academicYear: VALID_ID,
    });

    expect(error).toBeUndefined();
  });

  test("`null` ruxsat etiladi (maydon ixtiyoriy — orqaga moslik)", () => {
    expect(createGroupSchema.validate({ title: "x", academicYear: null }).error)
      .toBeUndefined();
  });

  test("maydonsiz so'rov HAMON ishlaydi (mavjud consumer'lar buzilmasin)", () => {
    expect(createGroupSchema.validate({ title: "101-guruh" }).error)
      .toBeUndefined();
  });

  test("noto'g'ri format RAD etiladi (ObjectId bo'lmagan string)", () => {
    const { error } = createGroupSchema.validate({
      title: "x",
      academicYear: "2025/2026",
    });

    expect(error).toBeDefined();
  });
});

describe("group.model — academicYear sxemasi", () => {
  test("maydon mavjud va `academicYear` ga ref beradi", () => {
    const path = GroupModel.schema.path("academicYear");

    expect(path).toBeDefined();
    expect(path.options.ref).toBe("academicYear");
  });

  test("default `null` — mavjud hujjatlar buzilmaydi", () => {
    const doc = new GroupModel({ title: "101-guruh" });

    expect(doc.academicYear).toBeNull();
  });
});

describe("group.controller — filtr va populate ro'yxatlari", () => {
  const src = require("fs").readFileSync(
    require.resolve("#references/group/group.controller"),
    "utf8",
  );

  test("FILTER_FIELDS ichida academicYear bor", () => {
    const list = src.match(/const FILTER_FIELDS = \[(.*?)\]/s)[1];
    expect(list).toContain("academicYear");
  });

  test("POPULATE ichida academicYear bor", () => {
    expect(src).toMatch(/path:\s*"academicYear"/);
  });
});
