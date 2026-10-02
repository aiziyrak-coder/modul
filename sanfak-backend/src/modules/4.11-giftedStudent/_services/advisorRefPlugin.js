"use strict";

const mongoose = require("mongoose");

function toAdvisorRef(advisorId) {
  const raw = advisorId === null || advisorId === undefined ? "" : String(advisorId).trim();
  if (!raw || !mongoose.isValidObjectId(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

function pickAdvisorId(update) {
  if (!update) return undefined;
  if (update.$set && "advisorId" in update.$set) return update.$set.advisorId;
  if ("advisorId" in update) return update.advisorId;
  return undefined;
}

const advisorRefPlugin = (schema) => {
  schema.pre("save", function preSaveAdvisorRef(next) {
    if (this.isModified("advisorId")) {
      this.advisor = toAdvisorRef(this.advisorId);
    }
    next();
  });

  schema.pre(
    ["updateOne", "findOneAndUpdate", "updateMany"],
    function preUpdateAdvisorRef(next) {
      const update = this.getUpdate();
      const advisorId = pickAdvisorId(update);
      if (advisorId === undefined) return next();

      const ref = toAdvisorRef(advisorId);
      if (update.$set) update.$set.advisor = ref;
      else this.setUpdate({ ...update, advisor: ref });
      return next();
    },
  );
};

module.exports = advisorRefPlugin;
module.exports.toAdvisorRef = toAdvisorRef;
module.exports.pickAdvisorId = pickAdvisorId;
