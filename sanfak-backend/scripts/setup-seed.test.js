"use strict";

const fs = require("fs");
const path = require("path");
const {
  EXIT,
  UsageError,
  parseCli,
  maskUri,
  maskSecrets,
  findProblemLines,
  findRemovalLines,
  evaluateStep,
  validatePlan,
  parseFullName,
  createHiddenInput,
} = require("./setup-seed");
const { STEPS, EXCLUDED, PHASES, TEST_ACCOUNT_PINS } = require("../seed/_deploy-plan");

const ROOT = path.join(__dirname, "..");
const ids = STEPS.map((s) => s.id);
const indexOf = (id) => ids.indexOf(id);

describe("setup-seed — CLI", () => {
  test("bayroqsiz: yozish rejimi, tasdiq so'raladi, default papka scripts/backups", () => {
    const o = parseCli([]);
    expect(o).toMatchObject({ dry: false, yes: false, skipAdmin: false, allowDev: false, forceUnlock: false, restore: null });
    expect(o.outDir).toBe(path.join(ROOT, "scripts", "backups"));
  });

  test("barcha bayroqlar o'qiladi", () => {
    const o = parseCli(["--dry", "--yes", "--skip-admin", "--allow-dev", "--force-unlock", "--verbose", "--out-dir", "tmp-out"]);
    expect(o).toMatchObject({ dry: true, yes: true, skipAdmin: true, allowDev: true, forceUnlock: true, verbose: true });
    expect(o.outDir).toBe(path.resolve("tmp-out"));
  });

  test("noma'lum bayroq — UsageError (jim yozish rejimiga o'tmaydi)", () => {
    expect(() => parseCli(["--dry-run"])).toThrow(UsageError);
    expect(() => parseCli(["--write"])).toThrow(UsageError);
    expect(() => parseCli(["extra"])).toThrow(UsageError);
  });

  test("--restore va --dry birga — UsageError", () => {
    expect(() => parseCli(["--restore", "x.json", "--dry"])).toThrow(UsageError);
  });

  test("--allow-other-db faqat --restore bilan", () => {
    expect(() => parseCli(["--allow-other-db"])).toThrow(UsageError);
    expect(parseCli(["--restore", "x.json", "--allow-other-db"]).allowOtherDb).toBe(true);
  });

  test("exit kodlari barqaror", () => {
    expect(EXIT).toEqual({ OK: 0, FAILED: 1, USAGE: 2, INTERRUPTED: 130 });
  });
});

describe("setup-seed — sirlarni yashirish", () => {
  test("URI dagi login/parol yashiriladi", () => {
    expect(maskUri("mongodb://admin:p4ss@db.local:27017/prod")).toBe("mongodb://***@db.local:27017/prod");
    expect(maskUri("mongodb+srv://u:p@cluster.x/db")).toBe("mongodb+srv://***@cluster.x/db");
    expect(maskUri("mongodb://127.0.0.1:27017/prod")).toBe("mongodb://127.0.0.1:27017/prod");
  });

  test("seed chiqishidagi to'liq MONGO_HOST va 14 xonali PIN yashiriladi", () => {
    const host = "mongodb://root:S3cret@10.0.0.5:27017/institute";
    const out = maskSecrets(`Ulanish: ${host}\nPIN 12345678901234 yaratildi`, host);
    expect(out).not.toContain("S3cret");
    expect(out).not.toContain("12345678901234");
    expect(out).toContain("mongodb://***@10.0.0.5:27017/institute");
  });
});

describe("setup-seed — exit 0 bo'lsa ham yashirin xatoni ushlash", () => {
  test.each([
    ["  [SKIP] rol topilmadi: \"moderator\""],
    ["  rektor: ROL TOPILMADI — o'tkazib yuborildi"],
    ["  ~ rol topilmadi (o'tkazildi): rektor"],
    ["  ✗ talim_sifati_nazorati  || YETISHMAYDI: eqReport:read"],
    ["  ✗ talim_sifati_nazorati  || ORTIQCHA: notification:read"],
    ["  Berildi: 0 | O'zgarishsiz: 0 | Rol yo'q: 1"],
  ])("%s", (lineText) => {
    expect(findProblemLines(`ok\n${lineText}\nok`)).toEqual([lineText.trim()]);
  });

  test("oddiy chiqish xato deb hisoblanmaydi", () => {
    const out = [
      "  ~ SKIP sinov foydalanuvchisi — NODE_ENV=production",
      "  Berildi: 1 | O'zgarishsiz: 0 | Rol yo'q: 0",
      "  Yaratildi: 3   Merge: 0   Jami: 3 rol",
    ].join("\n");
    expect(findProblemLines(out)).toEqual([]);
  });

  test("exit 0 + [SKIP] yozish rejimida — qadam muvaffaqiyatsiz", () => {
    const v = evaluateStep({ code: 0, output: "  [SKIP] rol topilmadi: \"oqituvchi\"\n", ms: 10 }, { dry: false, phase: "roles" });
    expect(v.ok).toBe(false);
    expect(v.problems).toHaveLength(1);
  });

  test("ko'rish rejimida [SKIP] — faqat ogohlantirish", () => {
    const v = evaluateStep({ code: 0, output: "  [SKIP] rol topilmadi: \"oqituvchi\"\n", ms: 10 }, { dry: true, phase: "roles" });
    expect(v.ok).toBe(true);
    expect(v.problems).toHaveLength(1);
  });

  test("nol bo'lmagan exit, signal va vaqt tugashi — muvaffaqiyatsiz", () => {
    expect(evaluateStep({ code: 1, output: "", ms: 1 }, { dry: false }).ok).toBe(false);
    expect(evaluateStep({ code: null, signal: "SIGTERM", output: "", ms: 1 }, { dry: false }).ok).toBe(false);
    expect(evaluateStep({ code: null, timedOut: true, output: "", ms: 1 }, { dry: false }).ok).toBe(false);
  });
});

describe("setup-seed — ko'rish rejimida olib tashlanadigan huquqlar", () => {
  test("rol seedlarining barcha olib tashlash formatlari topiladi", () => {
    const out = [
      "      - olib tashlanadi (2):",
      "          - permission:read",
      "      - qualAccessTestResult: create, update",
      "      − talim_sifati_nazorati:[notification]  (BUTUNLAY O'CHADI)",
      "  [rektor] taskCategory-[create,update,delete]",
      "      ~ eqSubmission − [create,readOwn]",
      "      ↻ scopeLevel: \"self\" → \"global\"",
      "      + task:read",
      "  [dekan] o'zgarishsiz",
    ].join("\n");
    expect(findRemovalLines(out)).toHaveLength(7);
  });

  test("indeks va katalog qadamlaridagi ro'yxatlar olib tashlash deb hisoblanmaydi", () => {
    const out = "  - _id_: {\"_id\":1}\n  - oneIdPin_unique_partial: {\"oneIdPin\":1}\n";
    expect(evaluateStep({ code: 0, output: out, ms: 1 }, { dry: true, phase: "index" }).removals).toEqual([]);
    expect(evaluateStep({ code: 0, output: out, ms: 1 }, { dry: true, phase: "catalog" }).removals).toEqual([]);
    expect(evaluateStep({ code: 0, output: out, ms: 1 }, { dry: false, phase: "roles" }).removals).toEqual([]);
  });
});

describe("setup-seed — reja butunligi", () => {
  test("haqiqiy reja tekshiruvdan o'tadi", () => {
    expect(validatePlan()).toEqual([]);
  });

  test("har qadam: fayl bor, bosqich ma'lum, args massiv, dryArgs massiv yoki null", () => {
    for (const s of STEPS) {
      expect([s.id, fs.existsSync(path.join(ROOT, s.file))]).toEqual([s.id, true]);
      expect(Object.keys(PHASES)).toContain(s.phase);
      expect(Array.isArray(s.args)).toBe(true);
      expect(s.dryArgs === null || Array.isArray(s.dryArgs)).toBe(true);
    }
  });

  test("buzilgan rejalar aniqlanadi", () => {
    const base = STEPS.filter((s) => s.id !== "gifted-roles");
    expect(validatePlan(base)).toEqual(["RBAC seed rejada yo'q: seed/gifted-roles.seed.js"]);
    expect(validatePlan([...STEPS, { ...STEPS[0] }])).toContain("takroriy qadam: permission-groups");
    const bad = [...STEPS, { id: "x", phase: "roles", file: "seed/yoq.seed.js", script: null, args: [], dryArgs: null, title: "x" }];
    expect(validatePlan(bad)).toContain("x: fayl yo'q — seed/yoq.seed.js");
    const wrongScript = STEPS.map((s) => (s.id === "super-admin" ? { ...s, script: "seed:council-roles" } : s));
    expect(validatePlan(wrongScript)).toContain('super-admin: "seed:council-roles" skripti seed/super-admin.seed.js ni ishga tushirmaydi');
    const demo = [...STEPS, { id: "demo", phase: "roles", file: "seed/admission-demo.seed.js", script: null, args: [], dryArgs: null, title: "demo" }];
    expect(validatePlan(demo)).toContain("demo: DEV-ONLY seed production rejasida");
    const users = [...STEPS, { id: "u", phase: "roles", file: "seed/task-users.seed.js", script: null, args: [], dryArgs: null, title: "u" }];
    expect(validatePlan(users)).toContain("u: test-foydalanuvchi seedi production rejasida");
  });

  test("istisno ro'yxati hozircha bo'sh — barcha RBAC seedlari rejada", () => {
    expect(EXCLUDED.size).toBe(0);
  });

  test("hech bir qadam test foydalanuvchi, demo yoki destruktiv seedni ishga tushirmaydi", () => {
    const forbidden = /users|test|demo|sample|setup-platform|create-admin|rektor-scope|methodical-specialties|malaka-(manager|teacher|tinglovchi)|^index\.js$/;
    for (const s of STEPS) expect([s.id, forbidden.test(path.basename(s.file))]).toEqual([s.id, false]);
  });

  test("test hisob PIN'lari takrorlanmaydi", () => {
    expect(new Set(TEST_ACCOUNT_PINS).size).toBe(TEST_ACCOUNT_PINS.length);
  });

  test("repodagi har bir sinov hisobi PIN'i yakuniy tekshiruv ro'yxatida", () => {
    const seedDir = path.join(ROOT, "seed");
    const files = [
      ...fs.readdirSync(seedDir).filter((f) => /users|test|^setup-platform\.js$|^create-admin\.js$|^malaka-(manager|teacher|tinglovchi)\.seed\.js$|^magistratura-user|^quality-login-user|^admission-4\.8/.test(f) && !f.endsWith(".test.js")).map((f) => path.join(seedDir, f)),
      path.join(ROOT, "scripts", "seed-workload-teacher-fixtures.js"),
    ];
    const listed = new Set(TEST_ACCOUNT_PINS);
    const missing = [];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      const literals = [
        ...(text.match(/["'`](\d{14})["'`]/g) || []).map((s) => s.slice(1, -1)),
        ...[...text.matchAll(/oneIdPin:\s*["']([A-Za-z_]+)["']/g)].map((m) => m[1]),
      ];
      for (const pin of literals) if (!listed.has(pin)) missing.push(`${path.basename(file)}: ${pin}`);
    }
    expect(missing).toEqual([]);
  });

  test("modul slotlaridan hosil qilinadigan sinov PIN'lari ham ro'yxatda", () => {
    const { MODULE_PIN_PREFIX, modulePin } = require("../seed/_module-pins");
    for (const prefix of Object.values(MODULE_PIN_PREFIX)) {
      for (const slot of [1, 7, 21, 27, 99, 101, 199]) expect(TEST_ACCOUNT_PINS).toContain(modulePin(prefix, slot));
    }
  });

  test("sinov PIN'lari haqiqiy JSHSHIR bo'la olmaydi (tug'ilgan sana qismi yaroqsiz)", () => {
    for (const pin of TEST_ACCOUNT_PINS.filter((p) => /^\d{14}$/.test(p))) {
      const first = Number(pin[0]);
      const day = Number(pin.slice(1, 3));
      const month = Number(pin.slice(3, 5));
      const plausible = first >= 3 && first <= 6 && day >= 1 && day <= 31 && month >= 1 && month <= 12;
      expect([pin, plausible]).toEqual([pin, false]);
    }
  });
});

describe("setup-seed — tartib qoidalari", () => {
  test("katalog rollardan oldin, indeks eng oxirida", () => {
    const lastCatalog = Math.max(...STEPS.map((s, i) => (s.phase === "catalog" ? i : -1)));
    const firstRole = STEPS.findIndex((s) => s.phase === "roles");
    expect(lastCatalog).toBeLessThan(firstRole);
    expect(STEPS[STEPS.length - 1].id).toBe("oneidpin-index");
  });

  test("ruxsat guruhlari birinchi, umumiy katalog ikkinchi (modul seedlari undan keyin)", () => {
    expect(indexOf("permission-groups")).toBe(0);
    expect(indexOf("permissions")).toBe(1);
  });

  test("super_admin rollar ichida birinchi, moderator darhol undan keyin", () => {
    const firstRole = STEPS.findIndex((s) => s.phase === "roles");
    expect(indexOf("super-admin")).toBe(firstRole);
    expect(indexOf("moderator")).toBe(firstRole + 1);
  });

  test("moderator'ga tayanadigan task/practice rollari undan keyin", () => {
    expect(indexOf("task-roles")).toBeGreaterThan(indexOf("moderator"));
    expect(indexOf("practice-roles")).toBeGreaterThan(indexOf("moderator"));
  });

  test("rektor rolini talab qiladigan qadamlar rektorni yaratadigan seeddan keyin", () => {
    for (const id of ["admission-rektor", "dashboard-rbac", "rektor-kengash"]) {
      expect(indexOf(id)).toBeGreaterThan(indexOf("studyload-roles"));
    }
  });

  test("rektor-kengash ilmiy bo'lim rollaridan keyin (aks holda rektor kalitlari qayta kesiladi)", () => {
    expect(indexOf("rektor-kengash")).toBeGreaterThan(indexOf("scientific-roles"));
  });

  test("quality-role-access sifat bo'limi rolidan keyin va --write bilan", () => {
    expect(indexOf("quality-role-access")).toBeGreaterThan(indexOf("quality-assurance-roles"));
    expect(STEPS[indexOf("quality-role-access")].args).toEqual(["--write"]);
    expect(STEPS[indexOf("rektor-kengash")].args).toEqual(["--write"]);
  });
});

describe("setup-seed — reja docs/DEPLOY.md dagi «Asosiy seed buyruqlari» bloki bilan bir xil", () => {
  const doc = fs.readFileSync(path.join(ROOT, "docs", "DEPLOY.md"), "utf8");
  const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts;

  function documentedOrder() {
    const start = doc.indexOf("**Asosiy seed buyruqlari**");
    const open = doc.indexOf("```bash", start);
    const close = doc.indexOf("```", open + 7);
    const block = doc.slice(open, close);
    const files = [];
    for (const raw of block.split("\n")) {
      const m = raw.match(/^(yarn|node)\s+(\S+)/);
      if (!m) continue;
      const found = m[1] === "node" ? [m[2]] : (scripts[m[2]] || "").match(/seed\/[\w.-]+\.seed\.js/g) || [];
      for (const f of found) if (files[files.length - 1] !== f) files.push(f);
    }
    return files;
  }

  test("seed fayllari tartibi aynan mos", () => {
    const planned = STEPS.filter((s) => s.file.startsWith("seed/")).map((s) => s.file);
    expect(documentedOrder()).toEqual(planned);
  });
});

describe("setup-seed — yashirin PIN kiritish", () => {
  const typed = (...chunks) => {
    const echoed = [];
    const input = createHiddenInput((s) => echoed.push(s));
    let r = { done: false };
    for (const c of chunks) {
      r = input.feed(c);
      if (r.done) break;
    }
    return { ...r, echoed: echoed.join("") };
  };

  test("raqamlar yig'iladi, ekranga faqat * chiqadi", () => {
    const r = typed("1234567", "8901234\r");
    expect(r).toMatchObject({ done: true, value: "12345678901234" });
    expect(r.echoed).toBe("*".repeat(14));
  });

  test("Backspace oxirgi belgini o'chiradi", () => {
    expect(typed("12345\u007f6\r").value).toBe("12346");
  });

  test("Delete, Home, F5 kabi escape-ketma-ketliklardagi raqamlar PIN'ga qo'shilmaydi", () => {
    expect(typed("123\u001b[3~45\u001b[1~6\u001b[15~7\u001bOP8\r").value).toBe("12345678");
  });

  test("bracketed paste — belgilar tashlanadi, joylashtirilgan raqamlar qoladi", () => {
    expect(typed("\u001b[200~12345678901234\u001b[201~\r").value).toBe("12345678901234");
  });

  test("14 tadan ortiq raqam kesilmaydi — validatsiya uni rad etadi", () => {
    expect(typed("123456789012345\r").value).toBe("123456789012345");
  });

  test("harf ham qiymatga kiradi (jim tashlanmaydi) — validatsiya rad etadi", () => {
    expect(typed("1234a\r").value).toBe("1234a");
  });

  test("Ctrl+C — to'xtatildi", () => {
    expect(typed("12\u0003")).toMatchObject({ done: true, interrupted: true });
  });
});

describe("setup-seed — F.I.Sh.", () => {
  test("kamida ikki so'z", () => {
    expect(parseFullName("  Karimov   Anvar  ")).toBe("Karimov Anvar");
    expect(parseFullName("Karimov Anvar Olimovich")).toBe("Karimov Anvar Olimovich");
    expect(parseFullName("Karimov")).toBeNull();
    expect(parseFullName("--pin 1")).toBeNull();
    expect(parseFullName("")).toBeNull();
  });
});
