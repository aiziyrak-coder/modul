const mongoose = require("mongoose");

const ContractTemplateSchema = new mongoose.Schema(
  {
    body: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model(
  "practiceContractTemplate",
  ContractTemplateSchema,
);
