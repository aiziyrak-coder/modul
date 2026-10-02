"use strict";

const {
  maskNonCode,
  findPermitCalls,
  splitTopLevel,
  collectModuleAliases,
  scanFiles,
  DEFAULT_ACTIONS,
} = require("./permit-scan");
const { collectRequirements } = require("./check-permission-drift");

const scan1 = (text, file = "src/x.routes.js") => scanFiles([{ file, text }]);
const pairs = (r) => [...r.requirements.keys()].sort();

describe("maskNonCode — izoh/satr/template/regex probelga aylanadi", () => {
  it("uzunlik va qator raqamlari SAQLANADI", () => {
    const src = 'const a = 1; // izoh\nconst b = "salom";\n';
    const { code } = maskNonCode(src);
    expect(code).toHaveLength(src.length);
    expect(code.split("\n")).toHaveLength(src.split("\n").length);
  });

  it("izohdagi `permit(` kodga chiqmaydi", () => {
    const { code } = maskNonCode("// permit(M, [ACTIONS.READ])\nconst x = 1;");
    expect(code).not.toContain("permit(");
  });

  it("blok izoh va JSDoc ham tozalanadi", () => {
    const { code } = maskNonCode("/* permit(MODULES.X)\n * permit(MODULES.Y)\n */\nlet z;");
    expect(code).not.toContain("permit(");
    expect(code).toContain("let z;");
  });

  it("template ichidagi `${}` ichma-ich satr bilan ham to'g'ri tugaydi", () => {
    const src = "const t = `a ${ f(`b ${ \"c\" }`) } d`;\nconst real = 1;";
    const { code } = maskNonCode(src);
    expect(code).toContain("const real = 1;");
    expect(code).not.toContain("f(");
  });

  it("🔴 regex literal ichidagi tirnoq satr boshlab yubormaydi", () => {
    const src = "const q = /[\"']/g;\nconst after = 2;";
    const { code } = maskNonCode(src);
    expect(code).toContain("const after = 2;");
    expect(code).not.toContain("\"");
  });

  it("bo'lish belgisi regex deb o'qilmaydi", () => {
    const src = "const r = (a) / b / c;\nconst after = 3;";
    const { code } = maskNonCode(src);
    expect(code).toContain("const after = 3;");
    expect(code).toContain("/ b /");
  });

  it("izoh ichidagi joylar `regions` da qaytadi", () => {
    const { regions } = maskNonCode("// permit(X)\ncode;");
    expect(regions.some((r) => r.kind === "line-comment")).toBe(true);
  });
});

describe("findPermitCalls — balansli qavs", () => {
  it("ko'p qatorli chaqiruv va oxirgi vergul", () => {
    const code = "permit(\n  MODULES.X,\n  [\n    ACTIONS.APPROVE,\n    ACTIONS.REJECT,\n  ],\n)";
    const calls = findPermitCalls(code);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toHaveLength(2);
    expect(calls[0].args[0]).toBe("MODULES.X");
  });

  it("`permitAdd(` va `obj.permit(` chaqiruv EMAS", () => {
    expect(findPermitCalls("permitAdd(MODULES.X)")).toHaveLength(0);
    expect(findPermitCalls("obj.permit(MODULES.X)")).toHaveLength(0);
    expect(findPermitCalls("xpermit(MODULES.X)")).toHaveLength(0);
  });

  it("yopilmagan qavs — `broken`, jim tashlanmaydi", () => {
    const calls = findPermitCalls("permit(MODULES.X, [ACTIONS.READ]");
    expect(calls[0].broken).toBe(true);
  });

  it("splitTopLevel ichma-ich qavsni buzmaydi", () => {
    expect(splitTopLevel("A, [B, C], f(d, e)")).toEqual(["A", "[B, C]", "f(d, e)"]);
  });
});

describe("collectModuleAliases", () => {
  it("`const M = MODULES.X` topiladi", () => {
    const { map } = collectModuleAliases("const M = MODULES.RESIDENT_RESOURCE;\n");
    expect(map.get("M")).toBe("RESIDENT_RESOURCE");
  });

  it("bir alias ikki xil kalitga bog'lansa — conflict", () => {
    const { conflicts } = collectModuleAliases("const M = MODULES.A_B;\nconst M = MODULES.C_D;\n");
    expect(conflicts).toHaveLength(1);
  });
});

describe("scanFiles — modul kalitini yechish", () => {
  it("literal shakl", () => {
    const r = scan1("permit(MODULES.RESIDENT, [ACTIONS.CREATE]);");
    expect(pairs(r)).toEqual(["resident:create"]);
    expect(r.stats.literal).toBe(1);
  });

  it("ALIAS shakli yechiladi", () => {
    const r = scan1(
      "const M = MODULES.RESIDENT_RESOURCE;\n" +
        ".post(permit(M, [ACTIONS.CREATE]), C.add)\n" +
        ".put(permit(M, [ACTIONS.UPDATE]), C.edit)\n",
    );
    expect(pairs(r)).toEqual(["residentResource:create", "residentResource:update"]);
    expect(r.stats.alias).toBe(2);
    expect(r.unresolved).toHaveLength(0);
  });

  it("🔴 fabrika parametri CHAQIRUVCHI fayldan yechiladi", () => {
    const factory = "src/modules/4.10-scientificDept/_shared/achievement.routes.js";
    const caller = "src/modules/4.10-scientificDept/patent/patent.routes.js";
    const r = scanFiles(
      [
        { file: factory, text: "const p = permit(moduleKey, [ACTIONS.CREATE]);" },
        { file: caller, text: "module.exports = createAchievementRoutes({ moduleKey: MODULES.PATENT });" },
      ],
      new Map([[factory, new Set([caller])]]),
    );
    expect(pairs(r)).toEqual(["patent:create"]);
    expect(r.stats.factory).toBe(1);
    expect(r.unresolved).toHaveLength(0);
  });

  it("bir nechta chaqiruvchi — kalitlar birlashadi", () => {
    const factory = "src/f.routes.js";
    const r = scanFiles(
      [
        { file: factory, text: "permit(moduleKey, [ACTIONS.READ_ALL]);" },
        { file: "src/a.js", text: "f({ moduleKey: MODULES.PATENT })" },
        { file: "src/b.js", text: "f({ moduleKey: MODULES.COPYRIGHT })" },
      ],
      new Map([[factory, new Set(["src/a.js", "src/b.js"])]]),
    );
    expect(pairs(r)).toEqual(["copyright:readAll", "patent:readAll"]);
  });

  it("action-siz `permit(M)` — eng keng to'plam (eski xulq saqlangan)", () => {
    const r = scan1("permit(MODULES.RESIDENT);");
    expect(pairs(r)).toEqual(DEFAULT_ACTIONS.map((a) => `resident:${a}`).sort());
    expect(r.stats.noActionArray).toBe(1);
  });

  it("izohdagi `permit(...)` TALAB YARATMAYDI (fantom juftlik yo'q)", () => {
    const r = scan1("// eski: permit(MODULES.FACULTY, [ACTIONS.CREATE])\nconst x = 1;");
    expect(r.requirements.size).toBe(0);
    expect(r.stats.inNonCode).toBe(1);
    expect(r.stats.codeCalls).toBe(0);
  });

  it("🔴 yechilmagan chaqiruv JIM tashlanmaydi", () => {
    const r = scan1("permit(someUnknownThing, [ACTIONS.READ]);");
    expect(r.requirements.size).toBe(0);
    expect(r.unresolved).toHaveLength(1);
    expect(r.unresolved[0].where).toBe("src/x.routes.js:1");
  });

  it("MODULES da yo'q kalit — unresolved (eski kod `continue` qilardi)", () => {
    const r = scan1("permit(MODULES.YOQ_BUNDAY_KALIT, [ACTIONS.READ]);");
    expect(r.requirements.size).toBe(0);
    expect(r.unresolved[0].reason).toMatch(/MODULES da yo'q/);
  });

  it("ACTIONS bermagan 2-argument — unresolved", () => {
    const r = scan1('permit(MODULES.RESIDENT, ["readAll"]);');
    expect(r.requirements.size).toBe(0);
    expect(r.unresolved).toHaveLength(1);
  });

  it("`permit(` niqob TURI bo'yicha sanaladi", () => {
    const r = scan1("// permit(MODULES.X)\nconst s = 'permit(MODULES.Y)';\n");
    expect(r.stats.nonCodeByKind).toEqual({ "line-comment": 1, string: 1 });
  });
});

describe("🔴 KORPUS — haqiqiy src/ (bazasiz)", () => {
  const r = collectRequirements();

  it("HECH BIR permit() chaqiruvi yechilmay qolmadi", () => {
    expect(r.unresolved).toEqual([]);
  });

  it("🔴 hech bir `permit(` REGEX literal ichiga yutilmagan", () => {
    expect(r.stats.nonCodeByKind.regex || 0).toBe(0);
    expect(r.stats.nonCodeByKind.template || 0).toBeLessThanOrEqual(2);
  });

  it("hisob yopiladi: kod + izoh/satr = xom `permit(`", () => {
    expect(r.stats.codeCalls + r.stats.inNonCode).toBe(r.stats.rawOccurrences);
  });

  it("literal + alias + fabrika = jami chaqiruv", () => {
    expect(r.stats.literal + r.stats.alias + r.stats.factory).toBe(r.stats.codeCalls);
  });

  it("alias va fabrika shakllari HAQIQATDAN topiladi", () => {
    expect(r.stats.alias).toBeGreaterThanOrEqual(150);
    expect(r.stats.factory).toBeGreaterThanOrEqual(7);
  });

  it("talab qilinadigan juftliklar soni eski skanerdan sezilarli KO'P", () => {
    expect(r.requirements.size).toBeGreaterThanOrEqual(700);
  });

  it("4.05 va 4.10 fabrikasi juftliklari haqiqatdan ro'yxatda", () => {
    expect(r.requirements.has("residentResource:create")).toBe(true);
    expect(r.requirements.has("residentDailyLog:approve")).toBe(true);
    expect(r.requirements.has("defense:create")).toBe(true);
  });
});
