const {
  resolveWeeklyHours,
  buildSemesterTable,
  buildSemestersBlocksTable,
} = require("./semesterBreakdown");

describe("resolveWeeklyHours", () => {
  test("weeklyHours bo'sh bo'lsa — hour dan olinadi", () => {
    const sem = { hour: 4, credit: 4, weeklyHours: 0 };
    expect(resolveWeeklyHours(sem)).toBe(sem.hour);
  });

  test("weeklyHours maydoni umuman yo'q bo'lsa ham — hour dan olinadi", () => {
    const sem = { hour: 6, credit: 6 };
    expect(resolveWeeklyHours(sem)).toBe(sem.hour);
  });

  test("weeklyHours to'ldirilgan bo'lsa — U USTUN", () => {
    expect(resolveWeeklyHours({ hour: 4, weeklyHours: 3 })).toBe(3);
  });

  test("ikkalasi ham bo'sh bo'lsa — 0 (mavjud xulq)", () => {
    expect(resolveWeeklyHours({ hour: 0, weeklyHours: 0 })).toBe(0);
    expect(resolveWeeklyHours({})).toBe(0);
    expect(resolveWeeklyHours(null)).toBe(0);
  });

  test("hafta soniga KO'PAYTIRILMAYDI — qiymat aynan ko'chadi", () => {
    const sem = { hour: 3 };
    expect(resolveWeeklyHours(sem)).toBe(sem.hour);
  });
});

const planFixture = (sem) => ({
  meta: {
    particles: { items: [{ slug: "maruza", title: "Ma'ruza", colNum: 1 }] },
    distribution: { semester: [1] },
  },
  blocks: [
    {
      blockCode: "MFI",
      title: "Majburiy fanlar",
      sciences: [
        {
          code: "FA1002",
          title: "Kommunal gigiyena",
          particle: [{ slug: "maruza", title: "Ma'ruza", value: 30 }],
          semesters: { 1: sem },
        },
      ],
    },
  ],
});

describe("semesterBreakdown — fallback ikkala jadvalda ham amal qiladi", () => {
  test("buildSemesterTable: weeklyHours bo'sh → hour", () => {
    const sem = { hour: 4, credit: 4, weeklyHours: 0 };
    const { fans } = buildSemesterTable(planFixture(sem), 1);
    expect(fans[0].weeklyHours).toBe(sem.hour);
  });

  test("buildSemesterTable: weeklyHours bor → u ustun", () => {
    const { fans } = buildSemesterTable(
      planFixture({ hour: 4, credit: 4, weeklyHours: 3 }),
      1,
    );
    expect(fans[0].weeklyHours).toBe(3);
  });

  test("buildSemestersBlocksTable: weeklyHours bo'sh → hour", () => {
    const sem = { hour: 4, credit: 4, weeklyHours: 0 };
    const { semesters } = buildSemestersBlocksTable(planFixture(sem), ["1"]);
    expect(semesters[0].blocks[0].fans[0].weeklyHours).toBe(sem.hour);
  });

  test("buildSemestersBlocksTable: weeklyHours bor → u ustun", () => {
    const { semesters } = buildSemestersBlocksTable(
      planFixture({ hour: 4, credit: 4, weeklyHours: 3 }),
      ["1"],
    );
    expect(semesters[0].blocks[0].fans[0].weeklyHours).toBe(3);
  });
});
