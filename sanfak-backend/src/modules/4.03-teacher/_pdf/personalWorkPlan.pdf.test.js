jest.mock("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
jest.mock("#modules/4.03-teacher/personalReport/personalReport.model");

jest.mock("./_blankaTable", () => {
  const actual = jest.requireActual("./_blankaTable");
  return {
    ...actual,
    ct: jest.fn(actual.ct),
    drawFooterLandscape: jest.fn(actual.drawFooterLandscape),
  };
});

const PersonalWorkPlan = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const PersonalReport = require("#modules/4.03-teacher/personalReport/personalReport.model");
const { ct, drawFooterLandscape, CW, PG } = require("./_blankaTable");
const {
  buildPersonalWorkPlanPdf,
  COLS_TEACHING,
  COLS_WORK,
  SIGNATORIES,
  SECTION_TITLES,
  SIGN_W,
  ERI_TEXT,
  buildTeachingRows,
  buildTeachingTotalRow,
  buildSignatureRows,
  buildKotibLines,
  pickReports,
  shortName,
} = require("./personalWorkPlan.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const chainableFind = (docs) => {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(docs);
  return chain;
};

const mockPlan = {
  _id: "planId123",
  name: null,
  status: "approved",
  academicYear: { title: "2025/2026" },
  teacher: {
    firstName: "Anvar",
    lastName: "Anatomov",
    middleName: "Akramovich",
    department: {
      title: "Normal anatomiya kafedrasi",
      faculty: { title: "Davolash ishi fakulteti" },
    },
    position: { title: "Dotsent" },
  },
  teachingLoad: {
    plannedHour: 248,
    sciences: [
      {
        science: { title: "Odam anatomiyasi 1,2,3" },
        course: 1,
        semester: 1,
        hoursByType: {
          lecture: 24,
          seminar: 96,
          laboratory: 0,
          practical: 4,
          independent: 0,
        },
        totalHour: 124,
        stavka: 0.5,
      },
      {
        science: { title: "Odam anatomiyasi 1,2,3" },
        course: 1,
        semester: 2,
        hoursByType: {
          lecture: 24,
          seminar: 96,
          laboratory: 0,
          practical: 0,
          independent: 0,
        },
        totalHour: 124,
        stavka: 0.5,
      },
    ],
  },
  methodicalWork: [
    {
      title: "Uslubiy qo'llanma tayyorlash",
      plannedCount: 1,
      actualCount: 1,
      semester: [1],
      deadline: new Date("2026-01-10"),
      effectiveStatus: "completed",
    },
  ],
  researchWork: [],
  mentoringWork: [],
  organizationalWork: [],
  extraWork: [],
  approvals: [
    { step: "teacher", status: "approved", approvedBy: { firstName: "Anvar", lastName: "Anatomov" }, date: new Date("2026-09-01") },
    { step: "kafedraUslubiy", status: "pending", approvedBy: null, date: null },
    { step: "kafedraIlmiy", status: "pending", approvedBy: null, date: null },
    { step: "kafedraUstozShogird", status: "pending", approvedBy: null, date: null },
    { step: "kafedraMudiri", status: "approved", approvedBy: { firstName: "Anatom", lastName: "Mudirov" }, date: new Date("2026-09-02") },
    { step: "oquvUslubiy", status: "pending", approvedBy: null, date: null },
    { step: "dekan", status: "rejected", approvedBy: { firstName: "Dilshod", lastName: "Rahmonov" }, date: new Date("2026-09-03") },
    { step: "ichkiNazorat", status: "pending", approvedBy: null, date: null },
  ],
};

const reportSem1 = {
  semester: 1,
  status: "approved",
  approvals: [
    { step: "dekan", status: "approved", approvedBy: { firstName: "Dilshod", lastName: "Rahmonov" }, date: new Date("2026-09-05") },
    { step: "kotib", status: "approved", approvedBy: { firstName: "Bek", lastName: "Ismatov" }, date: new Date("2026-09-06") },
  ],
};

async function renderTexts(plan = mockPlan, reports = []) {
  PersonalWorkPlan.findOne = jest.fn().mockReturnValue(chainablePopulate(plan));
  PersonalReport.find = jest.fn().mockReturnValue(chainableFind(reports));
  const doc = await buildPersonalWorkPlanPdf("planId123", {});
  doc.end();
  const texts = ct.mock.calls.map(([, text]) => String(text ?? ""));
  return { doc, texts };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("blanka kontrakti — I bo'lim ustunlari", () => {
  test("18 ustun (№ + 17), kengliklar yig'indisi = CW", () => {
    expect(COLS_TEACHING).toHaveLength(18);
    const sum = COLS_TEACHING.reduce((acc, c) => acc + c.w, 0);
    expect(sum).toBe(CW);
    expect(CW).toBe(PG.W - PG.M * 2);
  });

  test("ustun nomlari blankadagi tartibda", () => {
    expect(COLS_TEACHING.map((c) => c.hdr)).toEqual([
      "№",
      "Fan nomi",
      "bakalavriatura",
      "Klinik ordinatura",
      "Magistratura",
      "fakultet",
      "kurs",
      "Oqim soni",
      "Guruh soni",
      "Ma'ruza o'tkazish",
      "Amaliy, seminar va laboratoriya ishlarini o'tkazish",
      "Oraliq nazorat o'tkazish",
      "Yakuniy nazorat o'tkazish",
      "Qayta topshirish",
      "Malakaviy amaliyotga rahbarlik",
      "Turdosh fanlardan dars berish",
      "KO'larga rahbarlik qilish",
      "Jami",
    ]);
  });

  test("II–VI va imzo jadvali kengliklari ham CW ga teng", () => {
    expect(COLS_WORK.reduce((acc, c) => acc + c.w, 0)).toBe(CW);
    expect(Object.values(SIGN_W).reduce((acc, w) => acc + w, 0)).toBe(CW);
  });
});

describe("I bo'lim ma'lumot xaritasi", () => {
  test("seminar + laboratory + practical yig'indisi bitta katakda", () => {
    const rows = buildTeachingRows(mockPlan);
    expect(rows[0].lecture).toBe("24");
    expect(rows[0].practice).toBe("100");
    expect(rows[1].practice).toBe("96");
    expect(rows[0].total).toBe("124");
    expect(rows[0].faculty).toBe("Davolash ishi fakulteti");
  });

  test("ESKI qatorda blanka ustunlari BO'SH qoladi ('0' ham, '—' ham emas)", () => {
    const [row] = buildTeachingRows(mockPlan);
    for (const key of [
      "bachelor",
      "ordinatura",
      "magistratura",
      "stream",
      "group",
      "on",
      "yan",
      "retake",
      "practiceLead",
      "related",
      "koLead",
    ]) {
      expect(row[key]).toBe("");
    }
  });

  test("Jami satri — plannedHour va mavjud ustun yig'indilari", () => {
    const rows = buildTeachingRows(mockPlan);
    const total = buildTeachingTotalRow(mockPlan, rows);
    expect(total.science).toBe("Jami");
    expect(total.lecture).toBe("48");
    expect(total.practice).toBe("196");
    expect(total.total).toBe("248");
    expect(total.course).toBe("");
  });
});

describe("imzo jadvali — 8 imzolovchi × 2 qator", () => {
  test("tartib va lavozimlar blanka ro'yxati bo'yicha", () => {
    expect(SIGNATORIES.map((s) => s.step)).toEqual([
      "kafedraMudiri",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
      "teacher",
      "oquvUslubiy",
      "dekan",
      "ichkiNazorat",
    ]);
  });

  test("taqsimot qatori — approved/rejected/pending", () => {
    const rows = buildSignatureRows(mockPlan, []);
    expect(rows).toHaveLength(8);
    const byStep = Object.fromEntries(rows.map((r) => [r.step, r]));

    expect(byStep.kafedraMudiri.taqsimot.kuzgi).toEqual({
      imzo: ERI_TEXT,
      sana: "02.09.2026",
    });
    expect(byStep.kafedraMudiri.taqsimot.bahorgi).toEqual({ imzo: "", sana: "" });
    expect(byStep.kafedraMudiri.fio).toBe("Mudirov Anatom");

    expect(byStep.oquvUslubiy.taqsimot.kuzgi).toEqual({ imzo: "", sana: "" });
    expect(byStep.oquvUslubiy.fio).toBe("");

    expect(byStep.dekan.taqsimot.kuzgi).toEqual({
      imzo: "Rad etilgan",
      sana: "03.09.2026",
    });
  });

  test("approvals bo'sh bo'lsa — hamma katak bo'sh", () => {
    const rows = buildSignatureRows({ approvals: [] }, []);
    for (const row of rows) {
      expect(row.fio).toBe("");
      expect(row.taqsimot.kuzgi).toEqual({ imzo: "", sana: "" });
      expect(row.bajaruv.kuzgi).toEqual({ imzo: "", sana: "" });
    }
  });
});

describe("bajaruv qatori — hisobot zanjiri", () => {
  test("hisobot yo'q -> barcha bajaruv kataklari bo'sh", () => {
    const rows = buildSignatureRows(mockPlan, []);
    for (const row of rows) {
      expect(row.bajaruv.kuzgi).toEqual({ imzo: "", sana: "" });
      expect(row.bajaruv.bahorgi).toEqual({ imzo: "", sana: "" });
    }
  });

  test("semestr 1 approved -> dekan qatorining KUZGI bajaruv katagi", () => {
    const rows = buildSignatureRows(mockPlan, [reportSem1]);
    const dekan = rows.find((r) => r.step === "dekan");
    expect(dekan.bajaruv.kuzgi).toEqual({ imzo: ERI_TEXT, sana: "05.09.2026" });
    expect(dekan.bajaruv.bahorgi).toEqual({ imzo: "", sana: "" });
    expect(rows.find((r) => r.step === "teacher").bajaruv.kuzgi).toEqual({
      imzo: "",
      sana: "",
    });
  });

  test("semestr 2 -> BAHORGI bajaruv katagi", () => {
    const rows = buildSignatureRows(mockPlan, [
      { ...reportSem1, semester: 2 },
    ]);
    const dekan = rows.find((r) => r.step === "dekan");
    expect(dekan.bajaruv.bahorgi).toEqual({ imzo: ERI_TEXT, sana: "05.09.2026" });
    expect(dekan.bajaruv.kuzgi).toEqual({ imzo: "", sana: "" });
  });

  test("kengash kotibi imzosi jadvalga EMAS, alohida satrga chiqadi", () => {
    const lines = buildKotibLines([reportSem1]);
    expect(lines).toEqual([
      "Hisobot: Kuzgi semestr — kengash kotibi Ismatov Bek tasdiqladi, 06.09.2026",
    ]);
    expect(buildKotibLines([])).toEqual([]);
    expect(
      buildKotibLines([
        { semester: 1, approvals: [{ step: "kotib", status: "pending" }] },
      ]),
    ).toEqual([]);
  });

  test("bir semestrda ikki hisobot -> imzolangani tanlanadi", () => {
    const draft = { semester: 1, approvals: [{ step: "dekan", status: "pending" }] };
    expect(pickReports([draft, reportSem1])).toEqual([reportSem1]);
    expect(pickReports([reportSem1, draft])).toEqual([reportSem1]);
  });
});

describe("render — blanka matni va sahifalar", () => {
  test("sarlavha '<F.I.O>ning <yil> o'quv yili uchun shaxsiy ish rejasi'", async () => {
    const { texts } = await renderTexts(mockPlan, [reportSem1]);
    expect(shortName(mockPlan.teacher)).toBe("Anatomov A.A.");
    expect(texts).toContain(
      "Anatomov A.A.ning 2025/2026 o'quv yili uchun shaxsiy ish rejasi",
    );
  });

  test("imzo jadvalida 8 ta 'taqsimot' va 8 ta 'bajaruv' katagi", async () => {
    const { texts } = await renderTexts(mockPlan, [reportSem1]);
    expect(texts.filter((t) => t === "taqsimot")).toHaveLength(8);
    expect(texts.filter((t) => t === "bajaruv")).toHaveLength(8);
    for (const { label } of SIGNATORIES) expect(texts).toContain(label);
    expect(texts).toContain("KUZGI SEMESTR");
    expect(texts).toContain("BAHORGI SEMESTR");
    expect(texts).toContain("Hisobot turi");
  });

  test("bo'sh bo'lim ham chiziladi (blanka VI gacha) — 'Rejalashtirilmagan'", async () => {
    const { texts } = await renderTexts(mockPlan, []);
    for (const title of Object.values(SECTION_TITLES)) {
      expect(texts).toContain(title);
    }
    expect(texts.filter((t) => t === "Rejalashtirilmagan")).toHaveLength(4);
  });

  test("hech bir katakda '0' yozilmaydi (bo'sh katak qoladi)", async () => {
    const { texts } = await renderTexts(mockPlan, [reportSem1]);
    expect(texts.filter((t) => t === "0")).toHaveLength(0);
    expect(texts.filter((t) => t === "—")).toHaveLength(0);
  });

  test("1–2 sahifa (F-24: ortiqcha/bo'sh sahifa yo'q)", async () => {
    await renderTexts(mockPlan, [reportSem1]);
    const pageCount = drawFooterLandscape.mock.results[0].value;
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(pageCount).toBeLessThanOrEqual(2);
  });

  test("mock reja bilan xatosiz PDF quriladi va baytlar chiqadi", async () => {
    PersonalWorkPlan.findOne = jest
      .fn()
      .mockReturnValue(chainablePopulate(mockPlan));
    PersonalReport.find = jest.fn().mockReturnValue(chainableFind([reportSem1]));

    const doc = await buildPersonalWorkPlanPdf("planId123", {});
    const chunks = [];
    const finished = new Promise((resolve) => {
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", resolve);
    });
    doc.end();
    await finished;

    expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
  });
});

describe("buildPersonalWorkPlanPdf — scope (begona rejani yuklab olmaslik)", () => {
  test("scope filtri `findOne`ga uzatiladi", async () => {
    PersonalWorkPlan.findOne = jest
      .fn()
      .mockReturnValue(chainablePopulate(mockPlan));
    PersonalReport.find = jest.fn().mockReturnValue(chainableFind([]));

    await buildPersonalWorkPlanPdf("planId123", { teacher: "ownerId" });

    expect(PersonalWorkPlan.findOne).toHaveBeenCalledWith({
      _id: "planId123",
      teacher: "ownerId",
    });
  });

  test("reja topilmasa (yoki scope tashqarisida) 404 tashlaydi", async () => {
    PersonalWorkPlan.findOne = jest.fn().mockReturnValue(chainablePopulate(null));
    PersonalReport.find = jest.fn().mockReturnValue(chainableFind([]));

    await expect(
      buildPersonalWorkPlanPdf("planId123", {}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("reja topilmasa hisobot ham so'ralmaydi (keraksiz so'rov yo'q)", async () => {
    PersonalWorkPlan.findOne = jest.fn().mockReturnValue(chainablePopulate(null));
    PersonalReport.find = jest.fn().mockReturnValue(chainableFind([]));

    await expect(
      buildPersonalWorkPlanPdf("planId123", {}),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(PersonalReport.find).not.toHaveBeenCalled();
  });
});
