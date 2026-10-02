const Joi = require("joi");
const { optionalObjectId } = require("#validators/common");

const createTeacherLeaveSchema = Joi.object({
  teacher:        optionalObjectId(),
  type:           Joi.string().valid("leave", "resignation", "transfer").required().messages({
    "any.required": "type majburiy",
    "any.only":     "type: leave | resignation | transfer bo'lishi kerak",
  }),
  reason:         Joi.string().trim().min(3).max(1000).required().messages({
    "any.required":  "Sabab majburiy",
    "string.empty":  "Sabab majburiy",
    "string.min":    "Sabab kamida 3 ta belgi bo'lishi kerak",
    "string.max":    "Sabab 1000 belgidan oshmasligi kerak",
  }),
  distribution:   optionalObjectId(),
  teacherEntryId: optionalObjectId(),
  fromDate:       Joi.date().iso().required().messages({
    "any.required": "Boshlanish sanasi majburiy",
    "date.base":    "Boshlanish sanasi noto'g'ri formatda",
    "date.format":  "Boshlanish sanasi ISO formatda bo'lishi kerak",
  }),
  toDate:         Joi.when("type", {
    is: "leave",
    then: Joi.date().iso().min(Joi.ref("fromDate")).required(),
    otherwise: Joi.date().iso().min(Joi.ref("fromDate")).optional().allow(null),
  }).messages({
    "any.required": "Ta'til uchun tugash sanasi majburiy",
    "date.base":    "Tugash sanasi noto'g'ri formatda",
    "date.format":  "Tugash sanasi ISO formatda bo'lishi kerak",
    "date.min":     "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas",
  }),
});

const approveTeacherLeaveSchema = Joi.object({
  comment:      Joi.string().optional().allow("", null),
  distribution: optionalObjectId(),
  signature:    Joi.string().optional().allow("", null),
});

module.exports = { createTeacherLeaveSchema, approveTeacherLeaveSchema };
