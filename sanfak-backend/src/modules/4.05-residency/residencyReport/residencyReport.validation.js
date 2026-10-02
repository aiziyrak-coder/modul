const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");

exports.reportQuery = Joi.object({
  academicYear: optionalString(
    Joi.alternatives().try(
      Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId"),
      Joi.string().regex(/^\d{4}-\d{4}$/, "YYYY-YYYY"),
    ),
  ),
  specialty: optionalObjectId(objectId),
  program: optionalString(Joi.string().valid("magistratura", "ordinatura")),
  language: optionalString(),
});
