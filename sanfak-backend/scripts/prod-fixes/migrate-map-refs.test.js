"use strict";

const mongoose = require("mongoose");
const { ObjectId } = require("bson");
const { mapRefPaths, rewrite } = require("./migrate-map-refs");

const { Schema, Types } = mongoose;

describe("mapRefPaths — faqat Map ICHIDAGI ref yo'llari", () => {
  it("Map ichidagi skalyar ref topiladi", () => {
    const inner = new Schema({ science: { type: Types.ObjectId, ref: "science" } });
    const s = new Schema({ semesters: { type: Map, of: inner } });
    expect(mapRefPaths(s)).toEqual([{ path: "semesters.$*.science", ref: "science" }]);
  });

  it("Map TASHQARISIDAGI ref OLINMAYDI (uni oddiy so'rov topa oladi)", () => {
    const s = new Schema({ science: { type: Types.ObjectId, ref: "science" } });
    expect(mapRefPaths(s)).toEqual([]);
  });

  it("Map -> massiv -> ichma-ich hujjat zanjiri to'liq kuzatiladi", () => {
    const particle = new Schema({ slugRef: { type: Types.ObjectId, ref: "educationActivityType" } });
    const sem = new Schema({ particles: { type: [particle] } });
    const s = new Schema({ semesters: { type: Map, of: sem } });
    expect(mapRefPaths(s)).toEqual([
      { path: "semesters.$*.particles.$[].slugRef", ref: "educationActivityType" },
    ]);
  });

  it("BIR XIL sxema ikki joyda ishlatilsa IKKALASI ham topiladi", () => {
    const particle = new Schema({ slugRef: { type: Types.ObjectId, ref: "eat" } });
    const sem = new Schema({ particles: { type: [particle] } });
    const block = new Schema({ semesters: { type: Map, of: sem } });
    const s = new Schema({ a: { type: [block] }, b: { type: [block] } });
    const paths = mapRefPaths(s).map((p) => p.path).sort();
    expect(paths).toEqual([
      "a.$[].semesters.$*.particles.$[].slugRef",
      "b.$[].semesters.$*.particles.$[].slugRef",
    ]);
  });

  it("Map ichidagi MASSIV ref ham topiladi", () => {
    const inner = new Schema({ users: [{ type: Types.ObjectId, ref: "user" }] });
    const s = new Schema({ m: { type: Map, of: inner } });
    expect(mapRefPaths(s)).toEqual([{ path: "m.$*.users", ref: "user" }]);
  });

  it("Map qiymati TO'G'RIDAN-TO'G'RI ref bo'lsa ham topiladi (obyekt shakli)", () => {
    const s = new Schema({ m: { type: Map, of: { type: Types.ObjectId, ref: "user" } } });
    expect(mapRefPaths(s)).toEqual([{ path: "m.$*", ref: "user" }]);
  });

  it("Map qiymati ref MASSIVI bo'lsa ham topiladi (docAssignments shakli)", () => {
    const s = new Schema({ m: { type: Map, of: [{ type: Types.ObjectId, ref: "user" }] } });
    expect(mapRefPaths(s)).toEqual([{ path: "m.$*", ref: "user" }]);
  });
});

describe("rewrite — hujjat ichida almashtirish", () => {
  const A = new ObjectId();
  const B = new ObjectId();
  const C = new ObjectId();

  it("Map kalitlaridan qat'i nazar barcha bargni topadi", () => {
    const doc = { semesters: { 1: { science: A }, 2: { science: A }, 3: { science: C } } };
    expect(rewrite(doc, "semesters.$*.science".split("."), A, B)).toBe(2);
    expect(String(doc.semesters["1"].science)).toBe(String(B));
    expect(String(doc.semesters["3"].science)).toBe(String(C));
  });

  it("massiv bargida faqat MOS elementlar almashadi", () => {
    const doc = { m: { x: { users: [A, C, A] } } };
    expect(rewrite(doc, "m.$*.users".split("."), A, B)).toBe(2);
    expect(doc.m.x.users.map(String)).toEqual([String(B), String(C), String(B)]);
  });

  it("yo'q yo'l — 0, xato bermaydi", () => {
    expect(rewrite({}, "a.$*.b".split("."), A, B)).toBe(0);
    expect(rewrite({ a: null }, "a.$*.b".split("."), A, B)).toBe(0);
    expect(rewrite(null, "a".split("."), A, B)).toBe(0);
  });

  it("mos kelmagan id TEGILMAYDI", () => {
    const doc = { semesters: { 1: { science: C } } };
    expect(rewrite(doc, "semesters.$*.science".split("."), A, B)).toBe(0);
    expect(String(doc.semesters["1"].science)).toBe(String(C));
  });

  it("chuqur zanjir (Map -> massiv -> massiv) ishlaydi", () => {
    const doc = {
      semesters: { 1: { blocks: [{ sciences: [{ particle: [{ slugRef: A }, { slugRef: C }] }] }] } },
    };
    const p = "semesters.$*.blocks.$[].sciences.$[].particle.$[].slugRef".split(".");
    expect(rewrite(doc, p, A, B)).toBe(1);
    expect(String(doc.semesters["1"].blocks[0].sciences[0].particle[0].slugRef)).toBe(String(B));
  });
});
