"use strict";

const { PLAN, trimPermissions } = require("./trim-overbroad-grants.seed");
const { GRANTS } = require("./residency-roles.seed");

const talaba = PLAN.find((p) => p.role === "talaba");
const bolim = PLAN.find((p) => p.role === "magistratura_bolim");

describe("trimPermissions — YOZISH ketadi, O'QISH qoladi (MD-47)", () => {
  it("`announcement:create` olinadi, `read` QOLADI", () => {
    const { after, removed } = trimPermissions(
      [{ section: "announcement", actionKeys: ["read", "create"] }],
      talaba,
    );
    expect(removed).toBe(1);
    expect(after).toEqual([{ section: "announcement", actionKeys: ["read"] }]);
  });

  it("`src/domain/` bo'limlari ham qirqiladi (o'lik EMAS — jonli 400 bergan)", () => {
    const perms = ["student", "exam", "gradebook", "schedule"].map((s) => ({
      section: s,
      actionKeys: ["read", "create"],
    }));
    const { after, removed } = trimPermissions(perms, talaba);
    expect(removed).toBe(4);
    expect(after.every((e) => e.actionKeys.join() === "read")).toBe(true);
  });

  it("rejada YO'Q bo'lim TEGILMAYDI", () => {
    const perms = [{ section: "giftedStudent", actionKeys: ["read", "create"] }];
    expect(trimPermissions(perms, talaba)).toMatchObject({ after: perms, removed: 0 });
  });

  it("IDEMPOTENT — allaqachon toza grant o'zgarmaydi", () => {
    const perms = [{ section: "announcement", actionKeys: ["read"] }];
    const r = trimPermissions(perms, talaba);
    expect(r.removed).toBe(0);
    expect(r.notes).toEqual([]);
    expect(r.after).toEqual(perms);
  });

  it("faqat `create` bo'lgan bo'lim BUTUNLAY tushadi (bo'sh yozuv qolmaydi)", () => {
    const { after } = trimPermissions([{ section: "exam", actionKeys: ["create"] }], talaba);
    expect(after).toEqual([]);
  });
});

describe("trimPermissions — butun bo'lim olinadi (MD-09)", () => {
  it("`announcement` va `dissertation` BUTUNLAY tushadi", () => {
    const perms = [
      { section: "announcement", actionKeys: ["create", "readAll", "read"] },
      { section: "dissertation", actionKeys: ["create", "readAll"] },
      { section: "resident", actionKeys: ["read", "readAll", "create"] },
    ];
    const { after, removed } = trimPermissions(perms, bolim);
    expect(removed).toBe(5);
    expect(after).toEqual([{ section: "resident", actionKeys: ["read", "readAll", "create"] }]);
  });

  it("`residencyAnnouncement` TEGILMAYDI (4.5 o'z endpointi)", () => {
    const perms = [{ section: "residencyAnnouncement", actionKeys: ["create", "readAll"] }];
    expect(trimPermissions(perms, bolim).after).toEqual(perms);
  });
});

describe("trimPermissions — 4.5 dagi O'LIK grantlar (D-05)", () => {
  const rahbar = PLAN.find((p) => p.role === "ilmiy_rahbar");
  const ustoz = PLAN.find((p) => p.role === "klinik_ustoz");
  const mudir = PLAN.find((p) => p.role === "kafedra_mudiri");
  const rezident = PLAN.find((p) => p.role === "rezident");

  it("`magistratura_bolim` — o'lik amallar ketadi, TIRIK lar qoladi", () => {
    const perms = [
      { section: "residentAttendance", actionKeys: ["create", "readAll", "update", "approve", "export", "reject"] },
    ];
    const { after, removed } = trimPermissions(perms, bolim);
    expect(removed).toBe(2);
    expect(after).toEqual([
      { section: "residentAttendance", actionKeys: ["create", "readAll", "update", "approve"] },
    ]);
  });

  it("🔴 D-18 — `residentAttendance:approve` BO'LIMDA qoladi, USTOZDAN olinadi", () => {
    expect(bolim.dropActions.residentAttendance).not.toContain("approve");
    expect(ustoz.dropActions.residentAttendance).toContain("approve");
  });

  it("`klinik_ustoz` — `residentResource` da `create`/`update` TEGILMAYDI", () => {
    const perms = [
      { section: "residentResource", actionKeys: ["create", "update", "approve"] },
    ];
    const { after, removed } = trimPermissions(perms, ustoz);
    expect(removed).toBe(1);
    expect(after).toEqual([
      { section: "residentResource", actionKeys: ["create", "update"] },
    ]);
  });

  it("🔴 D-31 — `klinik_ustoz` dan rezident YOZISH huquqi olinadi (ega qarori)", () => {
    const perms = [
      { section: "resident", actionKeys: ["read", "readAll", "create", "update", "approve"] },
    ];
    const { after } = trimPermissions(perms, ustoz);
    expect(after).toEqual([{ section: "resident", actionKeys: ["read", "readAll"] }]);
  });

  it("🔴 D-31 — kundalikda YOZISH ketadi, TASDIQLASH qoladi (TZ 4.5.5)", () => {
    const perms = [
      {
        section: "residentDailyLog",
        actionKeys: ["read", "readAll", "create", "update", "approve"],
      },
    ];
    const { after } = trimPermissions(perms, ustoz);
    expect(after).toEqual([
      { section: "residentDailyLog", actionKeys: ["read", "readAll", "approve"] },
    ]);
  });

  it("🔴 `kafedra_mudiri` — `residentDailyLog` BO'LIMI qoladi (D-34/BE #160)", () => {
    const perms = [
      { section: "residentDailyLog", actionKeys: ["create", "readAll", "read", "update", "approve", "export", "reject"] },
    ];
    const { after } = trimPermissions(perms, mudir);
    expect(after).toEqual([
      { section: "residentDailyLog", actionKeys: ["create", "readAll", "read", "update", "approve"] },
    ]);
  });

  it("`ilmiy_rahbar` — `resident:update` QOLADI", () => {
    const perms = [{ section: "resident", actionKeys: ["readAll", "update", "approve", "reject"] }];
    expect(trimPermissions(perms, rahbar).after).toEqual([
      { section: "resident", actionKeys: ["readAll", "update"] },
    ]);
  });

  it("`rezident` — faqat `chat:update` ketadi", () => {
    const perms = [
      { section: "chat", actionKeys: ["create", "read", "readAll", "update", "delete"] },
    ];
    const { after, removed } = trimPermissions(perms, rezident);
    expect(removed).toBe(1);
    expect(after).toEqual([
      { section: "chat", actionKeys: ["create", "read", "readAll", "delete"] },
    ]);
  });
});

describe("PLAN — qamrov qadalgan", () => {
  it("faqat SANAB O'TILGAN rollar tegiladi", () => {
    expect(PLAN.map((p) => p.role)).toEqual([
      "talaba",
      "magistratura_bolim",
      "ilmiy_rahbar",
      "klinik_ustoz",
      "kafedra_mudiri",
      "rezident",
    ]);
  });

  it("🔴 TIRIK grantlar QAROR bo'lmasa PLAN ga tushmaydi", () => {
    const TIRIK_QOLADI = [
      ["ilmiy_rahbar", "resident", "update"],
      ["klinik_ustoz", "residentResource", "create"],
      ["klinik_ustoz", "residentResource", "update"],
      ["kafedra_mudiri", "resident", "create"],
      ["kafedra_mudiri", "residentDailyLog", "approve"],
      ["kafedra_mudiri", "residentDailyLog", "create"],
      ["kafedra_mudiri", "residentDailyLog", "readAll"],
      ["kafedra_mudiri", "residentDailyLog", "update"],
    ];
    for (const [role, section, action] of TIRIK_QOLADI) {
      const step = PLAN.find((p) => p.role === role);
      expect(step?.dropSections ?? []).not.toContain(section);
      expect(step?.dropActions?.[section] ?? []).not.toContain(action);
    }
  });

  it("🔴 ustozning TASDIQLASH huquqi hech qaysi qadamda olinmaydi", () => {
    const ustozStep = PLAN.find((p) => p.role === "klinik_ustoz");
    expect(ustozStep?.dropActions?.residentDailyLog ?? []).not.toContain("approve");
  });

  it("HECH QAYERDA `read`/`readAll` olinmaydi", () => {
    for (const step of PLAN) {
      for (const actions of Object.values(step.dropActions ?? {})) {
        expect(actions).not.toContain("read");
        expect(actions).not.toContain("readAll");
      }
    }
  });

  it("🔴 `seed:residency-roles` A1 olib tashlaganini QAYTA BERMAYDI (EXC-Q1)", () => {
    const overlaps = [];
    for (const step of PLAN) {
      const grants = GRANTS[step.role] ?? {};
      for (const section of step.dropSections ?? []) {
        if (grants[section]) overlaps.push(`${step.role}.${section}`);
      }
      for (const [section, actions] of Object.entries(step.dropActions ?? {})) {
        for (const a of grants[section] ?? []) {
          if (actions.includes(a)) overlaps.push(`${step.role}.${section}:${a}`);
        }
      }
    }
    expect(overlaps).toEqual([]);
  });
});
