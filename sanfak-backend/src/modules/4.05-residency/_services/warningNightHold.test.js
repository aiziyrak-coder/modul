"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const winston = require("#shared/winston.logger");
const {
  holdNightWarning,
  holdNightDraft,
  holdNightTransitions,
  holdsNightWarning,
  WARNING_EFFECT_KINDS,
  DRAFT_EFFECT_KIND,
} = require("./warningNightHold");

const uz = (day, hhmmss) => new Date(`${day}T${hhmmss}+05:00`);

beforeEach(() => jest.clearAllMocks());

describe("holdsNightWarning — UZ 22:00–08:00, faqat `sams`", () => {
  it.each([
    ["21:59:59.999", false],
    ["22:00:00.000", true],
    ["23:59:59.999", true],
    ["00:00:00.000", true],
    ["03:30:00.000", true],
    ["07:59:59.999", true],
    ["08:00:00.000", false],
    ["13:00:00.000", false],
  ])("sams, UZ %s -> %p", (t, want) => {
    expect(holdsNightWarning("sams", uz("2026-10-13", t))).toBe(want);
  });

  it("qo'lda davomat (`attendance`) tunda ham ushlanmaydi", () => {
    expect(holdsNightWarning("attendance", uz("2026-10-13", "01:30:00.000"))).toBe(false);
    expect(holdsNightWarning(undefined, uz("2026-10-13", "01:30:00.000"))).toBe(false);
  });

  it("yaroqsiz sana — ushlanmaydi (avvalgi xulq)", () => {
    expect(holdsNightWarning("sams", new Date(NaN))).toBe(false);
    expect(holdsNightWarning("sams", "salom")).toBe(false);
  });

  it("`now` Date bo'lmasa ham (ISO satr, ms) ishlaydi — yiqilmaydi", () => {
    expect(holdsNightWarning("sams", "2026-10-12T20:30:00.000Z")).toBe(true);
    expect(holdsNightWarning("sams", Date.parse("2026-10-13T05:00:00.000Z"))).toBe(false);
  });

  it("server vaqt zonasiga bog'liq emas (UTC lahzadan)", () => {
    expect(holdsNightWarning("sams", new Date("2026-10-13T02:59:00.000Z"))).toBe(true);
    expect(holdsNightWarning("sams", new Date("2026-10-13T03:00:00.000Z"))).toBe(false);
    expect(holdsNightWarning("sams", new Date("2026-10-13T17:00:00.000Z"))).toBe(true);
  });

  it("server TZ=UTC bo'lsa ham UZ soati (alohida jarayon)", () => {
    const { execFileSync } = require("child_process");
    const script =
      "const { holdsNightWarning: h } = require('./src/modules/4.05-residency/_services/warningNightHold');" +
      "console.log(JSON.stringify(['2026-10-13T02:59:00Z', '2026-10-13T03:00:00Z', '2026-10-13T16:59:00Z']" +
      ".map((t) => h('sams', new Date(t)))));";
    const out = execFileSync(process.execPath, ["-e", script], {
      cwd: require("path").resolve(__dirname, "../../../.."),
      env: { ...process.env, TZ: "UTC" },
      encoding: "utf8",
    });
    expect(JSON.parse(out.trim().split(/\r?\n/).pop())).toEqual([true, false, false]);
  });
});

describe("holdNightWarning — nima ushlanadi", () => {
  const NIGHT = { source: "sams", now: uz("2026-10-13", "01:30:00.000"), residentId: "r1" };
  const warned = () => ({
    fullName: "Aliyev Sardor",
    update: { totalUnexcusedHours: 8, warningIssued: true, warningIssuedAt: new Date() },
    effects: [
      { kind: "telegram" },
      { kind: "inApp" },
      { kind: "log" },
      { kind: "supervisor" },
      { kind: "openDraft" },
    ],
  });

  it("tunda: bayroq va 4 effekt olib tashlanadi, soat va 72 soat qoladi; id-only log", () => {
    const out = holdNightWarning(warned(), NIGHT);
    expect(out.update).toEqual({ totalUnexcusedHours: 8 });
    expect(out.effects.map((e) => e.kind)).toEqual(["openDraft"]);
    expect(winston.info).toHaveBeenCalledTimes(1);
    const line = winston.info.mock.calls[0][0];
    expect(line).toContain("ushlab turildi resident=r1 soat=8");
    expect(line).not.toContain("Aliyev");
  });

  it("kunduzi yoki `attendance` manbai — o'zgarmaydi", () => {
    const day = warned();
    expect(holdNightWarning(day, { ...NIGHT, now: uz("2026-10-13", "09:00:00.000") })).toBe(day);
    const manual = warned();
    expect(holdNightWarning(manual, { ...NIGHT, source: "attendance" })).toBe(manual);
    expect(winston.info).not.toHaveBeenCalled();
  });

  it("ogohlantirish o'tishi yo'q (D-23 bekor qilish, allaqachon ogohlantirilgan) — tegilmaydi", () => {
    const revoke = {
      update: { totalUnexcusedHours: 2, warningIssued: false, warningIssuedAt: null },
      effects: [{ kind: "revokeWarning" }],
    };
    expect(holdNightWarning(revoke, NIGHT)).toBe(revoke);
    const already = { update: { totalUnexcusedHours: 9 }, effects: [] };
    expect(holdNightWarning(already, NIGHT)).toBe(already);
    expect(winston.info).not.toHaveBeenCalled();
  });
});

describe("drift qulfi — `applyWarningThreshold` effekt turlari", () => {
  const { evaluateResident } = jest.requireActual("./expulsionCheck");
  const resident = {
    _id: "r1",
    fullName: "Aliyev Sardor",
    program: "ordinatura",
    status: "oquvda",
    supervisor: "u9",
    user: { _id: "u1", firstName: "Sardor", lastName: "Aliyev" },
    warningIssued: false,
  };

  it("6 soat o'tishi aynan WARNING_EFFECT_KINDS ni chiqaradi", () => {
    const kinds = evaluateResident(resident, 8).effects.map((e) => e.kind);
    expect(new Set(kinds)).toEqual(WARNING_EFFECT_KINDS);
  });

  it("D-23 va 72 soat effektlari bu to'plamga kirmaydi", () => {
    const d23 = evaluateResident({ ...resident, warningIssued: true }, 2).effects.map((e) => e.kind);
    const e72 = evaluateResident({ ...resident, warningIssued: true }, 80).effects.map((e) => e.kind);
    for (const k of [...d23, ...e72]) expect(WARNING_EFFECT_KINDS.has(k)).toBe(false);
    expect(e72).toContain("openDraft");
  });
});

describe("N72 — nima ushlanadi (holdNightDraft / holdNightTransitions)", () => {
  const NIGHT = { source: "sams", now: uz("2026-10-13", "01:30:00.000") };
  const R1 = { _id: "r1", fullName: "Aliyev Sardor", expulsionOrderCreated: false };
  const drafted = () => ({
    fullName: "Aliyev Sardor",
    update: { totalUnexcusedHours: 80 },
    effects: [{ kind: "openDraft", hours: 80, residentName: "Aliyev Sardor" }],
  });
  const lines = () => winston.info.mock.calls.map(([m]) => m);
  const HELD_72 = "72 soat loyihasi 08:00 sweep'gacha ushlab turildi resident=r1 soat=80";

  it("U1 tunda: openDraft olib tashlanadi, `update` o'zgarmaydi; id-only log", () => {
    const out = holdNightDraft(drafted(), { ...NIGHT, resident: R1 });
    expect(out.effects).toEqual([]);
    expect(out.update).toEqual({ totalUnexcusedHours: 80 });
    expect(lines()).toEqual([expect.stringContaining(HELD_72)]);
    expect(lines()[0]).not.toContain("Aliyev");
  });

  it("U4 loyiha allaqachon ochiq (surat bayrog'i) — jim olib tashlanadi (N72-Q4=A)", () => {
    const out = holdNightDraft(drafted(), { ...NIGHT, resident: { ...R1, expulsionOrderCreated: true } });
    expect(out.effects).toEqual([]);
    expect(winston.info).not.toHaveBeenCalled();
  });

  it("U5 o'tish yo'q — o'sha obyekt, log yo'q", () => {
    const none = { update: { totalUnexcusedHours: 9 }, effects: [{ kind: "cancelDraft" }] };
    expect(holdNightDraft(none, { ...NIGHT, resident: R1 })).toBe(none);
    const quiet = { update: { totalUnexcusedHours: 3 }, effects: [] };
    expect(holdNightTransitions(quiet, { ...NIGHT, resident: R1 })).toBe(quiet);
    expect(winston.info).not.toHaveBeenCalled();
  });

  it("U6 ikkala o'tish tunda: 4 ogohlantirish + openDraft ketadi, qolganlari qoladi; log [6h, 72h]", () => {
    const kinds = ["telegram", "inApp", "log", "supervisor", "openDraft", "revokeWarning", "cancelDraft", "basisLost", "boshqa"];
    const both = {
      update: { totalUnexcusedHours: 80, warningIssued: true, warningIssuedAt: new Date() },
      effects: kinds.map((kind) => ({ kind, hours: 80 })),
    };
    const out = holdNightTransitions(both, { ...NIGHT, resident: R1 });
    expect(out.update).toEqual({ totalUnexcusedHours: 80 });
    expect(out.effects.map((e) => e.kind)).toEqual(["revokeWarning", "cancelDraft", "basisLost", "boshqa"]);
    expect(lines()).toEqual([
      expect.stringContaining("6 soat ogohlantirishi 08:00 sweep'gacha ushlab turildi resident=r1 soat=80"),
      expect.stringContaining(HELD_72),
    ]);
  });
});

describe("N72 — oyna, manba, drift", () => {
  const R1 = { _id: "r1", expulsionOrderCreated: false };
  const run = (now, source) => {
    const evaluated = { update: { totalUnexcusedHours: 80 }, effects: [{ kind: DRAFT_EFFECT_KIND, hours: 80 }] };
    return [evaluated, holdNightDraft(evaluated, { source, now, resident: R1 })];
  };

  it.each([
    ["UZ 21:59:59.999", false, uz("2026-10-13", "21:59:59.999")],
    ["UZ 22:00:00.000", true, uz("2026-10-13", "22:00:00.000")],
    ["UZ 07:59:59.999", true, uz("2026-10-13", "07:59:59.999")],
    ["UZ 08:00:00.000", false, uz("2026-10-13", "08:00:00.000")],
    ["02:59Z (UZ 07:59)", true, new Date("2026-10-13T02:59:00.000Z")],
    ["03:00Z (UZ 08:00)", false, new Date("2026-10-13T03:00:00.000Z")],
  ])("U2 chegara %s -> ushlanadi=%p", (_l, held, now) => {
    const [evaluated, out] = run(now, "sams");
    expect(out === evaluated).toBe(!held);
    expect(out.effects).toHaveLength(held ? 0 : 1);
  });

  it.each([["attendance"], ["cron"], [undefined]])("U3 manba %p tunda ham ushlanmaydi", (source) => {
    const [evaluated, out] = run(uz("2026-10-13", "01:30:00.000"), source);
    expect(out).toBe(evaluated);
    expect(winston.info).not.toHaveBeenCalled();
  });

  it("U7 drift: 72 soat o'tishi aynan bitta DRAFT_EFFECT_KIND; u ogohlantirish to'plamida yo'q", () => {
    const { evaluateResident } = jest.requireActual("./expulsionCheck");
    const resident = {
      _id: "r1",
      program: "ordinatura",
      status: "oquvda",
      user: { _id: "u1", firstName: "Sardor", lastName: "Aliyev" },
      warningIssued: true,
    };
    const drafts = evaluateResident(resident, 80).effects.filter((e) => e.kind === DRAFT_EFFECT_KIND);
    expect(drafts).toHaveLength(1);
    expect(WARNING_EFFECT_KINDS.has(DRAFT_EFFECT_KIND)).toBe(false);
  });
});
