const Joi = require("joi");
const {
  langFields,
  langFieldsOptional,
  idParam,
  baseQuery,
  withPagination,
} = require("../lib/commonValidation");

const createSchema = Joi.object({
  ...langFields("title", { min: 2, max: 120 }),
  passportSample: Joi.string().trim().max(60).allow("", null).optional(),
  phoneSample: Joi.string().trim().max(60).allow("", null).optional(),
  media: Joi.any().optional(),
});

const updateSchema = Joi.object({
  ...langFieldsOptional("title", { max: 120 }),
  passportSample: Joi.string().trim().max(60).allow("", null),
  phoneSample: Joi.string().trim().max(60).allow("", null),
  media: Joi.any(),
  flagUrl: Joi.string().allow("").max(500),
}).min(1);

module.exports = {
  createSchema,
  updateSchema,
  findAll: baseQuery,
  paginate: withPagination(baseQuery),
  readSchema: idParam,
  deleteSchema: idParam,
};
