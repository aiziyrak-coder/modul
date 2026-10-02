"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { EJSON, ObjectId } = require("bson");
const mongoose = require("mongoose");

const { writeBackup, readBackup, BACKUP_FORMAT } = require("./_lib");
const { arrayRefPaths } = require("./scan-scalar-array-refs");

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pf-test-"));

describe("writeBackup / readBackup — BSON turlari saqlanadi (MD-55)", () => {
  let dir;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("`ObjectId` va `Date` TUR sifatida qaytadi (satr EMAS)", () => {
    const id = new ObjectId();
    const when = new Date("2026-08-31T06:00:00.000Z");
    const file = writeBackup(dir, "sinov", { ids: [id], when });

    const { format, payload } = readBackup(file);
    expect(format).toBe(BACKUP_FORMAT);
    expect(payload.ids[0]).toBeInstanceOf(ObjectId);
    expect(String(payload.ids[0])).toBe(String(id));
    expect(payload.when).toBeInstanceOf(Date);
    expect(payload.when.toISOString()).toBe(when.toISOString());
  });

  it("faylda `$oid` bor — ya'ni EJSON yozilgan", () => {
    const file = writeBackup(dir, "sinov", { id: new ObjectId() });
    expect(fs.readFileSync(file, "utf8")).toContain("$oid");
  });

  it("`backupFormat` payloaddagi maydonlarni BOSIB KETMAYDI", () => {
    const file = writeBackup(dir, "sinov", { script: "sinov", db: "x" });
    const { payload } = readBackup(file);
    expect(payload.script).toBe("sinov");
    expect(payload.db).toBe("x");
  });

  it("ESKI (versiyasiz) fayl `format: 1` deb o'qiladi", () => {
    const file = path.join(dir, "eski-1.json");
    fs.writeFileSync(file, JSON.stringify({ script: "eski", ids: ["6a951aa160e250dc7faa40b6"] }));
    const { format, payload } = readBackup(file);
    expect(format).toBe(1);
    expect(typeof payload.ids[0]).toBe("string");
  });

  it("EJSON aylanmasi qo'lda yozilgan fayl bilan ham ishlaydi", () => {
    const id = new ObjectId();
    const file = path.join(dir, "qol-1.json");
    fs.writeFileSync(file, EJSON.stringify({ backupFormat: 2, id }, undefined, 2, { relaxed: false }));
    expect(readBackup(file).payload.id).toBeInstanceOf(ObjectId);
  });
});

describe("arrayRefPaths — massiv-ref maydonlarini topish (MD-56)", () => {
  const { Schema, Types } = mongoose;

  it("`[ObjectId] + ref` maydonini topadi", () => {
    const s = new Schema({ allowedCourseIds: [{ type: Types.ObjectId, ref: "course" }] });
    expect(arrayRefPaths(s)).toEqual(["allowedCourseIds"]);
  });

  it("`ref` SIZ massivni OLMAYDI (u ma'lumotnomaga ishora qilmaydi)", () => {
    const s = new Schema({ tags: [{ type: Types.ObjectId }] });
    expect(arrayRefPaths(s)).toEqual([]);
  });

  it("SKALYAR ref maydonini olmaydi (u massiv emas)", () => {
    const s = new Schema({ course: { type: Types.ObjectId, ref: "course" } });
    expect(arrayRefPaths(s)).toEqual([]);
  });

  it("massiv bo'lmagan oddiy maydonlarni olmaydi", () => {
    const s = new Schema({ title: String, n: Number, flags: [String] });
    expect(arrayRefPaths(s)).toEqual([]);
  });

  it("ichma-ich hujjat massivi `$[]` bilan belgilanadi (skaner uni O'TKAZIB yuboradi)", () => {
    const child = new Schema({ courses: [{ type: Types.ObjectId, ref: "course" }] });
    const s = new Schema({ blocks: [child] });
    expect(arrayRefPaths(s)).toEqual(["blocks.$[].courses"]);
  });

  it("bir nechta maydon — hammasi qaytadi", () => {
    const s = new Schema({
      a: [{ type: Types.ObjectId, ref: "x" }],
      b: [{ type: Types.ObjectId, ref: "y" }],
      c: String,
    });
    expect(arrayRefPaths(s).sort()).toEqual(["a", "b"]);
  });
});
