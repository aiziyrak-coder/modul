"use strict";

const StudentAchievement = require("./studentAchievement.model");
const { currentAcademicYear } = require("../_services/academicYearWindow");

describe("studentAchievement — o'quv yili muhri", () => {
  test("🔴 yangi hujjat JORIY o'quv yili bilan muhrlanadi", () => {
    const doc = new StudentAchievement({ title: "Maqola" });
    expect(doc.academicYear).toBe(currentAcademicYear());
    expect(doc.academicYear).toMatch(/^\d{4}\/\d{4}$/);
  });

  test("aniq berilgan qiymat USTUN (ortga to'ldirish skripti shunga tayanadi)", () => {
    const doc = new StudentAchievement({ title: "Maqola", academicYear: "2024/2025" });
    expect(doc.academicYear).toBe("2024/2025");
  });

  test("sxemada `academicYearId` (ref) ATAYLAB YO'Q", () => {
    expect(StudentAchievement.schema.path("academicYearId")).toBeUndefined();
    expect(StudentAchievement.schema.path("academicYear")).toBeDefined();
  });

  test("`academicYear` indekslangan — reyting so'rovi uni filtrlaydi", () => {
    expect(StudentAchievement.schema.path("academicYear").options.index).toBe(true);
  });
});
