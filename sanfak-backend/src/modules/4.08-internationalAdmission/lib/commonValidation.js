const Joi = require("joi");

const langFields = (name, { required = true, min = 1, max = 300 } = {}) => {
  const suffixes = ["Uz", "Ru", "En"];
  const base = Joi.string().trim().min(min).max(max);
  return suffixes.reduce((acc, sfx) => {
    acc[`${name}${sfx}`] = required ? base.required() : base.allow("", null).optional();
    return acc;
  }, {});
};

const langFieldsOptional = (name, { max = 300 } = {}) =>
  ["Uz", "Ru", "En"].reduce((acc, sfx) => {
    acc[`${name}${sfx}`] = Joi.string().trim().max(max).allow("", null);
    return acc;
  }, {});

const idParam = Joi.object({ id: Joi.string().required() });

const baseQuery = Joi.object({
  search: Joi.string().allow("").optional(),
  active: Joi.boolean().optional(),
});

const withPagination = (schema) =>
  schema.keys({
    page: Joi.number().integer().min(1).required(),
    limit: Joi.number().integer().min(1).max(200).required(),
  });

module.exports = {
  langFields,
  langFieldsOptional,
  idParam,
  baseQuery,
  withPagination,
};
