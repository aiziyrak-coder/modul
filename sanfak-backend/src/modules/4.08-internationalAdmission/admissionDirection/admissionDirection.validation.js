const Joi = require("joi");
const {
  langFields,
  langFieldsOptional,
  idParam,
  baseQuery,
  withPagination,
} = require("../lib/commonValidation");

const createSchema = Joi.object({
  ...langFields("title", { min: 2, max: 300 }),
});

const updateSchema = Joi.object({
  ...langFieldsOptional("title", { max: 300 }),
}).min(1);

const findAll = baseQuery;
const paginate = withPagination(baseQuery);

module.exports = {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema: idParam,
  deleteSchema: idParam,
};
