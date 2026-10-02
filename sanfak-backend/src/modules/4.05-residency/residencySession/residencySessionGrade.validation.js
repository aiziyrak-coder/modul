const Joi = require("joi");
const { LESSON_SCORE_MAX } = require("#modules/4.05-residency/_services/lessonScore");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId");

const gradeParams = Joi.object({
  id: objectId.required(),
  resident: objectId.required(),
});

const gradeBody = Joi.object({
  score: Joi.number().min(0).max(LESSON_SCORE_MAX).allow(null).required(),
});

const residentParam = Joi.object({
  resident: objectId.required(),
});

module.exports = { gradeParams, gradeBody, residentParam };
