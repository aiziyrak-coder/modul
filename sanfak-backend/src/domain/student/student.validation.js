"use strict";
const Joi = require("joi");
const { optionalObjectId, optionalEnum } = require("#validators/common");

const createStudentSchema = Joi.object({
  firstName:  Joi.string().trim().min(2).max(60).required(),
  lastName:   Joi.string().trim().min(2).max(60).required(),
  middleName: Joi.string().trim().max(60).optional().allow("", null),

  photo:     Joi.string().uri().optional().allow(null, ""),
  birthDate: Joi.date().iso().optional().allow(null),
  gender:    optionalEnum(Joi.string().valid("male", "female")),

  passportSeries:   Joi.string().max(5).optional().allow(null, ""),
  passportNumber:   Joi.string().max(10).optional().allow(null, ""),
  passportIssuedBy: Joi.string().max(200).optional().allow(null, ""),
  passportIssuedAt: Joi.date().iso().optional().allow(null),
  passportExpiry:   Joi.date().iso().optional().allow(null),
  jshshir:          Joi.string().length(14).pattern(/^\d+$/).optional().allow(null, ""),

  phone: Joi.string().max(20).optional().allow(null, ""),
  email: Joi.string().email().optional().allow(null, ""),
  address: Joi.object({
    region:   Joi.string().max(100).optional().allow(null, ""),
    district: Joi.string().max(100).optional().allow(null, ""),
    street:   Joi.string().max(200).optional().allow(null, ""),
  }).optional(),

  studentId:    Joi.string().max(20).optional().allow(null),
  group:        Joi.string().hex().length(24).optional().allow(null),
  faculty:      Joi.string().hex().length(24).optional().allow(null),
  direction:    Joi.string().hex().length(24).optional().allow(null),
  course:       Joi.number().integer().min(1).max(8).optional(),
  semester:     Joi.number().integer().min(1).max(16).optional(),
  enrollmentYear: Joi.number().integer().min(2000).max(2100).optional().allow(null),

  studyType:     optionalEnum(Joi.string().valid("grant", "contract")),
  educationForm: optionalEnum(Joi.string().valid("kunduzgi", "kechki", "sirtqi", "masofaviy")),
  status:        optionalEnum(Joi.string().valid("active", "leave", "expelled", "graduated", "transferred")),

  user:   optionalObjectId(Joi.string().hex().length(24)),
  active: Joi.boolean().optional(),
});

const updateStudentSchema = createStudentSchema.fork(
  ["firstName", "lastName"],
  (f) => f.optional(),
);

const changeStatusSchema = Joi.object({
  status: Joi.string()
    .valid("active", "leave", "expelled", "graduated", "transferred")
    .required(),
  reason: Joi.string().max(500).optional().allow(null, ""),
});

const querySchema = Joi.object({
  group:         Joi.string().hex().length(24).optional(),
  faculty:       Joi.string().hex().length(24).optional(),
  direction:     Joi.string().hex().length(24).optional(),
  course:        Joi.number().integer().min(1).max(8).optional(),
  semester:      Joi.number().integer().min(1).max(16).optional(),
  status:        Joi.string().valid("active", "leave", "expelled", "graduated", "transferred").optional(),
  studyType:     Joi.string().valid("grant", "contract").optional(),
  educationForm: Joi.string().valid("kunduzgi", "kechki", "sirtqi", "masofaviy").optional(),
  search:        Joi.string().max(100).optional(),
  active:        Joi.boolean().optional(),
});

const paginateSchema = querySchema.keys({
  page:  Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(100).required(),
});

module.exports = {
  createStudentSchema,
  updateStudentSchema,
  changeStatusSchema,
  querySchema,
  paginateSchema,
};
