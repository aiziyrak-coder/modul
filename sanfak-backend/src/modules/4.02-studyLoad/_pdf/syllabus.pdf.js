const { ErrorHandler } = require("#shared/error");
"use strict";

const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const { areaText } = require("./programAreas");
const {
  createDoc,
  pipeToResponse,
  drawParagraph,
  ensureSpace,
  COLORS,
  PAGE,
  CONTENT_WIDTH,
  STATUS_LABEL,
} = require("#shared/pdfGenerators/pdfHelpers");
const {
  bwSectionTitle,
  bwTable,
  bwInfoTable,
  bwList,
} = require("./_syllabusBw");
const {
  resolveSignatory,
  BLANK_DATE,
  isPopulatedPerson,
  personName,
} = require("#modules/4.02-studyLoad/_shared/signatories");
const {
  drawSignatureBlock,
  measureSignatureBlock,
} = require("#modules/4.02-studyLoad/_shared/signatureBlock");
const {
  prepareVerifyQr,
  QR_SIZE_SLOT,
  QR_SIZE_ROW,
} = require("#modules/4.02-studyLoad/_shared/verifyQr");

const coverHeaderLines = () => [
  process.env.PDF_MINISTRY_1 ||
    "O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI",
  process.env.PDF_MINISTRY_2 ||
    "O'ZBEKISTON RESPUBLIKASI OLIY TA'LIM, FAN VA INNOVATSIYALAR VAZIRLIGI",
  process.env.PDF_INSTITUTE_NAME ||
    "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI",
];

const EDUCATION_FORM_LABEL = Object.freeze({
  full_time: "Kunduzgi",
  part_time: "Sirtqi",
  evening: "Kechki",
});
const EVALUATION_FORM_LABEL = Object.freeze({
  exam: "Imtihon",
  test: "Test",
  course_work: "Kurs ishi",
  report: "Hisobot",
});
const SCIENCE_LANG_LABEL = Object.freeze({
  uz: "O'zbek",
  ru: "Rus",
  en: "Ingliz",
});
const LITERATURE_GROUP_TITLES = Object.freeze({
  primary: "Asosiy adabiyotlar",
  additional: "Qo'shimcha adabiyotlar",
  guidance: "Uslubiy qo'llanmalar",
});

const MACHINE_SLUG_RX = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function enumLabel(map, raw) {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (map[v]) return map[v];
  return MACHINE_SLUG_RX.test(v) ? null : v;
}

const OBJECT_ID_RX = /^[0-9a-f]{24}$/i;

function noRawId(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return OBJECT_ID_RX.test(s) ? null : s;
}

function refTitle(v) {
  if (v == null) return null;
  if (typeof v === "object") return noRawId(v.title || v.name);
  return noRawId(v);
}

function directionLabel(d) {
  if (!d || typeof d !== "object") return null;
  const title = noRawId(d.title);
  if (!title) return null;
  const code = noRawId(d.directionCode);
  return code ? `${code} - ${title}` : title;
}

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function formatUzDatePlain(dt) {
  return `${dt.getFullYear()}-yil ${dt.getDate()}-${UZ_MONTHS[dt.getMonth()]}`;
}

async function buildSyllabusPdf(id) {
  const syl = await Syllabus.findById(id)
    .populate({
      path: "science",
      select: "name title code scienceCode department",
      populate: { path: "department", select: "title" },
    })
    .populate("faculty", "title")
    .populate("directions", "title directionCode")
    .populate({
      path: "scienceProgram",
      select: "code knowledgeArea educationArea directions",
      populate: { path: "directions", select: "knowledgeArea educationArea" },
    })
    .populate({
      path: "author.teacher",
      select: "firstName lastName middleName position",
      populate: { path: "position", select: "title" },
    })
    .populate("confirmation.viceRector", "firstName lastName middleName")
    .populate("methodicalHead.leader", "firstName lastName middleName")
    .populate("facultyDean.dean", "firstName lastName middleName")
    .populate("departmentHead.manager", "firstName lastName middleName")
    .populate("creator.teacher", "firstName lastName middleName")
    .populate("approvalSteps.approvedBy", "firstName lastName middleName")

    .exec();

  if (!syl) throw new Error("Sillabus topilmadi");

  const doc = createDoc();

  const verifyQr = await prepareVerifyQr(syl, { docType: "syllabus" });

  await _drawCoverPage(doc, syl, verifyQr);
  doc.addPage();
  doc.y = PAGE.margin;

  const teacher = syl.author?.teacher;
  const teacherName = teacher
    ? `${teacher.lastName || ""} ${teacher.firstName || ""} ${teacher.middleName || ""}`.trim()
    : "—";

  const directionsText = _directionsText(syl);

  bwInfoTable(doc, [
    [
      "Fan kodi",
      noRawId(syl.scienceCode) ||
        noRawId(syl.science?.scienceCode) ||
        noRawId(syl.science?.code),
    ],
    ["Fan turi", noRawId(syl.scienceType)],
    ["Ta'lim yo'nalishlari", directionsText],
    ["O'quv yili", syl.year ? `${syl.year}-yil` : null],
    ["Semestr", syl.semester ? `${syl.semester}-semestr` : null],
    ["Ta'lim shakli", enumLabel(EDUCATION_FORM_LABEL, syl.educationForm)],
    ["Kreditlar", syl.credits ? `${syl.credits} kredit` : null],
    [
      "Umumiy soatlar",
      syl.hoursByType?.totalHours ? `${syl.hoursByType.totalHours} soat` : null,
    ],
    ["Baholash shakli", enumLabel(EVALUATION_FORM_LABEL, syl.evaluationForm)],
    ["Fan tili", enumLabel(SCIENCE_LANG_LABEL, syl.scienceLang)],
    ["O'qituvchi", teacherName],
    [
      "Hujjat holati",
      syl.status === "approved"
        ? "Tasdiqlangan"
        : syl.status === "in_review"
          ? "Ko'rib chiqilmoqda"
          : "Qoralama",
    ],
  ]);

  const ht = syl.hoursByType || {};
  ensureSpace(doc, 70);
  bwSectionTitle(
    doc,
    ht.title || "Mashg'ulotlar shakli va semestrga ajratilgan soatlar",
  );
  const hItems =
    Array.isArray(ht.items) && ht.items.length
      ? ht.items
      : [
          ht.lecture != null && {
            slug: "maruza",
            title: "Ma'ruza",
            value: ht.lecture,
          },
          ht.practical != null && {
            slug: "amaliy",
            title: "Amaliy",
            value: ht.practical,
          },
          ht.laboratory != null && {
            slug: "laboratoriya",
            title: "Laboratoriya",
            value: ht.laboratory,
          },
          ht.seminar != null && {
            slug: "seminar",
            title: "Seminar",
            value: ht.seminar,
          },
          ht.independent != null && {
            slug: "mustaqil",
            title: "Mustaqil ta'lim",
            value: ht.independent,
          },
        ].filter(Boolean);

  const hColumns = hItems.map((h, i) => ({
    header: h.title || h.slug || `#${i + 1}`,
    key: h.slug || `k${i}`,
    width: 1,
  }));
  hColumns.push({ header: "JAMI", key: "_total", width: 1 });

  const rowData = {
    _total:
      ht.totalHours || hItems.reduce((a, h) => a + (Number(h.value) || 0), 0),
  };
  for (const h of hItems) rowData[h.slug || ""] = h.value || 0;

  bwTable(doc, hColumns, [rowData]);

  if (syl.sciencePurpose?.desc) {
    ensureSpace(doc, 50);
    bwSectionTitle(doc, syl.sciencePurpose.title || "Fan maqsadi (FM)");
    drawParagraph(doc, syl.sciencePurpose.desc);
  }

  if (syl.prerequisiteKnowledge?.desc) {
    ensureSpace(doc, 50);
    bwSectionTitle(
      doc,
      syl.prerequisiteKnowledge.title ||
        "Fanni o'zlashtirish uchun zarur boshlang'ich bilimlar",
    );
    drawParagraph(doc, syl.prerequisiteKnowledge.desc);
  }

  const lo = syl.learningOutcome;
  const hasLO =
    (lo?.knowledgeOutcomes?.length || 0) + (lo?.skillOutcomes?.length || 0) > 0;
  if (hasLO) {
    ensureSpace(doc, 50);
    bwSectionTitle(doc, lo.title || "Ta'lim natijalari (TN)");

    if (lo.knowledgeOutcomes?.length) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(lo.knowledgeAspect || "Bilimlar jihatidan:", PAGE.margin, doc.y)
        .moveDown(0.2);
      bwList(doc, lo.knowledgeOutcomes);
    }
    if (lo.skillOutcomes?.length) {
      doc.moveDown(0.3);
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(lo.skillsAspect || "Ko'nikmalar jihatidan:", PAGE.margin, doc.y)
        .moveDown(0.2);
      bwList(doc, lo.skillOutcomes);
    }
  }

  const sc = syl.scienceContent;
  if (sc?.topics?.length) {
    ensureSpace(doc, 60);
    bwSectionTitle(doc, sc.title || "Fan mazmuni");
    if (sc.desc) {
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(sc.desc, PAGE.margin, doc.y)
        .moveDown(0.3);
    }
    bwTable(
      doc,
      [
        { header: "№", key: "order", width: 0.4 },
        { header: "Mavzu nomi", key: "topic", width: 5 },
        { header: "Soatlar", key: "hour", width: 0.8 },
      ],
      sc.topics.map((t, i) => ({
        order: i + 1,
        topic: t.topic || "—",
        hour: t.hour || 0,
      })),
      { rowFontSize: 7.5 },
    );
  }

  const ts = syl.trainingSeminar;
  if (ts?.topics?.length) {
    ensureSpace(doc, 60);
    bwSectionTitle(doc, ts.title || "Mashg'ulotlar shakli: Seminar (S)");
    bwTable(
      doc,
      [
        { header: "№", key: "order", width: 0.4 },
        { header: "Mavzu nomi", key: "topic", width: 5 },
        { header: "Soatlar", key: "hour", width: 0.8 },
      ],
      ts.topics.map((t, i) => ({
        order: i + 1,
        topic: t.topic || "—",
        hour: t.hour || 0,
      })),
      { rowFontSize: 7.5 },
    );
  }

  const ind = syl.independent;
  if (ind?.topics?.length) {
    ensureSpace(doc, 60);
    bwSectionTitle(doc, ind.title || "Mustaqil ta'lim (MT)");
    bwTable(
      doc,
      [
        { header: "№", key: "order", width: 0.4 },
        { header: "Topshiriq", key: "topic", width: 5 },
        { header: "Soatlar", key: "hour", width: 0.8 },
      ],
      ind.topics.map((t, i) => ({
        order: i + 1,
        topic: t.topic || "—",
        hour: t.hour || 0,
      })),
      { rowFontSize: 7.5 },
    );
  }

  const ws = syl.weeklySchedule;
  if (ws?.weeks?.length) {
    ensureSpace(doc, 60);
    bwSectionTitle(
      doc,
      ws.title || "Mashg'ulotlar jadvali (haftalar bo'yicha)",
    );
    bwTable(
      doc,
      [
        { header: "Hafta", key: "week", width: 0.5 },
        { header: "Mavzu", key: "topic", width: 4.5 },
        { header: "Tur", key: "type", width: 1 },
        { header: "Soat", key: "hour", width: 0.6 },
      ],
      ws.weeks.map((w) => ({
        week: w.week || "—",
        topic: w.topic || "—",
        type: w.type || "—",
        hour: w.hour || 0,
      })),
      { rowFontSize: 7.5 },
    );
  }

  if (syl.submissionRules?.desc) {
    ensureSpace(doc, 80);
    bwSectionTitle(
      doc,
      syl.submissionRules.title || "Topshiriqlarni topshirish tartibi",
    );
    drawParagraph(doc, syl.submissionRules.desc);
  }

  const ci = syl.contactInfo;
  if (ci && (ci.schedule || ci.room || ci.phone || ci.desc)) {
    ensureSpace(doc, 100);
    bwSectionTitle(
      doc,
      ci.title || "Aloqa, konsultatsiya va qayta topshirish qoidalari",
    );
    const ciRows = [
      ["Qabul vaqti", ci.schedule],
      ["Xona", ci.room],
      ["Telefon", ci.phone],
    ].filter(([, v]) => v);
    for (const [label, value] of ciRows) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(`${label}:`, PAGE.margin, doc.y, { continued: true, width: 120 });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(` ${value}`, { width: CONTENT_WIDTH - 120 });
      doc.moveDown(0.2);
    }
    if (ci.desc) {
      doc.moveDown(0.2);
      drawParagraph(doc, ci.desc);
    }
  }

  const syLitGroups =
    Array.isArray(syl.literatureGroups) && syl.literatureGroups.length
      ? syl.literatureGroups
      : [
          syl.primaryLiterature && {
            slug: "primary",
            title: syl.primaryLiterature.title,
            literatures: syl.primaryLiterature.literatures,
          },
          syl.additionalLiterature && {
            slug: "additional",
            title: syl.additionalLiterature.title,
            literatures: syl.additionalLiterature.literatures,
          },
        ].filter(Boolean);

  for (const g of syLitGroups) {
    const list = Array.isArray(g.literatures) ? g.literatures : [];
    if (!list.length) continue;
    ensureSpace(doc, 50);
    bwSectionTitle(doc, g.title || LITERATURE_GROUP_TITLES[g.slug] || "Adabiyotlar");
    bwList(doc, list);
  }

  const ec = syl.evaluationCriteria;
  if (ec) {
    ensureSpace(doc, 60);
    bwSectionTitle(doc, ec.title || "Baholash mezonlari");

    const criteria =
      Array.isArray(ec.criteria) && ec.criteria.length
        ? ec.criteria
        : ["grading_5", "grading_4", "grading_3", "grading_2"]
            .map(
              (k) =>
                ec[k] && {
                  slug: k.replace("grading_", ""),
                  title: ec[k].title,
                  desc: ec[k].desc,
                },
            )
            .filter((c) => c && c.desc);

    for (const g of criteria) {
      if (!g || !g.desc) continue;
      ensureSpace(doc, 30);
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(g.title || "", PAGE.margin, doc.y)
        .moveDown(0.15);
      drawParagraph(doc, g.desc);
    }
  }

  const auth = syl.author;
  if (auth) {
    ensureSpace(doc, 60);
    bwSectionTitle(doc, "Fan o'qituvchisi to'g'risida ma'lumot");

    const authorTeacher = auth.teacher;
    const authorName = authorTeacher
      ? `${authorTeacher.lastName || ""} ${authorTeacher.firstName || ""} ${authorTeacher.middleName || ""}`.trim()
      : null;

    const authorRows = [
      ["F.I.SH.", authorName],
      ["Lavozimi", refTitle(authorTeacher?.position)],
      ["Tashkilot", noRawId(auth.organization)],
      ["Email", noRawId(auth.email)],
    ].filter(([, v]) => v);

    for (const [label, value] of authorRows) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(`${label}:`, PAGE.margin, doc.y, { continued: true, width: 120 });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(` ${value}`, { width: CONTENT_WIDTH - 120 });
      doc.moveDown(0.2);
    }

    if (auth.reviewer?.desc) {
      doc.moveDown(0.3);
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text("Taqrizchilar:", PAGE.margin, doc.y)
        .moveDown(0.15);
      drawParagraph(doc, auth.reviewer.desc);
    }
  }

  if (syl.desc) {
    ensureSpace(doc, 40);
    drawParagraph(doc, syl.desc);
  }

  const sigRows = _signatureRows(doc, syl, verifyQr);
  ensureSpace(doc, PROTOCOL_BLOCK_H + sigRows.rowsH);
  _drawDepartmentProtocol(doc, syl);
  _drawSignatureRows(doc, sigRows);

  _drawFooter(doc, "Sillabus", syl.status);
  doc.flushPages();

  return doc;
}

function _directionsText(syl) {
  const list = Array.isArray(syl.directions) ? syl.directions : [];
  const text = list.map(directionLabel).filter(Boolean).join(", ");
  return text || null;
}

function _buildConfirmationBlock(syl) {
  const conf = syl.confirmation || {};
  const sig = resolveSignatory(syl, {
    step: "prorektor",
    block: "confirmation",
    personField: "viceRector",
    snapshot: syl.verify?.snapshot,
  });

  return {
    confirm: noRawId(conf.confirm) || "TASDIQLAYMAN",
    position: noRawId(conf.position) || "O'quv ishlari bo'yicha prorektor",
    name: sig.name,
    date: sig.dateText,
    sig,
  };
}

function _cityYearLine(syl) {
  const city = (
    noRawId(syl.location) ||
    process.env.PDF_CITY ||
    "FARG'ONA"
  ).toUpperCase();
  const rawYear = Number(syl.year);
  const year =
    Number.isInteger(rawYear) && rawYear >= 1000
      ? rawYear
      : new Date(syl.createdAt || Date.now()).getFullYear();
  return `${city} – ${year}`;
}

async function _drawCoverPage(doc, syl, verifyQr) {
  let y = PAGE.margin + 6;
  for (const line of coverHeaderLines()) {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLORS.text)
      .text(line, PAGE.margin, y, { width: CONTENT_WIDTH, align: "center" });
    y = doc.y + 2;
  }

  y += 26;
  const tX = PAGE.margin + CONTENT_WIDTH * 0.45;
  const tW = CONTENT_WIDTH * 0.55;

  const conf = _buildConfirmationBlock(syl);
  const confH = drawSignatureBlock(doc, {
    x: tX,
    y,
    w: tW,
    align: "center",
    heading: `"${conf.confirm}"`,
    position: conf.position,
    sig: conf.sig,
    qr: verifyQr ? { image: verifyQr.image, size: QR_SIZE_SLOT } : undefined,
    emptySlotGap: 4,
  });
  y += confH;

  const sciName =
    noRawId(syl.science?.name) ||
    noRawId(syl.science?.title) ||
    noRawId(syl.scienceTitle) ||
    "—";
  y = Math.max(y + 40, PAGE.height * 0.34);
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(COLORS.text)
    .text(sciName.toUpperCase(), PAGE.margin, y, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  y = doc.y + 4;
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text("FANI BO'YICHA", PAGE.margin, y, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  y = doc.y + 4;
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(COLORS.text)
    .text(noRawId(syl.label) || "S I L L A B U S", PAGE.margin, y, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  y = doc.y + 28;

  const labelW = 130;
  const rows = [
    ["Bilim sohasi", _programAreaText(syl, "knowledgeArea")],
    ["Ta'lim sohasi", _programAreaText(syl, "educationArea")],
    ["Ta'lim yo'nalishi", _directionsText(syl)],
  ];
  for (const [label, value] of rows) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(COLORS.text)
      .text(`${label}:`, PAGE.margin + 40, y, { width: labelW });
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(COLORS.text)
      .text(value || "—", PAGE.margin + 40 + labelW, y, {
        width: CONTENT_WIDTH - 80 - labelW,
      });
    y = doc.y + 4;
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(_cityYearLine(syl), PAGE.margin, Math.max(y + 40, PAGE.height * 0.8), {
      width: CONTENT_WIDTH,
      align: "center",
    });
}

function _departmentShortName(syl) {
  const raw = refTitle(syl.science?.department);
  if (!raw) return null;
  return raw.replace(/\s*kafedra(si)?\s*$/i, "").trim() || raw;
}

function _programAreaText(syl, field) {
  return areaText(syl?.scienceProgram, field, null);
}

function _drawDepartmentProtocol(doc, syl) {
  const dept = _departmentShortName(syl) || "_____________";
  const step = (syl.approvalSteps || []).find((s) => s && s.step === "kafedra");
  const dateText =
    step && step.status === "approved" && step.date
      ? `${formatUzDatePlain(new Date(step.date))}dagi`
      : "_____________ dagi";
  const protocolText =
    step && step.status === "approved" && String(step.protocol || "").trim()
      ? String(step.protocol).trim()
      : "___";

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(
      `Mazkur Sillabus “${dept}” kafedrasining ${dateText} ${protocolText}-sonli ` +
        "yig'ilish bayoni bilan ma'qullangan.",
      PAGE.margin,
      doc.y,
      { width: CONTENT_WIDTH, align: "justify" },
    );
  doc.moveDown(0.6);
}

function _drawFooter(doc, docTitle, docStatus) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    const footerY = PAGE.height - PAGE.margin + 5;

    doc
      .moveTo(PAGE.margin, footerY - 8)
      .lineTo(PAGE.width - PAGE.margin, footerY - 8)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(
        `${docTitle} | Holat: ${STATUS_LABEL[docStatus] || docStatus}`,
        PAGE.margin,
        footerY - 2,
        { width: CONTENT_WIDTH - 60, align: "left" },
      )
      .text(
        `${i - range.start + 1} / ${range.count}`,
        PAGE.width - PAGE.margin - 55,
        footerY - 2,
        { width: 55, align: "right" },
      );
    doc.page.margins.bottom = bottomMargin;
  }
}

const PROTOCOL_BLOCK_H = 40;

function _signatureRows(doc, syl, verifyQr) {
  const mhSig = resolveSignatory(syl, {
    step: "methodical",
    block: "methodicalHead",
    personField: "leader",
    snapshot: syl.verify?.snapshot,
  });
  const fdSig = resolveSignatory(syl, {
    step: "dean",
    block: "facultyDean",
    personField: "dean",
    snapshot: syl.verify?.snapshot,
  });
  const dhSig = resolveSignatory(syl, {
    step: "kafedra",
    block: "departmentHead",
    personField: "manager",
    snapshot: syl.verify?.snapshot,
  });

  const creatorPerson = isPopulatedPerson(syl.creator?.teacher)
    ? syl.creator.teacher
    : isPopulatedPerson(syl.author?.teacher)
      ? syl.author.teacher
      : null;
  const creatorName = creatorPerson ? personName(creatorPerson) : "";

  const sigBlocks = [
    {
      position:
        syl.methodicalHead?.position || "O'quv-uslubiy boshqarma boshlig'i:",
      sig: mhSig,
    },
    {
      position: syl.facultyDean?.position || "Fakultet dekani:",
      sig: fdSig,
    },
    {
      position: syl.departmentHead?.position || "Kafedra mudiri:",
      sig: dhSig,
    },
    {
      position: syl.creator?.position || "Tuzuvchi:",
      sig: { name: creatorName, dateText: syl.creator?.date || "", source: "manual" },
    },
  ];

  const ROW_GAP = 6;
  const rowOpts = sigBlocks.map((blk) => ({
    layout: "row",
    position: blk.position,
    sig: { ...blk.sig, dateText: "" },
    qr: verifyQr ? { image: verifyQr.image, size: QR_SIZE_ROW } : undefined,
  }));

  const rowsH = rowOpts.reduce(
    (sum, opts) => sum + measureSignatureBlock(doc, opts) + ROW_GAP,
    0,
  );
  return { rowOpts, rowsH, rowGap: ROW_GAP };
}

function _drawSignatureRows(doc, { rowOpts, rowGap }) {
  const ROW_GAP = rowGap;
  let y = doc.y;
  for (const opts of rowOpts) {
    const h = drawSignatureBlock(doc, {
      ...opts,
      x: PAGE.margin,
      y,
      w: CONTENT_WIDTH,
    });
    y += h + ROW_GAP;
  }

  doc.y = y;
  doc.moveDown(2);
}

async function generateSyllabusPdf(req, res, next) {
  try {
    const doc = await buildSyllabusPdf(req.params.id);
    const filename = `sillabus-${req.params.id}`;
    pipeToResponse(res, doc, filename);
    doc.end();
  } catch (err) {
    return next(new ErrorHandler(400, "Sillabus PDF yaratishda xatolik", err.message));
  }
}

module.exports = { generateSyllabusPdf, buildSyllabusPdf };
