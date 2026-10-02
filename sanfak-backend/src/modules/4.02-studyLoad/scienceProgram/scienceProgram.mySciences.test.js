const fs = require("fs");
const ScienceModel = require("#references/science/science.model");

describe("science modeli — maydon nomlari", () => {
  test("`title` va `scienceCode` bor", () => {
    expect(ScienceModel.schema.path("title")).toBeDefined();
    expect(ScienceModel.schema.path("scienceCode")).toBeDefined();
  });

  test("`name` va `code` YO'Q (aggregate shularni o'qimasin)", () => {
    expect(ScienceModel.schema.path("name")).toBeUndefined();
    expect(ScienceModel.schema.path("code")).toBeUndefined();
  });
});

describe("getMyAssignedSciences — $project fan maydonlarini to'g'ri o'qisin", () => {
  const src = fs.readFileSync(
    require.resolve("./scienceProgram.controller"),
    "utf8",
  );

  test("scienceName `_scienceDoc.title` dan olinadi", () => {
    expect(src).toContain('scienceName: "$_scienceDoc.title"');
  });

  test("scienceCode `_scienceDoc.scienceCode` dan olinadi", () => {
    expect(src).toContain('scienceCode: "$_scienceDoc.scienceCode"');
  });

  test("mavjud bo'lmagan `_scienceDoc.name` / `.code` ga qaytilmasin", () => {
    expect(src).not.toContain('"$_scienceDoc.name"');
    expect(src).not.toContain('"$_scienceDoc.code"');
  });
});
