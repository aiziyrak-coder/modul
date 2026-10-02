require("#modules/4.05-residency/residencySpecialty/residencySpecialty.model");
require("#references/department/department.model");
require("#references/group/group.model");

const RESIDENT_REF_POPULATE = [
  { path: "specialty", select: "title" },
  { path: "department", select: "title name" },
  { path: "group", select: "title name" },
];

module.exports = { RESIDENT_REF_POPULATE };
