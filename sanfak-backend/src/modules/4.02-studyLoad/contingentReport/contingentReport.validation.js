"use strict";

const Joi = require("joi");
const { paginate, readSchema, deleteSchema } = require("#validators/common");
const { CATEGORIES, SOURCES, MAX_COURSE } = require("./contingentReport.model");
const {
  rowInvariantError,
  foreignRowInvariantError,
  rowLabel,
} = require("./contingentReport.invariants");

const academicYearInput = Joi.alternatives().try(
  Joi.string().hex().length(24),
  Joi.string().pattern(/^\d{4}\s*[-/]\s*\d{4}$/),
);

const objectId = Joi.string().hex().length(24);
const MAX_COUNT = 100000;
const count = Joi.number().integer().min(0).max(MAX_COUNT).default(0);

const rowInvariants = (row, helpers) => {
  const error = rowInvariantError(row);
  return error ? helpers.message(`${rowLabel(row)}: ${error}`) : row;
};

const rowSchema = Joi.object({
  direction: objectId.required(),
  directionCode: Joi.string().allow("", null).max(40).optional(),
  directionTitle: Joi.string().allow("", null).max(200).optional(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .default("milliy"),
  course: Joi.number().integer().min(1).max(MAX_COURSE).required(),
  total: count,
  boys: count,
  girls: count,
  grant: count,
  contract: count,
  grantBoys: count,
  grantGirls: count,
  contractBoys: count,
  contractGirls: count,
  groupCount: count,
  streamCount: count,
  mobilityOut: count,
  mobilityIn: count,
  source: Joi.object({
    total: Joi.string().valid(...SOURCES),
    groupCount: Joi.string().valid(...SOURCES),
    streamCount: Joi.string().valid(...SOURCES),
  })
    .unknown(false)
    .optional(),
}).custom(rowInvariants);

const foreignRowSchema = Joi.object({
  country: Joi.string().trim().min(1).max(100).required(),
  total: count,
  boys: count,
  girls: count,
}).custom((row, helpers) => {
  const error = foreignRowInvariantError(row);
  return error ? helpers.message(`${row.country}: ${error}`) : row;
});

const uniqueCountries = (rows, helpers) => {
  const seen = new Set();
  for (const r of rows) {
    const key = String(r.country).trim().toLocaleLowerCase("uz");
    if (seen.has(key)) {
      return helpers.message(`Davlat takrorlangan: ${r.country}`);
    }
    seen.add(key);
  }
  return rows;
};

const uniqueRows = (rows, helpers) => {
  const seen = new Set();
  for (const r of rows) {
    const key = `${r.direction}|${r.course}|${r.category}`;
    if (seen.has(key)) {
      return helpers.message(
        `Qator takrorlangan: ${r.directionTitle || r.direction} ${r.course}-kurs (${r.category})`,
      );
    }
    seen.add(key);
  }
  return rows;
};

const createReportSchema = Joi.object({
  academicYear: academicYearInput.required(),
  asOfDate: Joi.date().iso().optional(),
});

const updateReportSchema = Joi.object({
  asOfDate: Joi.date().iso().optional(),
  rows: Joi.array().items(rowSchema).max(500).custom(uniqueRows).required(),
  foreignByCountry: Joi.array()
    .items(foreignRowSchema)
    .max(300)
    .custom(uniqueCountries)
    .default([]),
});

const prefillSchema = Joi.object({
  force: Joi.boolean().default(false),
});

const paginateReportQuery = paginate.keys({
  status: Joi.string()
    .valid("draft", "in_review", "approved", "rejected")
    .optional(),
});

const summaryQuery = Joi.object({
  academicYear: academicYearInput.required(),
});

const approveReportSchema = Joi.object({
  protocol: Joi.string().max(200).allow("", null).optional(),
  signature: Joi.string().allow("", null).optional(),
  eriSignature: Joi.string().allow("", null).optional(),
  eriSerial: Joi.string().allow("", null).optional(),
});

const rejectReportSchema = Joi.object({
  comment: Joi.string().max(1000).allow("", null).optional(),
});

module.exports = {
  academicYearInput,
  createReportSchema,
  updateReportSchema,
  prefillSchema,
  paginateReportQuery,
  summaryQuery,
  approveReportSchema,
  rejectReportSchema,
  readSchema,
  deleteSchema,
  rowSchema,
  foreignRowSchema,
};
