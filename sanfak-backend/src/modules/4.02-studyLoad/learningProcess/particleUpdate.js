"use strict";

const mongoose = require("mongoose");
const { LOAD_COLUMNS } = require("#modules/4.02-studyLoad/_shared/planLoadColumns");

const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

const numOrZero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizeItem = (item) => {
  if (!item || typeof item !== "object") return null;
  const { _id: rawId, ...fields } = item;
  const [key, value] = Object.entries(fields)[0] || [];
  if (key === undefined) return null;
  const id = isObjectId(rawId) ? String(rawId) : null;
  const slug = id ? key : String(rawId ?? key);
  return { id, slug, value };
};

const findTarget = (rows, it) => {
  const byId = it.id ? rows.find((p) => String(p._id) === it.id) : null;
  return byId || rows.find((p) => p.slug === it.slug) || null;
};

const pushFor = (slug, value) => {
  const std = LOAD_COLUMNS.find((c) => c.slug === slug);
  if (!std) return undefined;
  if (value === 0) return null;
  return {
    _id: new mongoose.Types.ObjectId(),
    slug: std.slug,
    title: std.title,
    canonical: std.canonical,
    value,
    colNum: null,
  };
};

const planParticleWrites = (existing, incoming) => {
  const rows = (Array.isArray(existing) ? existing : []).filter((p) => p && p._id);
  const plan = { sets: [], pushes: [], skipped: [] };
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const it = normalizeItem(raw);
    if (!it) continue;
    const value = numOrZero(it.value);
    const target = findTarget(rows, it);
    if (target) {
      plan.sets.push({ particleId: String(target._id), value });
      continue;
    }
    const push = pushFor(it.slug, value);
    if (push === undefined) plan.skipped.push(it.slug);
    else if (push) plan.pushes.push(push);
  }
  return plan;
};

const findScienceRow = (doc, parentId, sciId) => {
  const block = (doc && doc.blocks ? doc.blocks : []).find(
    (b) => String(b._id) === String(parentId),
  );
  if (!block) return null;
  return (block.sciences || []).find((sc) => String(sc._id) === String(sciId)) || null;
};

const applyParticlePlan = async (Model, { id, parentId, sciId, plan }) => {
  const rowFilters = [
    { "block._id": new mongoose.Types.ObjectId(parentId) },
    { "science._id": new mongoose.Types.ObjectId(sciId) },
  ];
  for (const w of plan.sets) {
    await Model.updateOne(
      { _id: id },
      { $set: { "blocks.$[block].sciences.$[science].particle.$[part].value": w.value } },
      { arrayFilters: [...rowFilters, { "part._id": new mongoose.Types.ObjectId(w.particleId) }] },
    );
  }
  if (plan.pushes.length) {
    await Model.updateOne(
      { _id: id },
      { $push: { "blocks.$[block].sciences.$[science].particle": { $each: plan.pushes } } },
      { arrayFilters: rowFilters },
    );
  }
  return plan;
};

module.exports = { planParticleWrites, normalizeItem, findScienceRow, applyParticlePlan };
