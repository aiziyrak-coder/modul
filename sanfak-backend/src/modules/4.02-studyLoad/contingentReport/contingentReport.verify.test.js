const { REGISTRY } = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { resolveStepLabel } = require("#modules/4.02-studyLoad/_shared/signatoryLabels");
const { STEP_ORDER } = require("./contingentReport.chain");

const entry = () => REGISTRY.find((r) => r.kind === "contingentReport");

describe("verify registri", () => {
  test("`contingentReport` ro'yxatda, populate BO'SH (surat o'zi-yetarli)", () => {
    expect(entry()).toBeDefined();
    expect(entry().Model.modelName).toBe("contingentReport");
    expect(entry().populate).toEqual([]);
    expect(entry().stepsPath).toBeUndefined();
  });

  test("zanjirning har bosqichi uchun yorliq bor", () => {
    for (const step of STEP_ORDER) {
      expect(resolveStepLabel("contingentReport", step)).toEqual(expect.any(String));
    }
    expect(resolveStepLabel("contingentReport", "dean")).toBe("Fakultet dekani");
  });
});

describe("ommaviy sarlavhada talabalar soni YO'Q", () => {
  test("sarlavha: fakultet + yil + hujjat nomi", async () => {
    const title = await entry().buildTitle({
      facultyTitle: "Davolash ishi fakulteti",
      academicYearTitle: "2026/2027",
      rows: [{ total: 1741, boys: 819 }],
      foreignByCountry: [{ country: "Hindiston", total: 1476 }],
    });
    expect(title).toBe("Davolash ishi fakulteti — 2026/2027 o'quv yili talabalar kontingenti hisoboti");
    expect((title.match(/\d+/g) || []).sort()).toEqual(["2026", "2027"]);
    expect(title).not.toContain("1741");
    expect(title).not.toContain("Hindiston");
  });

  test("fakultet/yil bo'lmasa ham buzilmaydi", async () => {
    const title = await entry().buildTitle({ academicYearTitle: "", facultyTitle: "" });
    expect(title).toContain("talabalar kontingenti hisoboti");
    expect(title.startsWith("Fakultet")).toBe(true);
  });
});
