"use strict";

async function getGroupStats(groupIds = []) {
  if (!groupIds.length) {
    return { studentCount: 0, groupCount: 0, streamCount: 0 };
  }

  const GroupModel = require("#references/group/group.model");
  const groups = await GroupModel.find(
    { _id: { $in: groupIds }, active: true },
    { studentNumber: 1, lang: 1 },
  );

  const langSet = new Set(
    groups.map((g) => (g.lang ? String(g.lang) : null)).filter(Boolean),
  );

  return {
    studentCount: groups.reduce((s, g) => s + (g.studentNumber || 0), 0),
    groupCount: groups.length,
    streamCount: langSet.size,
  };
}

module.exports = { getGroupStats };
