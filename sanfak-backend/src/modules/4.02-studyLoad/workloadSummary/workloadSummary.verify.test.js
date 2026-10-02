const { REGISTRY } = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const {
  resolveStepLabel,
} = require("#modules/4.02-studyLoad/_shared/signatoryLabels");
const { STEP_ORDER } = require("./workloadSummary.chain");

const entry = () => REGISTRY.find((r) => r.kind === "workloadSummary");

describe("verify registri", () => {
  test("`workloadSummary` ro'yxatda", () => {
    expect(entry()).toBeDefined();
    expect(entry().Model.modelName).toBe("workloadSummary");
  });

  test("`populate` BO'SH — surat o'zi-yetarli (ref'ga tayanmaydi)", () => {
    expect(entry().populate).toEqual([]);
  });
});

describe("ommaviy sarlavhada moliya/soat YO'Q", () => {
  const RAQAM_RX = /\d{2,}/;

  test("sarlavhada faqat yil va hujjat nomi", async () => {
    const title = await entry().buildTitle({
      academicYearTitle: "2024/2025",
      snapshot: {
        rowCount: 29,
        totals: { total: 123456, hourly: 999, positions: 77 },
        rows: [{ department: "Mikrobiologiya", total: 234 }],
      },
    });

    expect(title).toBe("2024/2025 o'quv yili — kafedralar soatlar hisobi va ish o'rinlari");
    const raqamlar = title.match(/\d+/g) || [];
    expect(raqamlar.sort()).toEqual(["2024", "2025"]);
  });

  test("jami soat, kafedra soni va stavka sarlavhaga TUSHMAYDI", async () => {
    const title = await entry().buildTitle({
      academicYearTitle: "2024/2025",
      snapshot: { rowCount: 29, totals: { total: 123456 } },
    });
    expect(title).not.toContain("123456");
    expect(title).not.toContain("29");
    expect(title.replace(/2024|2025/g, "")).not.toMatch(RAQAM_RX);
  });

  test("o'quv yili nomi bo'lmasa ham sarlavha buzilmaydi", async () => {
    const title = await entry().buildTitle({ academicYearTitle: "" });
    expect(typeof title).toBe("string");
    expect(title.length).toBeGreaterThan(0);
    expect(title).toContain("kafedralar soatlar hisobi");
  });
});

describe("imzo yorliqlari — `workload` xaritasi qayta ishlatiladi", () => {
  test("zanjirning 4 bosqichida ham yorliq bor", () => {
    for (const step of STEP_ORDER) {
      expect(resolveStepLabel("workloadSummary", step)).toBeTruthy();
    }
  });

  test("yorliqlar namunadagi imzo matnlariga mos", () => {
    expect(resolveStepLabel("workloadSummary", "methodical")).toBe(
      "O'quv-uslubiy boshqarma boshlig'i",
    );
    expect(resolveStepLabel("workloadSummary", "financial")).toBe(
      "Reja moliya bo'limi boshlig'i",
    );
    expect(resolveStepLabel("workloadSummary", "rektor")).toContain("rektori");
  });
});

describe("buildSignatories — zanjirdan imzo", () => {
  jest.mock("./workloadSummary.model");
  const service = require("./workloadSummary.service");

  const person = { firstName: "Sobitali", lastName: "Yo'ldoshev" };

  test("faqat TASDIQLANGAN bosqich imzo beradi", () => {
    const out = service.buildSignatories({
      approvalSteps: [
        { step: "methodical", status: "approved", approvedBy: person, date: new Date("2026-09-17") },
        { step: "financial", status: "pending", approvedBy: null, date: null },
        { step: "prorektor", status: "rejected", approvedBy: person, date: new Date() },
      ],
    });

    expect(Object.keys(out)).toEqual(["methodical"]);
    expect(out.methodical.name).toBe("S.Yo'ldoshev");
    expect(out.methodical.date).toContain("2026-yil");
  });

  test("populate qilinmagan `approvedBy` — ism CHIZILMAYDI (xom ObjectId sizmasin)", () => {
    const out = service.buildSignatories({
      approvalSteps: [
        {
          step: "methodical",
          status: "approved",
          approvedBy: "6a8bdb6c5b767d415c184735",
          date: new Date(),
        },
      ],
    });
    expect(out.methodical).toBeUndefined();
  });

  test("bo'sh zanjir — bo'sh obyekt", () => {
    expect(service.buildSignatories({})).toEqual({});
    expect(service.buildSignatories({ approvalSteps: [] })).toEqual({});
  });
});
