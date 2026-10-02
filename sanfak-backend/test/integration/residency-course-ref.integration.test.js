"use strict";

const Course = require("#references/course/course.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Announcement = require("#modules/4.05-residency/residencyAnnouncement/residencyAnnouncement.model");
const {
  clearCache,
} = require("#references/_services/courseResolver");

let c1;
let c2;

beforeEach(async () => {
  clearCache();
  c1 = await Course.create({ title: "1-kurs" });
  c2 = await Course.create({ title: "2-kurs" });
  clearCache();
});

const makeResident = (courseNumber) =>
  Resident.create({ program: "ordinatura", fullName: "Test", courseNumber });

describe("courseRef — son yozilsa havola ham to'ladi", () => {
  it("son ma'lumotnomaga bog'lanadi", async () => {
    const r = await makeResident(2);
    expect(r.courseNumber).toBe(2);
    expect(String(r.courseRef)).toBe(String(c2._id));
  });

  it("`_id` YUBORIB BO'LMAYDI — maydon `Number`, mongoose cast qiladi", async () => {
    await expect(makeResident(String(c1._id))).rejects.toThrow(/Cast to Number/);
  });

  it("ma'lumotnomada yo'q kurs — havola bo'sh, lekin YOZUV SAQLANADI", async () => {
    const r = await makeResident(9);
    expect(r.courseNumber).toBe(9);
    expect(r.courseRef).toBeNull();
  });

  it("update bilan ham ergashadi", async () => {
    const r = await makeResident(1);
    await Resident.findByIdAndUpdate(r._id, { $set: { courseNumber: 2 } });
    const fresh = await Resident.findById(r._id);
    expect(String(fresh.courseRef)).toBe(String(c2._id));
  });

  it("REGRESSIYA — havolasiz eski hujjat o'qiladi va saqlanadi", async () => {
    const raw = await Resident.collection.insertOne({
      program: "ordinatura",
      fullName: "Migratsiyagacha",
      courseNumber: 1,
      active: true,
    });
    const doc = await Resident.findById(raw.insertedId);
    expect(doc.courseNumber).toBe(1);
    doc.fullName = "Tahrir";
    await expect(doc.save()).resolves.toBeTruthy();
  });
});

describe("targetCoursesRef — e'lon manzili", () => {
  it("sonlar bilan manzillansa havolalar ham to'ladi", async () => {
    const a = await Announcement.create({
      title: "1-kurs uchun",
      content: "matn",
      audience: "umumiy",
      targetCourses: [1],
    });
    expect(a.targetCourses).toEqual([1]);
    expect(a.targetCoursesRef.map(String)).toEqual([String(c1._id)]);
  });

  it("satr ko'rinishidagi SON ham qabul qilinadi", async () => {
    const a = await Announcement.create({
      title: "2-kurs uchun",
      content: "matn",
      audience: "umumiy",
      targetCourses: ["2"],
    });
    expect(a.targetCourses).toEqual([2]);
    expect(a.targetCoursesRef.map(String)).toEqual([String(c2._id)]);
  });

  it("bo'sh massiv — ikkalasi ham bo'sh (targetsiz e'lon)", async () => {
    const a = await Announcement.create({
      title: "Hammaga",
      content: "matn",
      audience: "umumiy",
      targetCourses: [],
    });
    expect(a.targetCourses).toEqual([]);
    expect(a.targetCoursesRef).toEqual([]);
  });

  it("dublikat sonlar bir marta saqlanadi", async () => {
    const a = await Announcement.create({
      title: "Takror",
      content: "matn",
      audience: "umumiy",
      targetCourses: [1, 1, 2],
    });
    expect(a.targetCourses).toEqual([1, 2]);
  });
});

describe("REGRESSIYA — faqat HAVOLA bilan manzillangan e'lon", () => {
  it("`targetCourses` bo'sh, `targetCoursesRef` to'la — TARGETSIZ deb qaralmaydi", async () => {
    const raw = await Announcement.collection.insertOne({
      title: "Faqat havola bilan",
      content: "matn",
      audience: "umumiy",
      targetCourses: [],
      targetCoursesRef: [c2._id],
      active: true,
    });
    const doc = await Announcement.findById(raw.insertedId);
    expect(doc.targetCourses).toEqual([]);
    expect(doc.targetCoursesRef.map(String)).toEqual([String(c2._id)]);
  });
});
