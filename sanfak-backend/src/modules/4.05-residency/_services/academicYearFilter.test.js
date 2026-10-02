"use strict";

const { Types } = require("mongoose");
const { applyAcademicYearFilter } = require("./academicYearFilter");

const ID = "6a5a0acbd34b3c21a575d5c8";

describe("applyAcademicYearFilter", () => {
  it("`_id` kelsa ref bo'yicha ObjectId bilan filtrlaydi", () => {
    const f = applyAcademicYearFilter({}, ID);
    expect(f.academicYearRef).toBeInstanceOf(Types.ObjectId);
    expect(String(f.academicYearRef)).toBe(ID);
  });

  it("tire bilan berilgan titul slash variantini ham qamrab oladi", () => {
    expect(applyAcademicYearFilter({}, "2025-2026")).toEqual({
      academicYear: { $in: ["2025-2026", "2025/2026"] },
    });
  });

  it("slash bilan berilgan titul tire variantini ham qamrab oladi", () => {
    expect(applyAcademicYearFilter({}, "2025/2026")).toEqual({
      academicYear: { $in: ["2025/2026", "2025-2026"] },
    });
  });

  it.each([undefined, null, ""])("bo'sh qiymat (%p) filtrga TEGMAYDI", (v) => {
    expect(applyAcademicYearFilter({ active: true }, v)).toEqual({ active: true });
  });

  it("mavjud filtrni buzmaydi", () => {
    const f = { active: true, program: "ordinatura" };
    applyAcademicYearFilter(f, ID);
    expect(f.active).toBe(true);
    expect(f.program).toBe("ordinatura");
    expect(String(f.academicYearRef)).toBe(ID);
  });

  it("24-belgidan farqli hex-ga o'xshash satr TITUL deb qaraladi", () => {
    expect(applyAcademicYearFilter({}, "6a5a0acb")).toEqual({
      academicYear: "6a5a0acb",
    });
  });
});
