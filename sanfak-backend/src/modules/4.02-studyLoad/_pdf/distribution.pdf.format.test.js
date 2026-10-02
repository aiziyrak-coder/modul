"use strict";

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);

const { teacherLabel } = require("./distribution.pdf");

describe("teacherLabel — stavka vergul bilan", () => {
  test("o'qituvchi bandi: '0,5 st.' (nuqtali '0.5 st.' emas)", () => {
    const label = teacherLabel({ teacher: { lastName: "Karimov", firstName: "A" }, position: "docent", stavka: 0.5 });
    expect(label).toContain("0,5 st.");
    expect(label).not.toContain("0.5");
  });

  test("vakant bandi: '0,75 st.'; butun stavka '1 st.' bo'lib qoladi", () => {
    expect(teacherLabel({ isVacant: true, vacantLabel: "2-o'rin", stavka: 0.75 })).toContain("0,75 st.");
    expect(teacherLabel({ isVacant: true, stavka: 1 })).toContain("1 st.");
  });
});
