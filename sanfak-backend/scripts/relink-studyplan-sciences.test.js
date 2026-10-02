const { relink } = require("./relink-studyplan-sciences");

const SCI_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEP_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const makeDb = ({ sciences = [], studyplans = [], workingplans = [], workloads = [] }) => {
  const calls = { updateOne: 0, updateMany: 0 };
  const data = { sciences, studyplans, workingplans, workloads };

  return {
    calls,
    collection(name) {
      const rows = data[name] || [];
      return {
        find: () => ({ toArray: async () => rows }),
        countDocuments: async () => rows.length,
        updateOne: async () => {
          calls.updateOne += 1;
          return { modifiedCount: 1 };
        },
        updateMany: async () => {
          calls.updateMany += 1;
          return { modifiedCount: rows.length };
        },
      };
    },
  };
};

const fixture = () => ({
  sciences: [{ _id: SCI_ID, scienceCode: "FA1200", department: DEP_ID }],
  studyplans: [
    {
      _id: "sp1",
      blocks: [
        {
          blockCode: "MFI",
          sciences: [
            { code: "FA1200", title: "Gigiyena", science: null, department: null },
            { code: "FA1200", title: "Gigiyena", science: "eski-id", department: "eski-dep" },
            { code: "FA120", title: "Gigiyena, harbiy gigiyena", science: null, department: null },
          ],
        },
        {
          blockCode: "TF2",
          sciences: [
            { code: "TM104", title: "Tanishuv amaliyoti", science: null, department: null },
            { code: "BAKYDA504", title: "Yakuniy davlat attestatsiyasi", science: null, department: null },
            { code: "", title: "Jami", science: null, department: null },
          ],
        },
      ],
    },
  ],
  workingplans: [],
  workloads: [{ _id: "w1" }],
});

describe("relink-studyplan-sciences — DRY (default)", () => {
  test("bayroqsiz chaqiruvda DB ga HECH NARSA yozilmaydi", async () => {
    const db = makeDb(fixture());
    const result = await relink({ db });

    expect(result.totalFilled).toBe(1);
    expect(db.calls.updateOne).toBe(0);
    expect(db.calls.updateMany).toBe(0);
    expect(result.written).toBeNull();
    expect(result.backupFile).toBeNull();
  });

  test("write: false ham yozmaydi", async () => {
    const db = makeDb(fixture());
    await relink({ db, write: false });
    expect(db.calls.updateOne).toBe(0);
  });
});

describe("relink-studyplan-sciences — hisobot guruhlari", () => {
  test("MERGE — allaqachon bog'langan qator qayta yozilmaydi", async () => {
    const data = fixture();
    const db = makeDb(data);
    const result = await relink({ db });

    const rows = data.studyplans[0].blocks[0].sciences;
    expect(rows[0].science).toBe(SCI_ID);
    expect(rows[1].science).toBe("eski-id");
    expect(rows[1].department).toBe("eski-dep");
    expect(result.stat.studyplans.already).toBe(1);
    expect(result.stat.studyplans.filled).toBe(1);
  });

  test("amaliyot/attestatsiya alohida guruhda — 'fan topilmadi' emas", async () => {
    const result = await relink({ db: makeDb(fixture()) });

    expect([...result.missing.nonScience.keys()].sort()).toEqual([
      "BAKYDA504",
      "TM104",
    ]);
    expect([...result.missing.science.keys()]).toEqual(["FA120"]);
    expect(result.stat.studyplans.nonScience).toBe(2);
    expect(result.stat.studyplans.notInCatalog).toBe(1);
  });

  test("kodsiz yig'indi qatori alohida sanaladi", async () => {
    const result = await relink({ db: makeDb(fixture()) });
    expect(result.stat.studyplans.noCode).toBe(1);
  });
});

describe("relink-studyplan-sciences — WRITE", () => {
  test("--write bilan faqat o'zgargan hujjat yoziladi", async () => {
    const db = makeDb(fixture());
    const result = await relink({ db, write: true, backup: false });

    expect(db.calls.updateOne).toBe(1);
    expect(db.calls.updateMany).toBe(1);
    expect(result.written).toEqual({
      studyplans: 1,
      workingplans: 0,
      workloads: 1,
    });
  });

  test("o'zgarish bo'lmasa --write ham yozmaydi (idempotent)", async () => {
    const data = fixture();
    data.studyplans[0].blocks[0].sciences[0].science = SCI_ID;
    const db = makeDb(data);

    const result = await relink({ db, write: true, backup: false });

    expect(result.totalFilled).toBe(0);
    expect(db.calls.updateOne).toBe(0);
    expect(db.calls.updateMany).toBe(0);
  });
});
