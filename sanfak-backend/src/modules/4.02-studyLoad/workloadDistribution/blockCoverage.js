const groupIds = (arr) =>
  (Array.isArray(arr) ? arr : []).map((g) => String(g?._id ?? g));

function coverageOf(groups, streams) {
  const ids = new Set(groupIds(groups));
  for (const s of Array.isArray(streams) ? streams : []) {
    for (const g of groupIds(s?.groups)) ids.add(g);
  }
  return [...ids];
}

function coverageClash(incoming, existing) {
  if (incoming.length === 0 && existing.length === 0) {
    return { clash: true, kind: "both-whole", overlap: 0 };
  }
  if (incoming.length === 0 || existing.length === 0) {
    return { clash: true, kind: "whole", overlap: 0 };
  }
  const overlap = incoming.filter((g) => existing.includes(g)).length;
  return { clash: overlap > 0, kind: overlap > 0 ? "overlap" : null, overlap };
}

module.exports = { groupIds, coverageOf, coverageClash };
