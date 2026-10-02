"use strict";

const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const Faculty = require("#references/faculty/faculty.model");
const Direction = require("#references/direction/direction.model");
const Group = require("#references/group/group.model");
const Course = require("#references/course/course.model");
const { resolveByTitle } = require("./academicYearRefPlugin");
const { COLUMNS, matchHeader, isSamplePin } = require("./rosterColumns");
const { onboardStudent } = require("./studentOnboarding");

const MAX_ROWS = Number(process.env.GIFTED_IMPORT_MAX_ROWS || 1000);

const HEADER_SCAN_ROWS = 10;

const LIVE = { active: { $ne: false } };
const PIN_RE = /^\d{14}$/;

const norm = (v) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/['ʻʼ’‘`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function cellText(cell) {
  const v = cell?.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("").trim();
    if (v.result !== undefined && v.result !== null) return String(v.result).trim();
    if (v.text !== undefined && v.text !== null) return String(v.text).trim();
    if (v.hyperlink) return String(v.hyperlink).trim();
    return "";
  }
  return String(v).trim();
}

const isNumericCell = (cell) => typeof cell?.value === "number";

function findHeaderRow(ws) {
  let best = { rowNumber: 0, map: null, hits: 0, ignored: [] };

  const last = Math.min(ws.rowCount || 0, HEADER_SCAN_ROWS);
  for (let r = 1; r <= last; r += 1) {
    const row = ws.getRow(r);
    const map = new Map();
    const ignored = [];
    let hits = 0;

    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const text = cellText(cell);
      const m = matchHeader(text);
      if (m?.key) {
        if (!map.has(m.key)) map.set(m.key, col);
        hits += 1;
      } else if (m?.rejected) {
        ignored.push({ header: text, reason: m.rejected });
      } else if (text) {
        ignored.push({ header: text, reason: "Noma'lum ustun — e'tiborsiz qoldirildi" });
      }
    });

    if (hits > best.hits) best = { rowNumber: r, map, hits, ignored };
  }

  return best;
}

async function loadCatalog() {
  const [faculties, directions, groups, courses] = await Promise.all([
    Faculty.find(LIVE).select("title").lean(),
    Direction.find(LIVE).select("title faculty").lean(),
    Group.find(LIVE).select("title direction course").lean(),
    Course.find(LIVE).select("title").lean(),
  ]);
  return { faculties, directions, groups, courses };
}

function resolveUnique(rows, title, parentField, parentId) {
  const key = norm(title);
  const matches = rows.filter((r) => {
    if (norm(r.title) !== key) return false;
    if (!parentField) return true;
    return String(r[parentField] || "") === String(parentId || "");
  });
  if (matches.length === 1) return { row: matches[0] };
  if (matches.length > 1) return { ambiguous: matches.length };
  return { missing: true };
}

async function resolveReferences(catalog, raw) {
  const errors = [];
  const set = {};

  if (raw.faculty) {
    const r = resolveUnique(catalog.faculties, raw.faculty);
    if (r.row) {
      set.faculty = r.row.title;
      set.facultyId = r.row._id;
    } else if (r.ambiguous) {
      errors.push(`Fakultet nomi noaniq — ma'lumotnomada ${r.ambiguous} ta moslik: "${raw.faculty}"`);
    } else {
      errors.push(`Fakultet ma'lumotnomada topilmadi: "${raw.faculty}"`);
    }
  }

  if (raw.direction) {
    if (!set.facultyId) {
      errors.push(`Yo'nalish uchun avval to'g'ri fakultet ko'rsatilishi kerak: "${raw.direction}"`);
    } else {
      const r = resolveUnique(catalog.directions, raw.direction, "faculty", set.facultyId);
      if (r.row) {
        set.direction = r.row.title;
        set.directionId = r.row._id;
      } else if (r.ambiguous) {
        errors.push(`Yo'nalish nomi noaniq — ${r.ambiguous} ta moslik: "${raw.direction}"`);
      } else {
        errors.push(
          `Yo'nalish bu fakultetda topilmadi: "${raw.direction}" (${set.faculty})`,
        );
      }
    }
  }

  if (raw.course) {
    const wanted = parseInt(String(raw.course).replace(/\D/g, ""), 10);
    const row = Number.isFinite(wanted)
      ? catalog.courses.find((c) => parseInt(String(c.title).replace(/\D/g, ""), 10) === wanted)
      : null;
    if (row) set.course = wanted;
    else errors.push(`Kurs ma'lumotnomada topilmadi: "${raw.course}"`);
  }

  if (raw.group) {
    if (!set.directionId) {
      errors.push(`Guruh uchun avval to'g'ri yo'nalish ko'rsatilishi kerak: "${raw.group}"`);
    } else {
      const r = resolveUnique(catalog.groups, raw.group, "direction", set.directionId);
      if (r.row) {
        set.group = r.row.title;
        set.groupId = r.row._id;
      } else if (r.ambiguous) {
        errors.push(`Guruh nomi noaniq — ${r.ambiguous} ta moslik: "${raw.group}"`);
      } else {
        errors.push(`Guruh bu yo'nalishda topilmadi: "${raw.group}" (${set.direction})`);
      }
    }
  }

  if (raw.academicYear) {
    const ref = await resolveByTitle(raw.academicYear);
    if (ref) set.academicYear = raw.academicYear;
    else errors.push(`O'quv yili ma'lumotnomada topilmadi: "${raw.academicYear}"`);
  }

  return { set, errors };
}

function validateRow(raw, numericJshshir) {
  const errors = [];

  if (!raw.lastName) errors.push("Familiya bo'sh");
  if (!raw.firstName) errors.push("Ism bo'sh");

  if (!raw.jshshir) {
    errors.push("JSHSHIR bo'sh");
  } else if (isSamplePin(raw.jshshir)) {
    errors.push(
      `Bu namunaviy satr — namunadagi JSHSHIR o'zgartirilmagan ("${raw.jshshir}"). ` +
        "Namunaviy satrlarni o'chirib, o'z ma'lumotingizni kiriting",
    );
  } else if (!PIN_RE.test(raw.jshshir)) {
    errors.push(
      numericJshshir
        ? `JSHSHIR 14 raqam emas ("${raw.jshshir}") — katak SON formatida saqlangan, ` +
          "boshidagi nol yo'qolgan bo'lishi mumkin; ustunni MATN formatiga o'tkazing"
        : `JSHSHIR aniq 14 raqam bo'lishi kerak ("${raw.jshshir}")`,
    );
  }

  if (Boolean(raw.passportSeria) !== Boolean(raw.passportNumber)) {
    errors.push("Pasport seriyasi va raqami — ikkalasi birga kiritilishi kerak");
  }

  return errors;
}

async function importRoster(buffer, { dryRun = false } = {}) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    throw new ErrorHandler(
      400,
      "Faylni o'qib bo'lmadi — u haqiqiy .xlsx emas yoki buzilgan",
      err.message,
    );
  }

  const ws = wb.worksheets[0];
  if (!ws) throw new ErrorHandler(400, "Faylda birorta varaq yo'q");

  const header = findHeaderRow(ws);
  if (!header.map || header.hits < 2) {
    throw new ErrorHandler(
      400,
      "Sarlavha qatori topilmadi — shablonni yuklab olib, ustun nomlarini o'zgartirmang",
    );
  }

  const missingRequired = COLUMNS.filter((c) => c.required && !header.map.has(c.key));
  if (missingRequired.length) {
    throw new ErrorHandler(
      400,
      `Majburiy ustunlar yetishmayapti: ${missingRequired.map((c) => c.header).join(", ")}`,
    );
  }

  const catalog = await loadCatalog();

  const report = {
    dryRun,
    total: 0,
    student: { created: 0, existing: 0, linked: 0, failed: 0 },
    account: { created: 0, existing: 0, skipped: 0 },
    columns: {
      recognized: [...header.map.keys()],
      ignored: header.ignored,
    },
    rows: [],
  };

  const seenPin = new Map();
  const seenPassport = new Map();

  const lastRow = ws.rowCount || 0;
  for (let r = header.rowNumber + 1; r <= lastRow; r += 1) {
    const row = ws.getRow(r);

    const raw = {};
    let numericJshshir = false;
    for (const [key, col] of header.map.entries()) {
      const cell = row.getCell(col);
      raw[key] = cellText(cell);
      if (key === "jshshir") numericJshshir = isNumericCell(cell);
    }

    if (!Object.values(raw).some(Boolean)) continue;

    report.total += 1;
    if (report.total > MAX_ROWS) {
      throw new ErrorHandler(
        400,
        `Bitta faylda ko'pi bilan ${MAX_ROWS} ta satr bo'lishi mumkin — ro'yxatni bo'lib yuklang`,
      );
    }

    const fail = (errors) => {
      report.student.failed += 1;
      report.rows.push({
        row: r,
        fullName: [raw.lastName, raw.firstName, raw.middleName].filter(Boolean).join(" "),
        jshshir: raw.jshshir || null,
        status: "failed",
        errors,
      });
    };

    const errors = validateRow(raw, numericJshshir);

    if (raw.jshshir && seenPin.has(raw.jshshir)) {
      errors.push(`Bu JSHSHIR faylda allaqachon bor (${seenPin.get(raw.jshshir)}-satr)`);
    }
    const passportKey =
      raw.passportSeria && raw.passportNumber
        ? `${norm(raw.passportSeria)}|${norm(raw.passportNumber)}`
        : null;
    if (passportKey && seenPassport.has(passportKey)) {
      errors.push(`Bu pasport faylda allaqachon bor (${seenPassport.get(passportKey)}-satr)`);
    }

    if (errors.length) {
      fail(errors);
      continue;
    }

    const refs = await resolveReferences(catalog, raw);
    if (refs.errors.length) {
      fail(refs.errors);
      continue;
    }

    seenPin.set(raw.jshshir, r);
    if (passportKey) seenPassport.set(passportKey, r);

    const payload = {
      lastName: raw.lastName,
      firstName: raw.firstName,
      middleName: raw.middleName || null,
      jshshir: raw.jshshir,
      passportSeria: raw.passportSeria || null,
      passportNumber: raw.passportNumber || null,
      email: raw.email || null,
      phone: raw.phone || null,
      workplace: raw.workplace || null,
      ...refs.set,
    };

    try {
      const result = await onboardStudent(payload, { dryRun });
      if (!result.ok) {
        fail(result.errors);
        continue;
      }

      report.student[result.student.status] += 1;
      report.account[result.account.status] += 1;
      report.rows.push({
        row: r,
        fullName: result.fullName,
        jshshir: raw.jshshir,
        student: result.student.status,
        account: result.account.status,
        id: result.student.id,
        ...(result.warnings.length ? { warnings: result.warnings } : {}),
      });
    } catch (err) {
      fail([err.message || "Saqlashda kutilmagan xato"]);
    }
  }

  return report;
}

module.exports = {
  importRoster,
  MAX_ROWS,
  loadCatalog,
  norm,
  cellText,
  findHeaderRow,
  resolveUnique,
  resolveReferences,
  validateRow,
};
