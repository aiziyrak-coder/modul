const APOSTROPHES = /[‘’ʻʼ`]/g;
const dedupeKey = (s) => s.replace(APOSTROPHES, "'").toLowerCase();

const clean = (v) => (typeof v === "string" ? v.trim() : "");

function areaValues(doc, field) {
  const own = ownValues(doc, field);
  return own.length ? own : directionValues(doc, field);
}

const listOf = (v) => (Array.isArray(v) ? v : []);

function ownValues(doc, field) {
  return listOf(doc && doc[field]).map(clean).filter(Boolean);
}

function directionValues(doc, field) {
  const seen = new Set();
  const out = [];
  for (const d of listOf(doc && doc.directions)) {
    const v = d && typeof d === "object" ? clean(d[field]) : "";
    if (!v || seen.has(dedupeKey(v))) continue;
    seen.add(dedupeKey(v));
    out.push(v);
  }
  return out;
}

function areaText(doc, field, fallback = null) {
  const values = areaValues(doc, field);
  return values.length ? values.join(", ") : fallback;
}

module.exports = { areaValues, areaText };
