"use strict";

const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const Department = require("#references/department/department.model");
const Group = require("#references/group/group.model");
const Course = require("#references/course/course.model");
const Specialty = require("#modules/4.05-residency/residencySpecialty/residencySpecialty.model");
const { resolveByTitle } = require("./academicYearRefPlugin");
const { COLUMNS, matchHeader, isSamplePin } = require("./rosterColumns");
const { onboardResident } = require("./residentOnboarding");

const MAX_ROWS = Number(process.env.RESIDENCY_IMPORT_MAX_ROWS || 1000);

const STUDY_PERIOD_MIN = 1;
const STUDY_PERIOD_MAX = 10;

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

const PROGRAM_ALIASES = {
  magistratura: "magistratura",
  magistr: "magistratura",
  magistratura2: "magistratura",
  ordinatura: "ordinatura",
  "klinik ordinatura": "ordinatura",
  rezidentura: "ordinatura",
  rezident: "ordinatura",
};

const FUNDING_ALIASES = {
  byudjet: "byudjet",
  budjet: "byudjet",
  budget: "byudjet",
  grant: "byudjet",
  shartnoma: "shartnoma",
  kontrakt: "shartnoma",
  tolov: "shartnoma",
};

const TRUE_WORDS = new Set(["ha", "xa", "yes", "true", "1", "+", "bor"]);
const FALSE_WORDS = new Set(["yoq", "yo q", "yuq", "no", "false", "0", "-", "yoq."]);

function parseDate(text) {
  const raw = String(text || "").trim();
  if (!raw) return { empty: true };

  let y;
  let m;
  let d;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dotted = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (iso) [, y, m, d] = iso;
  else if (dotted) [, d, m, y] = dotted;
  else return { invalid: true };

  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return { invalid: true };
  }
  return { date };
}

function parseCoordinates({ combined, lat, lng }) {
  const errors = [];
  const raw = String(combined || "").trim();
  const hasSeparate = Boolean(String(lat || "").trim()) || Boolean(String(lng || "").trim());

  let fromCombined = null;
  if (raw) {
    const parts = raw.split(/[;,\s]+/).filter(Boolean);
    if (parts.length === 4) {
      errors.push(
        `Koordinatada o'nlik ajratgich sifatida VERGUL ishlatilgan ("${raw}") — nuqta qo'ying: 41.311081, 69.240562`,
      );
    } else if (parts.length !== 2) {
      errors.push(`Koordinata tushunarsiz ("${raw}") — kutilgan shakl: 41.311081, 69.240562`);
    } else {
      const nums = parts.map(Number);
      if (nums.some((n) => !Number.isFinite(n))) {
        errors.push(`Koordinata son emas ("${raw}")`);
      } else {
        fromCombined = { lat: nums[0], lng: nums[1] };
      }
    }
  }

  let fromSeparate = null;
  if (hasSeparate) {
    if (!String(lat || "").trim() || !String(lng || "").trim()) {
      errors.push("Kenglik va uzunlik — ikkalasi birga kiritilishi kerak");
    } else {
      const a = Number(String(lat).replace(",", "."));
      const b = Number(String(lng).replace(",", "."));
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        errors.push(`Kenglik/uzunlik son emas ("${lat}", "${lng}")`);
      } else {
        fromSeparate = { lat: a, lng: b };
      }
    }
  }

  if (errors.length) return { errors };

  if (fromCombined && fromSeparate) {
    if (fromCombined.lat !== fromSeparate.lat || fromCombined.lng !== fromSeparate.lng) {
      return {
        errors: [
          "Koordinata ustuni va alohida kenglik/uzunlik BIR XIL emas — bittasini qoldiring",
        ],
      };
    }
  }

  const location = fromCombined || fromSeparate;
  if (!location) return { errors: [] };

  if (location.lat < -90 || location.lat > 90) {
    errors.push(`Kenglik -90 va 90 orasida bo'lishi kerak ("${location.lat}")`);
  }
  if (location.lng < -180 || location.lng > 180) {
    errors.push(`Uzunlik -180 va 180 orasida bo'lishi kerak ("${location.lng}")`);
  }

  return errors.length ? { errors } : { location, errors: [] };
}

async function loadCatalog() {
  const [departments, groups, courses, specialties] = await Promise.all([
    Department.find(LIVE).select("title").lean(),
    Group.find(LIVE).select("title").lean(),
    Course.find(LIVE).select("title").lean(),
    Specialty.find(LIVE).select("title code program").lean(),
  ]);
  return { departments, groups, courses, specialties };
}

function resolveUnique(rows, title, extraFilter) {
  const key = norm(title);
  const matches = rows.filter((r) => {
    if (norm(r.title) !== key) return false;
    return !extraFilter || extraFilter(r);
  });
  if (matches.length === 1) return { row: matches[0] };
  if (matches.length > 1) return { ambiguous: matches.length };
  return { missing: true };
}

function resolveSpecialty(rows, value, program) {
  const key = norm(value);
  const inProgram = rows.filter((r) => r.program === program);
  const matches = inProgram.filter(
    (r) => norm(r.title) === key || (r.code && norm(r.code) === key),
  );
  if (matches.length === 1) return { row: matches[0] };
  if (matches.length > 1) return { ambiguous: matches.length };
  return { missing: true };
}

async function resolveReferences(catalog, raw, program) {
  const errors = [];
  const set = {};

  if (raw.department) {
    const r = resolveUnique(catalog.departments, raw.department);
    if (r.row) {
      set.department = r.row._id;
      set.departmentTitle = r.row.title;
    } else if (r.ambiguous) {
      errors.push(`Kafedra nomi noaniq — ${r.ambiguous} ta moslik: "${raw.department}"`);
    } else {
      errors.push(`Kafedra ma'lumotnomada topilmadi: "${raw.department}"`);
    }
  }

  if (raw.group) {
    const r = resolveUnique(catalog.groups, raw.group);
    if (r.row) {
      set.group = r.row._id;
      set.groupTitle = r.row.title;
    } else if (r.ambiguous) {
      errors.push(`Guruh nomi noaniq — ${r.ambiguous} ta moslik: "${raw.group}"`);
    } else {
      errors.push(`Guruh ma'lumotnomada topilmadi: "${raw.group}"`);
    }
  }

  if (raw.specialty) {
    if (!program) {
      errors.push("Mutaxassislik uchun avval ta'lim yo'nalishi ko'rsatilishi kerak");
    } else {
      const r = resolveSpecialty(catalog.specialties, raw.specialty, program);
      if (r.row) {
        set.specialty = r.row._id;
        set.specialtyTitle = r.row.title;
        if (r.row.code) set.specialtyCode = r.row.code;
      } else if (r.ambiguous) {
        errors.push(`Mutaxassislik noaniq — ${r.ambiguous} ta moslik: "${raw.specialty}"`);
      } else {
        errors.push(
          `Mutaxassislik "${program}" yo'nalishi ma'lumotnomasida topilmadi: "${raw.specialty}"`,
        );
      }
    }
  }

  if (raw.courseNumber) {
    const wanted = parseInt(String(raw.courseNumber).replace(/\D/g, ""), 10);
    const found = Number.isFinite(wanted)
      ? catalog.courses.find(
          (c) => parseInt(String(c.title).replace(/\D/g, ""), 10) === wanted,
        )
      : null;
    if (found) set.courseNumber = wanted;
    else errors.push(`Kurs ma'lumotnomada topilmadi: "${raw.courseNumber}"`);
  }

  if (raw.academicYear) {
    const ref = await resolveByTitle(raw.academicYear);
    if (ref) set.academicYear = raw.academicYear;
    else errors.push(`O'quv yili ma'lumotnomada topilmadi: "${raw.academicYear}"`);
  }

  return { set, errors };
}

function parseRow(raw, numericJshshir) {
  const errors = [];
  const value = {};

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

  if (!raw.program) {
    errors.push("Ta'lim yo'nalishi bo'sh (magistratura yoki ordinatura)");
  } else {
    const program = PROGRAM_ALIASES[norm(raw.program)];
    if (program) value.program = program;
    else
      errors.push(
        `Ta'lim yo'nalishi tushunarsiz ("${raw.program}") — "magistratura" yoki "ordinatura" bo'lishi kerak`,
      );
  }

  if (raw.fundingType) {
    const funding = FUNDING_ALIASES[norm(raw.fundingType)];
    if (funding) value.fundingType = funding;
    else
      errors.push(
        `Ta'lim turi tushunarsiz ("${raw.fundingType}") — "byudjet" yoki "shartnoma" bo'lishi kerak`,
      );
  }

  if (Boolean(raw.passportSeria) !== Boolean(raw.passportNumber)) {
    errors.push("Pasport seriyasi va raqami — ikkalasi birga kiritilishi kerak");
  }

  if (raw.studyPeriod) {
    const years = Number(String(raw.studyPeriod).replace(",", "."));
    if (!Number.isFinite(years)) {
      errors.push(`O'qish muddati son bo'lishi kerak ("${raw.studyPeriod}")`);
    } else if (!Number.isInteger(years)) {
      errors.push(`O'qish muddati butun son (yil) bo'lishi kerak ("${raw.studyPeriod}")`);
    } else if (years < STUDY_PERIOD_MIN || years > STUDY_PERIOD_MAX) {
      errors.push(
        `O'qish muddati ${STUDY_PERIOD_MIN}..${STUDY_PERIOD_MAX} yil oralig'ida bo'lishi kerak ("${raw.studyPeriod}")`,
      );
    } else {
      value.studyPeriod = years;
    }
  }

  if (raw.foreign) {
    const key = norm(raw.foreign);
    if (TRUE_WORDS.has(key)) value.foreign = true;
    else if (FALSE_WORDS.has(key)) value.foreign = false;
    else errors.push(`"Xorijiy fuqaro" ustuni "ha" yoki "yo'q" bo'lishi kerak ("${raw.foreign}")`);
  }

  const coords = parseCoordinates({
    combined: raw.workplaceCoords,
    lat: raw.workplaceLat,
    lng: raw.workplaceLng,
  });
  errors.push(...coords.errors);
  if (coords.location) value.workplaceLocation = coords.location;

  for (const [key, label] of [
    ["admissionDate", "Qabul sanasi"],
    ["diplomaDate", "Diplom sanasi"],
  ]) {
    const parsed = parseDate(raw[key]);
    if (parsed.date) value[key] = parsed.date;
    else if (parsed.invalid) {
      errors.push(`${label} tushunarsiz ("${raw[key]}") — KK.OO.YYYY yoki YYYY-OO-KK`);
    }
  }

  return { errors, value };
}

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

const SCOPE_DENIED_ROW =
  "Bu kafedra sizning doirangizdan tashqarida — satr o'tkazib yuborildi";

async function importRoster(buffer, { dryRun = false, canCreate = () => true } = {}) {
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
    resident: { created: 0, existing: 0, linked: 0, failed: 0 },
    account: { created: 0, existing: 0, skipped: 0 },
    columns: { recognized: [...header.map.keys()], ignored: header.ignored },
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
      report.resident.failed += 1;
      report.rows.push({
        row: r,
        fullName: [raw.lastName, raw.firstName, raw.middleName].filter(Boolean).join(" "),
        jshshir: raw.jshshir || null,
        status: "failed",
        errors,
      });
    };

    const parsed = parseRow(raw, numericJshshir);
    const errors = [...parsed.errors];

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

    const refs = await resolveReferences(catalog, raw, parsed.value.program);
    if (refs.errors.length) {
      fail(refs.errors);
      continue;
    }

    if (!canCreate({ department: refs.set.department ?? null })) {
      fail([SCOPE_DENIED_ROW]);
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
      address: raw.address || null,
      workplace: raw.workplace || null,
      email: raw.email || null,
      phone: raw.phone || null,
      admissionOrder: raw.admissionOrder || null,
      diplomaSeria: raw.diplomaSeria || null,
      diplomaNumber: raw.diplomaNumber || null,
      ...parsed.value,
      ...refs.set,
    };

    try {
      const result = await onboardResident(payload, { dryRun });
      if (!result.ok) {
        fail(result.errors);
        continue;
      }

      report.resident[result.resident.status] += 1;
      report.account[result.account.status] += 1;
      report.rows.push({
        row: r,
        fullName: result.fullName,
        jshshir: raw.jshshir,
        status: "ok",
        resident: result.resident.status,
        account: result.account.status,
        id: result.resident.id,
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
  resolveSpecialty,
  resolveReferences,
  parseRow,
  parseDate,
  parseCoordinates,
};
