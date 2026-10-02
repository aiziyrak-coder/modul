"use strict";

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);

const { teacherLabel } = require("./distribution.pdf");

describe("teacherLabel — vakant prefiks dublikati (ADR-021 Faza B)", () => {
  test("`vacantLabel` allaqachon 'Vakant' bilan boshlansa — prefiks TAKRORLANMAYDI", () => {
    const label = teacherLabel({ isVacant: true, vacantLabel: "Vakant 1-o'rin", stavka: 1 });
    expect(label).not.toContain("Vakant Vakant");
    expect(label).toContain("Vakant 1-o'rin");
  });

  test("`vacantLabel` 'Vakant'siz bo'lsa — prefiks qo'shiladi", () => {
    const label = teacherLabel({ isVacant: true, vacantLabel: "2-o'rin", stavka: 0.5 });
    expect(label).toContain("Vakant 2-o'rin");
    expect(label).not.toContain("Vakant Vakant");
  });

  test("`vacantLabel` yo'q bo'lsa — faqat 'Vakant'", () => {
    const label = teacherLabel({ isVacant: true, stavka: 1 });
    expect(label).toContain("Vakant");
    expect(label).not.toContain("Vakant Vakant");
    expect(label).not.toContain("Vakant undefined");
  });

  test("vakant emas — teacher F.I.O chiziladi (regressiya)", () => {
    const label = teacherLabel({
      isVacant: false,
      teacher: { lastName: "Karimov", firstName: "Anvar" },
    });
    expect(label).toContain("Karimov");
    expect(label).not.toContain("Vakant");
  });
});

describe("teacherLabel — lavozim slug'i emas, NOMI chiqadi (2026-09-09)", () => {
  test("docent → Dotsent, senior_teacher → Katta o'qituvchi", () => {
    const l1 = teacherLabel({ teacher: { lastName: "Karimov", firstName: "A" }, position: "docent", stavka: 0.5 });
    expect(l1).toContain("Dotsent");
    expect(l1).not.toContain("docent");
    const l2 = teacherLabel({ teacher: { lastName: "Karimov", firstName: "A" }, position: "senior_teacher", stavka: 1 });
    expect(l2).toContain("Katta o'qituvchi");
  });
  test("noma'lum slug xom holda qoladi (yashirilmaydi)", () => {
    const l = teacherLabel({ teacher: { lastName: "Karimov", firstName: "A" }, position: "laborant", stavka: 1 });
    expect(l).toContain("laborant");
  });
});
