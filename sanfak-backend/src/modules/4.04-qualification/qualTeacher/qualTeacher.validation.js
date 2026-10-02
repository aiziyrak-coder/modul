const Joi = require("joi");
const objectId = Joi.string().length(24).hex();

const addTeachersSchema = Joi.object({
  course: objectId.required(),
  teachers: Joi.array().items(objectId).min(1).required(),
});

const removeTeachersSchema = Joi.object({
  course: objectId.required(),
  teachers: Joi.array().items(objectId).min(1).required(),
});

module.exports = { addTeachersSchema, removeTeachersSchema };
