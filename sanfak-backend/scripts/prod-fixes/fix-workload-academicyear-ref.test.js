const mongoose = require("mongoose");
const {
  fixWorkloadAcademicYear,
  classifyValue,
} = require("./fix-workload-academicyear-ref");

const oid = () => new mongoose.Types.ObjectId();
const YEAR_2627 = oid();

const makeDb = ({ academicyears = [], workloads = [] }) => {
  const calls = { updateOne: 0 };
  const data = { academicyears, workloads };
  return {
    calls,
    collection(name) {
      const rows = data[name] || [];
      return {
        find: (filter) => {
          const ids = filter && filter._id && filter._id.$in;
          const filtered = ids ? rows.filter((r) => ids.some((i) => String(i) === String(r._id))) : rows;
          return {
            project: () => ({ toArray: async () => filtered }),
            toArray: async () => filtered,
          };
        },
        updateOne: async (filter, update) => {
          calls.updateOne += 1;
          const doc = rows.find((r) => String(r._id) === String(filter._id));
          if (doc) doc.academicYear = update.$set.academicYear;
          return { modifiedCount: doc ? 1 : 0 };
        },
      };
    },
  };
};

describe("classifyValue — sof funksiya", () => {
  const byTitle = new Map([["2026/2027", YEAR_2627]]);

  test("ObjectId allaqachon to'g'ri — already", () => {
    expect(classifyValue(oid(), byTitle).status).toBe("already");
  });

  test("null/undefined — missing", () => {
    expect(classifyValue(null, byTitle).status).toBe("missing");
    expect(classifyValue(undefined, byTitle).status).toBe("missing");
  });

  test("24-hex satr — hexString (qidiruvsiz to'g'ridan-to'g'ri cast)", () => {
    const hex = "64f1a2b3c4d5e6f7a8b9c0d1";
    const cls = classifyValue(hex, byTitle);
    expect(cls.status).toBe("hexString");
    expect(cls.toId).toBe(hex);
  });

  test("tire formatidagi sarlavha normallashtirilib topiladi — resolved", () => {
    const cls = classifyValue("2026-2027", byTitle);
    expect(cls.status).toBe("resolved");
    expect(cls.normalized).toBe("2026/2027");
    expect(String(cls.toId)).toBe(String(YEAR_2627));
  });

  test("bo'shliq bilan / slash formatidagi sarlavha ham topiladi", () => {
    expect(classifyValue("  2026/2027  ", byTitle).status).toBe("resolved");
  });

  test("mos academicyears hujjati yo'q — unresolved, TEGILMAYDI", () => {
    const cls = classifyValue("2099-2100", byTitle);
    expect(cls.status).toBe("unresolved");
    expect(cls.normalized).toBe("2099/2100");
  });

  test("tanib bo'lmaydigan matn — unresolved, normalized=null", () => {
    const cls = classifyValue("noma'lum qiymat", byTitle);
    expect(cls.status).toBe("unresolved");
    expect(cls.normalized).toBeNull();
  });
});

describe("fixWorkloadAcademicYear — DRY (default)", () => {
  test("write bayrog'isiz DB'ga HECH NARSA yozilmaydi", async () => {
    const db = makeDb({
      academicyears: [{ _id: YEAR_2627, title: "2026/2027" }],
      workloads: [{ _id: "w1", academicYear: "2026-2027" }],
    });
    const result = await fixWorkloadAcademicYear({ db });
    expect(result.stat.resolved).toBe(1);
    expect(db.calls.updateOne).toBe(0);
    expect(result.written).toBeNull();
    expect(result.backupFile).toBeNull();
  });

  test("write: false ham yozmaydi", async () => {
    const db = makeDb({
      academicyears: [{ _id: YEAR_2627, title: "2026/2027" }],
      workloads: [{ _id: "w1", academicYear: "2026-2027" }],
    });
    await fixWorkloadAcademicYear({ db, write: false });
    expect(db.calls.updateOne).toBe(0);
  });
});

describe("fixWorkloadAcademicYear — WRITE", () => {
  test("faqat hal qilinadigan hujjatlar yoziladi, unresolved tegilmaydi", async () => {
    const db = makeDb({
      academicyears: [{ _id: YEAR_2627, title: "2026/2027" }],
      workloads: [
        { _id: "w1", academicYear: "2026-2027" },
        { _id: "w2", academicYear: "2099-2100" },
        { _id: "w3", academicYear: oid() },
      ],
    });
    const result = await fixWorkloadAcademicYear({ db, write: true, backup: false });
    expect(db.calls.updateOne).toBe(1);
    expect(result.written).toEqual({ workloads: 1 });
    expect(result.unresolvedList).toHaveLength(1);
    expect(result.unresolvedList[0]._id).toBe("w2");
  });

  test("hex-string qiymat qidiruvsiz to'g'ridan-to'g'ri ObjectId'ga aylantiriladi", async () => {
    const hex = "64f1a2b3c4d5e6f7a8b9c0d1";
    const db = makeDb({
      academicyears: [],
      workloads: [{ _id: "w1", academicYear: hex }],
    });
    const result = await fixWorkloadAcademicYear({ db, write: true, backup: false });
    expect(result.written).toEqual({ workloads: 1 });
    expect(String(result.toUpdate[0].toId)).toBe(hex);
  });

  test("o'zgarish yo'q bo'lsa yozilmaydi (idempotent)", async () => {
    const db = makeDb({
      academicyears: [{ _id: YEAR_2627, title: "2026/2027" }],
      workloads: [{ _id: "w1", academicYear: YEAR_2627 }],
    });
    const result = await fixWorkloadAcademicYear({ db, write: true, backup: false });
    expect(db.calls.updateOne).toBe(0);
    expect(result.written).toBeNull();
  });

  test("bo'sh workloads to'plamida ishlaydi (demo bazasi kabi)", async () => {
    const db = makeDb({ academicyears: [], workloads: [] });
    const result = await fixWorkloadAcademicYear({ db, write: true });
    expect(result.stat.total).toBe(0);
    expect(result.written).toBeNull();
  });
});
