const mongoose = require("mongoose");
const CouncilMember = require("./councilMember.model");
const { ROLES } = require("#config/constants");
const { escapeRegex } = require("#shared/searchFilter");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };

const NON_TEACHING_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.TALABA,
  ROLES.REZIDENT,
  ROLES.TINGLOVCHI,
  ROLES.KADRLAR,
  ROLES.REJA_MOLIYA,
  ROLES.ARM,
].filter(Boolean);

const POPULATE = [
  {
    path: "user",
    populate: [
      { path: "position", select: "title" },
      { path: "academicTitle", select: "title" },
    ],
  },
  "department",
];

const applyPopulate = (query) => {
  POPULATE.forEach((p) => {
    query = query.populate(p);
  });
  return query;
};

const buildFilter = async ({
  search,
  department,
  position,
  academicTitle,
  canVote,
  active,
}) => {
  const data = {};
  const userConditions = [];

  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const positions = await mongoose
      .model("position")
      .find({ title: rx })
      .select("_id")
      .lean();
    userConditions.push({
      $or: [
        { firstName: rx },
        { lastName: rx },
        { middleName: rx },
        ...(positions.length
          ? [{ position: { $in: positions.map((p) => p._id) } }]
          : []),
      ],
    });
  }
  if (position) userConditions.push({ position });
  if (academicTitle) userConditions.push({ academicTitle });

  if (userConditions.length) {
    const users = await mongoose
      .model("user")
      .find({ $and: userConditions })
      .select("_id")
      .lean();
    data.user = { $in: users.map((u) => u._id) };
  }

  if (department) data.department = department;
  if (typeof canVote === "boolean") data.canVote = canVote;
  if (typeof active === "boolean") data.active = active;
  return data;
};

module.exports = {
  buildFilter,

  create: (body) => new CouncilMember(body).save(),

  findAll: (filter) => applyPopulate(CouncilMember.find(filter, EXCLUDE)).exec(),

  paginate: (filter, query) => {
    const { page, limit } = normalizePageParams(query);
    return CouncilMember.paginate(filter, {
      limit,
      page,
      select: ["-createdAt", "-updatedAt"],
      populate: POPULATE,
      sort: withTiebreaker({ createdAt: -1 }),
    });
  },

  findOne: (id) => applyPopulate(CouncilMember.findById(id, EXCLUDE)).exec(),

  update: (id, body) => CouncilMember.findByIdAndUpdate(id, body, { new: true }),

  remove: (id) => CouncilMember.findByIdAndDelete(id),

  toggleVote: (id, canVote) =>
    CouncilMember.findByIdAndUpdate(id, { canVote }, { new: true }),

  userOptions: async (department) => {
    const excluded = await mongoose
      .model("role")
      .find({ title: { $in: NON_TEACHING_ROLES } })
      .select("_id")
      .lean();
    return mongoose
      .model("user")
      .find({
        active: true,
        ...(department && { department }),
        ...(excluded.length && { role: { $nin: excluded.map((r) => r._id) } }),
      })
      .select("firstName lastName middleName department position academicTitle")
      .populate("position", "title")
      .populate("academicTitle", "title")
      .sort({ lastName: 1 })
      .lean();
  },
};
