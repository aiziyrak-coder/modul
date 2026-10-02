"use strict";

const ExcelJS = require("exceljs");
const {
  computeWorkloadTotals,
} = require("#modules/4.02-studyLoad/_shared/workloadTotals");
const {
  findStaffItem,
  getOverallTotals,
  sumHourly,
} = require("#modules/4.02-studyLoad/_shared/staffPositionItems");

const INSTITUTE = "Farg'ona jamoat salomatligi tibbiyot instituti";
const BLANK_NAME = "____________";
const blankDate = (year) => `«____» ________ ${year} y`;

const COL_WIDTHS = { A: 4.9, B: 31.9, C: 39 };
const NUM_COL_WIDTH = 9.7;
const LAST_COL = 20;
const HEADER_LAST_ROW = 18;
const FIRST_DATA_ROW = 19;

const THIN = { style: "thin", color: { argb: "FF000000" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const CENTER_WRAP = { horizontal: "center", vertical: "middle", wrapText: true };
const LEFT_WRAP = { horizontal: "left", vertical: "middle", wrapText: true };
const FONT = { name: "Times New Roman", size: 10 };
const FONT_B = { ...FONT, bold: true };

function fullPersonName(u) {
  if (!u || typeof u !== "object") return "";
  return [u.lastName, u.firstName, u.middleName]
    .map((s) => (s == null ? "" : String(s).trim()))
    .filter(Boolean)
    .join(" ");
}

function resolveHeadName(wl) {
  const dep = wl && wl.department;
  const steps = wl && Array.isArray(wl.approvalSteps) ? wl.approvalSteps : [];
  const kafedra = steps.find((s) => s && s.step === "kafedra" && s.status === "approved");
  return (
    fullPersonName(dep && dep.head) ||
    fullPersonName(kafedra && kafedra.approvedBy) ||
    ""
  );
}

const pos = (sp, category, slug) => findStaffItem(sp, category, slug).positions;

function summarizeWorkload(wl) {
  const sp = (wl && wl.staffPositions) || {};
  const total = computeWorkloadTotals(wl).totalHours;
  const hourly = sumHourly(sp);
  const dh = {
    professor: pos(sp, "departmentHead", "professor"),
    docent: pos(sp, "departmentHead", "docent"),
    seniorTeacher: pos(sp, "departmentHead", "seniorTeacher"),
  };
  const ts = {
    professor: pos(sp, "teachingStaff", "professor"),
    docent: pos(sp, "teachingStaff", "docent"),
    seniorTeacher: pos(sp, "teachingStaff", "seniorTeacher"),
    assistant:
      pos(sp, "teachingStaff", "assistant") +
      pos(sp, "teachingStaff", "trainee"),
  };
  const support = {
    cabinetHead: pos(sp, "supportStaff", "cabinetHead"),
    laborant:
      pos(sp, "supportStaff", "laborant") +
      pos(sp, "supportStaff", "seniorLaborant"),
  };
  const itemsSum =
    dh.professor + dh.docent + dh.seniorTeacher +
    ts.professor + ts.docent + ts.seniorTeacher + ts.assistant;
  const hasItems = Array.isArray(sp.items) && sp.items.length > 0;
  const dep = wl.department;
  return {
    departmentId: String((dep && dep._id) || dep || ""),
    department: (dep && dep.title) || "",
    head: resolveHeadName(wl),
    total,
    hourly,
    forDistribution: total - hourly,
    positions: hasItems ? itemsSum : getOverallTotals(sp).totalPositions,
    dh,
    ts,
    supportTotal: support.cabinetHead + support.laborant,
    support,
  };
}

const addInto = (acc, row) => {
  acc.total += row.total;
  acc.hourly += row.hourly;
  acc.forDistribution += row.forDistribution;
  acc.positions += row.positions;
  for (const k of Object.keys(acc.dh)) acc.dh[k] += row.dh[k];
  for (const k of Object.keys(acc.ts)) acc.ts[k] += row.ts[k];
  acc.supportTotal += row.supportTotal;
  for (const k of Object.keys(acc.support)) acc.support[k] += row.support[k];
  return acc;
};

const emptyTotals = () => ({
  total: 0,
  hourly: 0,
  forDistribution: 0,
  positions: 0,
  dh: { professor: 0, docent: 0, seniorTeacher: 0 },
  ts: { professor: 0, docent: 0, seniorTeacher: 0, assistant: 0 },
  supportTotal: 0,
  support: { cabinetHead: 0, laborant: 0 },
});

function buildSummaryRows(workloads) {
  const byDep = new Map();
  for (const wl of Array.isArray(workloads) ? workloads : []) {
    if (!wl) continue;
    const row = summarizeWorkload(wl);
    const key = row.departmentId || row.department;
    const prev = byDep.get(key);
    if (!prev) byDep.set(key, row);
    else {
      addInto(prev, row);
      if (!prev.head) prev.head = row.head;
    }
  }
  return Array.from(byDep.values())
    .sort((a, b) => a.department.localeCompare(b.department, "uz"))
    .map((r, i) => ({ no: i + 1, ...r }));
}

function sumRows(rows) {
  return rows.reduce((acc, r) => addInto(acc, r), emptyTotals());
}

const numOrBlank = (n) => (Number(n) ? Number(n) : null);

const fmtDate = (d) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
};

const HEADER_CELLS = Object.freeze([
  ["A10:A18", "№"],
  ["B10:B18", "Kafedra nomi"],
  ["C10:C18", "Kafedra\nmudiri"],
  ["D10:D18", "Umumiy o'quv\nyuklama"],
  ["E10:F12", "Jumladan"],
  ["E13:E18", "Soatbay"],
  ["F13:F18", "Taqsimot\nuchun"],
  ["G10:G18", "Professor-o'qituvchi\numumiy ish o'rinlari"],
  ["H10:N12", "Jumladan"],
  ["H13:J14", "Kafedra\nmudiri"],
  ["H15:H18", "Professor"],
  ["I15:I18", "Dotsent"],
  ["J15:J18", "Katta\no'qituvchi"],
  ["K13:N14", "Kafedraning ilmiy-pedagogik xodimlari"],
  ["K15:K18", "Professor"],
  ["L15:L18", "Dotsent"],
  ["M15:M18", "Katta\no'qituvchi"],
  ["N15:N18", "O'qituvchi, assistent"],
  ["O10:T12", "O'quv-yordamchi xodimlar"],
  ["O13:T14", "Jumladan"],
  ["O15:O18", "Jami"],
  ["P15:P18", "Kabinet\nmudiri"],
  ["Q15:Q18", "Laboratoriya mudiri"],
  ["R15:R18", "Laborant"],
  ["S15:S18", "Laboratoriya ishchisi"],
  ["T15:T18", "EXM\nmuxandisi"],
]);

function rowValues(r) {
  return [
    r.no,
    r.department,
    r.head,
    numOrBlank(r.total),
    numOrBlank(r.hourly),
    numOrBlank(r.forDistribution),
    numOrBlank(r.positions),
    numOrBlank(r.dh.professor),
    numOrBlank(r.dh.docent),
    numOrBlank(r.dh.seniorTeacher),
    numOrBlank(r.ts.professor),
    numOrBlank(r.ts.docent),
    numOrBlank(r.ts.seniorTeacher),
    numOrBlank(r.ts.assistant),
    numOrBlank(r.supportTotal),
    numOrBlank(r.support.cabinetHead),
    null,
    numOrBlank(r.support.laborant),
    null,
    null,
  ];
}

function buildWorkloadSummaryWorkbook({ rows, academicYearTitle, date, signatories }) {
  const today = date instanceof Date ? date : new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = "SANFAK AIS";
  const ws = wb.addWorksheet(fmtDate(today), {
    views: [{ state: "frozen", ySplit: HEADER_LAST_ROW }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  for (let c = 1; c <= LAST_COL; c++) {
    const col = ws.getColumn(c);
    col.width = COL_WIDTHS[col.letter] || NUM_COL_WIDTH;
  }

  const set = (addr, value, opts = {}) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    cell.font = opts.font || FONT;
    cell.alignment = opts.alignment || CENTER_WRAP;
    return cell;
  };
  const borderRow = (r, font) => {
    for (let c = 1; c <= LAST_COL; c++) {
      const cell = ws.getCell(r, c);
      cell.border = BORDER;
      if (font) cell.font = font;
    }
  };

  const year = today.getFullYear();
  ws.mergeCells("A1:C7");
  set(
    "A1",
    `"TASDIQLAYMAN"\nFarg'ona jamoat salomatligi tibbiyot\ninstituti rektori\n${BLANK_NAME}\n${blankDate(year)}`,
    { font: FONT_B },
  );
  ws.mergeCells("P1:T7");
  set(
    "P1",
    `"KELISHILDI"\nO'quv ishlari bo'yicha\nprorektor\n${BLANK_NAME}\n${blankDate(year)}`,
    { font: FONT_B },
  );

  ws.mergeCells("A8:T8");
  ws.getRow(8).height = 34;
  set(
    "A8",
    `${INSTITUTE} ${academicYearTitle}-o'quv yili uchun kafedralar soatlar hisobi va ish o'rinlari\nJADVALI`,
    { font: { ...FONT_B, size: 12 } },
  );
  ws.mergeCells("R9:T9");
  set("R9", `${fmtDate(today)}-yil`, {
    alignment: { horizontal: "right", vertical: "middle" },
  });

  for (const [range, text] of HEADER_CELLS) {
    ws.mergeCells(range);
    set(range.split(":")[0], text, { font: FONT_B });
  }
  for (let r = 10; r <= HEADER_LAST_ROW; r++) borderRow(r);

  let rowNo = FIRST_DATA_ROW;
  for (const r of rows) {
    const row = ws.getRow(rowNo);
    row.values = rowValues(r);
    borderRow(rowNo, FONT);
    for (let c = 1; c <= LAST_COL; c++) {
      ws.getCell(rowNo, c).alignment = c === 2 || c === 3 ? LEFT_WRAP : CENTER_WRAP;
    }
    rowNo++;
  }

  const t = sumRows(rows);
  ws.getRow(rowNo).values = [
    "Jami", null, null,
    t.total, t.hourly, t.forDistribution, t.positions,
    t.dh.professor, t.dh.docent, t.dh.seniorTeacher,
    t.ts.professor, t.ts.docent, t.ts.seniorTeacher, t.ts.assistant,
    t.supportTotal, t.support.cabinetHead, 0, t.support.laborant, 0, 0,
  ];
  ws.mergeCells(rowNo, 1, rowNo, 3);
  borderRow(rowNo, FONT_B);
  for (let c = 1; c <= LAST_COL; c++) ws.getCell(rowNo, c).alignment = CENTER_WRAP;

  const sign = (r, label, person) => {
    ws.mergeCells(r, 3, r, 8);
    set(ws.getCell(r, 3).address, label, { font: FONT_B, alignment: LEFT_WRAP });
    ws.mergeCells(r, 12, r, 14);
    set(ws.getCell(r, 12).address, (person && person.name) || BLANK_NAME, {
      alignment: LEFT_WRAP,
    });
    if (person && person.date) {
      ws.mergeCells(r + 1, 12, r + 1, 14);
      set(ws.getCell(r + 1, 12).address, person.date, { alignment: LEFT_WRAP });
    }
  };
  const sg = signatories || {};
  sign(rowNo + 3, "O'quv-uslubiy boshqarma boshlig'i:", sg.methodical);
  sign(rowNo + 6, "Reja moliya bo'limi boshlig'i:", sg.financial);

  return wb;
}

function summaryFileName(academicYearTitle) {
  const safe = String(academicYearTitle || "")
    .replace(/[^0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `kafedralar-soatlar-hisobi${safe ? `-${safe}` : ""}.xlsx`;
}

module.exports = {
  buildSummaryRows,
  sumRows,
  buildWorkloadSummaryWorkbook,
  summaryFileName,
  FIRST_DATA_ROW,
  HEADER_CELLS,
  summarizeWorkload,
  fullPersonName,
  rowValues,
  INSTITUTE,
  fmtDate,
};
