const {
  buildTeachingRows,
  buildTeachingTotalRow,
  teachingFootnote,
} = require("./personalWorkPlan.pdf");

const fresh = (over = {}) => ({
  science: { title: "Odam anatomiyasi" },
  course: 2,
  streamCount: 1,
  groupCount: 8,
  totalHour: 226,
  hoursByType: {
    lecture: 24, seminar: 192, laboratory: 0, practical: 0, independent: 10,
    on: 0, yan: 0, retake: 10, practiceLead: 0, otherWork: 0, adjustment: 0,
  },
  ...over,
});
const legacy = () => ({
  science: { title: "Eski fan" },
  course: 1,
  totalHour: 130,
  hoursByType: { lecture: 20, seminar: 100, laboratory: 0, practical: 0, independent: 10 },
});
const plan = (sciences, plannedHour) => ({ teachingLoad: { plannedHour, sciences } });

describe("D-3b — yangi qator: blanka ustunlari to'la", () => {
  test("test4 defekti: qayta topshirish 10, oqim 1, guruh 8", () => {
    const [row] = buildTeachingRows(plan([fresh()], 226));
    expect(row).toMatchObject({ lecture: "24", practice: "192", retake: "10", stream: "1", group: "8", total: "226" });
    expect(row.on).toBe("");
  });

  test("oqim — faqat ma'ruza bo'lsa, guruh — faqat amaliy bo'lsa", () => {
    const h = { ...fresh().hoursByType, lecture: 0 };
    const [row] = buildTeachingRows(plan([fresh({ hoursByType: h })], 226));
    expect(row.stream).toBe("");
    expect(row.group).toBe("8");
  });

  test("KO, turdosh fanlar, ta'lim darajasi — manba yo'q, bo'sh", () => {
    const [row] = buildTeachingRows(plan([fresh()], 226));
    for (const key of ["bachelor", "ordinatura", "magistratura", "related", "koLead"]) expect(row[key]).toBe("");
  });

  test("Jami: soat ustunlari qo'shiladi (sonlar emas), ustunlar = rejadagi jami", () => {
    const p = plan([fresh(), fresh()], 452);
    const total = buildTeachingTotalRow(p, buildTeachingRows(p));
    expect(total).toMatchObject({ lecture: "48", practice: "384", retake: "20", total: "452", stream: "", group: "" });
    expect(teachingFootnote(p)).toBeNull();
  });
});

describe("D-3b — izoh: ustunlarga kirmagan soatlar (egasi qarori)", () => {
  test("eski qator: ustunlar bo'sh, `independent` izohda — ajratilmagani aytiladi", () => {
    const text = teachingFootnote(plan([legacy()], 130));
    expect(text).toMatch(/ko'rsatilmagan soatlar: 10 /);
    expect(text).toMatch(/eski formatdagi qatorlarda/);
  });

  test("yangi qator: boshqa ishlar + manfiy tuzatish yig'iladi", () => {
    const h = { ...fresh().hoursByType, otherWork: 12, adjustment: -2 };
    expect(teachingFootnote(plan([fresh({ hoursByType: h })], 226))).toMatch(/ko'rsatilmagan soatlar: 10 \(boshqa/);
  });

  test("aralash reja: ustunlar + izoh = jami (226 + 130 = 356)", () => {
    const p = plan([fresh(), legacy()], 356);
    const total = buildTeachingTotalRow(p, buildTeachingRows(p));
    const columns = ["lecture", "practice", "on", "yan", "retake", "practiceLead"].reduce((a, k) => a + (Number(total[k]) || 0), 0);
    const note = Number(teachingFootnote(p).match(/soatlar: ([\d.]+)/)[1]);
    expect(columns + note).toBe(356);
  });

  test("ustunlarga hammasi sig'sa — izoh yo'q", () => {
    expect(teachingFootnote(plan([fresh()], 226))).toBeNull();
    expect(teachingFootnote({})).toBeNull();
  });
});
