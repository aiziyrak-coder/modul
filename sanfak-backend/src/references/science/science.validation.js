const Joi = require("joi");
const common = require("#validators/common");

const { optionalString } = common;

const createScienceSchema = Joi.object({
  title: Joi.string().required(),
  desc: Joi.string().optional().allow(null, ""),
  scienceCode: optionalString(),
  department: Joi.string().optional(),
  active: Joi.boolean().optional(),
  isElective: Joi.boolean().optional(),
});

const updateScienceSchema = Joi.object({
  title: Joi.string().optional(),
  desc: Joi.string().optional().allow(null, ""),
  department: Joi.string().optional(),
  scienceCode: optionalString(),
  active: Joi.boolean().optional(),
  isElective: Joi.boolean().optional(),
});

const findAllSciencesQuery = common.findAll.keys({ isElective: Joi.boolean().optional() });
const paginateSciencesQuery = common.paginate.keys({ isElective: Joi.boolean().optional() });

module.exports = {
  createScienceSchema,
  updateScienceSchema,
  findAllSciencesQuery,
  paginateSciencesQuery,
};
