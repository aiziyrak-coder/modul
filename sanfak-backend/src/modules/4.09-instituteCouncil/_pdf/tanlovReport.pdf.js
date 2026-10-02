"use strict";

const {
  createDoc,
} = require("#shared/pdfGenerators/pdfHelpers");

const PG = { W: 595, H: 842, M: 24 };
const CW = PG.W - PG.M * 2;

const COLS = [
  { key: "n", w: 26, hdr: "№", align: "center" },
  { key: "fullName", w: 138, hdr: "Professor-o'qituvchilarning I.F.SH." },
  { key: "department", w: 150, hdr: "Kafedra nomi" },
  { key: "position", w: 88, hdr: "Tanlov lavozimi" },
  { key: "for", w: 48, hdr: "Rozilar", align: "center" },
  { key: "against", w: 48, hdr: "Qarshilar", align: "center" },
  { key: "abstain", w: 49, hdr: "Qatnashmaganlar", align: "center" },
];

const C = {
  text: "#111111",
  border: "#000000",
  headBg: "#e8e8e8",
  groupBg: "#d9d9d9",
};

const FS = { intro: 9, group: 10, head: 8, cell: 8.5, sign: 9.5 };
const PAD = 3;
const MIN_ROW = 16;

const colX = () => {
  const xs = [];
  let x = PG.M;
  for (const c of COLS) {
    xs.push(x);
    x += c.w;
  }
  return xs;
};

const rowHeight = (doc, row) => {
  let h = MIN_ROW;
  doc.fontSize(FS.cell).font("TNR");
  COLS.forEach((c) => {
    const v = String(row[c.key] ?? "");
    const need =
      doc.heightOfString(v, { width: c.w - PAD * 2, align: c.align || "left" }) +
      PAD * 2;
    if (need > h) h = need;
  });
  return Math.ceil(h);
};

const ensureSpace = (doc, y, need) => {
  if (y + need <= PG.H - PG.M - 12) return y;
  doc.addPage();
  return PG.M;
};

const drawHead = (doc, y) => {
  const xs = colX();
  doc.fontSize(FS.head).font("TNR-B");
  let h = MIN_ROW;
  COLS.forEach((c) => {
    const need = doc.heightOfString(c.hdr, { width: c.w - PAD * 2, align: "center" }) + PAD * 2;
    if (need > h) h = need;
  });
  h = Math.ceil(h);
  doc.save().rect(PG.M, y, CW, h).fill(C.headBg).restore();
  COLS.forEach((c, i) => {
    doc.rect(xs[i], y, c.w, h).lineWidth(0.7).strokeColor(C.border).stroke();
    doc
      .fillColor(C.text)
      .text(c.hdr, xs[i] + PAD, y + PAD, { width: c.w - PAD * 2, align: "center" });
  });
  return y + h;
};

const drawRow = (doc, y, row) => {
  const xs = colX();
  const h = rowHeight(doc, row);
  doc.fontSize(FS.cell).font("TNR").fillColor(C.text);
  COLS.forEach((c, i) => {
    doc.rect(xs[i], y, c.w, h).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.text(String(row[c.key] ?? ""), xs[i] + PAD, y + PAD, {
      width: c.w - PAD * 2,
      align: c.align || "left",
    });
  });
  return y + h;
};

const drawGroupTitle = (doc, y, title) => {
  const h = 18;
  doc.save().rect(PG.M, y, CW, h).fill(C.groupBg).restore();
  doc.rect(PG.M, y, CW, h).lineWidth(0.7).strokeColor(C.border).stroke();
  doc
    .fontSize(FS.group)
    .font("TNR-B")
    .fillColor(C.text)
    .text(String(title || "").toUpperCase(), PG.M + PAD, y + 4, {
      width: CW - PAD * 2,
      align: "center",
    });
  return y + h;
};

const drawSignatures = (doc, y) => {
  y = ensureSpace(doc, y + 14, 70);
  doc.fontSize(FS.sign).font("TNR").fillColor(C.text);
  ["Komissiya raisi:", "Komissiya a'zosi:", "Komissiya a'zosi:"].forEach((label) => {
    doc.text(label, PG.M, y, { width: 150, continued: false });
    doc
      .moveTo(PG.M + 150, y + 11)
      .lineTo(PG.M + 340, y + 11)
      .lineWidth(0.7)
      .strokeColor(C.border)
      .stroke();
    y += 24;
  });
  return y;
};

function buildTanlovPdf(data, res, filename = "tanlov-royxati") {
  const doc = createDoc({
    size: "A4",
    layout: "portrait",
    margins: { top: PG.M, bottom: PG.M, left: PG.M, right: PG.M },
  });

  const chunks = [];
  const rendered = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  let y = PG.M;

  if (data.intro) {
    doc.fontSize(FS.intro).font("TNR").fillColor(C.text);
    const h = doc.heightOfString(data.intro, { width: CW, align: "center" });
    doc.text(data.intro, PG.M, y, { width: CW, align: "center" });
    y += h + 6;
  }

  doc
    .fontSize(12)
    .font("TNR-B")
    .fillColor(C.text)
    .text("KOMISSIYA BAYONI", PG.M, y, { width: CW, align: "center" });
  y += 22;

  if (!data.groups.length) {
    doc
      .fontSize(FS.cell)
      .font("TNR")
      .text("Yakunlangan so'rovnoma topilmadi.", PG.M, y, { width: CW, align: "center" });
  }

  for (const g of data.groups) {
    y = ensureSpace(doc, y, 18 + MIN_ROW * 2);
    y = drawGroupTitle(doc, y, `${g.position} lavozimi`);
    y = drawHead(doc, y);
    g.rows.forEach((row, i) => {
      const need = rowHeight(doc, row);
      const before = y;
      y = ensureSpace(doc, y, need);
      if (y !== before) y = drawHead(doc, y);
      y = drawRow(doc, y, { ...row, n: i + 1 });
    });
    y += 10;
  }

  drawSignatures(doc, y);
  doc.end();

  return rendered.then((buffer) => {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.pdf"`,
    );
    res.end(buffer);
  });
}

module.exports = { buildTanlovPdf, COLS };
