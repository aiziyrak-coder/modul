"use strict";

const fs = require("fs");
const path = require("path");

const {
  PIN_LENGTH,
  MODULE_PIN_PREFIX,
  LOGIN_SLOTS,
  DEMO_SLOT_START,
  modulePin,
  modulePins,
} = require("./_module-pins");

const SEED_DIR = __dirname;
const REPO_ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(SEED_DIR, f), "utf8");

const PREFIXES = Object.values(MODULE_PIN_PREFIX);

const pinLiterals = (text) =>
  [...text.matchAll(/["'`](\d{14})["'`]/g)].map((m) => m[1]);

const pinTemplatePrefixes = (text) =>
  [...text.matchAll(/`(\d{4,13})\$\{/g)].map((m) => m[1]);

const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const OWNED_FILES = new Set([
  "_module-pins.js",
  "module-pins.test.js",
  "residency-test-users.seed.js",
  "residency-demo-data.seed.js",
  "task-users.seed.js",
  "gifted-users.seed.js",
  "gifted-demo.seed.js",
  "gifted-demo.seed.test.js",
  "gifted-demo-data.seed.js",
]);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

describe("modulePin()", () => {
  it("har doim 14 xonali raqam qaytaradi", () => {
    for (const prefix of PREFIXES) {
      for (const slot of [1, 7, 27, 99, 101, 201, 999]) {
        const pin = modulePin(prefix, slot);
        expect(pin).toMatch(/^\d{14}$/);
        expect(pin).toHaveLength(PIN_LENGTH);
        expect(pin.startsWith(prefix)).toBe(true);
      }
    }
  });

  it("DETERMINISTIK — bir xil kirish har doim bir xil PIN beradi", () => {
    expect(modulePin("45", 21)).toBe("45000000000021");
    expect(modulePin("45", 21)).toBe(modulePin("45", 21));
    expect(modulePin("47", 9)).toBe("47000000000009");
    expect(modulePin("411", 1)).toBe("41100000000001");
    expect(modulePin("411", DEMO_SLOT_START)).toBe("41100000000101");
  });

  it("noto'g'ri kirishda YIQILADI (jim qisqartirmaydi)", () => {
    expect(() => modulePin("4a", 1)).toThrow(/faqat raqamlardan/);
    expect(() => modulePin("45", 0)).toThrow(/1 dan katta/);
    expect(() => modulePin("45", 1.5)).toThrow(/butun son/);
    expect(() => modulePin("411", 1e11)).toThrow(/sig'maydi/);
    expect(() => modulePin("45", 1e21)).toThrow(/yaroqsiz natija/);
  });

  it("modulePins() ketma-ket diapazon beradi", () => {
    expect(modulePins("45", 3, 21)).toEqual([
      "45000000000021",
      "45000000000022",
      "45000000000023",
    ]);
    expect(modulePins("411", 2, DEMO_SLOT_START)).toEqual([
      "41100000000101",
      "41100000000102",
    ]);
  });
});

describe("prefikslar o'zaro kesishmaydi", () => {
  it("hech bir prefiks boshqasining boshlanishi emas", () => {
    for (const a of PREFIXES) {
      for (const b of PREFIXES) {
        if (a === b) continue;
        expect(a.startsWith(b)).toBe(false);
      }
    }
  });

  it("uch modulning login diapazonlari to'liq unikal", () => {
    const all = PREFIXES.flatMap((p) => modulePins(p, LOGIN_SLOTS));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("boshqa modul seedlari bilan kolliziya yo'q", () => {
  const foreignFiles = [...walk(path.join(REPO_ROOT, "seed")), ...walk(path.join(REPO_ROOT, "scripts"))]
    .filter((f) => !OWNED_FILES.has(path.basename(f)));

  it("boshqa fayllarni haqiqatan skanerlaydi (test o'zi bo'shab qolmasin)", () => {
    expect(foreignFiles.length).toBeGreaterThan(80);
    expect(foreignFiles.some((f) => f.includes("teacher-chain-users"))).toBe(true);
    expect(foreignFiles.some((f) => f.includes("practice-users"))).toBe(true);
  });

  it("hech bir begona fayl 45…/47…/411… LITERAL PIN ishlatmaydi", () => {
    const offenders = [];
    for (const file of foreignFiles) {
      for (const pin of pinLiterals(fs.readFileSync(file, "utf8"))) {
        const hit = PREFIXES.find((p) => pin.startsWith(p));
        if (hit) offenders.push(`${path.relative(REPO_ROOT, file)}: ${pin} (prefiks "${hit}")`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("hech bir begona fayl 45…/47…/411… SHABLON generatori ishlatmaydi", () => {
    const offenders = [];
    for (const file of foreignFiles) {
      for (const head of pinTemplatePrefixes(fs.readFileSync(file, "utf8"))) {
        const hit = PREFIXES.find((p) => head.startsWith(p) || p.startsWith(head));
        if (hit) offenders.push(`${path.relative(REPO_ROOT, file)}: \`${head}\${…}\` (prefiks "${hit}")`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("login seedlari o'z diapazonida", () => {
  it("residency-test-users — 45… , slotlar 21..27, KODDA literal PIN yo'q", () => {
    const code = stripComments(read("residency-test-users.seed.js"));
    expect(code).toContain('MODULE_PIN_PREFIX["4.5"]');
    for (const slot of [21, 22, 23, 24, 25, 26, 27]) {
      expect(code).toContain(`P(${slot})`);
    }
    expect(code).not.toMatch(/P\([1-7]\)/);
    expect(pinLiterals(code)).toEqual([]);
  });

  it("task-users — 47… PIN'lari O'ZGARMAGAN", () => {
    const { USERS } = require("./task-users.seed.js");
    expect(USERS.map((u) => u[0])).toEqual([
      "47000000000001",
      "47000000000002",
      "47000000000003",
      "47000000000004",
      "47000000000005",
      "47000000000006",
      "47000000000007",
      "47000000000008",
      "47000000000009",
    ]);
  });

  it("gifted-users — 411…, dublikatsiz, 4.11 grant olgan HAR rol qamrangan", () => {
    const { USERS } = require("./gifted-users.seed.js");
    const pins = USERS.map((u) => u[0]);
    expect(pins).toEqual([
      "41100000000001",
      "41100000000002",
      "41100000000003",
      "41100000000004",
      "41100000000005",
      "41100000000006",
      "41100000000007",
    ]);
    expect(new Set(pins).size).toBe(pins.length);

    const rolesText = read("gifted-roles.seed.js");
    const granted = new Set(
      [...rolesText.matchAll(/^\s*title:\s*"([a-z_]+)"/gm)].map((m) => m[1]),
    );
    const seeded = new Set(USERS.map((u) => u[3]));
    for (const role of granted) expect(seeded.has(role)).toBe(true);
    expect(seeded.has("oqituvchi")).toBe(true);
  });

  it("gifted-demo (mongosh) literal PIN'lari gifted-users bilan bir xil", () => {
    const { USERS } = require("./gifted-users.seed.js");
    const used = [...read("gifted-demo.seed.js").matchAll(/uid\("(\d{14})"\)/g)].map((m) => m[1]);
    expect(used).toHaveLength(5);
    for (const pin of used) {
      expect(USERS.map((u) => u[0])).toContain(pin);
    }
  });
});

describe("demo seedlari login diapazoniga KIRMAYDI", () => {
  const NODE_DEMO_SEEDS = [
    { file: "residency-demo-data.seed.js", module: "4.5", list: "REZIDENTLAR" },
    { file: "gifted-demo-data.seed.js", module: "4.11", list: "TALABALAR" },
  ];

  const loginPins = () => {
    const { USERS: task } = require("./task-users.seed.js");
    const { USERS: gifted } = require("./gifted-users.seed.js");
    return new Set([
      ...task.map((u) => u[0]),
      ...gifted.map((u) => u[0]),
      ...modulePins(MODULE_PIN_PREFIX["4.5"], LOGIN_SLOTS),
    ]);
  };

  for (const seed of NODE_DEMO_SEEDS) {
    it(`${seed.file} — yasaydigan jshshir login PIN'lari bilan kesishmaydi`, () => {
      const text = read(seed.file);

      const m = text.match(/const jshshir = modulePin\(PREFIX,\s*([^)]+)\)/);
      expect(m).not.toBeNull();
      const slotExpr = m[1].trim();

      const listBlock = text.match(new RegExp(`const ${seed.list} = \\[([\\s\\S]*?)\\n\\];`));
      expect(listBlock).not.toBeNull();
      const count = (listBlock[1].match(/^\s*\{/gm) || []).length;
      expect(count).toBeGreaterThan(0);

      const slotOf = new Function("DEMO_SLOT_START", "i", `return (${slotExpr});`);
      const prefix = MODULE_PIN_PREFIX[seed.module];
      const produced = Array.from({ length: count }, (_, i) =>
        modulePin(prefix, slotOf(DEMO_SLOT_START, i)),
      );

      const login = loginPins();
      const clashes = produced.filter((p) => login.has(p));
      expect(clashes).toEqual([]);

      for (const pin of produced) {
        expect(Number(pin.slice(prefix.length))).toBeGreaterThan(LOGIN_SLOTS);
      }
    });
  }

  it("mongosh demo seedi (201..) node demo diapazoni (101..199) bilan kesishmaydi", () => {
    const prefix = MODULE_PIN_PREFIX["4.11"];
    const mongosh = [...read("gifted-demo.seed.js").matchAll(/jshshir: "(\d{14})"/g)].map((m) => m[1]);
    expect(mongosh.length).toBeGreaterThan(0);

    const nodeDemo = new Set(modulePins(prefix, 199 - DEMO_SLOT_START + 1, DEMO_SLOT_START));
    const login = loginPins();

    for (const j of mongosh) {
      expect(j).toMatch(new RegExp(`^${prefix}`));
      expect(login.has(j)).toBe(false);
      expect(nodeDemo.has(j)).toBe(false);
      expect(Number(j.slice(prefix.length))).toBeGreaterThanOrEqual(201);
    }
  });

  it("eski to'qnashgan qiymatlar KODDA qaytib kelmagan", () => {
    expect(stripComments(read("residency-demo-data.seed.js"))).not.toContain("4050000000");
    expect(stripComments(read("gifted-demo-data.seed.js"))).not.toContain("4110000000");

    const giftedDemo = stripComments(read("gifted-demo.seed.js"));
    const stale = [
      "10000000000001",
      "10000000000002",
      "10000000000003",
      "10000000000006",
      "20000000000001",
    ];
    for (const pin of stale) expect(giftedDemo).not.toContain(pin);

    expect(stripComments(read("residency-test-users.seed.js"))).not.toMatch(/"000000000000\d\d"/);
  });
});
