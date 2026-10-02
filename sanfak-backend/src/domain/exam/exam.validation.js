"use strict";
const Joi = require("joi");
const { optionalObjectId, academicYearInput } = require("#validators/common");

const objectId = Joi.string().hex().length(24);

const createExamSchema = Joi.object({
  groups:       Joi.array().items(objectId).min(1).required(),
  science:      objectId.required(),
  teacher:      objectId.required(),
  faculty:      optionalObjectId(objectId),
  department:   optionalObjectId(objectId),
  room:         optionalObjectId(objectId),
  examType:     Joi.string().valid("midterm", "final", "retake", "state", "defense").required(),
  date:         Joi.date().iso().required(),
  startTime:    Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null, "").optional(),
  duration:     Joi.number().integer().min(30).max(480).optional(),
  academicYear: academicYearInput.required(),
  semester:     Joi.number().integer().min(1).max(16).required(),
  note:         Joi.string().max(500).allow(null, "").optional(),
});

const updateExamSchema = Joi.object({
  groups:       Joi.array().items(objectId).min(1).optional(),
  science:      objectId.optional(),
  teacher:      objectId.optional(),
  faculty:      optionalObjectId(objectId),
  department:   optionalObjectId(objectId),
  room:         optionalObjectId(objectId),
  examType:     Joi.string().valid("midterm", "final", "retake", "state", "defense").optional(),
  date:         Joi.date().iso().optional(),
  startTime:    Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null, "").optional(),
  duration:     Joi.number().integer().min(30).max(480).optional(),
  academicYear: academicYearInput.optional(),
  semester:     Joi.number().integer().min(1).max(16).optional(),
  note:         Joi.string().max(500).allow(null, "").optional(),
}).min(1);

const statusSchema = Joi.object({
  status: Joi.string()
    .valid("scheduled", "ongoing", "completed", "cancelled", "postponed")
    .required(),
});

const resultItemSchema = Joi.object({
  studentId:   objectId.required(),
  grade:       Joi.number().min(0).max(100).allow(null).optional(),
  letterGrade: Joi.string().valid("A", "B+", "B", "C+", "C", "D", "F").allow(null).optional().empty(""),
  passed:      Joi.boolean().allow(null).optional(),
  absent:      Joi.boolean().optional(),
  note:        Joi.string().max(300).allow(null, "").optional(),
});

const enterResultsSchema = Joi.object({
  results: Joi.array().items(resultItemSchema).min(1).required(),
});

const updateResultSchema = Joi.object({
  grade:       Joi.number().min(0).max(100).allow(null).optional(),
  letterGrade: Joi.string().valid("A", "B+", "B", "C+", "C", "D", "F").allow(null).optional().empty(""),
  passed:      Joi.boolean().allow(null).optional(),
  absent:      Joi.boolean().optional(),
  note:        Joi.string().max(300).allow(null, "").optional(),
}).min(1);

const querySchema = Joi.object({
  group:        objectId.optional(),
  science:      objectId.optional(),
  teacher:      objectId.optional(),
  faculty:      objectId.optional(),
  academicYear: Joi.string().optional(),
  semester:     Joi.number().integer().min(1).max(16).optional(),
  examType:     Joi.string().valid("midterm", "final", "retake", "state", "defense").optional(),
  status:       Joi.string().valid("scheduled", "ongoing", "completed", "cancelled", "postponed").optional(),
  dateFrom:     Joi.date().iso().optional(),
  dateTo:       Joi.date().iso().optional(),
});

const paginateSchema = querySchema.append({
  page:  Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

module.exports = {
  createExamSchema,
  updateExamSchema,
  statusSchema,
  enterResultsSchema,
  updateResultSchema,
  querySchema,
  paginateSchema,
};
