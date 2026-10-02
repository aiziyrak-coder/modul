"use strict";
const Joi = require("joi");

const objectId = Joi.string().hex().length(24);

const oubQuery = Joi.object({
  academicYear: objectId.optional(),
  faculty: objectId.optional(),
});

module.exports = { oubQuery };
