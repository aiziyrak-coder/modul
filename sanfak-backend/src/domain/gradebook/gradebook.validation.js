"use strict";
const Joi = require("joi");
const { optionalObjectId, optionalEnum, academicYearInput } = require("#validators/common");

const objectId = Joi.string().hex().length(24);

const entrySchema = Joi.object({
  student:    objectId.required(),
  attendance: optionalEnum(Joi.string().valid("present", "absent", "late", "excused")),
  grade:      Joi.number().min(0).max(100).allow(null).optional(),
  note:       Joi.string().max(300).allow(null, "").optional(),
});

const lessonSchema = Joi.object({
  date:       Joi.date().iso().required(),
  topic:      Joi.string().max(300).allow(null, "").optional(),
  lessonType: optionalEnum(Joi.string().valid("lecture", "seminar", "laboratory", "practical", "independent")),
  hours:      Joi.number().integer().min(1).max(8).optional(),
  entries:    Joi.array().items(entrySchema).optional(),
});

const createGradebookSchema = Joi.object({
  group:        objectId.required(),
  science:      objectId.required(),
  teacher:      objectId.required(),
  faculty:      optionalObjectId(objectId),
  department:   optionalObjectId(objectId),
  academicYear: academicYearInput.required(),
  semester:     Joi.number().integer().min(1).max(16).required(),
  lessonType:   optionalEnum(Joi.string().valid("lecture", "seminar", "laboratory", "practical")),
  totalHours:   Joi.number().min(0).optional(),
  note:         Joi.string().max(500).allow(null, "").optional(),
});

const addLessonSchema = lessonSchema;

const updateLessonSchema = Joi.object({
  date:       Joi.date().iso().optional(),
  topic:      Joi.string().max(300).allow(null, "").optional(),
  lessonType: optionalEnum(Joi.string().valid("lecture", "seminar", "laboratory", "practical", "independent")),
  hours:      Joi.number().integer().min(1).max(8).optional(),
  entries:    Joi.array().items(entrySchema).optional(),
}).min(1);

const summaryItemSchema = Joi.object({
  studentId:   objectId.required(),
  midterm:     Joi.number().min(0).max(100).allow(null).optional(),
  final:       Joi.number().min(0).max(100).allow(null).optional(),
  overall:     Joi.number().min(0).max(100).allow(null).optional(),
  letterGrade: Joi.string().valid("A", "B+", "B", "C+", "C", "D", "F").allow(null).optional().empty(""),
  passed:      Joi.boolean().allow(null).optional(),
});

const updateSummarySchema = Joi.object({
  summaryData: Joi.array().items(summaryItemSchema).min(1).required(),
});

const querySchema = Joi.object({
  group:        objectId.optional(),
  science:      objectId.optional(),
  teacher:      objectId.optional(),
  faculty:      objectId.optional(),
  academicYear: Joi.string().optional(),
  semester:     Joi.number().integer().min(1).max(16).optional(),
  status:       Joi.string().valid("active", "closed").optional(),
  lessonType:   Joi.string().valid("lecture", "seminar", "laboratory", "practical").optional(),
});

const paginateSchema = querySchema.append({
  page:  Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

module.exports = {
  createGradebookSchema,
  addLessonSchema,
  updateLessonSchema,
  updateSummarySchema,
  querySchema,
  paginateSchema,
};
