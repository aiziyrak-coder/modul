const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const codeOf = (rel) =>
  fs
    .readFileSync(path.join(ROOT, rel), "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const REQUIRED = [
  ["openLesson/openLesson.controller.js", "room", "title"],
  ["openLesson/openLesson.controller.js", "attendees.user", "middleName"],
  ["residencyLesson/residencyLesson.controller.js", "groups.group", "title"],
  ["residencyAnnouncement/residencyAnnouncement.controller.js", "attachments.uploadedBy", "middleName"],
  ["residencyNotice/residencyNotice.controller.js", "reviewedBy", "middleName"],
  ["residencyExpulsionOrder/residencyExpulsionOrder.service.js", "signedBy", "middleName"],
  ["residencyExpulsionOrder/residencyExpulsionOrder.service.js", "closedBy", "middleName"],
  ["residencyExpulsionOrder/residencyExpulsionOrder.service.js", "scan.uploadedBy", "middleName"],
  ["residencyExpulsionOrder/residencyExpulsionOrder.service.js", "resident", "specialtyTitle"],
];

describe("MD-40 populate'lari o'z joyida", () => {
  test.each(REQUIRED)("%s -> `%s` populate qilinadi", (file, refPath) => {
    expect(codeOf(file)).toContain(`path: "${refPath}"`);
  });

  test.each(REQUIRED)("%s -> `%s` select'i to'liq (`%s`)", (file, refPath, field) => {
    const src = codeOf(file);
    const at = src.indexOf(`path: "${refPath}"`);
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, src.indexOf("}", at))).toContain(field);
  });
});

describe("qulf o'zi ishlaydi", () => {
  test("mavjud bo'lmagan yo'l topilmaydi", () => {
    expect(codeOf(REQUIRED[0][0])).not.toContain('path: "bundayYolYoq"');
  });

  test("izoh filtri kodni yeb qo'ymaydi", () => {
    for (const [file] of REQUIRED) expect(codeOf(file)).toContain("populate(");
  });
});
