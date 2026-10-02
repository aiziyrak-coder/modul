jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const { responsibleHeading } = require("./scienceProgram.pdf");

const STD = "Fan-modul uchun mas'ullar:";

describe("responsibleHeading (D-8)", () => {
  test("title desc bilan bir xil — standart sarlavha (takror yo'q)", () => {
    expect(responsibleHeading({ title: "Karimova D.", desc: "Karimova D." })).toBe(STD);
  });

  test("title bo'sh — standart sarlavha", () => {
    expect(responsibleHeading({ title: null, desc: "Karimova D." })).toBe(STD);
  });

  test("alohida sarlavha berilgan — o'zi saqlanadi", () => {
    expect(responsibleHeading({ title: "Mas'ul o'qituvchilar:", desc: "Karimova D." })).toBe(
      "Mas'ul o'qituvchilar:",
    );
  });
});
