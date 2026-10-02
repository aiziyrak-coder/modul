const AuditoriumHour = require("#references/auditoriumHour/auditoriumHour.model");

let _normaCache = null;
let _normaCacheAt = 0;
const NORMA_TTL_MS = 60 * 1000;

async function getActiveNorma() {
  const now = Date.now();
  if (_normaCache && now - _normaCacheAt < NORMA_TTL_MS) return _normaCache;
  const norma = await AuditoriumHour.findOne({ active: true })
    .sort({ date: -1 })
    .lean();
  _normaCache = norma;
  _normaCacheAt = now;
  return norma;
}

function clearNormaCache() {
  _normaCache = null;
  _normaCacheAt = 0;
}

function calcMinHour(norma, positionSlug, stavka = 1.0) {
  if (!norma) return 0;
  const cat = (norma.categories || []).find((c) => c.slug === positionSlug);
  const base = cat ? Number(cat.value) : Number(norma.auditoriumHour);
  const factor = Number(stavka) || 1.0;
  return Math.round(base * factor);
}

function calcEntryAuditoriumHour(entry) {
  const blocks = (entry && entry.blocks) || [];
  return blocks.reduce((sum, b) => {
    const sw = b?.studyWork;
    const ts = sw?.thisSemester;
    const teaching = Number(ts?.teachingAuditoriumHour);
    const classTypes = sw?.classTypes;
    let stored;
    if (Number.isFinite(teaching) && teaching > 0) {
      stored = teaching;
    } else if (Array.isArray(classTypes) && classTypes.length > 0) {
      stored = classTypes.reduce((s, ct) => s + (Number(ct?.total) || 0), 0);
    } else {
      stored = Number(ts?.auditoriumHour) || 0;
    }
    const capped = Math.max(
      0,
      (Number(b?.totalHour) || 0) - (Number(b?.nonAuditHour) || 0),
    );
    return sum + Math.min(stored, capped);
  }, 0);
}

async function validateOneEntry(entry, opts = {}) {
  if (!entry) return null;
  if (entry.isVacant) return null;
  if (opts.skipPending && entry.acceptanceStatus === "pending") return null;

  const norma = await getActiveNorma();
  if (!norma) {
    return {
      teacherEntryId: entry._id,
      message: "AuditoriumHour normasi DBda topilmadi (active=true bo'lgani)",
      severity: "config",
    };
  }

  const minHour = calcMinHour(norma, entry.position, entry.stavka);
  const total   = Number(entry.totalHour) || 0;
  const auditoriumHour = calcEntryAuditoriumHour(entry);

  if (auditoriumHour < minHour) {
    return {
      teacherEntryId: entry._id,
      teacher:    entry.teacher,
      position:   entry.position,
      stavka:     entry.stavka,
      totalHour:  total,
      auditoriumHour,
      minHour,
      shortage:   minHour - auditoriumHour,
      message:    `Min soat shartiga rioya qilinmagan: auditoriya ${auditoriumHour} < ${minHour} (${entry.position || "default"} × ${entry.stavka || 1.0})`,
      severity:   "error",
    };
  }
  return null;
}

async function validateTeacherMinHours(distribution, opts = {}) {
  const teachers = (distribution && distribution.teachers) || [];
  const errors = [];
  for (const t of teachers) {
    const err = await validateOneEntry(t, opts);
    if (err) errors.push(err);
  }
  return errors;
}

const OVERLOAD_MULTIPLIER = 1.5;

async function validateMaxOverload(entry, multiplier = OVERLOAD_MULTIPLIER) {
  if (!entry || entry.isVacant) return null;
  const norma = await getActiveNorma();
  if (!norma) return null;
  const minHour = calcMinHour(norma, entry.position, entry.stavka);
  const maxHour = Math.round(minHour * multiplier);
  const total   = Number(entry.totalHour) || 0;
  const auditoriumHour = calcEntryAuditoriumHour(entry);
  if (auditoriumHour > maxHour) {
    return {
      teacherEntryId: entry._id,
      totalHour: total,
      auditoriumHour,
      maxHour,
      excess: auditoriumHour - maxHour,
      message: `Ortiqcha yuklama: auditoriya ${auditoriumHour} > ${maxHour} (1.5× normadan oshib ketdi)`,
      severity: "warning",
    };
  }
  return null;
}

function calcHourBounds(norma, positionSlug, stavka) {
  if (!norma) return null;
  const minHour = calcMinHour(norma, positionSlug, stavka);
  return { minHour, maxHour: Math.round(minHour * OVERLOAD_MULTIPLIER) };
}

const DEFAULT_ALLOWED_STAKES = [0.25, 0.5, 0.75, 1.0];

function getAllowedStakes(norma) {
  return norma && Array.isArray(norma.allowedStakes) && norma.allowedStakes.length
    ? norma.allowedStakes
    : DEFAULT_ALLOWED_STAKES;
}

function isAllowedStake(norma, stavka) {
  const allowed = getAllowedStakes(norma);
  return allowed.some((v) => Number(v) === Number(stavka));
}

module.exports = {
  getActiveNorma,
  OVERLOAD_MULTIPLIER,
  calcHourBounds,
  clearNormaCache,
  calcMinHour,
  calcEntryAuditoriumHour,
  validateOneEntry,
  validateTeacherMinHours,
  validateMaxOverload,
  DEFAULT_ALLOWED_STAKES,
  getAllowedStakes,
  isAllowedStake,
};
