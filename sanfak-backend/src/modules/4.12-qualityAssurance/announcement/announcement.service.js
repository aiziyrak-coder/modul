const { escapeRegex } = require("#shared/searchFilter");
const Announcement = require("./announcement.model");

const AUTHOR_SELECT = "firstName lastName middleName";

const buildFilter = (search) => {
  const filter = { active: true };
  const term = String(search || "").trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), "i");
    filter.$or = [{ title: rx }, { content: rx }];
  }
  return filter;
};

module.exports = {
  buildFilter,

  list: (search) =>
    Announcement.find(buildFilter(search))
      .populate("author", AUTHOR_SELECT)
      .sort({ createdAt: -1 })
      .exec(),

  findById: (id) =>
    Announcement.findById(id).populate("author", AUTHOR_SELECT).exec(),

  create: async ({ title, content }, authorId) => {
    const doc = await new Announcement({ title, content, author: authorId }).save();
    return doc.populate("author", AUTHOR_SELECT);
  },

  update: (id, patch) =>
    Announcement.findByIdAndUpdate(id, patch, { new: true, runValidators: true })
      .populate("author", AUTHOR_SELECT)
      .exec(),

  remove: (id) => Announcement.findByIdAndDelete(id),
};
