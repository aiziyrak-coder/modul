const Joi = require("joi");
const {
  langFields,
  langFieldsOptional,
  idParam,
  baseQuery,
  withPagination,
} = require("../lib/commonValidation");

const createSchema = Joi.object({
  ...langFields("title", { min: 2, max: 200 }),
  ...langFields("description", { required: false, max: 1000 }),
});

const updateSchema = Joi.object({
  ...langFieldsOptional("title", { max: 200 }),
  ...langFieldsOptional("description", { max: 1000 }),
}).min(1);

module.exports = {
  createSchema,
  updateSchema,
  findAll: baseQuery,
  paginate: withPagination(baseQuery),
  readSchema: idParam,
  deleteSchema: idParam,
};
