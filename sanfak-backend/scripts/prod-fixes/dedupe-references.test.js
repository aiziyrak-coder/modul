const path = require("path");
const { readBackup } = require("./_lib");
const { ObjectId } = require("bson");
const mongoose = require("mongoose");
const {
  normalizeReferenceTitle,
  discoverReferenceFolders,
  findDuplicateGroups,
  pickCanonical,
  countTitleWhitespaceIssues,
  pickBestWrittenTitle,
  extractModelRefInfo,
  buildRefMap,
  buildPositionalPath,
  buildRedirectOps,
  classifyTarget,
  isMongooseModel,
  processCollection,
  dedupeReferences,
  computeExitCode,
} = require("./dedupe-references");

const oid = () => new mongoose.Types.ObjectId();
const olderOid = () => mongoose.Types.ObjectId.createFromTime(1700000000);
const newerOid = () => mongoose.Types.ObjectId.createFromTime(1800000000);

describe("normalizeReferenceTitle", () => {
  test("bo'sh/null/undefined qiymat uchun bo'sh qator qaytaradi", () => {
    expect(normalizeReferenceTitle(null)).toBe("");
    expect(normalizeReferenceTitle(undefined)).toBe("");
    expect(normalizeReferenceTitle("")).toBe("");
  });

  test("registr farqiga e'tibor bermaydi", () => {
    expect(normalizeReferenceTitle("FAKULTET")).toBe(normalizeReferenceTitle("fakultet"));
    expect(normalizeReferenceTitle("Davolash Fakulteti")).toBe(normalizeReferenceTitle("davolash fakulteti"));
  });

  test("bosh/oxir va ichki takroriy bo'shliqlarni yig'adi", () => {
    expect(normalizeReferenceTitle("  Davolash    fakulteti  ")).toBe(normalizeReferenceTitle("Davolash fakulteti"));
  });

  test("to'g'ri apostrof (U+0027) bilan yozilgan so'zni tanib oladi", () => {
    expect(normalizeReferenceTitle("Amaliy mashg'ulot")).toBe("amaliy mashgulot");
  });

  test("4 xil apostrof belgisi bir xil kalitga tekislanadi ('  ' ' ʻ ʼ)", () => {
    const variants = [
      "Mustaqil ta'lim",
      "Mustaqil ta‘lim",
      "Mustaqil ta’lim",
      "Mustaqil taʻlim",
      "Mustaqil taʼlim",
    ];
    const keys = variants.map(normalizeReferenceTitle);
    keys.forEach((k) => expect(k).toBe("mustaqil talim"));
  });

  test("R-8: apostrofdan keyingi ORTIQCHA BO'SHLIQ ham bir xil kalitga tushadi", () => {
    expect(normalizeReferenceTitle("Amaliy mashg'ulot")).toBe(normalizeReferenceTitle("Amaliy mashg' ulot"));
    expect(normalizeReferenceTitle("Mustaqil ta'lim")).toBe(normalizeReferenceTitle("Mustaqil ta' lim"));
    expect(normalizeReferenceTitle("Laboratoriya mashg'uloti")).toBe(
      normalizeReferenceTitle("Laboratoriya mashg' uloti"),
    );
  });

  test("bir nechta bo'shliq apostrofdan keyin bo'lsa ham yopiladi", () => {
    expect(normalizeReferenceTitle("Amaliy mashg'ulot")).toBe(normalizeReferenceTitle("Amaliy mashg'   ulot"));
  });

  test("chindan HAR XIL nomlarni bir kalitga TEKISLAMAYDI (soxta-musbat yo'q)", () => {
    expect(normalizeReferenceTitle("Ichki kasalliklar kafedrasi")).not.toBe(
      normalizeReferenceTitle("Ichki kasalliklar bo'limi"),
    );
    expect(normalizeReferenceTitle("Dotsent")).not.toBe(normalizeReferenceTitle("Professor"));
  });
});

describe("findDuplicateGroups", () => {
  test("normallashtirilgan title bo'yicha guruhlaydi, yagona hujjatlar guruhga tushmaydi", () => {
    const a = { _id: oid(), title: "Amaliy mashg'ulot" };
    const b = { _id: oid(), title: "Amaliy mashg' ulot" };
    const c = { _id: oid(), title: "Seminar" };
    const groups = findDuplicateGroups([a, b, c]);
    expect(groups).toHaveLength(1);
    expect(groups[0].docs).toEqual(expect.arrayContaining([a, b]));
    expect(groups[0].docs).toHaveLength(2);
  });

  test("bo'sh/tanib bo'lmaydigan title'li hujjat e'tiborsiz qoldiriladi", () => {
    const groups = findDuplicateGroups([{ _id: oid(), title: "" }, { _id: oid(), title: null }]);
    expect(groups).toHaveLength(0);
  });

  test("dublikatsiz ro'yxat — bo'sh natija", () => {
    expect(findDuplicateGroups([{ _id: oid(), title: "A" }, { _id: oid(), title: "B" }])).toHaveLength(0);
  });

  test("3+ variantli guruh — N-to-1 nomzod sifatida bitta guruhga tushadi", () => {
    const docs = [
      { _id: oid(), title: "Mustaqil ta'lim" },
      { _id: oid(), title: "Mustaqil ta' lim" },
      { _id: oid(), title: "MUSTAQIL TA'LIM" },
    ];
    const groups = findDuplicateGroups(docs);
    expect(groups).toHaveLength(1);
    expect(groups[0].docs).toHaveLength(3);
  });
});

describe("pickCanonical", () => {
  test("1-ustuvorlik: active:true har doim active:false'dan ustun (referenssiz bo'lsa ham)", () => {
    const inactive = { _id: newerOid(), active: false };
    const active = { _id: olderOid(), active: true };
    const refCounts = new Map([[String(inactive._id), 50], [String(active._id), 0]]);
    expect(pickCanonical([inactive, active], refCounts)).toBe(active);
  });

  test("2-ustuvorlik: ikkalasi ham active bo'lsa — ko'proq referensga ega hujjat g'olib", () => {
    const lowRef = { _id: oid(), active: true };
    const highRef = { _id: oid(), active: true };
    const refCounts = new Map([[String(lowRef._id), 1], [String(highRef._id), 9]]);
    expect(pickCanonical([lowRef, highRef], refCounts)).toBe(highRef);
  });

  test("3-ustuvorlik: active va referens teng bo'lsa — ESKIROQ hujjat g'olib", () => {
    const older = { _id: olderOid(), active: true };
    const newer = { _id: newerOid(), active: true };
    const refCounts = new Map([[String(older._id), 3], [String(newer._id), 3]]);
    expect(pickCanonical([older, newer], refCounts)).toBe(older);
  });

  test("refCountByDocId berilmasa ham yiqilmaydi (default bo'sh Map)", () => {
    const older = { _id: olderOid(), active: true };
    const newer = { _id: newerOid(), active: true };
    expect(pickCanonical([older, newer])).toBe(older);
  });

  test("3 ta hujjatli guruh — barcha uch qoida birga to'g'ri ishlaydi", () => {
    const deleted = { _id: oid(), active: false };
    const lowRef = { _id: olderOid(), active: true };
    const highRef = { _id: newerOid(), active: true };
    const refCounts = new Map([
      [String(deleted._id), 100],
      [String(lowRef._id), 1],
      [String(highRef._id), 5],
    ]);
    expect(pickCanonical([deleted, lowRef, highRef], refCounts)).toBe(highRef);
  });
});

describe("countTitleWhitespaceIssues", () => {
  test("mukammal toza title — 0", () => {
    expect(countTitleWhitespaceIssues("Amaliy mashg'ulot")).toBe(0);
    expect(countTitleWhitespaceIssues("Mustaqil ta'lim")).toBe(0);
  });

  test("apostrofdan KEYIN bo'shliq — 1 (R-8, real audit holati)", () => {
    expect(countTitleWhitespaceIssues("Amaliy mashg' ulot")).toBe(1);
    expect(countTitleWhitespaceIssues("Mustaqil ta' lim")).toBe(1);
  });

  test("apostrofdan OLDIN bo'shliq ham hisoblanadi", () => {
    expect(countTitleWhitespaceIssues("Amaliy mashg 'ulot")).toBe(1);
  });

  test("bosh/oxir bo'shliq — 1", () => {
    expect(countTitleWhitespaceIssues(" Seminar")).toBe(1);
    expect(countTitleWhitespaceIssues("Seminar ")).toBe(1);
  });

  test("ketma-ket (doubled) ichki bo'shliq — 1", () => {
    expect(countTitleWhitespaceIssues("Amaliy  mashgulot")).toBe(1);
  });

  test("bir nechta muammo BIRGA — yig'indi sifatida sanaladi (bosh bo'shliq + apostrofdan keyin bo'shliq = 2)", () => {
    expect(countTitleWhitespaceIssues(" Amaliy mashg' ulot")).toBe(2);
  });

  test("bo'sh/null qiymat — yiqilmaydi, 0 qaytaradi", () => {
    expect(countTitleWhitespaceIssues("")).toBe(0);
    expect(countTitleWhitespaceIssues(null)).toBe(0);
  });
});

describe("pickBestWrittenTitle", () => {
  test(`REAL demo holat — Guruh 1: "Amaliy mashg' ulot" (R-8, ★ canonical, 23 ref) / "Amaliy mashg'ulot" (toza, 🗑 dublikat, 0 ref) — TOZA g'olib`, () => {
    const malformed = { _id: olderOid(), title: "Amaliy mashg' ulot" };
    const clean = { _id: newerOid(), title: "Amaliy mashg'ulot" };
    expect(pickBestWrittenTitle([malformed, clean])).toBe("Amaliy mashg'ulot");
    expect(pickBestWrittenTitle([clean, malformed])).toBe("Amaliy mashg'ulot");
  });

  test(`REAL demo holat — Guruh 2: "Mustaqil ta' lim" (R-8, ★ canonical) / "Mustaqil ta'lim" (toza, 🗑 dublikat) — TOZA g'olib`, () => {
    const malformed = { _id: olderOid(), title: "Mustaqil ta' lim" };
    const clean = { _id: newerOid(), title: "Mustaqil ta'lim" };
    expect(pickBestWrittenTitle([malformed, clean])).toBe("Mustaqil ta'lim");
  });

  test("DURANG (ikkalasi ham mukammal toza) — ESKIROQ hujjat g'olib, alifbo tartibiga QARAMAY", () => {
    const older = { _id: olderOid(), title: "Zoo fani" };
    const newer = { _id: newerOid(), title: "Alfa fani" };
    expect(pickBestWrittenTitle([older, newer])).toBe("Zoo fani");
    expect(pickBestWrittenTitle([newer, older])).toBe("Zoo fani");
  });

  test("TO'LIQ DURANG (bir xil muammo soni, yosh signali yo'q — _id yo'q) — title matni alifbo tartibida BIRINCHISI g'olib", () => {
    const b = { title: "B nomi" };
    const a = { title: "A nomi" };
    expect(pickBestWrittenTitle([b, a])).toBe("A nomi");
  });

  test("SOF FUNKSIYA — kirish massivi va hujjatlar o'zgarmaydi", () => {
    const docs = [
      { _id: newerOid(), title: "Amaliy mashg'ulot" },
      { _id: olderOid(), title: "Amaliy mashg' ulot" },
    ];
    const snapshotBefore = JSON.parse(JSON.stringify(docs));
    pickBestWrittenTitle(docs);
    expect(JSON.parse(JSON.stringify(docs))).toEqual(snapshotBefore);
  });
});

describe("extractModelRefInfo", () => {
  const ChildSchema = new mongoose.Schema({
    title: { type: String },
  });
  const childModel = mongoose.model("__dedupeTestChild", ChildSchema);

  const ParentSchema = new mongoose.Schema({
    title: String,
    plainRef: { type: mongoose.Schema.Types.ObjectId, ref: "__dedupeTestChild" },
    arrayRef: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "__dedupeTestChild" }], default: [] },
    assignees: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "__dedupeTestChild" }, status: String }],
  });
  const parentModel = mongoose.model("__dedupeTestParent", ParentSchema);

  test("to'g'ridan-to'g'ri ObjectId ref maydonini topadi", () => {
    const info = extractModelRefInfo(parentModel);
    expect(info.refFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "plainRef",
          ref: "__dedupeTestChild",
          leafIsArray: false,
          arrayLevels: [],
          viaMap: false,
        }),
      ]),
    );
  });

  test("massiv-ObjectId (SchemaArray.caster) ref maydonini topadi", () => {
    const info = extractModelRefInfo(parentModel);
    expect(info.refFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "arrayRef",
          ref: "__dedupeTestChild",
          leafIsArray: true,
          arrayLevels: [],
          viaMap: false,
        }),
      ]),
    );
  });

  test("DocumentArray ichidagi nested ref maydonini ham topadi (dot-notation)", () => {
    const info = extractModelRefInfo(parentModel);
    expect(info.refFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "assignees.user",
          ref: "__dedupeTestChild",
          leafIsArray: false,
          arrayLevels: ["assignees"],
          viaMap: false,
        }),
      ]),
    );
  });

  test("modelName va collectionName to'g'ri qaytariladi", () => {
    const info = extractModelRefInfo(childModel);
    expect(info.modelName).toBe("__dedupeTestChild");
    expect(info.collectionName).toBe(childModel.collection.name);
  });

  test("buildRefMap — bir nechta manbadan bitta nishonga teskari xarita quradi", () => {
    const infos = [extractModelRefInfo(parentModel), extractModelRefInfo(childModel)];
    const map = buildRefMap(infos);
    const refs = map.get("__dedupeTestChild");
    expect(refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ collection: parentModel.collection.name, field: "plainRef", model: "__dedupeTestParent", leafIsArray: false, arrayLevels: [] }),
        expect.objectContaining({ collection: parentModel.collection.name, field: "arrayRef", model: "__dedupeTestParent", leafIsArray: true, arrayLevels: [] }),
        expect.objectContaining({ collection: parentModel.collection.name, field: "assignees.user", model: "__dedupeTestParent", leafIsArray: false, arrayLevels: ["assignees"] }),
      ]),
    );
    expect(map.get("noSuchTarget")).toBeUndefined();
  });
});

describe("isMongooseModel", () => {
  test("real mongoose Model'ni tanib oladi", () => {
    const M = mongoose.model("__dedupeTestIsModel", new mongoose.Schema({ title: String }));
    expect(isMongooseModel(M)).toBe(true);
  });

  test("oddiy funksiya/obyekt/undefined'ni rad etadi", () => {
    expect(isMongooseModel(() => {})).toBe(false);
    expect(isMongooseModel({})).toBe(false);
    expect(isMongooseModel(undefined)).toBe(false);
  });
});

describe("classifyTarget", () => {
  test("String title bor, scope maydoni yo'q — hasTitle:true, scoped:false", () => {
    const M = mongoose.model("__dedupeTestGlobalTarget", new mongoose.Schema({ title: String }));
    const t = classifyTarget("globalTarget", M);
    expect(t.hasTitle).toBe(true);
    expect(t.scoped).toBe(false);
    expect(t.scopeFields).toEqual([]);
    expect(t.reason).toBeNull();
  });

  test("title yo'q — hasTitle:false, sabab tushuntirilgan", () => {
    const M = mongoose.model("__dedupeTestNoTitle", new mongoose.Schema({ value: Number }));
    const t = classifyTarget("noTitle", M);
    expect(t.hasTitle).toBe(false);
    expect(t.reason).toMatch(/title/);
  });

  test("faculty/department kabi scope maydoni bo'lsa — scoped:true (group/region naqshi)", () => {
    const M = mongoose.model(
      "__dedupeTestScopedTarget",
      new mongoose.Schema({
        title: String,
        faculty: { type: mongoose.Schema.Types.ObjectId, ref: "faculty" },
      }),
    );
    const t = classifyTarget("scopedTarget", M);
    expect(t.scoped).toBe(true);
    expect(t.scopeFields).toContain("faculty");
  });

  test("title Number bo'lsa (String emas) — hasTitle:false", () => {
    const M = mongoose.model("__dedupeTestNumericTitle", new mongoose.Schema({ title: Number }));
    const t = classifyTarget("numericTitle", M);
    expect(t.hasTitle).toBe(false);
  });
});

describe("discoverReferenceFolders", () => {
  const REFERENCES_DIR = path.join(__dirname, "..", "..", "src", "references");
  const found = discoverReferenceFolders(REFERENCES_DIR);

  test("ma'lum reference papkalarini topadi (faculty, department, group, educationActivityType)", () => {
    const names = found.map((f) => f.folder);
    expect(names).toEqual(expect.arrayContaining(["faculty", "department", "group", "educationActivityType"]));
  });

  test("_services papkasini o'tkazib yuboradi (model emas)", () => {
    expect(found.map((f) => f.folder)).not.toContain("_services");
  });

  test("har bir topilgan papka uchun modelPath haqiqatan mavjud", () => {
    const fs = require("fs");
    for (const f of found) expect(fs.existsSync(f.modelPath)).toBe(true);
  });

  test("qattiq kodlangan ro'yxat emas — natija papka nomi bo'yicha alifbo tartibida", () => {
    const names = found.map((f) => f.folder);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});

const makeFakeDb = (initialCollections) => {
  const state = {};
  for (const [name, docs] of Object.entries(initialCollections)) {
    state[name] = docs.map((d) => ({ ...d }));
  }
  const calls = { updateMany: 0, deleteOne: 0 };
  const matches = (doc, filter) => {
    const keys = Object.keys(filter || {});
    if (!keys.length) return true;
    return keys.every((k) => String(doc[k]) === String(filter[k]));
  };
  return {
    calls,
    state,
    collection(name) {
      if (!state[name]) state[name] = [];
      const rows = state[name];
      return {
        find: (filter = {}) => ({
          toArray: async () => rows.filter((d) => matches(d, filter)).map((d) => ({ ...d })),
          project: () => ({
            toArray: async () => rows.filter((d) => matches(d, filter)).map((d) => ({ _id: d._id })),
          }),
        }),
        countDocuments: async (filter = {}) => rows.filter((d) => matches(d, filter)).length,
        updateMany: async (filter, update) => {
          calls.updateMany += 1;
          const setKey = Object.keys(update.$set)[0];
          let n = 0;
          for (const d of rows) {
            if (matches(d, filter)) {
              d[setKey] = update.$set[setKey];
              n += 1;
            }
          }
          return { modifiedCount: n };
        },
        deleteOne: async (filter) => {
          calls.deleteOne += 1;
          const i = rows.findIndex((d) => matches(d, filter));
          if (i >= 0) rows.splice(i, 1);
          return { deletedCount: i >= 0 ? 1 : 0 };
        },
      };
    },
  };
};

const globalTarget = {
  folder: "educationActivityType",
  modelName: "educationActivityType",
  collectionName: "educationactivitytypes",
  hasTitle: true,
  reason: null,
  scoped: false,
  scopeFields: [],
};

const scopedTarget = {
  folder: "group",
  modelName: "group",
  collectionName: "groups",
  hasTitle: true,
  reason: null,
  scoped: true,
  scopeFields: ["direction", "course", "academicYear"],
};

const notApplicableTarget = {
  folder: "auditoriumHour",
  modelName: "auditoriumHour",
  collectionName: "auditoriumhours",
  hasTitle: false,
  reason: '"auditoriumHour" sxemasida String turidagi "title" maydoni yo\'q.',
  scoped: false,
  scopeFields: [],
};

describe("processCollection — DRY (default)", () => {
  test("write bayrog'isiz HECH NARSA yozilmaydi/o'chirilmaydi, lekin guruh to'g'ri hisoblanadi", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg'ulot", active: true };
    const dup = { _id: newerOid(), title: "Amaliy mashg' ulot", active: true };
    const usageRow = { _id: oid(), educationActivityType: canonical._id };
    const db = makeFakeDb({
      educationactivitytypes: [canonical, dup],
      schedules: [usageRow],
    });
    const refSources = [{ collection: "schedules", field: "educationActivityType", model: "schedule" }];

    const result = await processCollection({ db, target: globalTarget, refSources, write: false, backup: true });

    expect(result.applicable).toBe(true);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].canonical).toEqual(canonical);
    expect(result.groups[0].duplicates).toEqual([dup]);
    expect(result.merged).toHaveLength(0);
    expect(db.calls.updateMany).toBe(0);
    expect(db.calls.deleteOne).toBe(0);
  });

  test('"title" maydoni yo\'q kolleksiya — hech qanday so\'rov yubormay applicable:false qaytaradi', async () => {
    const db = makeFakeDb({});
    const result = await processCollection({ db, target: notApplicableTarget, refSources: [], write: true, backup: true });
    expect(result.applicable).toBe(false);
    expect(result.reason).toMatch(/title/);
    expect(db.calls.updateMany).toBe(0);
    expect(db.calls.deleteOne).toBe(0);
  });
});

describe("processCollection — WRITE, global (SCOPED emas)", () => {
  test("referenslar canonical'ga qayta yo'naltiriladi, dublikat o'chiriladi", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg'ulot", active: true };
    const dup = { _id: newerOid(), title: "Amaliy mashg' ulot", active: true };
    const usageOnCanonical = { _id: oid(), educationActivityType: canonical._id };
    const usageOnDup = { _id: oid(), educationActivityType: dup._id };
    const db = makeFakeDb({
      educationactivitytypes: [canonical, dup],
      schedules: [usageOnCanonical, usageOnDup],
    });
    const refSources = [{ collection: "schedules", field: "educationActivityType", model: "schedule" }];

    const result = await processCollection({ db, target: globalTarget, refSources, write: true, backup: false });

    expect(db.calls.updateMany).toBeGreaterThan(0);
    expect(db.calls.deleteOne).toBe(1);
    const persistedSchedules = db.state.schedules;
    expect(persistedSchedules.every((r) => String(r.educationActivityType) === String(canonical._id))).toBe(true);
    expect(result.merged).toEqual([
      expect.objectContaining({ deleted: true, remaining: 0 }),
    ]);
    expect(db.state.educationactivitytypes.map((d) => String(d._id))).toEqual([String(canonical._id)]);
  });

  test("XAVFSIZLIK: qayta tekshiruvda referens QOLSA — dublikat O'CHIRILMAYDI", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg'ulot", active: true };
    const dup = { _id: newerOid(), title: "Amaliy mashg' ulot", active: true };
    const usageRow = { _id: oid(), educationActivityType: dup._id };

    const db = {
      calls: { updateMany: 0, deleteOne: 0 },
      collection(name) {
        if (name === "educationactivitytypes") {
          return {
            find: () => ({ toArray: async () => [canonical, dup] }),
            deleteOne: async () => {
              db.calls.deleteOne += 1;
              return { deletedCount: 1 };
            },
          };
        }
        if (name === "schedules") {
          return {
            countDocuments: async () => 1,
            find: () => ({ project: () => ({ toArray: async () => [{ _id: usageRow._id }] }) }),
            updateMany: async () => {
              db.calls.updateMany += 1;
              return { modifiedCount: 0 };
            },
          };
        }
        return {
          countDocuments: async () => 0,
          find: () => ({ project: () => ({ toArray: async () => [] }) }),
          updateMany: async () => ({ modifiedCount: 0 }),
        };
      },
    };
    const refSources = [{ collection: "schedules", field: "educationActivityType", model: "schedule" }];

    const result = await processCollection({ db, target: globalTarget, refSources, write: true, backup: false });

    expect(db.calls.deleteOne).toBe(0);
    expect(result.merged).toEqual([
      expect.objectContaining({ deleted: false, remaining: 1 }),
    ]);
  });

  test("IDEMPOTENT: birlashtirilgandan keyin xuddi shu db'da qayta yugursa — dublikat guruh topilmaydi", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg'ulot", active: true };
    const dup = { _id: newerOid(), title: "Amaliy mashg' ulot", active: true };
    const db = makeFakeDb({ educationactivitytypes: [canonical, dup], schedules: [] });

    const first = await processCollection({ db, target: globalTarget, refSources: [], write: true, backup: false });
    expect(first.merged[0].deleted).toBe(true);

    const second = await processCollection({ db, target: globalTarget, refSources: [], write: true, backup: false });
    expect(second.groups).toHaveLength(0);
    expect(second.merged).toHaveLength(0);
  });

  test("guruh bo'lmasa (dublikat yo'q) --write ham DB'ga tegmaydi", async () => {
    const db = makeFakeDb({
      educationactivitytypes: [
        { _id: oid(), title: "Ma'ruza", active: true },
        { _id: oid(), title: "Seminar", active: true },
      ],
    });
    const result = await processCollection({ db, target: globalTarget, refSources: [], write: true, backup: false });
    expect(result.groups).toHaveLength(0);
    expect(db.calls.updateMany).toBe(0);
    expect(db.calls.deleteOne).toBe(0);
  });
});

describe("processCollection — WRITE, SCOPED kolleksiya (group/region naqshi)", () => {
  test("guruhlar HISOBOTGA chiqadi (canonical/duplicates hisoblanadi), lekin --write bilan HAM avto-merge qilinmaydi", async () => {
    const canonical = { _id: olderOid(), title: "1-guruh", active: true, direction: oid() };
    const dup = { _id: newerOid(), title: "1-Guruh", active: true, direction: oid() };
    const db = makeFakeDb({ groups: [canonical, dup] });

    const result = await processCollection({ db, target: scopedTarget, refSources: [], write: true, backup: false });

    expect(result.scoped).toBe(true);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].duplicates).toEqual([dup]);
    expect(result.merged).toHaveLength(0);
    expect(db.calls.updateMany).toBe(0);
    expect(db.calls.deleteOne).toBe(0);
    expect(db.state.groups).toHaveLength(2);
  });
});

describe("processCollection — WRITE, title-repair (canonical'ning title'i tuzatiladi)", () => {
  test("R-8 REAL holat: canonical (ko'proq referens) BUZUQ title bilan, dublikat TOZA title bilan — canonical'ning title'i tuzatiladi, dublikat birlashtirilib o'chiriladi", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg' ulot", active: true };
    const dup = { _id: newerOid(), title: "Amaliy mashg'ulot", active: true };
    const usageRow = { _id: oid(), educationActivityType: canonical._id };
    const db = makeFakeDb({
      educationactivitytypes: [canonical, dup],
      schedules: [usageRow],
    });
    const refSources = [{ collection: "schedules", field: "educationActivityType", model: "schedule" }];

    const result = await processCollection({ db, target: globalTarget, refSources, write: true, backup: false });

    expect(result.groups[0].titleRepair).toBe("Amaliy mashg'ulot");
    expect(result.titleFixes).toEqual([
      expect.objectContaining({ docId: canonical._id, from: "Amaliy mashg' ulot", to: "Amaliy mashg'ulot" }),
    ]);
    const persisted = db.state.educationactivitytypes.find((d) => String(d._id) === String(canonical._id));
    expect(persisted.title).toBe("Amaliy mashg'ulot");
    expect(db.state.educationactivitytypes).toHaveLength(1);
  });

  test("canonical ALLAQACHON eng toza — titleRepair:null, titleFixes bo'sh, title uchun DB'ga YOZUV YO'Q (shovqin yo'q)", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg'ulot", active: true };
    const dup = { _id: newerOid(), title: "Amaliy mashg' ulot", active: true };
    const usageRow = { _id: oid(), educationActivityType: canonical._id };
    const db = makeFakeDb({
      educationactivitytypes: [canonical, dup],
      schedules: [usageRow],
    });
    const refSources = [{ collection: "schedules", field: "educationActivityType", model: "schedule" }];
    const updateManyCallsBefore = db.calls.updateMany;

    const result = await processCollection({ db, target: globalTarget, refSources, write: true, backup: false });

    expect(result.groups[0].titleRepair).toBeNull();
    expect(result.titleFixes).toEqual([]);
    expect(db.calls.updateMany).toBe(updateManyCallsBefore);
    const persisted = db.state.educationactivitytypes.find((d) => String(d._id) === String(canonical._id));
    expect(persisted.title).toBe("Amaliy mashg'ulot");
  });

  test("SCOPED kolleksiyada titleRepair HISOBLANADI (ko'rinish/hisobot uchun) lekin --write bilan HAM yozilmaydi", async () => {
    const canonical = { _id: olderOid(), title: " 1-guruh", active: true, direction: oid() };
    const dup = { _id: newerOid(), title: "1-guruh", active: true, direction: oid() };
    const db = makeFakeDb({ groups: [canonical, dup] });

    const result = await processCollection({ db, target: scopedTarget, refSources: [], write: true, backup: false });

    expect(result.scoped).toBe(true);
    expect(result.groups[0].titleRepair).toBe("1-guruh");
    expect(result.titleFixes).toEqual([]);
    expect(db.calls.updateMany).toBe(0);
    expect(db.state.groups.find((d) => String(d._id) === String(canonical._id)).title).toBe(" 1-guruh");
  });

  test("zaxira (backup) title-tuzatishdan OLDINGI ('buzuq') qiymatni yozadi — real fayl, vaqtinchalik papkada", async () => {
    const os = require("os");
    const fs = require("fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dedupe-refs-title-backup-"));
    try {
      const canonical = { _id: olderOid(), title: "Amaliy mashg' ulot", active: true };
      const dup = { _id: newerOid(), title: "Amaliy mashg'ulot", active: true };
      const usageRow = { _id: oid(), educationActivityType: canonical._id };
      const db = makeFakeDb({
        educationactivitytypes: [canonical, dup],
        schedules: [usageRow],
      });
      const refSources = [{ collection: "schedules", field: "educationActivityType", model: "schedule" }];

      const result = await processCollection({
        db,
        target: globalTarget,
        refSources,
        write: true,
        backup: true,
        backupDir: tmpDir,
        dbName: "test-db",
      });

      const backupFile = result.titleFixes[0].backupFile;
      expect(backupFile).toBeTruthy();
      const { format, payload } = readBackup(backupFile);
      expect(format).toBe(2);
      expect(payload.action).toBe("title-repair");
      expect(payload.titleBefore).toBe("Amaliy mashg' ulot");
      expect(payload.titleAfter).toBe("Amaliy mashg'ulot");
      expect(String(payload.docId)).toBe(String(canonical._id));
      expect(payload.docId).toBeInstanceOf(ObjectId);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("dedupeReferences — orkestrator", () => {
  test("`only` filtri faqat ko'rsatilgan papkalarni qayta ishlaydi", async () => {
    const db = makeFakeDb({
      educationactivitytypes: [
        { _id: oid(), title: "Ma'ruza" },
        { _id: oid(), title: "Ma'ruza" },
      ],
      groups: [{ _id: oid(), title: "1-guruh" }],
    });
    const results = await dedupeReferences({
      db,
      targets: [globalTarget, scopedTarget],
      refMap: new Map(),
      write: false,
      only: ["educationActivityType"],
    });
    expect(results).toHaveLength(1);
    expect(results[0].folder).toBe("educationActivityType");
  });

  test("DRY: bir nechta kolleksiyada ham DB'ga hech narsa yozilmaydi", async () => {
    const db = makeFakeDb({
      educationactivitytypes: [
        { _id: oid(), title: "Ma'ruza" },
        { _id: oid(), title: "MA'RUZA" },
      ],
      groups: [
        { _id: oid(), title: "1-guruh" },
        { _id: oid(), title: "1-guruh" },
      ],
    });
    const results = await dedupeReferences({
      db,
      targets: [globalTarget, scopedTarget],
      refMap: new Map(),
      write: false,
    });
    expect(results.reduce((s, r) => s + r.groups.length, 0)).toBe(2);
    expect(db.calls.updateMany).toBe(0);
    expect(db.calls.deleteOne).toBe(0);
  });
});

describe("computeExitCode", () => {
  test("dublikat guruh topilmasa — 0", () => {
    expect(computeExitCode([{ groups: [], merged: [] }])).toBe(0);
  });

  test("dublikat guruh topilsa (DRY) — 1", () => {
    expect(computeExitCode([{ groups: [{ normalizedTitle: "x" }], merged: [] }])).toBe(1);
  });

  test("write rad etilgan holat bo'lsa — 1", () => {
    expect(computeExitCode([{ groups: [], merged: [{ deleted: false }] }])).toBe(1);
  });
});

describe("buildPositionalPath (MD-49)", () => {
  test("massiv darajasi yo'q — yo'l o'zgarmaydi", () => {
    expect(buildPositionalPath("allowedCourseIds", [])).toEqual({
      path: "allowedCourseIds",
      rests: [],
    });
  });

  test("bitta DocumentArray — `$[el0]` + o'sha darajaning qolgan yo'li", () => {
    expect(buildPositionalPath("criteria.criteria", ["criteria"])).toEqual({
      path: "criteria.$[el0].criteria",
      rests: ["criteria"],
    });
  });

  test("ikki daraja — HAR IKKALASI ham `$[elN]` (tashqisi `$[]` EMAS)", () => {
    const r = buildPositionalPath("teachers.blocks.science", ["teachers", "teachers.blocks"]);
    expect(r).toEqual({
      path: "teachers.$[el0].blocks.$[el1].science",
      rests: ["blocks.science", "science"],
    });
    expect(r.path).not.toContain("$[]");
  });

  test("ikki daraja + massiv barg", () => {
    expect(
      buildPositionalPath("teachers.blocks.groups", ["teachers", "teachers.blocks"]),
    ).toEqual({
      path: "teachers.$[el0].blocks.$[el1].groups",
      rests: ["blocks.groups", "groups"],
    });
  });
});


describe("buildRedirectOps (MD-49)", () => {
  const DUP = oid();
  const CANON = oid();

  test("oddiy skalyar ref — bitta `$set` (eski xatti-harakat saqlanadi)", () => {
    const ops = buildRedirectOps({ field: "faculty" }, DUP, CANON);
    expect(ops).toEqual([
      { filter: { faculty: DUP }, update: { $set: { faculty: CANON } }, options: {} },
    ]);
  });

  test("MASSIV barg — `$set` EMAS, `$addToSet` keyin `$pull`", () => {
    const ops = buildRedirectOps(
      { field: "allowedCourseIds", leafIsArray: true, arrayLevels: [] },
      DUP,
      CANON,
    );
    expect(ops).toHaveLength(2);
    expect(JSON.stringify(ops)).not.toContain("$set");
    expect(ops[0].update).toEqual({ $addToSet: { allowedCourseIds: CANON } });
    expect(ops[1].update).toEqual({ $pull: { allowedCourseIds: DUP } });
    expect(Object.keys(ops[0].update)[0]).toBe("$addToSet");
  });

  test("DocumentArray ichidagi skalyar — `$[el]` + arrayFilters", () => {
    const ops = buildRedirectOps(
      { field: "criteria.criteria", leafIsArray: false, arrayLevels: ["criteria"] },
      DUP,
      CANON,
    );
    expect(ops).toEqual([
      {
        filter: { "criteria.criteria": DUP },
        update: { $set: { "criteria.$[el0].criteria": CANON } },
        options: { arrayFilters: [{ "el0.criteria": DUP }] },
      },
    ]);
  });

  test("DocumentArray ichidagi MASSIV — ikkala operatsiyada ham arrayFilters", () => {
    const ops = buildRedirectOps(
      { field: "blocks.groups", leafIsArray: true, arrayLevels: ["blocks"] },
      DUP,
      CANON,
    );
    expect(ops).toHaveLength(2);
    for (const op of ops) {
      expect(op.options).toEqual({ arrayFilters: [{ "el0.groups": DUP }] });
      expect(op.update.$set).toBeUndefined();
    }
  });

  test("Map (`$*`) yo'li — `null` (fail-closed, jimgina 0 qaytarmaydi)", () => {
    expect(
      buildRedirectOps(
        { field: "semesters.$*.blocks.sciences.science", viaMap: true },
        DUP,
        CANON,
      ),
    ).toBeNull();
  });
});

describe("extractModelRefInfo — shakl klassifikatsiyasi (MD-49)", () => {
  const LeafSchema = new mongoose.Schema({ title: String });
  mongoose.model("__md49Leaf", LeafSchema);

  const DeepSchema = new mongoose.Schema({
    teachers: [
      {
        blocks: [
          {
            science: { type: mongoose.Schema.Types.ObjectId, ref: "__md49Leaf" },
            groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "__md49Leaf" }],
          },
        ],
      },
    ],
    semesters: {
      type: Map,
      of: new mongoose.Schema({
        science: { type: mongoose.Schema.Types.ObjectId, ref: "__md49Leaf" },
      }),
    },
  });
  const deepModel = mongoose.model("__md49Deep", DeepSchema);
  const fieldsOf = () => {
    const byField = {};
    for (const rf of extractModelRefInfo(deepModel).refFields) byField[rf.field] = rf;
    return byField;
  };

  test("ikki darajali nested skalyar — arrayLevels ikkalasini ham qayd etadi", () => {
    const rf = fieldsOf()["teachers.blocks.science"];
    expect(rf).toBeDefined();
    expect(rf.arrayLevels).toEqual(["teachers", "teachers.blocks"]);
    expect(rf.leafIsArray).toBe(false);
    expect(rf.viaMap).toBe(false);
  });

  test("ikki darajali nested MASSIV barg — leafIsArray true", () => {
    const rf = fieldsOf()["teachers.blocks.groups"];
    expect(rf).toBeDefined();
    expect(rf.leafIsArray).toBe(true);
    expect(rf.arrayLevels).toEqual(["teachers", "teachers.blocks"]);
  });

  test("Map ichidagi ref — viaMap true (avtomatik birlashtirish taqiqlanadi)", () => {
    const rf = Object.values(fieldsOf()).find((r) => r.viaMap);
    expect(rf).toBeDefined();
    expect(rf.field).toContain("$*");
  });
});

describe("processCollection — Map yo'li bo'lsa BIRLASHTIRMAYDI (MD-49 fail-closed)", () => {
  test("--write bilan ham hech narsa yozilmaydi/o'chirilmaydi, sabab qaytariladi", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg'ulot", active: true };
    const duplicate = { _id: newerOid(), title: "Amaliy mashg' ulot", active: true };
    const db = makeFakeDb({
      educationactivitytypes: [canonical, duplicate],
      workingplans: [{ _id: oid() }],
    });
    const refSources = [
      {
        collection: "workingplans",
        field: "semesters.$*.blocks.sciences.science",
        model: "workingPlan",
        viaMap: true,
      },
    ];

    const result = await processCollection({
      db,
      target: globalTarget,
      refSources,
      write: true,
      backup: false,
    });

    expect(result.mergeRefused).toEqual({
      reason: "MAP_PATH_UNSUPPORTED",
      sources: ["workingplans.semesters.$*.blocks.sciences.science"],
    });
    expect(result.merged).toEqual([]);
    expect(db.calls.updateMany).toBe(0);
    expect(db.calls.deleteOne).toBe(0);
    expect(db.state.educationactivitytypes).toHaveLength(2);
  });

  test("Map yo'li YO'Q bo'lsa — odatdagidek birlashtiradi (regressiya qulfi)", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg'ulot", active: true };
    const duplicate = { _id: newerOid(), title: "Amaliy mashg' ulot", active: true };
    const db = makeFakeDb({ educationactivitytypes: [canonical, duplicate] });

    const result = await processCollection({
      db,
      target: globalTarget,
      refSources: [],
      write: true,
      backup: false,
    });

    expect(result.mergeRefused).toBeUndefined();
    expect(result.merged).toHaveLength(1);
    expect(db.state.educationactivitytypes).toHaveLength(1);
  });
});

describe("buildRedirectOps — ragged-chidamlilik (MD-49)", () => {
  const DUP = oid();
  const CANON = oid();

  test("ikki darajali yo'lda HAR daraja uchun alohida arrayFilter quriladi", () => {
    const ops = buildRedirectOps(
      { field: "teachers.blocks.groups", leafIsArray: true, arrayLevels: ["teachers", "teachers.blocks"] },
      DUP,
      CANON,
    );
    for (const op of ops) {
      expect(op.options.arrayFilters).toEqual([
        { "el0.blocks.groups": DUP },
        { "el1.groups": DUP },
      ]);
      expect(JSON.stringify(op.update)).not.toContain("$[]");
    }
  });
});

describe("processCollection — xato butun yugurishni to'xtatmaydi (MD-49)", () => {
  test("qayta yo'naltirishda xato bo'lsa: dublikat O'CHIRILMAYDI, xato qayd etiladi, ish davom etadi", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg'ulot", active: true };
    const duplicate = { _id: newerOid(), title: "Amaliy mashg' ulot", active: true };
    const usageRow = { _id: oid(), faculty: duplicate._id };
    const db = makeFakeDb({ educationactivitytypes: [canonical, duplicate] });
    const realCollection = db.collection.bind(db);
    db.collection = (name) => {
      const c = realCollection(name);
      if (name !== "usages") return c;
      return {
        ...c,
        find: () => ({ project: () => ({ toArray: async () => [{ _id: usageRow._id }] }) }),
        countDocuments: async () => 1,
        updateMany: async () => {
          throw new Error("E11000 duplicate key error");
        },
      };
    };

    const result = await processCollection({
      db,
      target: globalTarget,
      refSources: [{ collection: "usages", field: "faculty", model: "usage" }],
      write: true,
      backup: false,
    });

    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].deleted).toBe(false);
    expect(result.merged[0].error).toContain("E11000");
    expect(db.state.educationactivitytypes).toHaveLength(2);
    expect(db.calls.deleteOne).toBe(0);
  });
});

describe("processCollection — fail-closed TITLE-TUZATISHNI bloklamaydi (MD-49)", () => {
  test("Map yo'li bo'lsa birlashtirilmaydi, lekin canonical nomi tuzatiladi", async () => {
    const canonical = { _id: olderOid(), title: "Amaliy mashg' ulot", active: true };
    const duplicate = { _id: newerOid(), title: "Amaliy mashg'ulot", active: false };
    const db = makeFakeDb({ educationactivitytypes: [canonical, duplicate] });

    const result = await processCollection({
      db,
      target: globalTarget,
      refSources: [{ collection: "workingplans", field: "semesters.$*.x", model: "wp", viaMap: true }],
      write: true,
      backup: false,
    });

    expect(result.mergeRefused.reason).toBe("MAP_PATH_UNSUPPORTED");
    expect(result.merged).toEqual([]);
    expect(db.calls.deleteOne).toBe(0);
    expect(result.titleFixes).toHaveLength(1);
    expect(result.titleFixes[0].to).toBe("Amaliy mashg'ulot");
  });
});
