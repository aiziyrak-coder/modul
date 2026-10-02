"use strict";

const {
  updateContingentSchema,
  createContingentSchema,
  paginateContingentQuery,
  prefillQuery,
} = require("./departmentContingent.validation");
const { MAX_ROWS, MAX_GROUPS_PER_STREAM } = require("./departmentContingent.model");

const D1 = "a".repeat(24);
const G1 = "1".repeat(24);
const G2 = "2".repeat(24);
const G3 = "3".repeat(24);

const row = (over = {}) => ({
  direction: D1,
  courseNum: 2,
  streams: [{ number: 1, groups: [G1, G2] }, { number: 2, groups: [G3] }],
  ...over,
});
const check = (body) => updateContingentSchema.validate(body, { abortEarly: false });

describe("updateContingentSchema — to'g'ri shakl", () => {
  test("oddiy qator o'tadi", () => {
    expect(check({ rows: [row()] }).error).toBeUndefined();
  });

  test("bo'sh ro'yxat ruxsat (hamma qatorni olib tashlash)", () => {
    expect(check({ rows: [] }).error).toBeUndefined();
  });

  test("bir oqimda turli til guruhlari — validatsiya to'smaydi (egasi default)", () => {
    expect(check({ rows: [row({ streams: [{ number: 1, groups: [G1, G2, G3] }] })] }).error).toBeUndefined();
  });
});

describe("updateContingentSchema — invariantlar", () => {
  test("guruh ikki oqimda — rad", () => {
    const bad = row({ streams: [{ number: 1, groups: [G1] }, { number: 2, groups: [G1] }] });
    expect(check({ rows: [bad] }).error.message).toMatch(/bir necha oqimda/);
  });

  test("oqim raqami takrorlangan — rad", () => {
    const bad = row({ streams: [{ number: 1, groups: [G1] }, { number: 1, groups: [G2] }] });
    expect(check({ rows: [bad] }).error).toBeDefined();
  });

  test("bir xil (yo'nalish, kurs) qatori ikki marta — rad", () => {
    expect(check({ rows: [row(), row()] }).error).toBeDefined();
  });

  test("oqim guruhsiz / qator oqimsiz — rad", () => {
    expect(check({ rows: [row({ streams: [{ number: 1, groups: [] }] })] }).error).toBeDefined();
    expect(check({ rows: [row({ streams: [] })] }).error).toBeDefined();
  });

  test("kurs chegarasi (1..7)", () => {
    expect(check({ rows: [row({ courseNum: 0 })] }).error).toBeDefined();
    expect(check({ rows: [row({ courseNum: 8 })] }).error).toBeDefined();
  });
});

describe("DoS chegaralari — qatorlar va oqim guruhlari", () => {
  const hexId = (i) => i.toString(16).padStart(24, "0");
  const rowsOf = (n) => Array.from({ length: n }, (_, i) => row({ direction: hexId(i + 1) }));
  const streamOf = (n) => [{ number: 1, groups: Array.from({ length: n }, (_, i) => hexId(i + 1)) }];

  test(`qatorlar: ${MAX_ROWS} ta — o'tadi, ${MAX_ROWS + 1} ta — rad`, () => {
    expect(check({ rows: rowsOf(MAX_ROWS) }).error).toBeUndefined();
    expect(check({ rows: rowsOf(MAX_ROWS + 1) }).error.message).toMatch(/ko'p qator/);
  });

  test(`oqim guruhlari: ${MAX_GROUPS_PER_STREAM} ta — o'tadi, ${MAX_GROUPS_PER_STREAM + 1} ta — rad`, () => {
    expect(check({ rows: [row({ streams: streamOf(MAX_GROUPS_PER_STREAM) })] }).error).toBeUndefined();
    expect(
      check({ rows: [row({ streams: streamOf(MAX_GROUPS_PER_STREAM + 1) })] }).error.message,
    ).toMatch(/ko'p guruh/);
  });
});

describe("allowlist (K6) — server maydonlari qabul qilinmaydi", () => {
  test.each([["department"], ["academicYear"], ["lastEditedBy"], ["active"]])(
    "top-level `%s` — rad",
    (field) => {
      expect(check({ rows: [], [field]: D1 }).error).toBeDefined();
    },
  );

  test("qatorda `course` (ObjectId) — rad (serverda resolveCourse)", () => {
    expect(check({ rows: [row({ course: D1 })] }).error).toBeDefined();
  });
});

describe("so'rov sxemalari", () => {
  test("create — o'quv yili faqat ObjectId (sarlavha resolver'da o'tmaydi)", () => {
    expect(createContingentSchema.validate({ academicYear: D1 }).error).toBeUndefined();
    expect(createContingentSchema.validate({ academicYear: "2026/2027" }).error).toBeDefined();
  });

  test("paginate — default sahifa, limit chegarasi", () => {
    expect(paginateContingentQuery.validate({}).value).toMatchObject({ page: 1, limit: 20 });
    expect(paginateContingentQuery.validate({ limit: 500 }).error).toBeDefined();
  });

  test("prefill — yil, yo'nalish, kurs majburiy", () => {
    expect(prefillQuery.validate({ academicYear: D1, direction: D1, courseNum: 3 }).error).toBeUndefined();
    expect(prefillQuery.validate({ academicYear: D1, direction: D1 }).error).toBeDefined();
  });
});
