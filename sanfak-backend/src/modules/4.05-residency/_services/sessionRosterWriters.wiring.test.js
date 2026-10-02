"use strict";

const fs = require("fs");
const path = require("path");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");

const REPO = path.resolve(__dirname, "../../../..");
const WRITERS = [
  "src/modules/4.05-residency/_services/sessionResolution.js",
  "src/modules/4.05-residency/_services/sessionRoster.js",
  "src/modules/4.05-residency/residencySession/residencySessionGrade.service.js",
];
const RAW_HANDLE_READERS = [];
const COLLECTION = Roster.collection.collectionName;

const MODEL_REQUIRE = String.raw`require\(\s*["'\x60][^"'\x60)]*residencySessionRoster\.model(?:\.js)?["'\x60]\s*,?\s*\)`;
const MODEL_DECL = String.raw`(?:const|let|var)\s+(\w+)\s*=\s*${MODEL_REQUIRE}`;
const WRITE_METHODS =
  "create|insertMany|insertOne|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|deleteOne|deleteMany|bulkWrite|bulkSave|replaceOne|findOneAndDelete|findByIdAndDelete|findOneAndReplace";
const QUERY_WRITES = "updateOne|updateMany|deleteOne|deleteMany|replaceOne|findOneAndUpdate|findOneAndDelete|findOneAndReplace";

function jsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") out.push(...jsFiles(full));
    else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) out.push(full);
  }
  return out;
}

const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const SOURCES = ["src", "scripts", "seed"]
  .flatMap((dir) => jsFiles(path.join(REPO, dir)))
  .map((full) => ({
    rel: path.relative(REPO, full).split(path.sep).join("/"),
    code: stripComments(fs.readFileSync(full, "utf8")),
  }));

const modelNames = (code) => [...code.matchAll(new RegExp(MODEL_DECL, "g"))].map((m) => m[1]);

function writesFrames(code) {
  const names = modelNames(code);
  const viaModel = names.some(
    (n) =>
      new RegExp(`\\b${n}\\.(?:collection\\.)?(?:${WRITE_METHODS})\\(`).test(code) ||
      new RegExp(`\\bnew\\s+${n}\\s*\\(`).test(code) ||
      new RegExp(`\\b${n}\\.(?:find|findOne|findById|where)\\([^;]*?\\.(?:${QUERY_WRITES})\\(`).test(code),
  );
  return viaModel || (names.length > 0 && /\.\$?save\s*\(/.test(code));
}

function takesRawHandle(code) {
  const viaModel = modelNames(code).some((n) => new RegExp(`\\b${n}\\.(?:collection|db|base)\\b`).test(code));
  const byName =
    /\.model\(\s*["'\x60]residencySessionRoster["'\x60]\s*\)/.test(code) ||
    /\.models\s*(?:\.\s*residencySessionRoster\b|\[\s*["'\x60]residencySessionRoster["'\x60]\s*\])/.test(code);
  return viaModel || byName || new RegExp(`["'\\x60]${COLLECTION}["'\\x60]`).test(code);
}

const offenders = (detect) => SOURCES.filter((s) => detect(s.code)).map((s) => s.rel).sort();

describe("yozuvchilar — faqat ruxsat etilgan fayllar", () => {
  test("freymga faqat ruxsat etilgan fayllar yozadi", () => {
    expect(offenders(writesFrames)).toEqual(WRITERS);
  });

  test("xom tutqich — faqat ko'rib chiqilgan o'quvchilar", () => {
    expect(offenders(takesRawHandle)).toEqual(RAW_HANDLE_READERS);
  });
});

const REQ = 'const Roster = require("./residencySessionRoster.model");\n';

describe("qulf o'zi ishlaydi — yozuv shakllari", () => {
  test.each([
    ["alias", 'const X = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");\nX.updateOne({}, {});'],
    ["bir papka", "const Roster = require('./residencySessionRoster.model');\nRoster.insertMany([]);"],
    [".js, let", 'let R=require("./residencySessionRoster.model.js");\nR.deleteMany({});'],
    ["native collection", 'const R = require("./residencySessionRoster.model");\nR.collection.insertOne({});'],
    ["new Model().save()", `${REQ}await new Roster(row).save();`],
    ["new Model() — keyin save", `${REQ}const doc = new Roster(row);\nawait doc.save();`],
    ["hidratlangan hujjat", `${REQ}const f = await Roster.findById(id);\nf.outcome = "present";\nawait f.save();`],
    ["$save taxallusi", `${REQ}const f = await Roster.findOne({ session });\nawait f.$save();`],
    ["freym yasab boshqa joyga uzatish", `${REQ}await persist(new Roster(row));`],
    ["bulkSave", `${REQ}await Roster.bulkSave(docs);`],
    ["so'rov zanjiri", `${REQ}await Roster.find({ session })\n  .where("resident").in(ids)\n  .updateMany({ $set: { cancelledAt: at } });`],
    ["where zanjiri", `${REQ}await Roster.where("session", id).deleteMany();`],
  ])("%s — yozuv ushlanadi", (_label, code) => {
    expect(writesFrames(code)).toBe(true);
  });

  test("o'qish yozuv emas; model e'loni tutqich emas; modelsiz faylda `.save(` begona", () => {
    expect(writesFrames(`${REQ}Roster.find({}); Roster.distinct("session"); Roster.exists({});`)).toBe(false);
    expect(writesFrames(`${REQ}await Roster.find({ session }).lean();\nawait Session.updateOne({}, {});`)).toBe(false);
    expect(writesFrames('mongoose.model("residencySessionRoster", Schema);')).toBe(false);
    expect(writesFrames("const doc = new Other(row);\nawait doc.save();")).toBe(false);
  });

  test("servis modelni o'qiydi, lekin YOZMAYDI va tutqich olmaydi", () => {
    const service = SOURCES.find((s) => s.rel.endsWith("residencySession/residencySession.service.js"));
    expect(modelNames(service.code)).toEqual(["Roster"]);
    expect(writesFrames(service.code)).toBe(false);
    expect(takesRawHandle(service.code)).toBe(false);
  });
});

describe("qulf o'zi ishlaydi — xom tutqich va manbalar", () => {
  test.each([
    ["collectionName", `${REQ}db.collection(Roster.collection.collectionName).updateOne({}, {});`],
    ["Model.db", `${REQ}Roster.db.collection("x").insertOne({});`],
    ["ulanish + kolleksiya nomi", `mongoose.connection.collection("${COLLECTION}").insertOne({});`],
    ["native db + nom", `mongoose.connection.db.collection('${COLLECTION}').updateMany({}, {});`],
    ["nomi bilan", 'mongoose.model("residencySessionRoster").updateMany({}, {});'],
    ["ulanish modeli nomi bilan", 'conn.model("residencySessionRoster").find({});'],
    ["models reyestri", "mongoose.models.residencySessionRoster.updateMany({}, {});"],
    ["models[...]", 'mongoose.models["residencySessionRoster"].deleteMany({});'],
  ])("%s — tutqich ushlanadi", (_label, code) => {
    expect(takesRawHandle(code)).toBe(true);
  });

  test("oddiy o'qish va modelning o'z e'loni — tutqich emas", () => {
    expect(takesRawHandle(`${REQ}Roster.find({}).lean();`)).toBe(false);
    expect(takesRawHandle('mongoose.model("residencySessionRoster", Schema);')).toBe(false);
  });

  test("manbalar haqiqatan skanerlangan (src, scripts, seed)", () => {
    expect(COLLECTION).toBe("residencysessionrosters");
    expect(SOURCES.length).toBeGreaterThan(50);
    expect(SOURCES.some((s) => s.rel === WRITERS[0])).toBe(true);
    for (const dir of ["scripts/", "seed/"]) expect(SOURCES.some((s) => s.rel.startsWith(dir))).toBe(true);
  });
});
