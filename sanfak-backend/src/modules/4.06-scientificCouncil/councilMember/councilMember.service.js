const CouncilMember = require("./councilMember.model");
const {
  specialtyCondition,
} = require("#modules/4.06-scientificCouncil/_shared/councilSpecialties");

const EXCLUDE = { __v: 0 };

const POPULATE = [
  {
    path: "user",
    select: "firstName lastName photo email phone position academicTitle",
    populate: [
      { path: "position", select: "title" },
      { path: "academicTitle", select: "title" },
    ],
  },
  { path: "specialties", select: "title code branch" },
];

const applyPopulate = (query) => {
  POPULATE.forEach((p) => query.populate(p));
  return query;
};

const buildFilter = ({ scope, search, active, all, specialty, specialtyIds }) => {
  const data = { ...(scope || {}) };
  if (search) {
    const re = new RegExp(search, "i");
    data.$or = [
      { degree: re },
      { organization: re },
      { "external.name": re },
      { "external.workplace": re },
    ];
  }
  if (!all && active === undefined) data.active = true;
  if (active !== undefined) data.active = active;
  const specialtyCond = specialtyCondition(specialty, specialtyIds);
  if (specialtyCond !== undefined) data.specialties = specialtyCond;
  return data;
};

module.exports = {
  buildFilter,

  create: (body) => new CouncilMember(body).save(),

  findAll: (filter) =>
    applyPopulate(CouncilMember.find(filter, EXCLUDE)).exec(),

  paginate: (filter, { page, limit }) =>
    CouncilMember.paginate(filter, {
      limit: parseInt(limit),
      page: parseInt(page),
      select: ["-__v"],
      populate: POPULATE,
    }),

  findOne: (id) =>
    applyPopulate(CouncilMember.findById(id, EXCLUDE)).exec(),

  findByUser: (userId) =>
    applyPopulate(CouncilMember.findOne({ user: userId }, EXCLUDE)).exec(),

  update: (id, body) =>
    CouncilMember.findByIdAndUpdate(id, body, { new: true })
      .populate(POPULATE)
      .exec(),

  remove: (id) => CouncilMember.findByIdAndDelete(id).exec(),

  incrementAssigned: async (memberId) => {
    const member = await CouncilMember.findById(memberId).exec();
    if (!member) return null;
    member.assignedCount = (member.assignedCount || 0) + 1;
    return member.save();
  },
};
