const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const JOURNAL_TYPES = ["scopus", "wos", "nationalOak", "foreignOak"];

const OakJournalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: JOURNAL_TYPES,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

OakJournalSchema.plugin(mongoosePaginate);

const model = mongoose.model("oakJournal", OakJournalSchema);
model.JOURNAL_TYPES = JOURNAL_TYPES;

module.exports = model;
