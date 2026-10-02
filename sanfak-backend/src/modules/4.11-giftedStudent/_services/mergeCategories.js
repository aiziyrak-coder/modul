"use strict";

const norm = (v) => String(v ?? "").trim().toLowerCase();

function mergeCategories(incoming, current = []) {
  if (!Array.isArray(incoming)) return incoming;

  const byId = new Map();
  const byName = new Map();
  for (const c of current) {
    if (!c || c._id == null) continue;
    byId.set(String(c._id), c._id);
    const key = norm(c.name);
    if (key && !byName.has(key)) byName.set(key, c._id);
  }

  const ishlatilgan = new Set();

  return incoming.map((cat) => {
    if (!cat || typeof cat !== "object") return cat;

    const sent = cat._id != null ? String(cat._id) : null;
    if (sent && byId.has(sent) && !ishlatilgan.has(sent)) {
      ishlatilgan.add(sent);
      return { ...cat, _id: byId.get(sent) };
    }

    const key = norm(cat.name);
    const matched = key ? byName.get(key) : null;
    if (matched && !ishlatilgan.has(String(matched))) {
      ishlatilgan.add(String(matched));
      return { ...cat, _id: matched };
    }

    const { _id, ...rest } = cat;
    return rest;
  });
}

module.exports = { mergeCategories };
