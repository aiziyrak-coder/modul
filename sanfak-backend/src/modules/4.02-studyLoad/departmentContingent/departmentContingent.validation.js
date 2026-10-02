"use strict";

const Joi = require("joi");
const { readSchema, deleteSchema } = require("#validators/common");
const {
  MAX_COURSE,
  MAX_STREAMS,
  MAX_NOTE,
  MAX_ROWS,
  MAX_GROUPS_PER_STREAM,
} = require("./departmentContingent.model");
const { duplicateGroupIds } = require("./departmentContingent.derive");

const objectId = Joi.string().hex().length(24);
const academicYearInput = objectId;
const courseNum = Joi.number().integer().min(1).max(MAX_COURSE);

const streamSchema = Joi.object({
  number: Joi.number().integer().min(1).max(MAX_STREAMS).required(),
  groups: Joi.array()
    .items(objectId)
    .min(1)
    .max(MAX_GROUPS_PER_STREAM)
    .unique()
    .required()
    .messages({ "array.max": `Bitta oqimda ${MAX_GROUPS_PER_STREAM} tadan ko'p guruh bo'lishi mumkin emas` }),
});

const noGroupInTwoStreams = (row, helpers) =>
  duplicateGroupIds(row).length > 0
    ? helpers.message(`${row.courseNum}-kurs: bitta guruh bir necha oqimda turibdi`)
    : row;

const rowSchema = Joi.object({
  direction: objectId.required(),
  courseNum: courseNum.required(),
  streams: Joi.array().items(streamSchema).min(1).max(MAX_STREAMS).unique("number").required(),
  note: Joi.string().trim().max(MAX_NOTE).allow(null, ""),
}).custom(noGroupInTwoStreams);

const updateContingentSchema = Joi.object({
  rows: Joi.array()
    .items(rowSchema)
    .max(MAX_ROWS)
    .messages({ "array.max": `Kontingentda ${MAX_ROWS} tadan ko'p qator bo'lishi mumkin emas` })
    .unique((a, b) => a.direction === b.direction && a.courseNum === b.courseNum)
    .required(),
});

const createContingentSchema = Joi.object({
  academicYear: academicYearInput.required(),
});

const paginateContingentQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  academicYear: academicYearInput,
  department: objectId,
});

const summaryQuery = Joi.object({
  academicYear: academicYearInput.required(),
});

const prefillQuery = Joi.object({
  academicYear: academicYearInput.required(),
  direction: objectId.required(),
  courseNum: courseNum.required(),
});

module.exports = {
  createContingentSchema,
  updateContingentSchema,
  paginateContingentQuery,
  summaryQuery,
  prefillQuery,
  readSchema,
  deleteSchema,
};
