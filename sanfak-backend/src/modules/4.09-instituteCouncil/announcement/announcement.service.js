const Announcement = require("./announcement.model");
const { escapeRegex } = require("#shared/searchFilter");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");

const EXCLUDE = { updatedAt: 0 };
const POPULATE = ["createdBy"];

const applyPopulate = (query) => {
  POPULATE.forEach((p) => {
    query = query.populate(p);
  });
  return query;
};

const buildFilter = ({ search, recipientGroup, from, to }) => {
  const data = {};
  if (search) {
    const rgx = { $regex: new RegExp(escapeRegex(search), "i") };
    data.$or = [{ title: rgx }, { content: rgx }];
  }
  if (recipientGroup) data.recipientGroup = recipientGroup;
  if (from || to) {
    const createdAt = {};
    if (from) createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    data.createdAt = createdAt;
  }
  return data;
};

module.exports = {
  buildFilter,

  create: (body) => new Announcement(body).save(),

  findAll: (filter) => applyPopulate(Announcement.find(filter, EXCLUDE)).exec(),

  paginate: (filter, query) => {
    const { page, limit } = normalizePageParams(query);
    return Announcement.paginate(filter, {
      limit,
      page,
      select: ["-updatedAt"],
      populate: POPULATE,
      sort: withTiebreaker({ createdAt: -1 }),
    });
  },

  findOne: (id) => applyPopulate(Announcement.findById(id, EXCLUDE)).exec(),

  remove: (id) => Announcement.findByIdAndDelete(id),
};
