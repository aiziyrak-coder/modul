const EducationActivityType = require("#references/educationActivityType/educationActivityType.model");

const _cache = new Map();
const TTL_MS = 60 * 1000;
let _loadedAt = 0;

const normalize = (s) => {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t || null;
};

const matchKey = (s) => {
  const t = normalize(s);
  if (!t) return null;
  return t
    .replace(/[''‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
};

async function loadCache() {
  const now = Date.now();
  if (_cache.size > 0 && now - _loadedAt < TTL_MS) return;

  const docs = await EducationActivityType.find({})
    .select("title")
    .lean();

  _cache.clear();
  for (const d of docs) {
    const key = matchKey(d.title);
    if (key && !_cache.has(key)) _cache.set(key, d._id);
  }
  _loadedAt = now;
}

async function resolveOrCreate(title) {
  const norm = normalize(title);
  if (!norm) return null;
  const key = matchKey(norm);

  await loadCache();
  if (_cache.has(key)) return _cache.get(key);

  _loadedAt = 0;
  await loadCache();
  if (_cache.has(key)) return _cache.get(key);

  const doc = await EducationActivityType.findOneAndUpdate(
    { title: norm },
    { $setOnInsert: { title: norm, active: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  _cache.set(key, doc._id);
  return doc._id;
}

async function enrichItemsWithSlugRef(items) {
  if (!Array.isArray(items)) return items || [];
  const out = [];
  for (const item of items) {
    const next = { ...(item || {}) };
    if (next.title && !next.slugRef) {
      next.slugRef = await resolveOrCreate(next.title);
    }
    out.push(next);
  }
  return out;
}

async function enrichMetaWithSlugRefs(meta) {
  if (!meta || typeof meta !== "object") return meta;

  const out = { ...meta };

  if (out.particles && Array.isArray(out.particles.items)) {
    out.particles = {
      ...out.particles,
      items: await enrichItemsWithSlugRef(out.particles.items),
    };
  }

  return out;
}

function clearCache() {
  _cache.clear();
  _loadedAt = 0;
}

async function populateAllSlugRefs(doc) {
  if (!doc) return doc;

  const ids = new Set();
  const slots = [];

  const collect = (items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item?.slugRef && typeof item.slugRef !== "object") {
        ids.add(String(item.slugRef));
      }
    }
    slots.push(items);
  };

  const iterMap = (mapOrObj) => {
    if (!mapOrObj) return [];
    if (mapOrObj instanceof Map) return [...mapOrObj.values()];
    if (typeof mapOrObj === "object") return Object.values(mapOrObj);
    return [];
  };

  collect(doc.meta?.particles?.items);

  if (Array.isArray(doc.blocks)) {
    for (const block of doc.blocks) {
      collect(block.particle);
      for (const sem of iterMap(block.semesters)) {
        collect(sem.particles);
      }
      if (Array.isArray(block.sciences)) {
        for (const sci of block.sciences) {
          collect(sci.particle);
          for (const sem of iterMap(sci.semesters)) {
            collect(sem.particles);
          }
        }
      }
    }
  }

  if (doc.semesters) {
    for (const semData of iterMap(doc.semesters)) {
      if (!semData) continue;
      if (Array.isArray(semData.blocks)) {
        for (const block of semData.blocks) {
          if (Array.isArray(block.sciences)) {
            for (const sci of block.sciences) {
              collect(sci.particle);
            }
          }
        }
      }
      collect(semData.blocksTotal?.particles);
      collect(semData.practice?.particles);
      collect(semData.grandTotal?.particles);
    }
  }

  if (ids.size === 0) return doc;

  const docs = await EducationActivityType.find({ _id: { $in: [...ids] } })
    .lean();
  const map = new Map(docs.map((d) => [String(d._id), d]));

  for (const items of slots) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item?.slugRef && typeof item.slugRef !== "object") {
        const populated = map.get(String(item.slugRef));
        if (populated) item.slugRef = populated;
      }
    }
  }

  return doc;
}

module.exports = {
  resolveOrCreate,
  enrichItemsWithSlugRef,
  enrichMetaWithSlugRefs,
  populateAllSlugRefs,
  clearCache,
};
