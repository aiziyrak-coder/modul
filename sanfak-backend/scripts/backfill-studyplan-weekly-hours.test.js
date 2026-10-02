const {
  backfill,
  applyFill,
  fillBlocks,
  emptyStat,
  FILL_STATUS,
} = require("./backfill-studyplan-weekly-hours");

const makeDb = ({ studyplans = [] }) => {
  const calls = { updateOne: 0, updateMany: 0 };
  const data = { studyplans };

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
  studyplans: [
    {
      _id: "sp1",
      blocks: [
        {
          blockCode: "MFI",
          sciences: [
            {
              code: "FA1002",
              semesters: {
                1: { hour: 4, credit: 4, weeklyHours: 0 },
                2: { hour: 4, credit: 4, weeklyHours: 3 },
                3: { hour: 0, credit: 0, weeklyHours: 0 },
              },
            },
            {
              code: "FA1003",
              semesters: {
                1: { hour: 6, credit: 6 },
              },
            },
          ],
        },
      ],
    },
  ],
});

describe("backfill-studyplan-weekly-hours — DRY (default)", () => {
  test("bayroqsiz chaqiruvda DB ga HECH NARSA yozilmaydi", async () => {
    const db = makeDb(fixture());
    const result = await backfill({ db });

    expect(db.calls.updateOne).toBe(0);
    expect(db.calls.updateMany).toBe(0);
    expect(result.written).toBeNull();
    expect(result.totalFilled).toBe(2);
  });

  test("hisobot raqamlari: to'ldiriladi / allaqachon / manbasiz", async () => {
    const result = await backfill({ db: makeDb(fixture()) });

    expect(result.stat.docs).toBe(1);
    expect(result.stat.changedDocs).toBe(1);
    expect(result.stat[FILL_STATUS.FILLED]).toBe(2);
    expect(result.stat[FILL_STATUS.ALREADY]).toBe(1);
    expect(result.stat[FILL_STATUS.NO_SOURCE]).toBe(1);
  });
});

describe("backfill-studyplan-weekly-hours — MERGE va arifmetika", () => {
  test("mavjud weeklyHours > 0 buzilmaydi", () => {
    const sem = { hour: 4, weeklyHours: 3 };
    expect(applyFill(sem)).toBe(FILL_STATUS.ALREADY);
    expect(sem.weeklyHours).toBe(3);
  });

  test("bo'sh weeklyHours `hour` ning AYNAN qiymatini oladi (ko'paytirish yo'q)", () => {
    const sem = { hour: 4, weeklyHours: 0 };
    expect(applyFill(sem)).toBe(FILL_STATUS.FILLED);
    expect(sem.weeklyHours).toBe(sem.hour);
  });

  test("hour ham 0 bo'lsa tegilmaydi (mavjud xulq saqlanadi)", () => {
    const sem = { hour: 0, weeklyHours: 0 };
    expect(applyFill(sem)).toBe(FILL_STATUS.NO_SOURCE);
    expect(sem.weeklyHours).toBe(0);
  });

  test("idempotent — ikkinchi o'tishda 0 ta to'ldirish", () => {
    const { studyplans } = fixture();
    const stat1 = emptyStat();
    fillBlocks(studyplans[0].blocks, stat1);
    expect(stat1[FILL_STATUS.FILLED]).toBe(2);

    const stat2 = emptyStat();
    fillBlocks(studyplans[0].blocks, stat2);
    expect(stat2[FILL_STATUS.FILLED]).toBe(0);
    expect(stat2[FILL_STATUS.ALREADY]).toBe(3);
  });
});
