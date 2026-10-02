const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const POST_RECIPIENTS = ["all", "teachers", "heads", "deans"];

const ScientificPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    recipients: [{ type: String, enum: POST_RECIPIENTS }],
    telegram: { type: Boolean, default: true },
    specialtyCode: { type: String, default: "" },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ScientificPostSchema.plugin(mongoosePaginate);

const model = mongoose.model("scientificPost", ScientificPostSchema);
model.POST_RECIPIENTS = POST_RECIPIENTS;

module.exports = model;
