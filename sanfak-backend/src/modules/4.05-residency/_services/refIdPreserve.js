"use strict";

const REF_PATHS = [
  { path: "specialty", title: "specialtyTitle" },
  { path: "department", title: "departmentTitle" },
  { path: "group", title: "groupTitle" },
  { path: "user", title: null },
  { path: "supervisor", title: null },
];

const liveTitle = (value) =>
  value && typeof value === "object" ? (value.title ?? value.name ?? null) : null;

const preserveRefIds = (doc, paths = REF_PATHS) => {
  if (!doc || typeof doc.toObject !== "function") return doc;

  const out = doc.toObject();
  for (const { path, title } of paths) {
    const original = doc.populated(path);
    if (!original) continue;

    if (out[path] === null || out[path] === undefined) {
      out[path] = original;
      continue;
    }

    const fresh = liveTitle(out[path]);
    if (title && fresh) out[title] = fresh;
  }
  return out;
};

const preserveRefIdsAll = (docs, paths = REF_PATHS) =>
  Array.isArray(docs) ? docs.map((d) => preserveRefIds(d, paths)) : docs;

const preservePaginated = (result, paths = REF_PATHS) => {
  if (!result || !Array.isArray(result.docs)) return result;
  return { ...result, docs: preserveRefIdsAll(result.docs, paths) };
};

module.exports = {
  REF_PATHS,
  preserveRefIds,
  preserveRefIdsAll,
  preservePaginated,
};
