const mongoose = require("mongoose");
const {
  mergeDuplicates,
  groupDuplicates,
  REF_SOURCES,
} = require("./merge-academicyear-duplicates");

const oid = () => new mongoose.Types.ObjectId();

describe("groupDuplicates — sof funksiya", () => {
  test("bir xil yil, ikki ajratuvchi — dublikat guruh, kanonik=slash hujjat", () => {
    const slash = { _id: oid(), title: "2026/2027" };
    const dash = { _id: oid(), title: "2026-2027" };
    const other = { _id: oid(), title: "2027/2028" };
    const groups = groupDuplicates([slash, dash, other]);
    expect(groups).toHaveLength(1);
    expect(groups[0].canonical).toBe(slash);
    expect(groups[0].duplicates).toEqual([dash]);
  });

  test("kanonik (slash) yo'q guruh — canonical=null, merge nomzodi EMAS", () => {
    const dash1 = { _id: oid(), title: "2026-2027" };
    const dash2 = { _id: oid(), title: "2026–2027" };
    const groups = groupDuplicates([dash1, dash2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].canonical).toBeNull();
    expect(groups[0].duplicates).toHaveLength(2);
  });

  test("dublikatsiz (yagona) yillar guruhga tushmaydi", () => {
    const groups = groupDuplicates([
      { _id: oid(), title: "2026/2027" },
      { _id: oid(), title: "2027/2028" },
    ]);
    expect(groups).toHaveLength(0);
  });

  test("uchta variant bitta guruhga birlashadi (N-to-1 merge)", () => {
    const slash = { _id: oid(), title: "2026/2027" };
    const dash = { _id: oid(), title: "2026-2027" };
    const enDash = { _id: oid(), title: "2026–2027" };
    const groups = groupDuplicates([slash, dash, enDash]);
    expect(groups).toHaveLength(1);
    expect(groups[0].canonical).toBe(slash);
    expect(groups[0].duplicates).toHaveLength(2);
  });

  test("tanib bo'lmaydigan sarlavha e'tiborsiz qoldiriladi (bu skript ishi emas)", () => {
    const groups = groupDuplicates([{ _id: oid(), title: "noto'g'ri" }, { _id: oid(), title: "yana ham" }]);
    expect(groups).toHaveLength(0);
  });
});

describe("REF_SOURCES — ro'yxat yaxlitligi", () => {
  test("har yozuvda collection+field bor, dublikat juftlik yo'q", () => {
    const seen = new Set();
    for (const s of REF_SOURCES) {
      expect(typeof s.collection).toBe("string");
      expect(typeof s.field).toBe("string");
      const key = `${s.collection}.${s.field}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(REF_SOURCES.length).toBeGreaterThan(0);
  });
});

const makeDb = ({ academicyears = [], refCollections = {} }) => {
  const calls = { updateMany: 0, deleteOne: 0 };
  return {
    calls,
    collection(name) {
      if (name === "academicyears") {
        return {
          find: () => ({ toArray: async () => academicyears }),
          deleteOne: async ({ _id }) => {
            calls.deleteOne += 1;
            const i = academicyears.findIndex((d) => String(d._id) === String(_id));
            if (i >= 0) academicyears.splice(i, 1);
            return { deletedCount: 1 };
          },
        };
      }
      const rows = refCollections[name] || [];
      const keyOf = (filter) => Object.keys(filter)[0];
      return {
        countDocuments: async (filter) => {
          const k = keyOf(filter);
          return rows.filter((r) => String(r[k]) === String(filter[k])).length;
        },
        find: (filter) => ({
          project: () => ({
            toArray: async () => {
              const k = keyOf(filter);
              return rows.filter((r) => String(r[k]) === String(filter[k]));
            },
          }),
        }),
        updateMany: async (filter, update) => {
          calls.updateMany += 1;
          const k = keyOf(filter);
          const setKey = Object.keys(update.$set)[0];
          let n = 0;
          for (const r of rows) {
            if (String(r[k]) === String(filter[k])) {
              r[setKey] = update.$set[setKey];
              n += 1;
            }
          }
          return { modifiedCount: n };
        },
      };
    },
  };
};

describe("mergeDuplicates — DRY (default)", () => {
  test("write bayrog'isiz HECH NARSA yozilmaydi/o'chirilmaydi (referens sanog'i ishlaydi)", async () => {
    const canonical = { _id: oid(), title: "2026/2027" };
    const dup = { _id: oid(), title: "2026-2027" };
    const groupRow = { _id: oid(), academicYear: dup._id };
    const db = makeDb({
      academicyears: [canonical, dup],
      refCollections: { groups: [groupRow] },
    });
    const result = await mergeDuplicates({ db });
    expect(result.mergeable).toHaveLength(1);
    expect(result.perPair).toHaveLength(1);
    expect(result.perPair[0].totalRefs).toBe(1);
    expect(db.calls.updateMany).toBe(0);
    expect(db.calls.deleteOne).toBe(0);
    expect(result.written).toBeNull();
  });

  test("kanonik topilmagan guruh perPair'ga umuman kirmaydi", async () => {
    const dash1 = { _id: oid(), title: "2026-2027" };
    const dash2 = { _id: oid(), title: "2026–2027" };
    const db = makeDb({ academicyears: [dash1, dash2], refCollections: {} });
    const result = await mergeDuplicates({ db, write: true, backup: false });
    expect(result.noCanonical).toHaveLength(1);
    expect(result.perPair).toHaveLength(0);
    expect(db.calls.deleteOne).toBe(0);
  });
});

describe("mergeDuplicates — WRITE", () => {
  test("referenslar qayta yo'naltiriladi, dublikat o'chiriladi", async () => {
    const canonical = { _id: oid(), title: "2026/2027" };
    const dup = { _id: oid(), title: "2026-2027" };
    const groupRow = { _id: oid(), academicYear: dup._id };
    const workloadRow = { _id: oid(), academicYear: dup._id };
    const db = makeDb({
      academicyears: [canonical, dup],
      refCollections: { groups: [groupRow], workloads: [workloadRow] },
    });
    const result = await mergeDuplicates({ db, write: true, backup: false });
    expect(db.calls.updateMany).toBeGreaterThan(0);
    expect(db.calls.deleteOne).toBe(1);
    expect(String(groupRow.academicYear)).toBe(String(canonical._id));
    expect(String(workloadRow.academicYear)).toBe(String(canonical._id));
    expect(result.written).toEqual({ merged: 1, refused: 0 });
    expect(result.perPair[0].deleted).toBe(true);
  });

  test("o'zgarish bo'lmasa (dublikat yo'q) --write ham yozmaydi (idempotent)", async () => {
    const db = makeDb({
      academicyears: [{ _id: oid(), title: "2026/2027" }, { _id: oid(), title: "2027/2028" }],
      refCollections: {},
    });
    const result = await mergeDuplicates({ db, write: true, backup: false });
    expect(db.calls.updateMany).toBe(0);
    expect(db.calls.deleteOne).toBe(0);
    expect(result.written).toBeNull();
  });

  test("XAVFSIZLIK: qayta tekshiruvda referens QOLSA — dublikat O'CHIRILMAYDI", async () => {
    const canonical = { _id: oid(), title: "2026/2027" };
    const dup = { _id: oid(), title: "2026-2027" };
    let deleteOneCalls = 0;
    const db = {
      collection(name) {
        if (name === "academicyears") {
          return {
            find: () => ({ toArray: async () => [canonical, dup] }),
            deleteOne: async () => {
              deleteOneCalls += 1;
              return { deletedCount: 1 };
            },
          };
        }
        if (name === "groups") {
          return {
            countDocuments: async () => 1,
            find: () => ({ project: () => ({ toArray: async () => [{ _id: oid() }] }) }),
            updateMany: async () => ({ modifiedCount: 0 }),
          };
        }
        return {
          countDocuments: async () => 0,
          find: () => ({ project: () => ({ toArray: async () => [] }) }),
          updateMany: async () => ({ modifiedCount: 0 }),
        };
      },
    };
    const result = await mergeDuplicates({ db, write: true, backup: false });
    expect(deleteOneCalls).toBe(0);
    expect(result.written).toEqual({ merged: 0, refused: 1 });
    expect(result.perPair[0].deleted).toBe(false);
    expect(result.perPair[0].remainingAfterRepoint).toBe(1);
  });
});
