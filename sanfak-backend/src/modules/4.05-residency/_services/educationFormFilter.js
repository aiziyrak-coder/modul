"use strict";

const mongoose = require("mongoose");

const HEX24 = /^[0-9a-fA-F]{24}$/;

const toObjectId = (hex) => new mongoose.Types.ObjectId(String(hex));


const formVariants = (value) => {
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
  return [...new Set([raw, lower, capitalized])];
};

const applyEducationFormFilter = (filter, value) => {
  if (value === null || value === undefined || value === "") return filter;
  const raw = String(value).trim();

  if (HEX24.test(raw)) {
    filter.educationFormRef = toObjectId(raw);
    return filter;
  }

  const variants = formVariants(raw);
  filter.educationForm =
    variants.length === 1 ? variants[0] : { $in: variants };
  return filter;
};

module.exports = { applyEducationFormFilter, formVariants, HEX24 };
