const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const memberSchema = Joi.object({
  user: Joi.string().required(),
  department: optionalObjectId(),
  position: Joi.any().strip(),
  academicTitle: Joi.any().strip(),
  canVote: Joi.boolean().optional(),
  role: Joi.string().allow("", null).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  active: Joi.boolean().optional(),
});

const updateMemberSchema = Joi.object({
  user: Joi.string().optional(),
  department: optionalObjectId(),
  position: Joi.any().strip(),
  academicTitle: Joi.any().strip(),
  canVote: Joi.boolean().optional(),
  role: Joi.string().allow("", null).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  active: Joi.boolean().optional(),
});

const toggleVoteSchema = Joi.object({
  canVote: Joi.boolean().required(),
});

const objectIdFilter = () => optionalObjectId(Joi.string().hex().length(24));

const findMembersSchema = Joi.object({
  search: optionalString(),
  department: optionalObjectId(),
  position: objectIdFilter(),
  academicTitle: objectIdFilter(),
  canVote: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
});

const paginateMembersSchema = findMembersSchema.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const userOptionsSchema = Joi.object({
  department: optionalObjectId(Joi.string().hex().length(24)),
});

module.exports = {
  memberSchema,
  updateMemberSchema,
  toggleVoteSchema,
  findMembersSchema,
  paginateMembersSchema,
  userOptionsSchema,
};
