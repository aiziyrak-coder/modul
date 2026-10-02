"use strict";

const mongoose = require("mongoose");

const HEX24 = /^[0-9a-fA-F]{24}$/;

const toObjectId = (hex) => new mongoose.Types.ObjectId(String(hex));


const yearVariants = (title) => {
  const t = String(title).trim();
  const alt = t.includes("/") ? t.replace(/\//g, "-") : t.replace(/-/g, "/");
  return alt === t ? [t] : [t, alt];
};

const applyAcademicYearFilter = (filter, value) => {
  if (value === null || value === undefined || value === "") return filter;
  const raw = String(value);

  if (HEX24.test(raw)) {
    filter.academicYearRef = toObjectId(raw);
    return filter;
  }

  const variants = yearVariants(raw);
  filter.academicYear = variants.length === 1 ? variants[0] : { $in: variants };
  return filter;
};

module.exports = { applyAcademicYearFilter, yearVariants, HEX24 };
