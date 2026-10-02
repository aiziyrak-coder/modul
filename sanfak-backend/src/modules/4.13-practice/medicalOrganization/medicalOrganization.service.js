const MedicalOrganization = require("./medicalOrganization.model");
const { escapeRegex } = require("#shared/searchFilter");

const EXCLUDE = { updatedAt: 0 };
const POPULATE = [
  { path: "orgType", select: "title" },
  { path: "region", select: "title" },
  { path: "district", select: "title" },
  {
    path: "responsibleUsers",
    select: "firstName lastName position",
    populate: { path: "position", select: "title", strictPopulate: false },
  },
];

const ALLOWED = [
  "title",
  "orgType",
  "stir",
  "region",
  "district",
  "address",
  "headName",
  "headJshshir",
  "headPhone",
  "email",
  "capacity",
  "active",
  "responsibleUsers",
];

const pick = (body = {}) => {
  const out = {};
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k];
  return out;
};

const buildFilter = ({ search, active, orgType, region, district }) => {
  const data = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    data.$or = [{ title: rx }, { stir: rx }, { headName: rx }];
  }
  if (active !== undefined) data.active = active;
  if (orgType) data.orgType = orgType;
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

  create: (body) => new MedicalOrganization(body).save(),

  findAll: (filter) =>
    applyPopulate(MedicalOrganization.find(filter, EXCLUDE))
      .sort({ createdAt: -1 })
      .exec(),

  paginate: (filter, { page, limit }) =>
    MedicalOrganization.paginate(filter, {
      limit: parseInt(limit),
      page: parseInt(page),
      select: ["-createdAt", "-updatedAt"],
      populate: POPULATE,
      sort: { createdAt: -1 },
    }),

  findOne: (id) =>
    applyPopulate(MedicalOrganization.findById(id, EXCLUDE)).exec(),

  update: (id, body) =>
    MedicalOrganization.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }),

  remove: (id) => MedicalOrganization.findByIdAndDelete(id),
};
