const mongoose = require("mongoose");
const {
  cleanArtifacts,
  isSuspiciousTitle,
  countTopLevelReferences,
  REF_SOURCES,
} = require("./clean-lessontype-artifacts");

const oid = () => new mongoose.Types.ObjectId();

describe("isSuspiciousTitle — sof funksiya", () => {
  test("berilgan aniq namunalar shubhali deb topiladi", () => {
    expect(isSuspiciousTitle("%")).toBe(true);
    expect(isSuspiciousTitle("Jami")).toBe(true);
    expect(isSuspiciousTitle("jami")).toBe(true);
    expect(isSuspiciousTitle("soat")).toBe(true);
    expect(isSuspiciousTitle("Umumiy yuklamaning hajmi soat")).toBe(true);
  });

  test("bosh-oxir bo'shliq va katta-kichik harfga sezgir emas", () => {
    expect(isSuspiciousTitle("  JAMI  ")).toBe(true);
    expect(isSuspiciousTitle("  %  ")).toBe(true);
  });

  test("bo'sh sarlavha shubhali", () => {
    expect(isSuspiciousTitle("")).toBe(true);
    expect(isSuspiciousTitle(null)).toBe(true);
    expect(isSuspiciousTitle(undefined)).toBe(true);
  });

  test("sof raqam/foiz shubhali", () => {
    expect(isSuspiciousTitle("42")).toBe(true);
    expect(isSuspiciousTitle("3.5")).toBe(true);
    expect(isSuspiciousTitle("50%")).toBe(true);
    expect(isSuspiciousTitle("%%%")).toBe(true);
  });

  test("HAQIQIY dars turi nomlari shubhali EMAS (soxta-musbat xavfi)", () => {
    expect(isSuspiciousTitle("Ma'ruza")).toBe(false);
    expect(isSuspiciousTitle("Seminar")).toBe(false);
    expect(isSuspiciousTitle("Amaliy mashg'ulot")).toBe(false);
    expect(isSuspiciousTitle("Klinik amaliyot")).toBe(false);
    expect(isSuspiciousTitle("Laboratoriya")).toBe(false);
    expect(isSuspiciousTitle("Mustaqil ta'lim")).toBe(false);
  });
});

describe("REF_SOURCES — ataylab bo'sh (grounding natijasi)", () => {
  test("hozircha 0 ta — grep 0 natija berdi", () => {
    expect(REF_SOURCES).toEqual([]);
  });
});

const makeDb = ({ lessontypesExists = true, lessontypes = [], otherCollections = {} }) => {
  const calls = { deleteMany: 0 };
  const names = lessontypesExists ? ["lessontypes", ...Object.keys(otherCollections)] : Object.keys(otherCollections);
  return {
    calls,
    listCollections(filter) {
      const filtered = filter && filter.name ? names.filter((n) => n === filter.name) : names;
      return { toArray: async () => filtered.map((name) => ({ name })) };
    },
    collection(name) {
      if (name === "lessontypes") {
        const rows = lessontypes;
        return {
          find: () => ({ toArray: async () => rows }),
          deleteMany: async (filter) => {
            calls.deleteMany += 1;
            const ids = filter._id.$in.map(String);
            const before = rows.length;
            for (let i = rows.length - 1; i >= 0; i--) {
              if (ids.includes(String(rows[i]._id))) rows.splice(i, 1);
            }
            return { deletedCount: before - rows.length };
          },
        };
      }
      const rows = otherCollections[name] || [];
      return {
        countDocuments: async (filter) => {
          const targetId = filter.$expr.$in[0];
          return rows.filter((r) => Object.values(r).some((v) => String(v) === String(targetId))).length;
        },
      };
    },
  };
};

describe("countTopLevelReferences", () => {
  test("deepScan=false — hech narsa skan qilmaydi, 0 qaytaradi", async () => {
    const db = makeDb({ otherCollections: { attendances: [{ _id: oid(), lessonType: "x" }] } });
    const result = await countTopLevelReferences(db, oid(), { deepScan: false });
    expect(result.total).toBe(0);
  });

  test("top-level maydonda ObjectId topsa sanaydi", async () => {
    const targetId = oid();
    const db = makeDb({ otherCollections: { legacyRows: [{ _id: oid(), someField: targetId }] } });
    const result = await countTopLevelReferences(db, targetId, { excludeCollections: ["lessontypes"] });
    expect(result.total).toBe(1);
    expect(result.perCollection.legacyRows).toBe(1);
  });

  test("excludeCollections ro'yxatidagilarni o'tkazib yuboradi", async () => {
    const targetId = oid();
    const db = makeDb({ otherCollections: { skipMe: [{ _id: oid(), f: targetId }] } });
    const result = await countTopLevelReferences(db, targetId, { excludeCollections: ["skipMe", "lessontypes"] });
    expect(result.total).toBe(0);
  });
});

describe("cleanArtifacts — collection mavjud emas (demo holati)", () => {
  test("yiqilmasdan toza hisobot beradi", async () => {
    const db = makeDb({ lessontypesExists: false });
    const result = await cleanArtifacts({ db, write: true });
    expect(result.collectionExists).toBe(false);
    expect(result.totalDocs).toBe(0);
    expect(db.calls.deleteMany).toBe(0);
  });
});

describe("cleanArtifacts — DRY (default)", () => {
  test("write bayrog'isiz HECH NARSA o'chirilmaydi", async () => {
    const junk = { _id: oid(), title: "Jami" };
    const db = makeDb({ lessontypes: [junk, { _id: oid(), title: "Ma'ruza" }] });
    const result = await cleanArtifacts({ db });
    expect(result.suspiciousCount).toBe(1);
    expect(result.deletable).toHaveLength(1);
    expect(db.calls.deleteMany).toBe(0);
    expect(result.written).toBeNull();
  });
});

describe("cleanArtifacts — WRITE", () => {
  test("referenssiz shubhali yozuv o'chiriladi, haqiqiy nom tegilmaydi", async () => {
    const junk = { _id: oid(), title: "%" };
    const real = { _id: oid(), title: "Ma'ruza" };
    const db = makeDb({ lessontypes: [junk, real] });
    const result = await cleanArtifacts({ db, write: true, backup: false });
    expect(db.calls.deleteMany).toBe(1);
    expect(result.written).toEqual({ deleted: 1 });
    expect(result.kept).toHaveLength(0);
  });

  test("XAVFSIZLIK: referensli shubhali yozuv --write bilan ham O'CHIRILMAYDI", async () => {
    const junk = { _id: oid(), title: "Jami" };
    const db = makeDb({
      lessontypes: [junk],
      otherCollections: { legacyRows: [{ _id: oid(), lessonTypeRaw: junk._id }] },
    });
    const result = await cleanArtifacts({ db, write: true, backup: false });
    expect(result.kept).toHaveLength(1);
    expect(result.deletable).toHaveLength(0);
    expect(db.calls.deleteMany).toBe(0);
    expect(result.written).toBeNull();
  });

  test("shubhali yozuv topilmasa — o'chirilmaydi (idempotent)", async () => {
    const db = makeDb({ lessontypes: [{ _id: oid(), title: "Ma'ruza" }, { _id: oid(), title: "Seminar" }] });
    const result = await cleanArtifacts({ db, write: true });
    expect(result.suspiciousCount).toBe(0);
    expect(db.calls.deleteMany).toBe(0);
    expect(result.written).toBeNull();
  });

  test("--skip-deep-scan (deepScan:false) chuqur referensni topmaydi — hisobotda ko'rinadi", async () => {
    const junk = { _id: oid(), title: "Jami" };
    const db = makeDb({
      lessontypes: [junk],
      otherCollections: { legacyRows: [{ _id: oid(), lessonTypeRaw: junk._id }] },
    });
    const result = await cleanArtifacts({ db, write: true, backup: false, deepScan: false });
    expect(result.deepScan).toBe(false);
    expect(result.deletable).toHaveLength(1);
    expect(db.calls.deleteMany).toBe(1);
  });
});
