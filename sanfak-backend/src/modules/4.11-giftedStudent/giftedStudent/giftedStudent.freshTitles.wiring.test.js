const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(
  path.join(__dirname, "giftedStudent.controller.js"),
  "utf8",
);

const MUST_REFRESH = [
  "findAllStudents",
  "paginateStudents",
  "findOneStudent",
  "findMyStudent",
  "findMyAdvisees",
];

const NEXT_HANDLER = /\n {2}[a-zA-Z]+: async \(req, res, next\) => \{/;

const bodyOf = (name) => {
  const start = SOURCE.indexOf(`  ${name}: async (req, res, next) => {`);
  if (start === -1) return null;
  const next = SOURCE.slice(start + 1).search(NEXT_HANDLER);
  return next === -1 ? SOURCE.slice(start) : SOURCE.slice(start, start + 1 + next);
};

const codeOf = (name) =>
  String(bodyOf(name))
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

describe("applyFreshTitles ulanishi", () => {
  test.each(MUST_REFRESH)("`%s` handleri applyFreshTitles ni chaqiradi", (name) => {
    expect(bodyOf(name)).not.toBeNull();
    expect(codeOf(name)).toContain("applyFreshTitles");
  });

  test("servis import qilingan", () => {
    expect(SOURCE).toContain('require("../_services/freshTitles")');
  });

  test("qulf o'zi ishlaydi — mavjud bo'lmagan handler topilmaydi", () => {
    expect(bodyOf("bundayHandlerYoq")).toBeNull();
  });
});

describe("`applyFreshTitles` LEAN hujjat kutadi", () => {
  test.each(MUST_REFRESH)("`%s` da `.exec()` ishlatilmaydi", (name) => {
    expect(codeOf(name)).not.toContain(".exec()");
  });

  test("izoh filtri qulfni ko'r qilib qo'ymaydi", () => {
    expect(codeOf("getRanking")).toContain("stripStudentPii");
    expect(codeOf("getRanking")).not.toContain(".exec()");
  });
});
