const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const {
  buildTemplateRows,
  validateApplyRow,
  reportMissing,
  applyTemplate,
} = require("./backfill-group-year-language");

const oid = () => new mongoose.Types.ObjectId();

describe("buildTemplateRows — sof funksiya", () => {
  test("ikkalasi ham to'la guruh shablonga TUSHMAYDI", () => {
    const rows = buildTemplateRows([
      { _id: oid(), title: "101-guruh", direction: null, course: null, academicYear: oid(), lang: oid() },
    ]);
    expect(rows).toHaveLength(0);
  });

  test("faqat academicYear yo'q — _missing=['academicYear']", () => {
    const rows = buildTemplateRows([
      { _id: oid(), title: "101-guruh", direction: { title: "Davolash ishi" }, course: { title: "1" }, academicYear: null, lang: oid() },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]._missing).toEqual(["academicYear"]);
    expect(rows[0].academicYear).toBeNull();
    expect(rows[0].language).toBeNull();
    expect(rows[0].direction).toBe("Davolash ishi");
  });

  test("ikkalasi ham yo'q — _missing ikkala kalitni ham o'z ichiga oladi", () => {
    const rows = buildTemplateRows([
      { _id: oid(), title: "102-guruh", direction: null, course: null, academicYear: null, lang: null },
    ]);
    expect(rows[0]._missing).toEqual(["academicYear", "language"]);
  });

  test("chiqish shakli aniq 6 asosiy kalitni saqlaydi (spek talabi)", () => {
    const rows = buildTemplateRows([
      { _id: oid(), title: "x", direction: null, course: null, academicYear: null, lang: oid() },
    ]);
    expect(Object.keys(rows[0])).toEqual(
      expect.arrayContaining(["groupId", "title", "direction", "course", "academicYear", "language"]),
    );
  });
});

describe("validateApplyRow — sof funksiya", () => {
  const groupId = oid();
  const yearId = oid();
  const langId = oid();
  const ctxBase = () => ({
    groupsById: new Map([[String(groupId), { academicYear: null, lang: null }]]),
    validYearIds: new Set([String(yearId)]),
    validLanguageIds: new Set([String(langId)]),
  });

  test("to'g'ri qator — apply, 'language' → 'lang' XARITALANADI", () => {
    const v = validateApplyRow({ groupId: String(groupId), academicYear: String(yearId), language: String(langId) }, ctxBase());
    expect(v.status).toBe("apply");
    expect(String(v.setFields.academicYear)).toBe(String(yearId));
    expect(String(v.setFields.lang)).toBe(String(langId));
    expect(v.setFields.language).toBeUndefined();
  });

  test("groupId topilmasa — invalid", () => {
    const v = validateApplyRow({ groupId: String(oid()), academicYear: String(yearId) }, ctxBase());
    expect(v.status).toBe("invalid");
  });

  test("groupId noto'g'ri formatda — invalid", () => {
    const v = validateApplyRow({ groupId: "notanid" }, ctxBase());
    expect(v.status).toBe("invalid");
  });

  test("academicYear — bunday academicyears hujjati yo'q — invalid", () => {
    const v = validateApplyRow({ groupId: String(groupId), academicYear: String(oid()) }, ctxBase());
    expect(v.status).toBe("invalid");
    expect(v.reasons[0]).toMatch(/academicyears hujjati yo'q/);
  });

  test("DB'da allaqachon to'ldirilgan maydonga TEGILMAYDI — skip", () => {
    const ctx = ctxBase();
    ctx.groupsById.set(String(groupId), { academicYear: oid(), lang: null });
    const v = validateApplyRow({ groupId: String(groupId), academicYear: String(yearId), language: String(langId) }, ctx);
    expect(v.status).toBe("apply");
    expect(v.setFields.academicYear).toBeUndefined();
    expect(String(v.setFields.lang)).toBe(String(langId));
  });

  test("ikkala maydon ham allaqachon to'la — skip (yozadigan narsa yo'q)", () => {
    const ctx = ctxBase();
    ctx.groupsById.set(String(groupId), { academicYear: oid(), lang: oid() });
    const v = validateApplyRow({ groupId: String(groupId), academicYear: String(yearId), language: String(langId) }, ctx);
    expect(v.status).toBe("skip");
  });

  test("qator maydonlari null bo'lsa (to'ldirilmagan shablon) — skip", () => {
    const v = validateApplyRow({ groupId: String(groupId), academicYear: null, language: null }, ctxBase());
    expect(v.status).toBe("skip");
  });
});

const makeDb = ({ groups = [], academicyears = [], languageofinstructions = [], directions = [], courses = [] }) => {
  const calls = { updateOne: 0 };
  const data = { groups, academicyears, languageofinstructions, directions, courses };
  return {
    calls,
    collection(name) {
      const rows = data[name] || [];
      return {
        countDocuments: async () => rows.length,
        find: (filter) => {
          let filtered = rows;
          if (filter && filter._id && filter._id.$in) {
            filtered = rows.filter((r) => filter._id.$in.some((i) => String(i) === String(r._id)));
          } else if (filter && filter.$or) {
            filtered = rows.filter((r) => !r.academicYear || !r.lang);
          }
          return {
            project: () => ({ toArray: async () => filtered }),
            toArray: async () => filtered,
          };
        },
        updateOne: async (filter, update) => {
          calls.updateOne += 1;
          const doc = rows.find((r) => String(r._id) === String(filter._id));
          if (doc) Object.assign(doc, update.$set);
          return { modifiedCount: doc ? 1 : 0 };
        },
      };
    },
  };
};

describe("reportMissing — REPORT rejimi (fayl yozadi, DB'ga yozmaydi)", () => {
  const outPath = path.join(os.tmpdir(), `b3-template-test-${Date.now()}.json`);
  afterEach(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });

  test("shablon faylga to'g'ri yoziladi", async () => {
    const g1 = { _id: oid(), title: "101", direction: null, course: null, academicYear: null, lang: oid() };
    const g2 = { _id: oid(), title: "102", direction: null, course: null, academicYear: oid(), lang: oid() };
    const db = makeDb({ groups: [g1, g2] });
    const result = await reportMissing({ db, outPath });
    expect(result.missingCount).toBe(1);
    expect(fs.existsSync(outPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(outPath, "utf8"));
    expect(written).toHaveLength(1);
    expect(written[0].groupId).toBe(String(g1._id));
  });
});

describe("applyTemplate — DRY (default)", () => {
  const applyPath = path.join(os.tmpdir(), `b3-apply-test-${Date.now()}.json`);
  afterEach(() => {
    if (fs.existsSync(applyPath)) fs.unlinkSync(applyPath);
  });

  test("write bayrog'isiz DB'ga HECH NARSA yozilmaydi", async () => {
    const groupId = oid();
    const yearId = oid();
    fs.writeFileSync(applyPath, JSON.stringify([{ groupId: String(groupId), academicYear: String(yearId), language: null }]));
    const db = makeDb({
      groups: [{ _id: groupId, academicYear: null, lang: null }],
      academicyears: [{ _id: yearId }],
    });
    const result = await applyTemplate({ db, applyPath });
    expect(result.apply).toBe(1);
    expect(db.calls.updateOne).toBe(0);
    expect(result.written).toBeNull();
  });
});

describe("applyTemplate — WRITE", () => {
  const applyPath = path.join(os.tmpdir(), `b3-apply-write-test-${Date.now()}.json`);
  afterEach(() => {
    if (fs.existsSync(applyPath)) fs.unlinkSync(applyPath);
  });

  test("faqat 'apply' qatorlar yoziladi, invalid/skip tegilmaydi", async () => {
    const validGroup = oid();
    const alreadyFullGroup = oid();
    const missingGroup = oid();
    const yearId = oid();
    const langId = oid();
    fs.writeFileSync(
      applyPath,
      JSON.stringify([
        { groupId: String(validGroup), academicYear: String(yearId), language: String(langId) },
        { groupId: String(alreadyFullGroup), academicYear: String(yearId), language: String(langId) },
        { groupId: String(missingGroup), academicYear: String(yearId), language: String(langId) },
      ]),
    );
    const validGroupDoc = { _id: validGroup, academicYear: null, lang: null };
    const db = makeDb({
      groups: [
        validGroupDoc,
        { _id: alreadyFullGroup, academicYear: oid(), lang: oid() },
      ],
      academicyears: [{ _id: yearId }],
      languageofinstructions: [{ _id: langId }],
    });
    const result = await applyTemplate({ db, applyPath, write: true, backup: false });
    expect(result.apply).toBe(1);
    expect(result.skip).toBe(1);
    expect(result.invalid).toBe(1);
    expect(db.calls.updateOne).toBe(1);
    expect(result.written).toEqual({ groups: 1 });

    expect(String(validGroupDoc.lang)).toBe(String(langId));
    expect(String(validGroupDoc.academicYear)).toBe(String(yearId));
    expect(validGroupDoc.language).toBeUndefined();
  });
});
