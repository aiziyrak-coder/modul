"use strict";

const ExcelJS = require("exceljs");
const { buildTemplateWorkbook } = require("./rosterTemplate");
const { COLUMNS } = require("./rosterColumns");

async function helpSheet() {
  const wb = buildTemplateWorkbook();
  const buf = await wb.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buf);
  const ws = read.getWorksheet("Yo'riqnoma");
  expect(ws).toBeTruthy();
  const rows = [];
  ws.eachRow((row) => {
    rows.push([1, 2, 3].map((c) => String(row.getCell(c).value ?? "")).join(" | "));
  });
  return rows;
}

describe("shablon Yo'riqnomasi — ish joyi koordinatasi", () => {
  it("«YOKI» qatori bor va ikkala shaklni ham nomlaydi", async () => {
    const rows = await helpSheet();
    const line = rows.find((r) => r.includes("YOKI"));
    expect(line).toBeTruthy();
    expect(line).toContain("Ish joyi koordinatasi");
    expect(line).toContain("Ish joyi kengligi");
    expect(line).toContain("Ish joyi uzunligi");
  });

  it("vergul tuzog'i ayirib aytilgan", async () => {
    const rows = await helpSheet();
    const line = rows.find((r) => r.includes("YOKI"));
    expect(line).toContain("VERGUL");
  });

  it.each([
    ["workplaceCoords", "YOKI"],
    ["workplaceLat", "O'RNIGA"],
    ["workplaceLng", "O'RNIGA"],
  ])("%s izohi ikkinchi shaklga ishora qiladi", (key, needle) => {
    const col = COLUMNS.find((c) => c.key === key);
    expect(col).toBeTruthy();
    expect(col.note).toContain(needle);
  });

  it.each([
    ["workplaceCoords", "Ish joyi koordinatasi"],
    ["workplaceLat", "Ish joyi kengligi"],
    ["workplaceLng", "Ish joyi uzunligi"],
  ])("%s sarlavhasi O'ZGARMAYDI", (key, header) => {
    expect(COLUMNS.find((c) => c.key === key).header).toBe(header);
  });
});
