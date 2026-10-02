const { cleanup, isTargetSlot } = require("./cleanup-elective-slots");

const EMPTY_SLOT_TITLE = "Tanlov fani (tanlanmagan)";

const makeDb = (studyplans) => {
  const calls = { updateOne: 0 };
  return {
    calls,
    collection(name) {
      if (name !== "studyplans") {
        return { find: () => ({ toArray: async () => [] }) };
      }
      return {
        find: () => ({ toArray: async () => studyplans }),
        updateOne: async () => {
          calls.updateOne += 1;
          return { modifiedCount: 1 };
        },
      };
    },
  };
};

const fixture = () => [
  {
    _id: "sp1",
    learningProcess: "lp1",
    blocks: [
      {
        blockCode: "TF2",
        title: "Tanlov fanlar",
        sciences: [
          { title: EMPTY_SLOT_TITLE, science: null, code: null },
          { title: EMPTY_SLOT_TITLE, science: "sci1", code: "FA1001" },
          { title: "Bioetika", science: "sci2", code: "TN1104" },
        ],
      },
      {
        blockCode: "MFI",
        title: "Majburiy fanlar",
        sciences: [{ title: "Anatomiya", science: "sci3", code: "MFI01" }],
      },
    ],
  },
];

describe("isTargetSlot", () => {
  test("title + science:null + code:null — NISHON", () => {
    expect(
      isTargetSlot({ title: EMPTY_SLOT_TITLE, science: null, code: null }),
    ).toBe(true);
  });

  test("science to'ldirilgan bo'lsa — NISHON EMAS (xavfsizlik)", () => {
    expect(
      isTargetSlot({ title: EMPTY_SLOT_TITLE, science: "sci1", code: null }),
    ).toBe(false);
  });

  test("code bor bo'lsa — NISHON EMAS", () => {
    expect(
      isTargetSlot({ title: EMPTY_SLOT_TITLE, science: null, code: "FA1001" }),
    ).toBe(false);
  });

  test("boshqa title — NISHON EMAS", () => {
    expect(isTargetSlot({ title: "Bioetika", science: null, code: null })).toBe(
      false,
    );
  });
});

describe("cleanup (dry-run — DEFAULT)", () => {
  test("DB ga BIRORTA yozuv ketmaydi (`apply` berilmasa)", async () => {
    const db = makeDb(fixture());
    const result = await cleanup({ db, dbName: "test" });

    expect(db.calls.updateOne).toBe(0);
    expect(result.written).toBeNull();
    expect(result.backupFile).toBeNull();
  });

  test("faqat NISHON slot sanaladi — to'ldirilgan/haqiqiy qatorlar TEGILMAYDI", async () => {
    const db = makeDb(fixture());
    const result = await cleanup({ db, dbName: "test" });

    expect(result.scannedPlans).toBe(1);
    expect(result.affectedPlans).toBe(1);
    expect(result.totalRemoved).toBe(1);
    expect(result.perPlan).toEqual([
      { _id: "sp1", learningProcess: "lp1", removed: 1 },
    ]);
  });
});

describe("cleanup (--apply)", () => {
  test("YOZADI — faqat nishon slot olib tashlanadi, qolgani saqlanadi", async () => {
    const db = makeDb(fixture());
    const result = await cleanup({ db, apply: true, backup: false, dbName: "test" });

    expect(db.calls.updateOne).toBe(1);
    expect(result.written).toBe(1);
    expect(result.backupFile).toBeNull();
  });

  test("nishon topilmasa — apply=true bo'lsa ham yozuv YO'Q", async () => {
    const clean = [
      {
        _id: "sp2",
        learningProcess: "lp2",
        blocks: [{ blockCode: "TF2", sciences: [{ title: "Bioetika", science: "sci1", code: "TN1104" }] }],
      },
    ];
    const db = makeDb(clean);
    const result = await cleanup({ db, apply: true, backup: false, dbName: "test" });

    expect(db.calls.updateOne).toBe(0);
    expect(result.written).toBeNull();
  });

  test("zaxira fayl HAQIQATAN yoziladi (`backup` default true)", async () => {
    const db = makeDb(fixture());
    const result = await cleanup({ db, apply: true, dbName: "test" });

    expect(result.backupFile).toEqual(
      expect.stringContaining("cleanup-elective-slots-"),
    );
    const fs = require("fs");
    expect(fs.existsSync(result.backupFile)).toBe(true);
    fs.unlinkSync(result.backupFile);
  });
});
