"use strict";

const fs = require("fs");
const path = require("path");

const ROOTS = [path.join(__dirname, "..", "_pdf"), path.join(__dirname)];
const FORBIDDEN = /\b(?:fill|stroke)?[oO]pacity\s*\(/;

function sourceFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js") && !f.endsWith(".testutil.js"))
    .map((f) => path.join(dir, f));
}

describe("4.02 PDF qatlami — opacity TAQIQ (ADR-021 SHART #1, R-4.02-28)", () => {
  const files = ROOTS.flatMap(sourceFiles);

  test("kamida 5 generator + shared helperlar skanerlanadi", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  test.each(files.map((f) => [path.relative(path.join(__dirname, ".."), f), f]))(
    "%s — `opacity(` chaqiruvi yo'q",
    (_rel, file) => {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      const hits = lines
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter(({ line }) => FORBIDDEN.test(line));
      expect(hits).toEqual([]);
    },
  );
});
