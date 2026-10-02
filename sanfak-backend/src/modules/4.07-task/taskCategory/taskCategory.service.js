const { searchRegex } = require("#modules/4.07-task/_services/searchTerm");
const TaskCategory = require("./taskCategory.model");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };

const buildFilter = ({ search, active }) => {
  const filter = {};
  const rx = searchRegex(search);
  if (rx) filter.name = rx;
  if (active !== undefined) filter.active = active;
  return filter;
};

module.exports = {
  buildFilter,

  create: (body) => new TaskCategory(body).save(),

  findAll: (filter) => TaskCategory.find(filter, EXCLUDE).sort({ name: 1 }).exec(),

  paginate: (filter, { page, limit }) =>
    TaskCategory.paginate(filter, {
      limit: parseInt(limit),
      page: parseInt(page),
      select: ["-createdAt", "-updatedAt"],
      sort: { name: 1 },
    }),

  findOne: (id) => TaskCategory.findById(id, EXCLUDE).exec(),

  findByName: (name) => TaskCategory.findOne({ name }).exec(),

  update: (id, body) =>
    TaskCategory.findByIdAndUpdate(id, body, { new: true, runValidators: true }),

  remove: (id) => TaskCategory.findByIdAndDelete(id),
};
