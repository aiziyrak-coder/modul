const OrgType = require("./orgType.model");
const { escapeRegex } = require("#shared/searchFilter");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };

const buildFilter = ({ search, active }) => {
  const data = {};
  if (search) data.title = { $regex: new RegExp(escapeRegex(search), "i") };
  if (active !== undefined) data.active = active;
  return data;
};

module.exports = {
  buildFilter,

  create: (body) => new OrgType(body).save(),

  findAll: (filter) => OrgType.find(filter, EXCLUDE).sort({ title: 1 }).exec(),

  paginate: (filter, { page, limit }) =>
    OrgType.paginate(filter, {
      limit: parseInt(limit),
      page: parseInt(page),
      select: ["-createdAt", "-updatedAt"],
      sort: { title: 1 },
    }),

  findOne: (id) => OrgType.findById(id, EXCLUDE).exec(),

  update: (id, body) => OrgType.findByIdAndUpdate(id, body, { new: true }),

  remove: (id) => OrgType.findByIdAndDelete(id),
};
