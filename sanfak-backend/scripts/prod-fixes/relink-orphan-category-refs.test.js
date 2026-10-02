const mongoose = require("mongoose");
const {
  SITES,
  parseMappings,
  buildGuardErrors,
  unknownArgs,
  buildCatalog,
  categoryFromLabel,
  catalogByName,
  anyIdForms,
  remapRootValue,
  scan,
  applyMappings,
} = require("./relink-orphan-category-refs");

const HEX_OLD = "6a7efdac5916905f06cebea4";
const HEX_NEW = "6a90235d4a28f1c7ae0e91c9";
const HEX_OTHER = "6a90235d4a28f1c7ae0e91ca";
const oid = (h) => new mongoose.Types.ObjectId(h);

function fakeDb(collections, { databaseName = "test-db" } = {}) {
  const calls = { updateOne: [], findOne: [] };
  return {
    databaseName,
    calls,
    listCollections: () => ({ toArray: async () => [] }),
    collection: (name) => ({
      find: () => ({
        toArray: async () => (collections[name] || []).slice(),
        project: () => ({ limit: () => ({ toArray: async () => [] }) }),
      }),
      findOne: async (filter) => {
        calls.findOne.push({ name, filter });
        const list = collections[name] || [];
        return list.find((d) => String(d._id) === String(filter._id)) || null;
      },
      updateOne: async (filter, update) => {
        calls.updateOne.push({ name, filter, update });
        const list = collections[name] || [];
        const doc = list.find((d) => String(d._id) === String(filter._id));
        if (!doc) return { matchedCount: 0, modifiedCount: 0 };
        Object.assign(doc, update.$set);
        return { matchedCount: 1, modifiedCount: 1 };
      },
    }),
  };
}

const CRIT_A = "6a7efdac5916905f06cebea8";
const CRIT_B = "6a7efdac5916905f06cebea9";
const CRIT_DEL = "6a7efdac5916905f06cebeaa";
const HEX_B_SAME_NAME = "6a90235d4a28f1c7ae0e91cc";
const HEX_DELETED = "6a90235d4a28f1c7ae0e91cd";
const HEX_INACTIVE = "6a90235d4a28f1c7ae0e91ce";

const CATALOG_DOCS = [
  {
    _id: oid(CRIT_A),
    name: "Ilmiy maqola",
    deletedAt: null,
    categories: [
      { _id: oid(HEX_NEW), name: "Scopus/WoS maqola", points: 50, active: true },
      { _id: oid(HEX_OTHER), name: "Mahalliy jurnal", points: 20, active: true },
      { _id: oid(HEX_INACTIVE), name: "Nofaol kategoriya", points: 10, active: false },
    ],
  },
  {
    _id: oid(CRIT_B),
    name: "Ilmiy anjuman",
    deletedAt: null,
    categories: [{ _id: oid(HEX_B_SAME_NAME), name: "Scopus/WoS maqola", points: 15, active: true }],
  },
  {
    _id: oid(CRIT_DEL),
    name: "Eski mezon",
    deletedAt: new Date("2026-08-01"),
    categories: [{ _id: oid(HEX_DELETED), name: "Scopus/WoS maqola", points: 99, active: true }],
  },
];

describe("parseMappings", () => {
  test("to'g'ri juftlikni qabul qiladi", () => {
    const { pairs, errors } = parseMappings(["--map", `${HEX_OLD}=${HEX_NEW}`]);
    expect(errors).toEqual([]);
    expect(pairs).toEqual([{ from: HEX_OLD, to: HEX_NEW }]);
  });

  test("24-hex bo'lmagan qiymatni RAD etadi (ObjectId.isValid tuzog'i)", () => {
    const { pairs, errors } = parseMappings(["--map", `abcdefghijkl=${HEX_NEW}`]);
    expect(pairs).toEqual([]);
    expect(errors.join(" ")).toMatch(/24-hex/);
  });

  test("eski va yangi bir xil bo'lsa RAD etadi", () => {
    const { pairs, errors } = parseMappings(["--map", `${HEX_OLD}=${HEX_OLD}`]);
    expect(pairs).toEqual([]);
    expect(errors.join(" ")).toMatch(/bir xil/);
  });

  test("bitta eski id ikki xil nishonga ko'rsatilsa xato beradi", () => {
    const { errors } = parseMappings([
      "--map", `${HEX_OLD}=${HEX_NEW}`,
      "--map", `${HEX_OLD}=${HEX_OTHER}`,
    ]);
    expect(errors.join(" ")).toMatch(/ikki xil nishonga/);
  });

  test("--map dan keyin qiymat bo'lmasa xato beradi", () => {
    const { errors } = parseMappings(["--map", "--write"]);
    expect(errors.join(" ")).toMatch(/berilmagan/);
  });

  test("--map umuman bo'lmasa bo'sh natija (xatosiz)", () => {
    expect(parseMappings(["--write"])).toEqual({ pairs: [], errors: [] });
  });
});

describe("buildCatalog", () => {
  test("kategoriyalarni id bo'yicha xaritalaydi", () => {
    const c = buildCatalog(CATALOG_DOCS);
    expect(c.size).toBe(5);
    expect(c.get(HEX_NEW)).toMatchObject({ name: "Scopus/WoS maqola", points: 50, criteriaId: CRIT_A });
  });

  test("yumshoq o'chirilgan mezon ichidagi kategoriya ham KIRADI (yetim emas)", () => {
    const c = buildCatalog(CATALOG_DOCS);
    expect(c.has(HEX_DELETED)).toBe(true);
    expect(c.get(HEX_DELETED).parentDeleted).toBe(true);
  });
});

describe("categoryFromLabel", () => {
  test("«Mezon (Kategoriya)» dan kategoriya nomini ajratadi", () => {
    expect(categoryFromLabel("Ilmiy maqola (Scopus/WoS maqola)")).toBe("Scopus/WoS maqola");
  });
  test("qavssiz/bo'sh/noto'g'ri qiymatda null", () => {
    expect(categoryFromLabel("Ilmiy maqola")).toBeNull();
    expect(categoryFromLabel(null)).toBeNull();
    expect(categoryFromLabel("Mezon ()")).toBeNull();
  });
});

describe("catalogByName", () => {
  test("nomni registr/bo'shliqqa befarq topadi", () => {
    const c = buildCatalog(CATALOG_DOCS);
    expect(catalogByName(c, "  scopus/wos MAQOLA ")).toHaveLength(3);
  });
  test("topilmasa bo'sh massiv", () => {
    expect(catalogByName(buildCatalog(CATALOG_DOCS), "Yo'q nom")).toEqual([]);
  });
});

describe("anyIdForms", () => {
  test("hex va ObjectId ikkalasini qaytaradi (aralash BSON tip)", () => {
    const forms = anyIdForms(HEX_OLD);
    expect(forms).toHaveLength(2);
    expect(typeof forms[0]).toBe("string");
    expect(forms[1]).toBeInstanceOf(mongoose.Types.ObjectId);
  });
});

describe("scan", () => {
  const collections = () => ({
    evaluationcriterias: CATALOG_DOCS,
    scholarships: [
      {
        _id: oid("6a7efdac5916905f06cebeb6"),
        name: "Rektor stipendiyasi",
        criteria: [
          {
            criteria: oid(CRIT_A),
            categoryIds: [HEX_OLD],
            pointOverrides: [{ categoryId: HEX_OLD, points: 40 }],
          },
        ],
      },
    ],
    studentachievements: [
      {
        _id: oid("6a7efdac5916905f06cebeae"),
        title: "Scopus maqola",
        scoreCriteria: oid(CRIT_A),
        scoreCategoryId: oid(HEX_OLD),
        scoreLabel: "Ilmiy maqola (Scopus/WoS maqola)",
      },
      {
        _id: oid("6a7efdac5916905f06cebeaf"),
        title: "Toza yozuv — ObjectId TIPIDA",
        scoreCriteria: oid(CRIT_A),
        scoreCategoryId: oid(HEX_NEW),
        scoreLabel: "Ilmiy maqola (Scopus/WoS maqola)",
      },
      {
        _id: oid("6a7efdac5916905f06cebeb0"),
        title: "Toza yozuv - hex SATR tipida",
        scoreCriteria: oid(CRIT_A),
        scoreCategoryId: HEX_OTHER,
        scoreLabel: "Ilmiy maqola (Mahalliy jurnal)",
      },
    ],
    scholarshipapplications: [
      {
        _id: oid("6a7efdac5916905f06cebec0"),
        judgeScores: [
          {
            scores: [
              { criteria: oid(CRIT_A), categoryId: HEX_OLD, value: 30 },
              { criteria: oid(CRIT_A), categoryId: HEX_NEW, value: 10 },
            ],
          },
        ],
      },
    ],
  });

  test("to'rtala saqlash joyidagi yetimni ham topadi", async () => {
    const { orphans } = await scan(fakeDb(collections()));
    const keys = orphans.map((o) => o.site).sort();
    expect(keys).toEqual([
      "achievement.scoreCategoryId",
      "application.judgeScores",
      "scholarship.categoryIds",
      "scholarship.pointOverrides",
    ]);
    expect(orphans.every((o) => o.value === HEX_OLD)).toBe(true);
  });

  test("ObjectId TIPIDAGI yetimni ham ko'radi (asl xatoning o'zi)", async () => {
    const { orphans } = await scan(fakeDb(collections()));
    const ach = orphans.find((o) => o.site === "achievement.scoreCategoryId");
    expect(ach).toBeDefined();
    expect(ach.value).toBe(HEX_OLD);
  });

  test("tirik havolalarni yetim deb belgilamaydi", async () => {
    const { orphans } = await scan(fakeDb(collections()));
    expect(orphans.some((o) => o.value === HEX_NEW)).toBe(false);
  });

  test("BSON tip taqsimotini ANIQ sanaydi (aralash tip ko'rinsin)", async () => {
    const { typeCounts } = await scan(fakeDb(collections()));
    expect(typeCounts["achievement.scoreCategoryId"]).toEqual({ objectId: 2, string: 1, other: 0 });
  });

  test("snapshot dalilini (scoreLabel) yig'adi", async () => {
    const { orphans } = await scan(fakeDb(collections()));
    const ach = orphans.find((o) => o.site === "achievement.scoreCategoryId");
    expect(ach.labelHint).toBe("Scopus/WoS maqola");
  });

  test("har yetim yonidagi MEZON ref ini ham yig'adi (ball kaliti uchun)", async () => {
    const { orphans } = await scan(fakeDb(collections()));
    expect(orphans.every((o) => o.criteriaId === CRIT_A)).toBe(true);
  });

  test("ObjectId TIPIDAGI TIRIK havola yolg'on yetim bo'lmaydi", async () => {
    const { orphans } = await scan(fakeDb(collections()));
    expect(orphans.some((o) => o.value === HEX_NEW)).toBe(false);
    expect(orphans.filter((o) => o.value === HEX_OLD)).toHaveLength(4);
  });

  test("yetim bo'lmasa bo'sh ro'yxat", async () => {
    const c = collections();
    c.scholarships[0].criteria[0].categoryIds = [HEX_NEW];
    c.scholarships[0].criteria[0].pointOverrides = [];
    c.studentachievements[0].scoreCategoryId = HEX_NEW;
    c.scholarshipapplications[0].judgeScores[0].scores = [{ categoryId: HEX_NEW, value: 1 }];
    const { orphans } = await scan(fakeDb(c));
    expect(orphans).toEqual([]);
  });
});

describe("remapRootValue", () => {
  const map = new Map([[HEX_OLD, HEX_NEW]]);

  test("scholarships.criteria da IKKALA qoida ham qo'llanadi", () => {
    const criteria = [{ categoryIds: [HEX_OLD], pointOverrides: [{ categoryId: HEX_OLD, points: 40 }] }];
    const out = remapRootValue("scholarships", "criteria", criteria, map);
    expect(out[0].categoryIds).toEqual([HEX_NEW]);
    expect(out[0].pointOverrides[0].categoryId).toBe(HEX_NEW);
  });

  test("DUBLIKAT hosil bo'lmaydi (nishon massivda allaqachon bor edi)", () => {
    const criteria = [{ categoryIds: [HEX_OLD, HEX_NEW], pointOverrides: [] }];
    const out = remapRootValue("scholarships", "criteria", criteria, map);
    expect(out[0].categoryIds).toEqual([HEX_NEW]);
  });

  test("ikki qavatli judgeScores[].scores[] ni qayta yozadi", () => {
    const js = [{ scores: [{ categoryId: HEX_OLD, value: 30 }, { categoryId: HEX_NEW, value: 10 }] }];
    const out = remapRootValue("scholarshipapplications", "judgeScores", js, map);
    expect(out[0].scores.map((s) => s.categoryId)).toEqual([HEX_NEW, HEX_NEW]);
    expect(out[0].scores[0].value).toBe(30);
  });

  test("skalyar scoreCategoryId ni almashtiradi", () => {
    expect(remapRootValue("studentachievements", "scoreCategoryId", HEX_OLD, map)).toBe(HEX_NEW);
  });

  test("xaritada yo'q qiymatga TEGMAYDI", () => {
    expect(remapRootValue("studentachievements", "scoreCategoryId", HEX_OTHER, map)).toBe(HEX_OTHER);
    const criteria = [{ categoryIds: [HEX_OTHER], pointOverrides: [] }];
    expect(remapRootValue("scholarships", "criteria", criteria, map)[0].categoryIds).toEqual([HEX_OTHER]);
  });

  test("bo'sh/undefined ildizda yiqilmaydi", () => {
    expect(remapRootValue("scholarships", "criteria", undefined, map)).toEqual([]);
    expect(remapRootValue("scholarshipapplications", "judgeScores", null, map)).toEqual([]);
  });
});

describe("applyMappings", () => {
  const mkDb = () =>
    fakeDb({
      evaluationcriterias: CATALOG_DOCS,
      scholarships: [
        {
          _id: oid("6a7efdac5916905f06cebeb6"),
          name: "Rektor stipendiyasi",
          criteria: [{ categoryIds: [HEX_OLD], pointOverrides: [{ categoryId: HEX_OLD, points: 40 }] }],
        },
      ],
      studentachievements: [
        { _id: oid("6a7efdac5916905f06cebeae"), scoreCategoryId: HEX_OLD, scoreLabel: "Ilmiy maqola (Scopus/WoS maqola)" },
      ],
      scholarshipapplications: [],
    });

  test("tegilgan hujjatlarni qayta bog'laydi va zaxira yozadi", async () => {
    const db = mkDb();
    const { orphans } = await scan(db);
    const tmp = require("path").join(
      require("os").tmpdir(),
      `relink-test-${process.pid}-${orphans.length}`,
    );
    const res = await applyMappings(db, orphans, [{ from: HEX_OLD, to: HEX_NEW }], tmp);
    expect(res.results.every((r) => r.status === "qayta bog'landi")).toBe(true);
    expect(require("fs").existsSync(res.backupFile)).toBe(true);
    const raw = require("fs").readFileSync(res.backupFile, "utf8");
    expect(raw).toMatch(/\$oid/);
    const { EJSON } = require("mongoose").mongo.BSON;
    const parsed = EJSON.parse(raw, { relaxed: false });
    expect(Number(parsed.backupFormat)).toBe(2);
    expect(parsed.changes[0]._id).toBeInstanceOf(mongoose.Types.ObjectId);
    require("fs").rmSync(tmp, { recursive: true, force: true });
  });

  test("bir hujjatning IKKALA joyi ham yangilanadi (bitta updateOne)", async () => {
    const db = mkDb();
    const { orphans } = await scan(db);
    const tmp = require("path").join(require("os").tmpdir(), `relink-test2-${process.pid}`);
    await applyMappings(db, orphans, [{ from: HEX_OLD, to: HEX_NEW }], tmp);
    const sch = db.calls.updateOne.find((c) => c.name === "scholarships");
    expect(sch.update.$set.criteria[0].categoryIds).toEqual([HEX_NEW]);
    expect(sch.update.$set.criteria[0].pointOverrides[0].categoryId).toBe(HEX_NEW);
    require("fs").rmSync(tmp, { recursive: true, force: true });
  });

  test("xaritada yo'q yetimga TEGMAYDI", async () => {
    const db = mkDb();
    const { orphans } = await scan(db);
    const tmp = require("path").join(require("os").tmpdir(), `relink-test3-${process.pid}`);
    const res = await applyMappings(db, orphans, [{ from: HEX_OTHER, to: HEX_NEW }], tmp);
    expect(res.targetedCount).toBe(0);
    expect(db.calls.updateOne).toHaveLength(0);
    require("fs").rmSync(tmp, { recursive: true, force: true });
  });

  test("optimistik qulf: filtrga ildizning ESKI qiymati kiradi", async () => {
    const db = mkDb();
    const { orphans } = await scan(db);
    const tmp = require("path").join(require("os").tmpdir(), `relink-test4-${process.pid}`);
    await applyMappings(db, orphans, [{ from: HEX_OLD, to: HEX_NEW }], tmp);
    const sch = db.calls.updateOne.find((c) => c.name === "scholarships");
    expect(sch.filter).toHaveProperty("criteria");
    expect(sch.filter.criteria[0].categoryIds).toEqual([HEX_OLD]);
    require("fs").rmSync(tmp, { recursive: true, force: true });
  });
});

describe("buildGuardErrors", () => {
  const catalog = buildCatalog(CATALOG_DOCS);
  const orphan = (over = {}) => ({
    value: HEX_OLD,
    criteriaId: CRIT_A,
    collection: "scholarships",
    _id: oid("6a7efdac5916905f06cebeb6"),
    path: "criteria[0].categoryIds[0]",
    ...over,
  });
  const scanResult = (orphans = [orphan()]) => ({ catalog, orphans });
  const ok = { write: true, expectedDb: "db1", dbName: "db1" };

  test("DRY rejimda hech qanday qo'riqchi ishlamaydi", () => {
    expect(
      buildGuardErrors({ write: false, pairs: [], scanResult: scanResult(), expectedDb: null, dbName: "db1" }),
    ).toEqual([]);
  });

  test("--db berilmasa RAD", () => {
    const e = buildGuardErrors({ ...ok, expectedDb: null, pairs: [{ from: HEX_OLD, to: HEX_NEW }], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/--db=<nom> berilmagan/);
  });

  test("--db mos kelmasa RAD", () => {
    const e = buildGuardErrors({ ...ok, expectedDb: "boshqa", pairs: [{ from: HEX_OLD, to: HEX_NEW }], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/MOS EMAS/);
  });

  test("--map bo'lmasa RAD (skript o'zi moslashtirmaydi)", () => {
    const e = buildGuardErrors({ ...ok, pairs: [], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/moslashtirmaydi/);
  });

  test("chap tomon TIRIK kategoriya bo'lsa RAD", () => {
    const e = buildGuardErrors({ ...ok, pairs: [{ from: HEX_NEW, to: HEX_OTHER }], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/TIRIK kategoriya/);
  });

  test("chap tomon skanda topilmasa RAD (idempotentlik)", () => {
    const e = buildGuardErrors({ ...ok, pairs: [{ from: "6a7efdac5916905f06cebe11", to: HEX_NEW }], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/topilmadi/);
  });

  test("nishon katalogda yo'q bo'lsa RAD", () => {
    const e = buildGuardErrors({ ...ok, pairs: [{ from: HEX_OLD, to: "6a7efdac5916905f06cebe22" }], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/katalogda YO/);
  });

  test("nishon BOSHQA MEZONDAGI bir xil nomli kategoriya bo'lsa RAD", () => {
    const e = buildGuardErrors({ ...ok, pairs: [{ from: HEX_OLD, to: HEX_B_SAME_NAME }], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/BOSHQA mezonga ishora/);
  });

  test("nishon O'CHIRILGAN mezon ichida bo'lsa RAD", () => {
    const e = buildGuardErrors({ ...ok, pairs: [{ from: HEX_OLD, to: HEX_DELETED }], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/CHIRILGAN mezon/);
  });

  test("nishon NOFAOL kategoriya bo'lsa RAD", () => {
    const e = buildGuardErrors({ ...ok, pairs: [{ from: HEX_OLD, to: HEX_INACTIVE }], scanResult: scanResult() });
    expect(e.join(" ")).toMatch(/NOFAOL/);
  });

  test("havolada mezon ref i bo'lmasa OGOHLANTIRADI (jimgina o'tkazmaydi)", () => {
    const e = buildGuardErrors({
      ...ok,
      pairs: [{ from: HEX_OLD, to: HEX_NEW }],
      scanResult: scanResult([orphan({ criteriaId: null })]),
    });
    expect(e.join(" ")).toMatch(/mezon ref i YO/);
  });

  test("hammasi to'g'ri bo'lsa xato YO'Q", () => {
    expect(buildGuardErrors({ ...ok, pairs: [{ from: HEX_OLD, to: HEX_NEW }], scanResult: scanResult() })).toEqual([]);
  });
});

describe("unknownArgs", () => {
  test("ma'lum bayroqlarni o'tkazadi", () => {
    expect(unknownArgs(["--write", "--audit", "--map", HEX_OLD + "=" + HEX_NEW, "--db=x", "--backup-dir=/t"])).toEqual([]);
  });

  test("--map=a=b ni USHLAYDI (qo'shni bayroqlar `=` shaklida)", () => {
    const arg = "--map=" + HEX_OLD + "=" + HEX_NEW;
    expect(unknownArgs([arg])).toEqual([arg]);
  });

  test("noma'lum bayroqni ushlaydi", () => {
    expect(unknownArgs(["--dry", "--rollback"])).toEqual(["--dry", "--rollback"]);
  });

  test("--map ning QIYMATI bayroq deb hisoblanmaydi", () => {
    expect(unknownArgs(["--map", HEX_OLD + "=" + HEX_NEW, "--write"])).toEqual([]);
  });
});

describe("SITES tripwire", () => {
  test("aynan 4 ta saqlash joyi qamralgan (yangi joy qo'shilsa test yiqilsin)", () => {
    expect(SITES.map((s) => s.key).sort()).toEqual([
      "achievement.scoreCategoryId",
      "application.judgeScores",
      "scholarship.categoryIds",
      "scholarship.pointOverrides",
    ]);
  });

  test("har site collect va remapRoot ni eksport qiladi", () => {
    for (const s of SITES) {
      expect(typeof s.collect).toBe("function");
      expect(typeof s.remapRoot).toBe("function");
      expect(typeof s.collection).toBe("string");
      expect(typeof s.root).toBe("string");
    }
  });
});
