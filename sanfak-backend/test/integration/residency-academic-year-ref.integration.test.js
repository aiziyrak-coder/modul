"use strict";

const AcademicYear = require("#references/academicYear/academicYear.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Announcement = require("#modules/4.05-residency/residencyAnnouncement/residencyAnnouncement.model");
const plugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");

let y2025;
let y2026;

beforeEach(async () => {
  plugin.clearCache();
  const raw = await AcademicYear.collection.insertOne({
    title: "2025-2026",
    active: true,
  });
  y2025 = { _id: raw.insertedId };
  y2026 = await AcademicYear.create({ title: "2026/2027" });
  plugin.clearCache();
});

const makeResident = (academicYear) =>
  Resident.create({
    program: "ordinatura",
    fullName: "Test Rezident",
    courseNumber: 1,
    academicYear,
  });

describe("create — satr yozilsa ref ham to'ladi", () => {
  it("tire formatidagi satr ma'lumotnomaga bog'lanadi", async () => {
    const r = await makeResident("2025-2026");
    expect(String(r.academicYearRef)).toBe(String(y2025._id));
    expect(r.academicYear).toBe("2025-2026");
  });

  it("slash formati ham bog'lanadi (ikkala tomon normallashtiriladi)", async () => {
    const r = await makeResident("2025/2026");
    expect(String(r.academicYearRef)).toBe(String(y2025._id));
  });

  it("ma'lumotnomada yo'q yil — ref `null`, lekin YOZUV SAQLANADI", async () => {
    const r = await makeResident("1999-2000");
    expect(r.academicYearRef).toBeNull();
    expect(r.academicYear).toBe("1999-2000");
  });

  it("yil berilmasa ref ham bo'sh", async () => {
    const r = await makeResident(null);
    expect(r.academicYearRef).toBeNull();
  });
});

describe("update — ikkala yo'l ham qo'llab-quvvatlanadi", () => {
  it("`save()` bilan o'zgartirilsa ref ergashadi", async () => {
    const r = await makeResident("2025-2026");
    r.academicYear = "2026-2027";
    await r.save();
    expect(String(r.academicYearRef)).toBe(String(y2026._id));
  });

  it("`findByIdAndUpdate` ($set) bilan ham ergashadi", async () => {
    const r = await makeResident("2025-2026");
    await Resident.findByIdAndUpdate(r._id, { $set: { academicYear: "2026-2027" } });
    const fresh = await Resident.findById(r._id);
    expect(String(fresh.academicYearRef)).toBe(String(y2026._id));
  });

  it("`findByIdAndUpdate` (yalang'och obyekt) bilan ham ergashadi", async () => {
    const r = await makeResident("2025-2026");
    await Resident.findByIdAndUpdate(r._id, { academicYear: "2026-2027" });
    const fresh = await Resident.findById(r._id);
    expect(String(fresh.academicYearRef)).toBe(String(y2026._id));
  });

  it("yilga TEGMAYDIGAN yangilanish ref'ni buzmaydi", async () => {
    const r = await makeResident("2025-2026");
    await Resident.findByIdAndUpdate(r._id, { $set: { fullName: "Boshqa ism" } });
    const fresh = await Resident.findById(r._id);
    expect(String(fresh.academicYearRef)).toBe(String(y2025._id));
  });
});

describe("REGRESSIYA — eski hujjat buzilmaydi", () => {
  it("ref'siz eski hujjat o'qiladi va SAQLANADI", async () => {
    const raw = await Resident.collection.insertOne({
      program: "ordinatura",
      fullName: "Migratsiyagacha",
      courseNumber: 1,
      academicYear: "2025-2026",
      active: true,
    });
    const doc = await Resident.findById(raw.insertedId);
    expect(doc).not.toBeNull();
    expect(doc.academicYear).toBe("2025-2026");

    doc.fullName = "Tahrirlandi";
    await expect(doc.save()).resolves.toBeTruthy();
  });
});

describe("populate — ref haqiqiy qatorga olib boradi", () => {
  it("e'londa ham ishlaydi va titulni qaytaradi", async () => {
    const a = await Announcement.create({
      title: "Test e'lon",
      content: "matn",
      audience: "umumiy",
      academicYear: "2026-2027",
    });
    const populated = await Announcement.findById(a._id).populate(
      "academicYearRef",
      "title",
    );
    expect(populated.academicYearRef.title).toBe("2026/2027");
  });
});

describe("`_id` kiruvchi qiymat sifatida (uy konvensiyasi)", () => {
  it("`_id` yuborilsa titul ma'lumotnomadan olinadi", async () => {
    const r = await makeResident(String(y2026._id));
    expect(r.academicYear).toBe("2026/2027");
    expect(String(r.academicYearRef)).toBe(String(y2026._id));
  });

  it("`_id` bilan update ham ikkala maydonni to'ldiradi", async () => {
    const r = await makeResident("2025-2026");
    await Resident.findByIdAndUpdate(r._id, {
      $set: { academicYear: String(y2026._id) },
    });
    const fresh = await Resident.findById(r._id);
    expect(fresh.academicYear).toBe("2026/2027");
    expect(String(fresh.academicYearRef)).toBe(String(y2026._id));
  });

  it("NOMA'LUM `_id` — qiymat O'ZGARTIRILMAYDI", async () => {
    const ghost = "6a5a0acbd34b3c21a575d5c8";
    const r = await makeResident(ghost);
    expect(r.academicYear).toBe(ghost);
    expect(r.academicYearRef).toBeNull();
  });
});
