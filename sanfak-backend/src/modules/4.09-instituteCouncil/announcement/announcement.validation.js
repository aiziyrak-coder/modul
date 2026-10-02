const Joi = require("joi");
const { optionalString } = require("#validators/common");

const RECIPIENT_GROUP = ["all", "professors", "dotsents", "deptHeads"];

const announcementSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().required(),
  recipientGroup: Joi.string()
    .valid(...RECIPIENT_GROUP)
    .required(),
  fileUrl: optionalString(),
  media: Joi.any().optional(),
  active: Joi.boolean().optional(),
});

const findAnnouncementsSchema = Joi.object({
  search: optionalString(),
  recipientGroup: optionalString(Joi.string().valid(...RECIPIENT_GROUP)),
});

const paginateAnnouncementsSchema = findAnnouncementsSchema.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
});

module.exports = {
  announcementSchema,
  findAnnouncementsSchema,
  paginateAnnouncementsSchema,
};
