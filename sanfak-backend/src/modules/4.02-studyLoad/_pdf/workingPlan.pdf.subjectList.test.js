jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const { buildSubjectRows } = require("./workingPlan.pdf");

const SCI_ID = "6a7d69082200e50d919e2b40";

const mandatoryBlock = (sciences) => ({
  blockCode: "MFI",
  title: "Majburiy fanlar",
  sciences,
});

const electiveBlock = (sciences) => ({
  blockCode: "TF2",
  title: "Tanlov fanlari",
  sciences,
});

const sumCredit = (rows) => rows.reduce((s, r) => s + (r.credit || 0), 0);

describe("workingPlan.pdf — buildSubjectRows (III. FANLAR RO'YXATI)", () => {
  test("bir fan ikki semestrda bo'lsa — BITTA qator, kredit yig'iladi", () => {
    const blocks = [
      mandatoryBlock([
        { science: SCI_ID, code: "FA1002", title: "Kommunal gigiyena", totalCredit: 3 },
      ]),
      mandatoryBlock([
        { science: SCI_ID, code: "FA1002", title: "Kommunal gigiyena", totalCredit: 2 },
      ]),
    ];

    const { majburiy, tanlov } = buildSubjectRows(blocks);

    expect(majburiy).toHaveLength(1);
    expect(tanlov).toHaveLength(0);
    expect(majburiy[0].credit).toBe(5);
    expect(majburiy[0].code).toBe("FA1002");
  });

  test("noyoblashtirish kreditni yo'qotmaydi — 'Jami' xom qatorlar yig'indisiga teng", () => {
    const raw = [
      { science: "a", code: "FA1", title: "Fan A", totalCredit: 4 },
      { science: "b", code: "FA2", title: "Fan B", totalCredit: 2 },
      { science: "a", code: "FA1", title: "Fan A", totalCredit: 4 },
      { science: "c", code: "FA3", title: "Fan C", totalCredit: 3 },
      { science: "b", code: "FA2", title: "Fan B", totalCredit: 4 },
    ];
    const blocks = [mandatoryBlock(raw.slice(0, 2)), mandatoryBlock(raw.slice(2))];

    const { majburiy } = buildSubjectRows(blocks);

    expect(majburiy).toHaveLength(3);
    expect(sumCredit(majburiy)).toBe(sumCredit(raw.map((r) => ({ credit: r.totalCredit }))));
    expect(sumCredit(majburiy)).toBe(17);
  });

  test("`science` bo'lmasa kalit `code` ga tushadi", () => {
    const blocks = [
      mandatoryBlock([{ code: "FA1005", title: "Kommunal gigiyena", totalCredit: 2 }]),
      mandatoryBlock([{ code: "FA1005", title: "Kommunal gigiyena", totalCredit: 2 }]),
    ];

    const { majburiy } = buildSubjectRows(blocks);

    expect(majburiy).toHaveLength(1);
    expect(majburiy[0].credit).toBe(4);
  });

  test("turli fanlar birlashtirilmaydi (`blockCode` kalitga kirmaydi)", () => {
    const blocks = [
      mandatoryBlock([
        { science: "a", code: "FA1", title: "Fan A", totalCredit: 3 },
        { science: "b", code: "FA2", title: "Fan B", totalCredit: 3 },
      ]),
      { blockCode: "BLK1", title: "Majburiy fanlar", sciences: [
        { science: "a", code: "FA1", title: "Fan A", totalCredit: 1 },
      ] },
    ];

    const { majburiy } = buildSubjectRows(blocks);

    expect(majburiy).toHaveLength(2);
    expect(majburiy.find((r) => r.code === "FA1").credit).toBe(4);
    expect(majburiy.find((r) => r.code === "FA2").credit).toBe(3);
  });

  test("tanlov va majburiy ustunlar alohida sanaladi va aralashmaydi", () => {
    const blocks = [
      mandatoryBlock([{ science: "a", code: "FA1", title: "Fan A", totalCredit: 4 }]),
      electiveBlock([{ science: "t", code: "TN1", title: "Tanlov 1", totalCredit: 2 }]),
      electiveBlock([{ science: "t", code: "TN1", title: "Tanlov 1", totalCredit: 2 }]),
    ];

    const { majburiy, tanlov } = buildSubjectRows(blocks);

    expect(majburiy).toHaveLength(1);
    expect(tanlov).toHaveLength(1);
    expect(tanlov[0].credit).toBe(4);
    expect(majburiy[0].idx).toBe("1.01");
    expect(tanlov[0].idx).toBe("2.01");
  });

  test("bo'sh / noto'g'ri kirish — xato otilmaydi", () => {
    expect(buildSubjectRows(undefined)).toEqual({ majburiy: [], tanlov: [] });
    expect(buildSubjectRows([])).toEqual({ majburiy: [], tanlov: [] });
    expect(buildSubjectRows([{ blockCode: "MFI", title: "Majburiy fanlar" }])).toEqual({
      majburiy: [],
      tanlov: [],
    });
  });
});
