const { summarizeSections } = require("./personalWorkPlan.controller");
const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const { monitoringExportQuery } = require("./personalWorkPlan.validation");

describe("summarizeSections — F-1 (TZ 4.3.9)", () => {
  test("bo'sh reja — totalItems/completedItems/overdueCount 0, completionPercent 0 (NaN emas)", () => {
    const result = summarizeSections({});
    expect(result).toEqual({
      totalItems: 0,
      completedItems: 0,
      overdueCount: 0,
      completionPercent: 0,
    });
    expect(Number.isFinite(result.completionPercent)).toBe(true);
  });

  test("5 bo'lim bo'yicha umumiy yig'indi to'g'ri hisoblanadi", () => {
    const plan = {
      methodicalWork: [{ status: "completed" }],
      researchWork: [{ status: "planned" }, { status: "completed" }],
      mentoringWork: [],
      organizationalWork: [{ status: "cancelled" }],
      extraWork: [{ status: "completed" }],
    };
    const result = summarizeSections(plan);
    expect(result.totalItems).toBe(5);
    expect(result.completedItems).toBe(3);
    expect(result.completionPercent).toBe(60);
  });

  test("`overdueCount` — faqat `effectiveStatus === 'overdue'` elementlarni sanaydi", () => {
    const plan = {
      researchWork: [
        { status: "planned", effectiveStatus: "overdue" },
        { status: "planned", effectiveStatus: "planned" },
        { status: "completed", effectiveStatus: "completed" },
      ],
    };
    const result = summarizeSections(plan);
    expect(result.overdueCount).toBe(1);
    expect(result.totalItems).toBe(3);
  });

  test("`completionPercent` butun songa yaxlitlanadi", () => {
    const plan = {
      researchWork: [
        { status: "completed" },
        { status: "planned" },
        { status: "planned" },
      ],
    };
    expect(summarizeSections(plan).completionPercent).toBe(33);
  });

  test("to'liq mongoose hujjatda (lean EMAS) muddati o'tgan ish `overdue` deb hisoblanadi", () => {
    const plan = new PersonalWorkPlanModel({
      teacher: "aaaaaaaaaaaaaaaaaaaaaaaa",
      academicYear: "bbbbbbbbbbbbbbbbbbbbbbbb",
      researchWork: [
        {
          title: "Muddati o'tgan ish",
          status: "planned",
          deadline: new Date("2020-01-01"),
        },
      ],
      mentoringWork: [{ title: "Bajarilgan ish", status: "completed" }],
    });

    const result = summarizeSections(plan);
    expect(result.overdueCount).toBe(1);
    expect(result.totalItems).toBe(2);
    expect(result.completedItems).toBe(1);
    expect(result.completionPercent).toBe(50);
  });

  test("kelajakdagi muddat — `overdue` DEB hisoblanmaydi", () => {
    const plan = new PersonalWorkPlanModel({
      teacher: "aaaaaaaaaaaaaaaaaaaaaaaa",
      academicYear: "bbbbbbbbbbbbbbbbbbbbbbbb",
      researchWork: [
        { title: "Kelajakdagi ish", status: "planned", deadline: new Date("2099-01-01") },
      ],
    });
    expect(summarizeSections(plan).overdueCount).toBe(0);
  });
});

describe("monitoringExportQuery — F-2 (GET /monitoring/export)", () => {
  test("`format` berilmasa ham qabul qilinadi (controller standart 'excel' oladi)", () => {
    expect(monitoringExportQuery.validate({}).error).toBeUndefined();
  });

  test("`format: 'excel'` va `format: 'pdf'` qabul qilinadi", () => {
    expect(monitoringExportQuery.validate({ format: "excel" }).error).toBeUndefined();
    expect(monitoringExportQuery.validate({ format: "pdf" }).error).toBeUndefined();
  });

  test("noto'g'ri `format` rad etiladi", () => {
    expect(monitoringExportQuery.validate({ format: "csv" }).error).toBeDefined();
  });

  test("`monitoring` bilan bir xil filtrlar (`teacher`, `academicYear`) ham qabul qilinadi", () => {
    const { error } = monitoringExportQuery.validate({
      teacher: "aaaaaaaaaaaaaaaaaaaaaaaa",
      academicYear: "bbbbbbbbbbbbbbbbbbbbbbbb",
      format: "pdf",
    });
    expect(error).toBeUndefined();
  });
});

describe("summarizeSections — D-21 rad etilgan dalil", () => {
  test("rad etilgan dalil bajarilgan hisoblanmaydi (50%, 100% emas)", () => {
    const plan = {
      researchWork: [
        { status: "completed", verification: { status: "approved" } },
        { status: "completed", verification: { status: "rejected" } },
      ],
    };
    const result = summarizeSections(plan);
    expect(result.completedItems).toBe(1);
    expect(result.completionPercent).toBe(50);
  });
});
