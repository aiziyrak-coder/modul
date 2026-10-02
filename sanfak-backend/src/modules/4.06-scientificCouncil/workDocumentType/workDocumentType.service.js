const WorkDocumentType = require("./workDocumentType.model");

const EXCLUDE = { __v: 0 };

const buildFilter = ({ search, active, all }) => {
  const data = {};
  if (search) {
    const re = new RegExp(search, "i");
    data.$or = [{ labelUz: re }, { labelRu: re }, { key: re }, { format: re }];
  }
  if (active !== undefined) data.active = active;
  else if (!all) data.active = true;
  return data;
};

module.exports = {
  buildFilter,

  create: (body) => new WorkDocumentType(body).save(),

  findAll: (filter) =>
    WorkDocumentType.find(filter, EXCLUDE).sort({ order: 1, labelUz: 1 }).exec(),

  paginate: (filter, { page, limit }) =>
    WorkDocumentType.paginate(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      select: ["-__v"],
      sort: { order: 1, labelUz: 1 },
    }),

  findOne: (id) => WorkDocumentType.findById(id, EXCLUDE).exec(),

  update: (id, body) =>
    WorkDocumentType.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).exec(),

  remove: (id) => WorkDocumentType.findByIdAndDelete(id).exec(),
};
