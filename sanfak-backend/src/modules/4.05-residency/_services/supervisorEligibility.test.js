"use strict";

const { ROLES } = require("#config/constants");
const {
  checkSupervisorEligible,
  SUPERVISOR_ROLE_BY_PROGRAM,
} = require("./supervisorEligibility");

const user = (title, active = true) => ({
  _id: "u1",
  firstName: "Test",
  lastName: "User",
  active,
  role: title ? { title } : undefined,
});

describe("checkSupervisorEligible — dastur bo'yicha rol", () => {
  it("ordinatura -> klinik_ustoz OK", () => {
    expect(checkSupervisorEligible(user(ROLES.KLINIK_USTOZ), "ordinatura")).toEqual({ ok: true });
  });

  it("magistratura -> ilmiy_rahbar OK", () => {
    expect(checkSupervisorEligible(user(ROLES.ILMIY_RAHBAR), "magistratura")).toEqual({ ok: true });
  });

  it("ordinatura -> ilmiy_rahbar RAD (dasturi mos emas)", () => {
    const r = checkSupervisorEligible(user(ROLES.ILMIY_RAHBAR), "ordinatura");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("klinik ustoz");
  });

  it("magistratura -> klinik_ustoz RAD", () => {
    const r = checkSupervisorEligible(user(ROLES.KLINIK_USTOZ), "magistratura");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ilmiy rahbar");
  });

  it("super_admin RAD — o'lchangan jonli nuqson", () => {
    const r = checkSupervisorEligible(user(ROLES.SUPER_ADMIN), "ordinatura");
    expect(r.ok).toBe(false);
  });

  it.each([
    ROLES.TALABA,
    ROLES.OQITUVCHI,
    ROLES.KAFEDRA_MUDIRI,
    ROLES.DEKAN,
    ROLES.MAGISTRATURA_BOLIM,
    ROLES.REKTOR,
  ])("%s ustoz bo'la OLMAYDI", (title) => {
    expect(checkSupervisorEligible(user(title), "ordinatura").ok).toBe(false);
    expect(checkSupervisorEligible(user(title), "magistratura").ok).toBe(false);
  });
});

describe("checkSupervisorEligible — faollik va chekka holatlar", () => {
  it("active:false RAD — hatto TO'G'RI rolda ham", () => {
    const r = checkSupervisorEligible(user(ROLES.KLINIK_USTOZ, false), "ordinatura");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("faol emas");
  });

  it("`active` maydoni YO'Q eski hujjat — o'tadi (faqat ANIQ `false` rad etiladi)", () => {
    const legacy = { _id: "u1", role: { title: ROLES.KLINIK_USTOZ } };
    expect(checkSupervisorEligible(legacy, "ordinatura")).toEqual({ ok: true });
  });

  it("foydalanuvchi topilmasa RAD", () => {
    expect(checkSupervisorEligible(null, "ordinatura").ok).toBe(false);
    expect(checkSupervisorEligible(undefined, "ordinatura").message).toContain("topilmadi");
  });

  it("`role` populate QILINMAGAN bo'lsa RAD (jim o'tib ketmaydi)", () => {
    const raw = { _id: "u1", active: true, role: "6a5a0acbd34b3c21a575d59d" };
    const r = checkSupervisorEligible(raw, "ordinatura");
    expect(r.ok).toBe(false);
  });

  it("rezidentning dasturi noma'lum bo'lsa RAD (fail-closed)", () => {
    const r = checkSupervisorEligible(user(ROLES.KLINIK_USTOZ), undefined);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("dasturi aniqlanmadi");
  });

  it("xarita FAQAT ikki dasturni biladi", () => {
    expect(Object.keys(SUPERVISOR_ROLE_BY_PROGRAM).sort()).toEqual([
      "magistratura",
      "ordinatura",
    ]);
  });
});

describe("kafedra doirasi (TZ 4.5.2)", () => {
  const DEP = "6a5a0acbd34b3c21a575d001";
  const OTHER_DEP = "6a5a0acbd34b3c21a575d002";

  const ustoz = (department) => ({ ...user(ROLES.KLINIK_USTOZ), department });
  const scoped = { restricted: true, department: DEP };
  const free = { restricted: false, department: null };

  it("o'z kafedrasi ustozi — OK", () => {
    expect(checkSupervisorEligible(ustoz(DEP), "ordinatura", scoped)).toEqual({ ok: true });
  });

  it("🔴 BEGONA kafedra ustozi — RAD", () => {
    const r = checkSupervisorEligible(ustoz(OTHER_DEP), "ordinatura", scoped);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("boshqa kafedradan");
  });

  it("ustozning kafedrasi belgilanmagan — RAD (fail-closed)", () => {
    expect(checkSupervisorEligible(ustoz(null), "ordinatura", scoped).ok).toBe(false);
  });

  it("populate qilingan kafedra obyekti ham taniladi", () => {
    const withDoc = { ...user(ROLES.KLINIK_USTOZ), department: { _id: DEP, title: "X" } };
    expect(checkSupervisorEligible(withDoc, "ordinatura", scoped)).toEqual({ ok: true });
  });

  it("aktorning kafedrasi belgilanmagan — RAD (fail-closed)", () => {
    const r = checkSupervisorEligible(ustoz(DEP), "ordinatura", {
      restricted: true,
      department: null,
    });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("kafedrangiz belgilanmagan");
  });

  it("cheklanmagan aktor (bo'lim / global) — kafedra tekshirilmaydi", () => {
    expect(checkSupervisorEligible(ustoz(OTHER_DEP), "ordinatura", free)).toEqual({ ok: true });
  });

  it("doira umuman berilmasa mavjud xulq saqlanadi", () => {
    expect(checkSupervisorEligible(ustoz(OTHER_DEP), "ordinatura")).toEqual({ ok: true });
  });

  it("rol noto'g'ri bo'lsa avval ROL xatosi qaytadi", () => {
    const wrong = { ...user(ROLES.ILMIY_RAHBAR), department: OTHER_DEP };
    const r = checkSupervisorEligible(wrong, "ordinatura", scoped);
    expect(r.message).toContain("faqat klinik ustoz biriktiriladi");
  });
});
