"use strict";

const ExcelJS = require("exceljs");
const { COLUMNS, REJECTED } = require("./rosterColumns");

const SAMPLE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF6DA" } };
const SAMPLE_FONT = { italic: true, color: { argb: "FF7A6A3A" } };
const SAMPLE_HINT =
  "Bu satrlar NAMUNA — qanday to'ldirish kerakligini ko'rsatadi.\n" +
  "Yuklashdan OLDIN ularni o'chirib, o'z ma'lumotingizni kiriting.";

function buildTemplateWorkbook(sampleRows = []) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Talabalar");

  ws.columns = COLUMNS.map((c) => ({
    header: c.required ? `${c.header} *` : c.header,
    key: c.key,
    width: c.width,
  }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const pinIndex = COLUMNS.findIndex((c) => c.key === "jshshir") + 1;
  ws.getColumn(pinIndex).numFmt = "@";

  COLUMNS.forEach((c, i) => {
    if (c.note) ws.getRow(1).getCell(i + 1).note = c.note;
  });

  sampleRows.forEach((values, i) => {
    const row = ws.addRow(values);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = SAMPLE_FILL;
      cell.font = SAMPLE_FONT;
    });
    if (i === 0) row.getCell(1).note = SAMPLE_HINT;
  });

  const help = wb.addWorksheet("Yo'riqnoma");
  help.columns = [
    { header: "Ustun", key: "col", width: 24 },
    { header: "Majburiy", key: "req", width: 12 },
    { header: "Izoh", key: "note", width: 60 },
  ];
  help.getRow(1).font = { bold: true };
  if (sampleRows.length) {
    help.addRow({
      col: "⚠️ NAMUNA",
      req: "",
      note: `Birinchi varaqdagi ${sampleRows.length} ta rangli satr — namuna. Yuklashdan oldin o'chiring.`,
    }).font = { bold: true };
  }

  help.addRow({
    col: "* — majburiy",
    req: "",
    note: "Yulduzchali ustun to'ldirilmasa satr yuklanmaydi",
  });
  COLUMNS.forEach((c) =>
    help.addRow({
      col: c.required ? `${c.header} *` : c.header,
      req: c.required ? "HA" : "",
      note: c.note || "",
    }),
  );
  help.addRow({});
  help.addRow({ col: "QABUL QILINMAYDIGAN USTUNLAR" }).font = { bold: true };
  REJECTED.forEach((r) => help.addRow({ col: r.aliases[0], req: "", note: r.reason }));

  return wb;
}

module.exports = { buildTemplateWorkbook };
