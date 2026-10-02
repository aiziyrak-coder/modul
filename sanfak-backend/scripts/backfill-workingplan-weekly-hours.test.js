const {
  backfill,
  fillWorkingPlan,
  fillScienceProgram,
  applyRowFill,
  toGlobalSemesterKey,
  indexPlanSciences,
  emptyRowStat,
  ROW_STATUS,
  DOC_SKIP,
  SP_SKIP,
} = require("./backfill-workingplan-weekly-hours");

const SCI_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SCI_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const LP_1 = "cccccccccccccccccccccccc";

const makeDb = (data) => {
  const calls = { updateOne: 0, updateMany: 0 };
  const rows = {
    workingplans: [],
    workingschedules: [],
    studyplans: [],
    scienceprograms: [],
    ...data,
  };

  return {
    calls,
    collection(name) {
      return {
        find: () => ({ toArray: async () => rows[name] || [] }),
        countDocuments: async () => (rows[name] || []).length,
        updateOne: async () => {
          calls.updateOne += 1;
          return { modifiedCount: 1 };
        },
        updateMany: async () => {
          calls.updateMany += 1;
          return { modifiedCount: 1 };
        },
      };
    },
  };
};

const studyPlanFixture = () => ({
  _id: "sp1",
  learningProcess: LP_1,
  blocks: [
    {
      blockCode: "MFI",
      sciences: [
        {
          code: "FA1002",
          science: SCI_A,
          semesters: {
            1: { hour: 9, credit: 9 },
            5: { hour: 4, credit: 4, weeklyHours: 0 },
            6: { hour: 6, credit: 6, weeklyHours: 0 },
          },
        },
        {
          code: "FA1003",
          science: null,
          semesters: { 5: { hour: 2, credit: 2, weeklyHours: 0 } },
        },
      ],
    },
  ],
});

const workingPlanFixture = (over = {}) => ({
  _id: "wp1",
  workingSchedule: "ws1",
  studyPlan: "sp1",
  semesters: {
    1: {
      blocks: [
        {
          blockCode: "MFI",
          sciences: [
            { code: "FA1002", science: SCI_A, weeklyHours: 0 },
            { code: "FA1003", science: null, weeklyHours: 0 },
          ],
        },
      ],
    },
    2: {
      blocks: [
        {
          blockCode: "MFI",
          sciences: [{ code: "FA1002", science: SCI_A, weeklyHours: 0 }],
        },
      ],
    },
  },
  ...over,
});

const scheduleFixture = (over = {}) => ({
  _id: "ws1",
  currentCourse: 3,
  status: "approved",
  learningProcess: LP_1,
  ...over,
});

const fixture = (over = {}) => ({
  workingplans: [workingPlanFixture(over.wp)],
  workingschedules: [scheduleFixture(over.ws)],
  studyplans: [studyPlanFixture()],
  scienceprograms: over.scienceprograms || [],
});

describe("backfill-workingplan-weekly-hours — DRY (default)", () => {
  test("bayroqsiz chaqiruvda DB ga HECH NARSA yozilmaydi", async () => {
    const db = makeDb(fixture());
    const result = await backfill({ db });

    expect(db.calls.updateOne).toBe(0);
    expect(db.calls.updateMany).toBe(0);
    expect(result.written).toBeNull();
    expect(result.wpStat.rows[ROW_STATUS.FILLED]).toBe(3);
  });

  test("qulflangan (approved) hujjat alohida sanaladi", async () => {
    const result = await backfill({ db: makeDb(fixture()) });
    expect(result.wpStat.lockedTouched).toEqual({ approved: 1 });
  });
});

describe("semestr xaritasi — kurs-ichi ↔ global", () => {
  test("3-kurs: local 1→5, local 2→6 (xarita generatsiya kodidan)", () => {
    expect(toGlobalSemesterKey(3, "1")).toBe("5");
    expect(toGlobalSemesterKey(3, "2")).toBe("6");
  });

  test("1-kurs: local 1→1, local 2→2", () => {
    expect(toGlobalSemesterKey(1, "1")).toBe("1");
    expect(toGlobalSemesterKey(1, "2")).toBe("2");
  });

  test("qiymat AYNAN mos global semestrdan olinadi (boshqa kursnikidan emas)", () => {
    const plan = studyPlanFixture();
    const wp = workingPlanFixture();
    const stat = emptyRowStat();
    fillWorkingPlan(wp, scheduleFixture(), plan, stat);

    const sciA = plan.blocks[0].sciences[0];
    expect(wp.semesters[1].blocks[0].sciences[0].weeklyHours).toBe(
      sciA.semesters[5].hour,
    );
    expect(wp.semesters[2].blocks[0].sciences[0].weeklyHours).toBe(
      sciA.semesters[6].hour,
    );
    expect(wp.semesters[1].blocks[0].sciences[0].weeklyHours).not.toBe(
      sciA.semesters[1].hour,
    );
  });

  test("`code` bo'yicha moslash — `science` bo'lmaganda ishlaydi", () => {
    const plan = studyPlanFixture();
    const wp = workingPlanFixture();
    fillWorkingPlan(wp, scheduleFixture(), plan, emptyRowStat());
    expect(wp.semesters[1].blocks[0].sciences[1].weeklyHours).toBe(
      plan.blocks[0].sciences[1].semesters[5].hour,
    );
  });

  test("takrorlangan `code` noaniq — indeksdan chiqariladi", () => {
    const plan = {
      blocks: [
        {
          sciences: [
            { code: "DUP", science: null, semesters: {} },
            { code: "DUP", science: null, semesters: {} },
          ],
        },
      ],
    };
    expect(indexPlanSciences(plan).byCode.has("DUP")).toBe(false);
  });
});

describe("MERGE va arifmetika", () => {
  test("mavjud weeklyHours > 0 buzilmaydi", () => {
    const sci = { weeklyHours: 3 };
    expect(applyRowFill(sci, { hour: 4 })).toBe(ROW_STATUS.ALREADY);
    expect(sci.weeklyHours).toBe(3);
  });

  test("manba qiymati AYNAN ko'chadi (hafta soniga ko'paytirilmaydi)", () => {
    const sci = { weeklyHours: 0 };
    const srcSem = { hour: 4 };
    expect(applyRowFill(sci, srcSem)).toBe(ROW_STATUS.FILLED);
    expect(sci.weeklyHours).toBe(srcSem.hour);
  });

  test("manba qatori topilmasa — NO_MATCH, tegilmaydi", () => {
    const sci = { weeklyHours: 0 };
    expect(applyRowFill(sci, null)).toBe(ROW_STATUS.NO_MATCH);
    expect(sci.weeklyHours).toBe(0);
  });

  test("manba qiymati 0 bo'lsa — NO_SOURCE, tegilmaydi", () => {
    const sci = { weeklyHours: 0 };
    expect(applyRowFill(sci, { hour: 0, weeklyHours: 0 })).toBe(
      ROW_STATUS.NO_SOURCE,
    );
    expect(sci.weeklyHours).toBe(0);
  });

  test("idempotent — ikkinchi o'tishda 0 ta to'ldirish", () => {
    const plan = studyPlanFixture();
    const wp = workingPlanFixture();
    const s1 = emptyRowStat();
    fillWorkingPlan(wp, scheduleFixture(), plan, s1);
    expect(s1[ROW_STATUS.FILLED]).toBe(3);

    const s2 = emptyRowStat();
    fillWorkingPlan(wp, scheduleFixture(), plan, s2);
    expect(s2[ROW_STATUS.FILLED]).toBe(0);
    expect(s2[ROW_STATUS.ALREADY]).toBe(3);
  });
});

describe("orqaga ko'rsatkich — taxmin YO'Q", () => {
  test("studyPlan ko'rsatkichi yo'q + learningProcess YAGONA → ishlanadi", async () => {
    const data = fixture({ wp: { studyPlan: null } });
    const result = await backfill({ db: makeDb(data) });
    expect(result.wpStat.linkViaLearningProcess).toBe(1);
    expect(result.wpStat.skip[DOC_SKIP.NO_PLAN]).toBe(0);
  });

  test("studyPlan yo'q + learningProcess 2 nomzod → O'TKAZIB YUBORILADI", async () => {
    const data = fixture({ wp: { studyPlan: null } });
    data.studyplans = [
      studyPlanFixture(),
      { ...studyPlanFixture(), _id: "sp2" },
    ];
    const result = await backfill({ db: makeDb(data) });
    expect(result.wpStat.skip[DOC_SKIP.NO_PLAN]).toBe(1);
    expect(result.wpStat.rows[ROW_STATUS.FILLED]).toBe(0);
  });

  test("workingSchedule topilmasa → o'tkazib yuboriladi", async () => {
    const data = fixture();
    data.workingschedules = [];
    const result = await backfill({ db: makeDb(data) });
    expect(result.wpStat.skip[DOC_SKIP.NO_SCHEDULE]).toBe(1);
  });

  test("currentCourse yo'q → o'tkazib yuboriladi (xarita qurilmaydi)", async () => {
    const data = fixture({ ws: { currentCourse: null } });
    const result = await backfill({ db: makeDb(data) });
    expect(result.wpStat.skip[DOC_SKIP.NO_COURSE]).toBe(1);
    expect(result.wpStat.rows[ROW_STATUS.FILLED]).toBe(0);
  });
});

describe("2-faza — scienceprograms", () => {
  const wpFilled = () => ({
    _id: "wp1",
    semesters: {
      1: { blocks: [{ sciences: [{ science: SCI_A, weeklyHours: 4 }] }] },
    },
  });

  test("workingPlan ko'rsatkichi bor → to'ldiriladi", () => {
    const spg = { science: SCI_A, workingPlan: "wp1", weeklyHours: null };
    const wp = wpFilled();
    const r = fillScienceProgram(spg, new Map([["wp1", wp]]), [wp], false);
    expect(r.status).toBe(ROW_STATUS.FILLED);
    expect(spg.weeklyHours).toBe(wp.semesters[1].blocks[0].sciences[0].weeklyHours);
  });

  test("ko'rsatkich yo'q → DEFAULT: o'tkazib yuboriladi, TAXMIN yo'q", () => {
    const spg = { science: SCI_A, workingPlan: null, weeklyHours: null };
    const wp = wpFilled();
    const r = fillScienceProgram(spg, new Map(), [wp], false);
    expect(r.status).toBe(SP_SKIP.NO_POINTER);
    expect(spg.weeklyHours).toBeNull();
  });

  test("--sp-agree: nomzodlar bir xil qiymat bersa → to'ldiriladi", () => {
    const spg = { science: SCI_A, workingPlan: null, weeklyHours: null };
    const a = wpFilled();
    const b = { ...wpFilled(), _id: "wp2" };
    const r = fillScienceProgram(spg, new Map(), [a, b], true);
    expect(r.status).toBe(ROW_STATUS.FILLED);
    expect(spg.weeklyHours).toBe(4);
  });

  test("--sp-agree: nomzodlar kelishmasa → NOANIQ, tegilmaydi", () => {
    const spg = { science: SCI_A, workingPlan: null, weeklyHours: null };
    const a = wpFilled();
    const b = {
      _id: "wp2",
      semesters: {
        1: { blocks: [{ sciences: [{ science: SCI_A, weeklyHours: 6 }] }] },
      },
    };
    const r = fillScienceProgram(spg, new Map(), [a, b], true);
    expect(r.status).toBe(SP_SKIP.AMBIGUOUS);
    expect(spg.weeklyHours).toBeNull();
  });

  test("mavjud weeklyHours > 0 buzilmaydi (MERGE)", () => {
    const spg = { science: SCI_A, workingPlan: "wp1", weeklyHours: 3 };
    const wp = wpFilled();
    const r = fillScienceProgram(spg, new Map([["wp1", wp]]), [wp], false);
    expect(r.status).toBe(ROW_STATUS.ALREADY);
    expect(spg.weeklyHours).toBe(3);
  });

  test("zanjir: 1-faza to'ldirgan qiymat 2-fazada ishlatiladi", async () => {
    const data = fixture({
      scienceprograms: [
        {
          _id: "spg1",
          science: SCI_A,
          workingPlan: "wp1",
          weeklyHours: null,
          status: "approved",
        },
      ],
    });
    const result = await backfill({ db: makeDb(data) });
    expect(result.spStat[ROW_STATUS.FILLED]).toBe(1);
    expect(result.spUpdates[0].weeklyHours).toBe(
      studyPlanFixture().blocks[0].sciences[0].semesters[5].hour,
    );
    expect(result.spStat.lockedTouched).toEqual({ approved: 1 });
  });

  test("fan rejada yo'q → NO_MATCH", () => {
    const spg = { science: SCI_B, workingPlan: "wp1", weeklyHours: null };
    const wp = wpFilled();
    const r = fillScienceProgram(spg, new Map([["wp1", wp]]), [wp], false);
    expect(r.status).toBe(SP_SKIP.NO_MATCH);
  });
});
