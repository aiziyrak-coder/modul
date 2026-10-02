const {
  isQuotaOnlyElective,
  hasRealSubjects,
} = require("./electiveQuotaSlot");

const quotaOnlyBlock = () => ({
  blockCode: "TF2",
  title: "Tanlov fanlar",
  totalCredit: 24,
  semesters: {
    3: { hour: 3, credit: 3 },
    4: { hour: 5, credit: 5 },
    9: { hour: 0, credit: 0 },
  },
  sciences: [
    { serialNumber: "", code: "", title: "Jami" },
    { serialNumber: "", code: "", title: "Malakaviy amaliyot" },
    { serialNumber: "", code: "TM104", title: "Tanishuv amaliyoti" },
    { serialNumber: "", code: "", title: "HAMMASI" },
  ],
});

const listedBlock = () => ({
  blockCode: "TF2",
  title: "Tanlov fanlar",
  totalCredit: 24,
  semesters: { 3: { hour: 3, credit: 3 } },
  sciences: [{ serialNumber: "2.01", code: "TN1104", title: "Bioetika" }],
});

describe("hasRealSubjects / isQuotaOnlyElective", () => {
  test("amaliyot + yig'indi qatorlari HAQIQIY fan hisoblanmaydi", () => {
    expect(hasRealSubjects(quotaOnlyBlock())).toBe(false);
    expect(isQuotaOnlyElective(quotaOnlyBlock())).toBe(true);
  });

  test("fan qatori bo'lsa — kvota holati EMAS (A-stsenariy tegilmaydi)", () => {
    expect(hasRealSubjects(listedBlock())).toBe(true);
    expect(isQuotaOnlyElective(listedBlock())).toBe(false);
  });

  test("MAJBURIY blok hech qachon kvota-only holatida emas", () => {
    const mandatory = {
      blockCode: "MF1",
      title: "Majburiy fanlar",
      semesters: { 3: { hour: 3, credit: 3 } },
      sciences: [],
    };
    expect(isQuotaOnlyElective(mandatory)).toBe(false);
  });
});
