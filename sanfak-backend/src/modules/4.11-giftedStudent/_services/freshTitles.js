const FacultyModel = require("#references/faculty/faculty.model");
const DirectionModel = require("#references/direction/direction.model");
const GroupModel = require("#references/group/group.model");

const REF_FIELDS = [
  { ref: "facultyId", snapshot: "faculty", model: FacultyModel },
  { ref: "directionId", snapshot: "direction", model: DirectionModel },
  { ref: "groupId", snapshot: "group", model: GroupModel },
];

const applyFreshTitles = async (input) => {
  if (!input) return input;
  const docs = (Array.isArray(input) ? input : [input]).filter(
    (d) => d && typeof d === "object",
  );
  if (!docs.length) return input;

  for (const { ref, snapshot, model } of REF_FIELDS) {
    const ids = [...new Set(docs.map((d) => d[ref]).filter(Boolean).map(String))];
    if (!ids.length) continue;

    const rows = await model.find({ _id: { $in: ids } }).select("title").lean();
    const titleById = new Map(rows.map((r) => [String(r._id), r.title]));

    for (const doc of docs) {
      const id = doc[ref];
      if (!id) continue;
      const title = titleById.get(String(id));
      if (title) doc[snapshot] = title;
    }
  }
  return input;
};

module.exports = { applyFreshTitles, REF_FIELDS };
