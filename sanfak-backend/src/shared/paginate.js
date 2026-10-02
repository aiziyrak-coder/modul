const { PAGINATION } = require("../config/constants");

const getPaginationOptions = (query) => {
  const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(
    parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );

  return {
    page,
    limit,
    select: ["-__v"],
    sort: { createdAt: -1 },
  };
};

const buildSearchQuery = (search, fields) => {
  if (!search) return {};

  const searchRegex = { $regex: new RegExp(search, "i") };
  return {
    $or: fields.map((field) => ({ [field]: searchRegex })),
  };
};

const withTiebreaker = (sort, tiebreakerField = "_id") => {
  if (!sort || typeof sort !== "object" || Array.isArray(sort)) return sort;
  if (Object.prototype.hasOwnProperty.call(sort, tiebreakerField)) return sort;

  const keys = Object.keys(sort);
  if (!keys.length) return sort;

  const primaryDirection = sort[keys[0]];
  return { ...sort, [tiebreakerField]: primaryDirection };
};

const normalizePageParams = (
  { page, limit } = {},
  {
    defaultPage = PAGINATION.DEFAULT_PAGE,
    defaultLimit = PAGINATION.DEFAULT_LIMIT,
    maxLimit = PAGINATION.MAX_LIMIT,
  } = {},
) => {
  const parsedPage = parseInt(page, 10);
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : defaultPage;

  const parsedLimit = parseInt(limit, 10);
  const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;

  return { page: safePage, limit: Math.min(safeLimit, maxLimit) };
};

const buildPaginateOptions = (
  query = {},
  {
    sort = { createdAt: -1 },
    tiebreakerField,
    populate,
    lean = true,
    maxLimit,
    defaultLimit,
    defaultPage,
  } = {},
) => {
  const { page, limit } = normalizePageParams(query, { maxLimit, defaultLimit, defaultPage });
  const options = { page, limit, sort: withTiebreaker(sort, tiebreakerField), lean };
  if (populate) options.populate = populate;
  return options;
};

module.exports = {
  getPaginationOptions,
  buildSearchQuery,
  withTiebreaker,
  normalizePageParams,
  buildPaginateOptions,
};
