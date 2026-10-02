const { GRANTS } = require("./quality-assurance-roles.seed");
const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

describe("4.12 seed ↔ route gate mosligi (D-080)", () => {
  test("talim_sifati_nazorati review huquqiga ega — indicatorSubmission:approve (route: permitReview)", () => {
    expect(GRANTS[ROLES.TALIM_SIFATI_NAZORATI][MODULES.INDICATOR_SUBMISSION]).toContain(
      ACTIONS.APPROVE,
    );
  });

  test("talim_sifati_nazorati reject huquqiga ham ega (kelajakdagi alohida gate uchun tayyor)", () => {
    expect(GRANTS[ROLES.TALIM_SIFATI_NAZORATI][MODULES.INDICATOR_SUBMISSION]).toContain(
      ACTIONS.REJECT,
    );
  });

  const ALLOWED_4_12 = [MODULES.INDICATOR, MODULES.INDICATOR_SUBMISSION];

  test("talim_sifati_nazorati grantlari 4.12 dan TASHQARIGA chiqmaydi", () => {
    const sections = Object.keys(GRANTS[ROLES.TALIM_SIFATI_NAZORATI]);
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) expect(ALLOWED_4_12).toContain(s);
  });

  test("oqituvchi grantlari ham 4.12 dan TASHQARIGA chiqmaydi (D-097 da qo'shilgan)", () => {
    const sections = Object.keys(GRANTS[ROLES.OQITUVCHI] || {});
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) expect(ALLOWED_4_12).toContain(s);
  });

  test("o'lik action'lar seedga qaytmaydi — indicatorSubmission:review / readOwn", () => {
    const sb = GRANTS[ROLES.TALIM_SIFATI_NAZORATI][MODULES.INDICATOR_SUBMISSION] || [];
    const oq = (GRANTS[ROLES.OQITUVCHI] || {})[MODULES.INDICATOR_SUBMISSION] || [];
    expect(sb).not.toContain("review");
    expect(oq).not.toContain("readOwn");
  });
});
