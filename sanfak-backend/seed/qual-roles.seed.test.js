const fs = require("fs");
const path = require("path");

const { MODULES, ACTIONS } = require("../src/config/constants");
const {
  rolesDef,
  MANAGER_PERMISSIONS,
  TEACHER_PERMISSIONS,
  LISTENER_PERMISSIONS,
  mergePermissions,
  diffPermissions,
  countDuplicateSections,
} = require("./qual-roles.seed");
const { RECTOR_ACTIONS } = require("./qual-cert-approval.seed");

const QUAL_DIR = path.join(__dirname, "../src/modules/4.04-qualification");

function collectRouteRequirements() {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".routes.js")) files.push(p);
    }
  })(QUAL_DIR);

  const reqs = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const rel = path.relative(QUAL_DIR, f).split(path.sep).join("/");
    for (const m of src.matchAll(/permit\(\s*MODULES\.([A-Z0-9_]+)\s*,\s*\[([^\]]*)\]/g)) {
      const section = MODULES[m[1]];
      const actions = m[2]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => ACTIONS[s.replace("ACTIONS.", "")])
        .filter(Boolean);
      if (section && actions.length) reqs.push({ section, actions, where: rel });
    }
  }
  return reqs;
}

function roleAllows(perms, section, actions) {
  const p = perms.find((x) => x.section === section);
  if (!p) return false;
  return actions.some((a) => (p.actionKeys || []).includes(a));
}

const RECTOR_PERMISSIONS = [
  { section: MODULES.QUAL_CERTIFICATE, actionKeys: RECTOR_ACTIONS },
];

const ROLE_PERMS = {
  malaka_menejer: MANAGER_PERMISSIONS,
  malaka_oqituvchi: TEACHER_PERMISSIONS,
  malaka_tinglovchi: LISTENER_PERMISSIONS,
  rektor: RECTOR_PERMISSIONS,
};

describe("4.4 qual-roles seed — to'plam sifati", () => {
  it("uch rol e'lon qilingan va nomlari to'g'ri", () => {
    expect(rolesDef.map((r) => r.title).sort()).toEqual([
      "malaka_menejer",
      "malaka_oqituvchi",
      "malaka_tinglovchi",
    ]);
  });

  it("har bir section kanonik MODULES qiymati, action kanonik ACTIONS", () => {
    const sections = new Set(Object.values(MODULES));
    const actions = new Set(Object.values(ACTIONS));
    for (const [role, perms] of Object.entries(ROLE_PERMS)) {
      for (const p of perms) {
        expect({ role, section: p.section, ok: sections.has(p.section) }).toEqual({
          role,
          section: p.section,
          ok: true,
        });
        p.actionKeys.forEach((a) =>
          expect({ role, a, ok: actions.has(a) }).toEqual({ role, a, ok: true }),
        );
      }
    }
  });

  it("bitta rolda bir section ikki marta yozilmagan", () => {
    for (const [role, perms] of Object.entries(ROLE_PERMS)) {
      const seen = perms.map((p) => p.section);
      expect({ role, dup: seen.length - new Set(seen).size }).toEqual({ role, dup: 0 });
    }
  });
});

describe("4.4 qual-roles seed — backend route'lari qoplanadimi", () => {
  const reqs = collectRouteRequirements();

  it("route fayllardan talablar o'qildi", () => {
    expect(reqs.length).toBeGreaterThan(100);
  });

  it("HAR BIR permit() talabini kamida bitta rol qanoatlantiradi", () => {
    const uncovered = reqs
      .filter(
        (r) =>
          !Object.values(ROLE_PERMS).some((perms) =>
            roleAllows(perms, r.section, r.actions),
          ),
      )
      .map((r) => `${r.where}: ${r.section}:${r.actions.join("|")}`);
    expect([...new Set(uncovered)]).toEqual([]);
  });
});

describe("4.4 qual-roles seed — frontend sahifa gate'lari", () => {
  const MANAGER_GATES = [
    "qualAccessTestResult:export",
    "qualAccessTestResult:readAll",
    "qualCalendarPlan:readAll",
    "qualCourse:create",
    "qualCourse:readAll",
    "qualCourse:update",
    "qualCourseSubscription:readAll",
    "qualCourseType:readAll",
    "qualExitTestResult:export",
    "qualExitTestResult:readAll",
    "qualNotification:readAll",
    "qualPayment:readAll",
    "qualPetition:readAll",
    "qualSource:readAll",
    "qualTopic:readAll",
    "qualTopicCompletion:export",
  ];
  const TEACHER_GATES = ["qualTopicLecture:create", "qualTopicScenario:readAll"];

  const check = (perms, gates) =>
    gates.filter((g) => {
      const [section, action] = g.split(":");
      return !roleAllows(perms, section, [action]);
    });

  it("menejer o'z sahifalarining hammasini ocha oladi", () => {
    expect(check(MANAGER_PERMISSIONS, MANAGER_GATES)).toEqual([]);
  });

  it("o'qituvchi o'z sahifalarining hammasini ocha oladi", () => {
    expect(check(TEACHER_PERMISSIONS, TEACHER_GATES)).toEqual([]);
  });

  it("o'qituvchi menejer sahifalarini OCHA OLMAYDI (kurs yaratish/qabul)", () => {
    expect(roleAllows(TEACHER_PERMISSIONS, MODULES.QUAL_COURSE, [ACTIONS.CREATE])).toBe(
      false,
    );
    expect(
      roleAllows(TEACHER_PERMISSIONS, MODULES.QUAL_PETITION, [ACTIONS.READ_ALL]),
    ).toBe(false);
  });

  it("tinglovchi test savollarini ko'ra olmaydi (faqat topshiradi)", () => {
    expect(
      roleAllows(LISTENER_PERMISSIONS, MODULES.QUAL_ACCESS_TEST, [ACTIONS.READ_ALL]),
    ).toBe(false);
    expect(
      roleAllows(LISTENER_PERMISSIONS, MODULES.QUAL_ACCESS_TEST_RESULT, [ACTIONS.CREATE]),
    ).toBe(true);
  });
});

describe("4.4 qual-roles seed — merge xulqi", () => {
  const other = [
    { section: MODULES.FACULTY, actionKeys: [ACTIONS.READ_ALL] },
    { section: MODULES.ARTICLE, actionKeys: [ACTIONS.CREATE] },
  ];

  it("boshqa modul ruxsatlari saqlanadi", () => {
    const out = mergePermissions([...other], MANAGER_PERMISSIONS);
    expect(out.filter((p) => p.section === MODULES.FACULTY)).toHaveLength(1);
    expect(out.filter((p) => p.section === MODULES.ARTICLE)).toHaveLength(1);
  });

  it("eski 4.4 ruxsatlari kanonik to'plam bilan almashadi (dublikat yo'q)", () => {
    const stale = [
      ...other,
      { section: MODULES.QUAL_COURSE, actionKeys: [ACTIONS.READ] },
    ];
    const out = mergePermissions(stale, MANAGER_PERMISSIONS);
    expect(out.filter((p) => p.section === MODULES.QUAL_COURSE)).toHaveLength(1);
    expect(
      out.find((p) => p.section === MODULES.QUAL_COURSE).actionKeys,
    ).toContain(ACTIONS.CREATE);
  });

  it("chat/notification additiv — mavjud qiymat saqlanadi (D-082)", () => {
    const withChat = [{ section: MODULES.CHAT, actionKeys: [ACTIONS.READ] }];
    const out = mergePermissions(withChat, MANAGER_PERMISSIONS);
    const chat = out.filter((p) => p.section === MODULES.CHAT);
    expect(chat).toHaveLength(1);
    expect(chat[0].actionKeys).toEqual([ACTIONS.READ]);
  });

  it("idempotent — ikkinchi marta ishga tushirilsa o'zgarish yo'q", () => {
    const first = mergePermissions([...other], MANAGER_PERMISSIONS);
    const second = mergePermissions(first, MANAGER_PERMISSIONS);
    expect(diffPermissions(first, second)).toEqual({ added: [], removed: [] });
  });

  it("qayta ishga tushirishda hech bir bo'lim takroriy yozuvga aylanmaydi (province/region)", () => {
    for (const perms of [MANAGER_PERMISSIONS, LISTENER_PERMISSIONS]) {
      const first = mergePermissions([...other], perms);
      const third = mergePermissions(mergePermissions(first, perms), perms);
      expect(third).toHaveLength(first.length);
      const sections = third.map((p) => p.section);
      expect(new Set(sections).size).toBe(sections.length);
    }
  });

  it("oldingi ishga tushirishlardan qolgan takroriy yozuvlar yig'iladi — birinchisi (permit o'qiydigan) qoladi", () => {
    const damaged = [
      ...other,
      { section: MODULES.PROVINCE, actionKeys: [ACTIONS.READ] },
      { section: MODULES.PROVINCE, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
      { section: MODULES.REGION, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
      { section: MODULES.REGION, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
    ];
    expect(countDuplicateSections(damaged)).toBe(2);
    const out = mergePermissions(damaged, LISTENER_PERMISSIONS);
    expect(countDuplicateSections(out)).toBe(0);
    expect(out.find((p) => p.section === MODULES.PROVINCE).actionKeys).toEqual([ACTIONS.READ]);
  });

  it("4.4 dan tashqari bo'lim rolda bo'lsa — saqlanadi, ustidan yozilmaydi", () => {
    const withRegion = [{ section: MODULES.REGION, actionKeys: [ACTIONS.READ] }];
    const out = mergePermissions(withRegion, LISTENER_PERMISSIONS);
    const region = out.filter((p) => p.section === MODULES.REGION);
    expect(region).toHaveLength(1);
    expect(region[0].actionKeys).toEqual([ACTIONS.READ]);
  });
});
