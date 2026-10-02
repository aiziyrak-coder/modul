"use strict";

const { loadAll } = require("./_role-seed-inventory");
const { MODULES, ACTIONS, ROLES } = require("../src/config/constants");

describe("ADR-049 — magistratura_bolim o'quv reja formasining lug'atlari (seedlar birlashmasi)", () => {
  const { grants } = loadAll();
  const mag = grants.filter((g) => g.title === ROLES.MAGISTRATURA_BOLIM);
  const canList = (section) =>
    mag.some((g) => g.section === section && g.actions.includes(ACTIONS.READ_ALL));

  test.each([
    [MODULES.ACADEMIC_LEVEL, "4.02"],
    [MODULES.READING_FORM, "4.02"],
    [MODULES.SPECIALIZATION, "4.02"],
    [MODULES.STUDY_PERIOD, "4.02"],
    [MODULES.EDUCATION_FORM, "4.05"],
    [MODULES.DIRECTION, "4.05"],
    [MODULES.SCIENCE, "4.05"],
  ])("`%s` ro'yxatini o'qiy oladi (egasi — %s seed)", (section) => {
    expect(canList(section)).toBe(true);
  });

  test("lug'at grantlari faqat o'qish — yozuv amali yo'q", () => {
    const REFS = [
      MODULES.ACADEMIC_LEVEL,
      MODULES.READING_FORM,
      MODULES.SPECIALIZATION,
      MODULES.STUDY_PERIOD,
      MODULES.EDUCATION_FORM,
      MODULES.DIRECTION,
      MODULES.SCIENCE,
    ];
    const READ = new Set([ACTIONS.READ, ACTIONS.READ_ALL]);
    const buzganlar = mag
      .filter((g) => REFS.includes(g.section))
      .flatMap((g) => g.actions.filter((a) => !READ.has(a)).map((a) => `${g.source}:${g.section}:${a}`));
    expect(buzganlar).toEqual([]);
  });
});
