"use strict";

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "../../../..");
const MODEL = "residencyExpulsionOrder/residencyExpulsionOrder.model";
const MODEL_REQUIRE = String.raw`require\(\s*["'\x60][^"'\x60)]*residencyExpulsionOrder\.model(?:\.js)?["'\x60]\s*,?\s*\)`;
const MODEL_DECL = String.raw`(?:const|let|var)\s+(\w+)\s*=\s*${MODEL_REQUIRE}`;
const RAW_HANDLE_READERS = ["scripts/recount-45-unexcused-hours.js"];

const ORDER_WRITERS = [
  "scripts/migrate-45-expulsion-orders.js",
  "src/modules/4.05-residency/_services/expulsionOrderDecision.js",
  "src/modules/4.05-residency/_services/expulsionOrderLifecycle.js",
];
const FLAG_WRITERS = [
  "src/modules/4.05-residency/_services/expulsionOrderDecision.js",
  "src/modules/4.05-residency/_services/expulsionOrderLifecycle.js",
];
const EXPELLED_WRITERS = ["src/modules/4.05-residency/_services/expulsionOrderDecision.js"];

const WRITE_METHODS =
  "create|insertMany|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|deleteOne|deleteMany|bulkWrite|replaceOne|findOneAndDelete|findByIdAndDelete|findOneAndReplace";

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

const SOURCES = [...jsFiles(path.join(REPO, "src")), ...jsFiles(path.join(REPO, "scripts"))].map((full) => ({
  rel: path.relative(REPO, full).split(path.sep).join("/"),
  code: stripComments(fs.readFileSync(full, "utf8")),
}));

const modelNames = (code) => [...code.matchAll(new RegExp(MODEL_DECL, "g"))].map((m) => m[1]);

function writesOrder(code) {
  return modelNames(code).some((n) => new RegExp(`\\b${n}\\.(?:collection\\.)?(${WRITE_METHODS}|insertOne)\\(`).test(code));
}

const takesRawHandle = (code) =>
  modelNames(code).some((n) => new RegExp(`\\b${n}\\.collection\\.collectionName\\b`).test(code)) ||
  /mongoose\.model\(\s*["'\x60]residencyExpulsionOrder["'\x60]\s*\)/.test(code);
const writesFlag = (code) => /\$set:\s*\{[^}]*\bexpulsionOrderCreated:/.test(code);
const writesExpelled = (code) => /\$set:\s*\{[^}]*\bstatus:\s*(STATUS_EXPELLED|"chetlatilgan")/.test(code);

const offenders = (detect) => SOURCES.filter((s) => detect(s.code)).map((s) => s.rel).sort();

describe("yozuvchilar — faqat ruxsat etilgan fayllar", () => {
  test("buyruq hujjati", () => {
    expect(offenders(writesOrder)).toEqual(ORDER_WRITERS);
  });

  test("rezident bayrog'i (ko'rsatkich)", () => {
    expect(offenders(writesFlag)).toEqual(FLAG_WRITERS);
  });

  test("`chetlatilgan` holati — faqat S2", () => {
    expect(offenders(writesExpelled)).toEqual(EXPELLED_WRITERS);
  });

  test("xom tutqich — faqat ko'rib chiqilgan o'quvchilar", () => {
    expect(offenders(takesRawHandle)).toEqual(RAW_HANDLE_READERS);
  });
});

describe("qulf o'zi ishlaydi", () => {
  test("model nomi har xil bo'lsa ham yozuv topiladi", () => {
    const code = `const X = require("#modules/4.05-residency/${MODEL}");\nX.updateOne({}, {});`;
    expect(writesOrder(code)).toBe(true);
    expect(writesOrder(code.replace("X.updateOne", "X.findOne"))).toBe(false);
  });

  test("nisbiy yo'l bilan olingan model ham ushlanadi (bir papka, `../`, bittalik qo'shtirnoq)", () => {
    for (const req of ['require("./residencyExpulsionOrder.model")', "require('../residencyExpulsionOrder/residencyExpulsionOrder.model')"]) {
      expect(writesOrder(`const Order = ${req};\nOrder.findOneAndUpdate({}, {});`)).toBe(true);
      expect(writesOrder(`const Order = ${req};\nOrder.findById(x);`)).toBe(false);
    }
  });

  test.each([
    ["`.js` qo'shimchasi", 'const Order = require("./residencyExpulsionOrder.model.js");\nOrder.updateOne({}, {});'],
    ["`let`, probelsiz", 'let Order=require("./residencyExpulsionOrder.model");\nOrder.deleteOne({});'],
    ["bir necha qatorda", 'const Order = require(\n  "#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model",\n);\nOrder.create({});'],
    ["template satr", "const Order = require(`./residencyExpulsionOrder.model`);\nOrder.bulkWrite([]);"],
    ["native `collection`", 'const Order = require("./residencyExpulsionOrder.model");\nOrder.collection.updateOne({}, {});'],
  ])("%s — yozuv ushlanadi", (_label, code) => {
    expect(writesOrder(code)).toBe(true);
  });

  test("xom tutqich ushlanadi, oddiy o'qish emas", () => {
    const req = 'const Order = require("./residencyExpulsionOrder.model");\n';
    expect(takesRawHandle(`${req}db.collection(Order.collection.collectionName).updateOne({}, {});`)).toBe(true);
    expect(takesRawHandle('mongoose.model("residencyExpulsionOrder").updateOne({}, {});')).toBe(true);
    expect(takesRawHandle(`${req}Order.findById(x);`)).toBe(false);
    expect(takesRawHandle('mongoose.model("residencyExpulsionOrder", Schema);')).toBe(false);
  });

  test("entity papkasidagi servis modelni o'qiydi, lekin YOZMAYDI", () => {
    const service = SOURCES.find((s) => s.rel.endsWith("residencyExpulsionOrder/residencyExpulsionOrder.service.js"));
    expect(service.code).toMatch(new RegExp(`const Order = ${MODEL_REQUIRE}`));
    expect(writesOrder(service.code)).toBe(false);
  });

  test("bayroq va holat yozuvlari topiladi, filtrdagi o'qish emas", () => {
    expect(writesFlag("Resident.updateOne({ expulsionOrderCreated: true }, { $set: { expulsionOrderCreated: false } })")).toBe(true);
    expect(writesFlag("Resident.find({ expulsionOrderCreated: { $ne: true } })")).toBe(false);
    expect(writesExpelled('x.updateOne({}, { $set: { status: "chetlatilgan" } })')).toBe(true);
    expect(writesExpelled('x.find({ status: { $ne: "chetlatilgan" } })')).toBe(false);
  });

  test("manbalar haqiqatan skanerlangan", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    expect(SOURCES.some((s) => s.rel.endsWith("expulsionOrderLifecycle.js"))).toBe(true);
  });
});
