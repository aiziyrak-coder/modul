"use strict";

const mongoose = require("mongoose");

const HEX24 = /^[0-9a-fA-F]{24}$/;

const toObjectId = (hex) => new mongoose.Types.ObjectId(String(hex));


const COURSE_QUERY = /^(\d{1,2}|[0-9a-fA-F]{24})$/;

const applyCourseFilter = (filter, value) => {
  if (value === null || value === undefined || value === "") return filter;
  const raw = String(value).trim();

  if (HEX24.test(raw)) {
    filter.courseRef = toObjectId(raw);
    return filter;
  }

  const num = Number(raw);
  filter.courseNumber = Number.isFinite(num) ? num : { $in: [] };
  return filter;
};

module.exports = { applyCourseFilter, COURSE_QUERY, HEX24 };
