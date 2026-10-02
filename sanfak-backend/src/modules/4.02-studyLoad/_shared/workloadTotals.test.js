const {
  computeWorkloadTotals,
  workloadTotalHours,
} = require("./workloadTotals");

const doc = (directions) => ({ directions });

describe("computeWorkloadTotals", () => {
  test("bloklarni yig'adi: soat va ma'ruza soni", () => {
    const result = computeWorkloadTotals(
      doc([
        { blocks: [{ totalHour: 150 }, { totalHour: 168 }] },
        { blocks: [{ totalHour: 300 }] },
      ]),
    );
    expect(result).toEqual({ totalLectures: 3, totalHours: 618 });
  });

  test("`workloadTotalHours` faqat soatni qaytaradi", () => {
    expect(workloadTotalHours(doc([{ blocks: [{ totalHour: 40 }] }]))).toBe(40);
  });

  test("bloksiz yo'nalish — 0 qo'shadi, qulamaydi", () => {
    expect(computeWorkloadTotals(doc([{ blocks: [] }, {}]))).toEqual({
      totalLectures: 0,
      totalHours: 0,
    });
  });

  test("`totalHour` yo'q blok NaN bermaydi (regressiya)", () => {
    const result = computeWorkloadTotals(doc([{ blocks: [{}, { totalHour: 10 }] }]));
    expect(result.totalHours).toBe(10);
    expect(Number.isNaN(result.totalHours)).toBe(false);
  });

  test("`directions` umuman bo'lmasa 0 (panel maydonni so'ramagan holat)", () => {
    expect(computeWorkloadTotals({})).toEqual({ totalLectures: 0, totalHours: 0 });
    expect(computeWorkloadTotals(null)).toEqual({ totalLectures: 0, totalHours: 0 });
  });
});

describe("approvalInbox — yuklama uchun jami soat ulangan", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const SRC = fs.readFileSync(
    path.join(__dirname, "..", "approvalInbox", "approvalInbox.controller.js"),
    "utf8",
  );

  test("workload entity `totalHourFn` va `totalHourSelect` bilan e'lon qilingan", () => {
    const block = SRC.slice(SRC.indexOf('key: "workload"'), SRC.indexOf('key: "distribution"'));
    expect(block).toMatch(/totalHourSelect:\s*"directions"/);
    expect(block).toMatch(/totalHourFn:\s*workloadTotalHours/);
  });

  test("`buildSelect` hisob manbasini select'ga qo'shadi", () => {
    expect(SRC).toMatch(/if \(entity\.totalHourSelect\) fields\.push\(entity\.totalHourSelect\)/);
  });

  test("natijada `totalHourFn` ustun turadi", () => {
    expect(SRC).toMatch(/totalHour:\s*entity\.totalHourFn/);
  });
});
