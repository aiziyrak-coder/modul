"use strict";

const V = require("./residencyTest.validation");

const OID = "6a5a0acbd34b3c21a575d5fb";
const ok = { title: "1-oraliq sinov", date: "2026-09-01", fileUrl: "/files/t.pdf" };

const val = (schema, payload) => schema.validate(payload, { convert: true });

describe("createSchema", () => {
  it("minimal to'g'ri so'rovni qabul qiladi", () => {
    expect(val(V.createSchema, ok).error).toBeUndefined();
  });

  it("fayl (fileUrl) yo'q -> xato", () => {
    const { fileUrl, ...noFile } = ok;
    expect(val(V.createSchema, noFile).error).toBeDefined();
  });

  it("nom yoki sana yo'q -> xato", () => {
    expect(val(V.createSchema, { ...ok, title: undefined }).error).toBeDefined();
    expect(val(V.createSchema, { ...ok, date: undefined }).error).toBeDefined();
  });

  it("satr ko'rinishidagi son maydonlarni songa aylantiradi", () => {
    const { error, value } = val(V.createSchema, {
      ...ok,
      courseNumber: "2",
      maxScore: "50",
      questionCount: "30",
    });
    expect(error).toBeUndefined();
    expect(value.courseNumber).toBe(2);
    expect(value.maxScore).toBe(50);
    expect(value.questionCount).toBe(30);
  });

  it("bo'sh satrli ixtiyoriy maydonlar so'rovni yiqitmaydi", () => {
    const { error } = val(V.createSchema, {
      ...ok,
      specialty: "",
      group: "",
      science: "",
      program: "",
      courseNumber: "",
      maxScore: "",
      academicYear: "",
    });
    expect(error).toBeUndefined();
  });

  it("bo'sh maxScore kalitni olib tashlaydi -> model default'i (100) ishlaydi", () => {
    expect(val(V.createSchema, { ...ok, maxScore: "" }).value.maxScore).toBeUndefined();
  });

  it("model chegarasini Joi ham ushlaydi (maxScore 0 va 101)", () => {
    expect(val(V.createSchema, { ...ok, maxScore: 0 }).error).toBeDefined();
    expect(val(V.createSchema, { ...ok, maxScore: 101 }).error).toBeDefined();
    expect(val(V.createSchema, { ...ok, maxScore: 100 }).error).toBeUndefined();
  });

  it("noto'g'ri program qiymati -> xato", () => {
    expect(val(V.createSchema, { ...ok, program: "bakalavr" }).error).toBeDefined();
  });

  it("yaroqsiz ObjectId -> xato", () => {
    expect(val(V.createSchema, { ...ok, specialty: "abc" }).error).toBeDefined();
    expect(val(V.createSchema, { ...ok, specialty: OID }).error).toBeUndefined();
  });

  it("noma'lum maydonni rad etadi (mijoz `uploadedBy` yoza olmaydi)", () => {
    expect(val(V.createSchema, { ...ok, uploadedBy: OID }).error).toBeDefined();
  });
});

describe("updateSchema", () => {
  it("faylsiz qisman tahrirni qabul qiladi", () => {
    expect(val(V.updateSchema, { title: "Yangi nom" }).error).toBeUndefined();
  });

  it("bo'sh obyektni rad etadi", () => {
    expect(val(V.updateSchema, {}).error).toBeDefined();
  });
});

describe("resultsSchema", () => {
  it("to'g'ri ro'yxatni qabul qiladi", () => {
    expect(
      val(V.resultsSchema, { results: [{ resident: OID, score: 88 }] }).error,
    ).toBeUndefined();
  });

  it("0 ball qabul qilinadi", () => {
    expect(
      val(V.resultsSchema, { results: [{ resident: OID, score: 0 }] }).error,
    ).toBeUndefined();
  });

  it("null ball qabul qilinadi (ballni olib tashlash)", () => {
    expect(
      val(V.resultsSchema, { results: [{ resident: OID, score: null }] }).error,
    ).toBeUndefined();
  });

  it("manfiy ball -> xato", () => {
    expect(
      val(V.resultsSchema, { results: [{ resident: OID, score: -1 }] }).error,
    ).toBeDefined();
  });

  it("yuqori chegara Joi'da tekshirilmaydi (server tekshiradi)", () => {
    expect(
      val(V.resultsSchema, { results: [{ resident: OID, score: 500 }] }).error,
    ).toBeUndefined();
  });

  it("score maydonisiz qator -> xato", () => {
    expect(val(V.resultsSchema, { results: [{ resident: OID }] }).error).toBeDefined();
  });

  it("bo'sh ro'yxat -> xato", () => {
    expect(val(V.resultsSchema, { results: [] }).error).toBeDefined();
  });
});

describe("listQuery", () => {
  it("kurs raqamini ham, ma'lumotnoma _id sini ham qabul qiladi", () => {
    expect(val(V.listQuery, { courseNumber: "1" }).error).toBeUndefined();
    expect(val(V.listQuery, { courseNumber: OID }).error).toBeUndefined();
  });

  it("bo'sh filtrlar so'rovni yiqitmaydi", () => {
    expect(
      val(V.listQuery, { search: "", specialty: "", group: "", academicYear: "" }).error,
    ).toBeUndefined();
  });
});
