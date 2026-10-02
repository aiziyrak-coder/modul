"use strict";
const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const ScienceModel = require("#references/science/science.model");

const NOT_ELECTIVE_MESSAGE =
  "Bu fan katalogda «Tanlov fani» deb belgilanmagan — «Fanlar» bo'limida belgilang";

const label = (doc) => doc.scienceCode || doc.title || String(doc._id);

const assertElectiveScience = (doc) => {
  if (doc && doc.isElective !== true) {
    throw new ErrorHandler(400, NOT_ELECTIVE_MESSAGE, `fan: ${label(doc)}`);
  }
};

const assertElectiveScienceIds = async (ids) => {
  const list = [...new Set((ids || []).map(String))].filter((id) =>
    mongoose.isValidObjectId(id),
  );
  if (list.length === 0) return;
  const bad = await ScienceModel.find({ _id: { $in: list }, isElective: { $ne: true } })
    .select("_id scienceCode title")
    .lean();
  if (bad.length > 0) {
    throw new ErrorHandler(
      400,
      NOT_ELECTIVE_MESSAGE,
      `belgilanmagan: ${bad.map(label).join(", ")}`,
    );
  }
};

module.exports = { assertElectiveScience, assertElectiveScienceIds, NOT_ELECTIVE_MESSAGE };
