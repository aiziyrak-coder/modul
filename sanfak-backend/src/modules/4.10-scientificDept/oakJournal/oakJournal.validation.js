const Joi = require("joi");
const { optionalString } = require("#validators/common");

const JOURNAL_TYPES = ["scopus", "wos", "nationalOak", "foreignOak"];

const createJournalSchema = Joi.object({
  name: Joi.string().trim().min(2).max(300).required(),
  type: Joi.string()
    .valid(...JOURNAL_TYPES)
    .required(),
});

const updateJournalSchema = Joi.object({
  name: Joi.string().trim().min(2).max(300),
  type: Joi.string().valid(...JOURNAL_TYPES),
  active: Joi.boolean(),
}).min(1);

const journalQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  type: optionalString(Joi.string().valid(...JOURNAL_TYPES)),
  active: Joi.boolean().optional(),
});

const journalPaginateSchema = journalQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  JOURNAL_TYPES,
  createJournalSchema,
  updateJournalSchema,
  journalQuerySchema,
  journalPaginateSchema,
};
