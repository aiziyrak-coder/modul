const PracticeStudent = require("./student.model");
const { escapeRegex } = require("#shared/searchFilter");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = [
  { path: "academicYear", select: "title" },
  { path: "direction", select: "title" },
  { path: "region", select: "title" },
  { path: "district", select: "title" },
];

const ALLOWED = [
  "fish",
  "academicYear",
  "direction",
  "course",
  "group",
  "region",
  "district",
  "active",
];

const pick = (body = {}) => {
  const out = {};
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k];
  return out;
};

const buildFilter = ({
  search,
  active,
  academicYear,
  direction,
  course,
  region,
  district,
}) => {
  const data = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    data.$or = [{ fish: rx }, { group: rx }];
  }
  if (active !== undefined) data.active = active;
  if (academicYear) data.academicYear = academicYear;
  if (direction) data.direction = direction;
  if (course) data.course = course;
  if (region) data.region = region;
  if (district) data.district = district;
  return data;
};

const applyPopulate = (query) => {
  POPULATE.forEach((p) => {
    query = query.populate(p);
  });
  return query;
};

module.exports = {
  buildFilter,
  pick,

  create: (body) => new PracticeStudent(body).save(),

  findAll: (filter) =>
    applyPopulate(PracticeStudent.find(filter, EXCLUDE))
      .sort({ createdAt: -1 })
      .exec(),

  paginate: (filter, { page, limit }) =>
    PracticeStudent.paginate(filter, {
      limit: parseInt(limit),
      page: parseInt(page),
      select: ["-createdAt", "-updatedAt"],
      populate: POPULATE,
      sort: { createdAt: -1 },
    }),

  findOne: (id) => applyPopulate(PracticeStudent.findById(id, EXCLUDE)).exec(),

  update: (id, body) =>
    PracticeStudent.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }),

  remove: (id) => PracticeStudent.findByIdAndDelete(id),

  bulkCourseTransfer: (studentIds, toCourse) =>
    PracticeStudent.updateMany(
      { _id: { $in: studentIds } },
      { $set: { course: toCourse } },
    ),
};
