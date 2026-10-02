async function shadowedIds(Model, baseMatch, groupFields) {
  const key = Object.fromEntries(groupFields.map((f) => [f, `$${f}`]));
  const rows = await Model.aggregate([
    { $match: { ...baseMatch, status: { $ne: "superseded" } } },
    { $group: { _id: key, docs: { $push: { id: "$_id", status: "$status" } } } },
  ]);
  const ids = [];
  for (const r of rows || []) {
    const docs = Array.isArray(r.docs) ? r.docs : [];
    if (!docs.some((d) => d.status === "approved")) continue;
    for (const d of docs) if (d.status !== "approved") ids.push(d.id);
  }
  return ids;
}

function excludeShadow(match, ids) {
  if (Array.isArray(ids) && ids.length > 0) match._id = { $nin: ids };
  return match;
}

const WORKLOAD_GROUP = ["department", "academicYear"];
const DISTRIBUTION_GROUP = ["department", "academicYear", "course"];

module.exports = { shadowedIds, excludeShadow, WORKLOAD_GROUP, DISTRIBUTION_GROUP };
