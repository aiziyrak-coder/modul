const {
  calculateBlockTotal,
  CLINICAL_PRACTICE_SHARE,
} = require("./workload.model");
const { applyClinicalSplit } = require("../_shared/clinicalPractice");

describe("CLINICAL_PRACTICE_SHARE — konstanta manbasi", () => {
  test("qiymati 0.5 (ADR-018, o'quv reja Izoh 6-band)", () => {
    expect(CLINICAL_PRACTICE_SHARE).toBe(0.5);
  });
});

const buildStudyWork = (classTypes) => ({
  group: 3,
  stream: 2,
  semester: 1,
  thisSemester: { totalHour: 0, auditoriumHour: 0 },
  classTypes,
  items: [],
});

describe("Invariant #1/#2 (ADR-018) — split reja hajmi/yuklamani o'zgartirmaydi", () => {
  const withoutSplit = () =>
    buildStudyWork([
      { slug: "maruza", stream: 10, total: 0 },
      { slug: "klinik_amaliyot", stream: 0, total: 0 },
      { slug: "amaliy", stream: 62, total: 0 },
    ]);

  const withSplit = () => {
    const split = applyClinicalSplit(
      { lecture: 10, seminar: 0, laboratory: 0, practical: 62, clinical: 0 },
      { share: CLINICAL_PRACTICE_SHARE },
    );
    return buildStudyWork([
      { slug: "maruza", stream: split.lecture, total: 0 },
      { slug: "klinik_amaliyot", stream: split.clinical, total: 0 },
      { slug: "amaliy", stream: split.practical, total: 0 },
    ]);
  };

  test("thisSemester.auditoriumHour (reja hajmi, Σ ct.stream) — split'dan oldin/keyin TENG", () => {
    const sw1 = withoutSplit();
    const sw2 = withSplit();
    calculateBlockTotal(sw1, { items: [] }, 0, 55);
    calculateBlockTotal(sw2, { items: [] }, 0, 55);
    expect(sw2.thisSemester.auditoriumHour).toBe(sw1.thisSemester.auditoriumHour);
    expect(sw1.thisSemester.auditoriumHour).toBe(72);
  });

  test("thisSemester.teachingAuditoriumHour (o'qituvchi yuklamasi) — TENG (klinik ham amaliy ham GURUHga ko'payadi)", () => {
    const sw1 = withoutSplit();
    const sw2 = withSplit();
    calculateBlockTotal(sw1, { items: [] }, 0, 55);
    calculateBlockTotal(sw2, { items: [] }, 0, 55);
    expect(sw2.thisSemester.teachingAuditoriumHour).toBe(
      sw1.thisSemester.teachingAuditoriumHour,
    );
    expect(sw1.thisSemester.teachingAuditoriumHour).toBe(206);
  });

  test("thisSemester.totalHour — TENG", () => {
    const sw1 = withoutSplit();
    const sw2 = withSplit();
    calculateBlockTotal(sw1, { items: [] }, 0, 55);
    calculateBlockTotal(sw2, { items: [] }, 0, 55);
    expect(sw2.thisSemester.totalHour).toBe(sw1.thisSemester.totalHour);
  });

  test("calculateBlockTotal qaytargan jami soat (block.totalHour) — TENG", () => {
    const sw1 = withoutSplit();
    const sw2 = withSplit();
    const total1 = calculateBlockTotal(sw1, { items: [] }, 0, 55);
    const total2 = calculateBlockTotal(sw2, { items: [] }, 0, 55);
    expect(total2).toBe(total1);
  });
});

describe("Regressiya qulfi — klinik_amaliyot STREAM_BASED emas (GURUHga ko'payadi)", () => {
  test("klinik_amaliyot.total = stream × GURUH soni (OQIM emas)", () => {
    const sw = buildStudyWork([
      { slug: "klinik_amaliyot", stream: 18, total: 0 },
    ]);
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    const klinik = sw.classTypes.find((c) => c.slug === "klinik_amaliyot");
    expect(klinik.total).toBe(18 * 3);
  });
});
