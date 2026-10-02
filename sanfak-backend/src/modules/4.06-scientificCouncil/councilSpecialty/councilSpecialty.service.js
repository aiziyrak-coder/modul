const CouncilSpecialty = require("./councilSpecialty.model");

const EXCLUDE = { __v: 0 };

const buildFilter = ({ search, active, all }) => {
  const data = {};
  if (search) {
    const re = new RegExp(search, "i");
    data.$or = [{ title: re }, { code: re }, { branch: re }];
  }
  if (active !== undefined) data.active = active;
  else if (!all) data.active = true;
  return data;
};

module.exports = {
  buildFilter,

  create: (body) => new CouncilSpecialty(body).save(),

  findAll: (filter) =>
    CouncilSpecialty.find(filter, EXCLUDE).sort({ code: 1 }).exec(),

  paginate: (filter, { page, limit }) =>
    CouncilSpecialty.paginate(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      select: ["-__v"],
      sort: { code: 1 },
    }),

  findOne: (id) => CouncilSpecialty.findById(id, EXCLUDE).exec(),

  update: (id, body) =>
    CouncilSpecialty.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).exec(),

  remove: (id) => CouncilSpecialty.findByIdAndDelete(id).exec(),
};
