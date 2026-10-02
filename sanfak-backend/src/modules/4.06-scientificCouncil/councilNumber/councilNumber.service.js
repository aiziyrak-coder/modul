const CouncilNumber = require("./councilNumber.model");

const EXCLUDE = { __v: 0 };

const POPULATE = {
  path: "specialties",
  select: "title code branch active",
};

const buildFilter = ({ search, active, all }) => {
  const data = {};
  if (search) data.number = new RegExp(search, "i");
  if (active !== undefined) data.active = active;
  else if (!all) data.active = true;
  return data;
};

module.exports = {
  buildFilter,

  create: (body) => new CouncilNumber(body).save(),

  findAll: (filter) =>
    CouncilNumber.find(filter, EXCLUDE)
      .populate(POPULATE)
      .sort({ number: 1 })
      .exec(),

  paginate: (filter, { page, limit }) =>
    CouncilNumber.paginate(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      select: ["-__v"],
      populate: POPULATE,
      sort: { number: 1 },
    }),

  findOne: (id) =>
    CouncilNumber.findById(id, EXCLUDE).populate(POPULATE).exec(),

  update: (id, body) =>
    CouncilNumber.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    })
      .populate(POPULATE)
      .exec(),

  remove: (id) => CouncilNumber.findByIdAndDelete(id).exec(),

  findActiveConflicts: (specialtyIds, exceptId) => {
    const query = { active: true, specialties: { $in: specialtyIds } };
    if (exceptId) query._id = { $ne: exceptId };
    return CouncilNumber.find(query, { number: 1, specialties: 1 })
      .populate({ path: "specialties", select: "code" })
      .exec();
  },

  takenSpecialtyIds: (exceptId) => {
    const query = { active: true };
    if (exceptId) query._id = { $ne: exceptId };
    return CouncilNumber.distinct("specialties", query);
  },
};
