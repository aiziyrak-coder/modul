const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(
  path.join(__dirname, "syllabus.controller.js"),
  "utf8",
);

const projectionBlock = () => {
  const start = SRC.indexOf("ScienceProgram.findById(spId, {");
  expect(start).toBeGreaterThan(-1);
  const open = SRC.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}") {
      depth--;
      if (depth === 0) return SRC.slice(open + 1, i);
    }
  }
  throw new Error("proyeksiya bloki topilmadi");
};

const projectedFields = () => {
  const block = projectionBlock();
  const fields = new Set();
  const rx = /(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*1/g;
  let m;
  while ((m = rx.exec(block)) !== null) {
    fields.add(String(m[1] || m[2]).split(".")[0]);
  }
  return fields;
};

const readFields = () => {
  const start = SRC.indexOf("addSyllabus: async");
  const end = SRC.indexOf("findAllSyllabuses:", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const body = SRC.slice(start, end);

  const fields = new Set();
  const rx = /\bsp\??\.([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = rx.exec(body)) !== null) fields.add(m[1]);
  return fields;
};

describe("syllabus.controller — ScienceProgram proyeksiyasi drift qulfi", () => {
  test("proyeksiya handler o'qiydigan HAR BIR maydonni qamrab oladi", () => {
    const projected = projectedFields();
    const read = readFields();

    const missing = [...read].filter((f) => !projected.has(f));
    expect(missing).toEqual([]);
  });

  test("`hourItems` proyeksiyada bor (Variant C soatlari ko'chishi uchun)", () => {
    expect(projectedFields().has("hourItems")).toBe(true);
  });

  test("legacy fixed soat maydonlari OLIB TASHLANMAGAN (fallback saqlanadi)", () => {
    const projected = projectedFields();
    for (const f of [
      "lectureHours",
      "seminarHours",
      "labHours",
      "practicalHours",
      "independentHours",
      "totalHours",
    ]) {
      expect(projected.has(f)).toBe(true);
    }
  });

  test("darvoza uchun `status` ham so'raladi", () => {
    expect(projectedFields().has("status")).toBe(true);
  });
});
