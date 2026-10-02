"use strict";
const Joi = require("joi");
const { optionalObjectId, optionalEnum, academicYearInput } = require("#validators/common");

const objectId = Joi.string().hex().length(24);

const attendanceEntrySchema = Joi.object({
  student: objectId.required(),
  status:  Joi.string().valid("present", "absent", "late", "excused").required(),
  note:    Joi.string().max(300).optional().allow(null, ""),
});

const createAttendanceSchema = Joi.object({
  group:        objectId.required(),
  science:      optionalObjectId(objectId),
  teacher:      optionalObjectId(objectId),
  date:         Joi.date().iso().required(),
  lessonType:   optionalEnum(Joi.string().valid("lecture", "seminar", "laboratory", "practical", "independent")),
  academicYear: academicYearInput.optional().allow(null),
  semester:     Joi.number().integer().min(1).max(16).optional().allow(null),
  attendances:  Joi.array().items(attendanceEntrySchema).optional(),
  note:         Joi.string().max(500).optional().allow(null, ""),
});

const updateAttendanceSchema = Joi.object({
  date:         Joi.date().iso().optional(),
  lessonType:   optionalEnum(Joi.string().valid("lecture", "seminar", "laboratory", "practical", "independent")),
  academicYear: academicYearInput.optional().allow(null),
  semester:     Joi.number().integer().min(1).max(16).optional().allow(null),
  attendances:  Joi.array().items(attendanceEntrySchema).optional(),
  note:         Joi.string().max(500).optional().allow(null, ""),
});

const querySchema = Joi.object({
  group:        Joi.string().hex().length(24).optional(),
  science:      Joi.string().hex().length(24).optional(),
  academicYear: Joi.string().max(20).optional(),
  semester:     Joi.number().integer().min(1).max(16).optional(),
  fromDate:     Joi.date().iso().optional(),
  toDate:       Joi.date().iso().optional(),
  page:         Joi.number().integer().min(1).optional(),
  limit:        Joi.number().integer().min(1).max(100).optional(),
});

module.exports = {
  createAttendanceSchema,
  updateAttendanceSchema,
  querySchema,
};
