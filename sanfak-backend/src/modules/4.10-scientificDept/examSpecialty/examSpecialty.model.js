const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const EXAM_SPECIALTY_STATUSES = ["open", "closed"];

const ExamSpecialtySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, default: "", trim: true },
    regStart: { type: Date, default: null },
    regEnd: { type: Date, default: null },
    status: { type: String, enum: EXAM_SPECIALTY_STATUSES, default: "open" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ExamSpecialtySchema.plugin(mongoosePaginate);

const model = mongoose.model("examSpecialty", ExamSpecialtySchema);
model.EXAM_SPECIALTY_STATUSES = EXAM_SPECIALTY_STATUSES;

module.exports = model;
