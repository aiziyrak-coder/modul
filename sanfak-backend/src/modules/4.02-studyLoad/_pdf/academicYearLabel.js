"use strict";

const mongoose = require("mongoose");

function academicYearLabel(value, fallback = "") {
  if (!value) return fallback;
  if (value instanceof mongoose.Types.ObjectId) return fallback;
  if (typeof value === "object" && typeof value.title === "string") {
    return value.title;
  }
  return fallback;
}

module.exports = { academicYearLabel };
