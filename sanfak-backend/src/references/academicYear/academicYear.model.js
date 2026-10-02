const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const ACADEMIC_YEAR_FORMAT = /^\d{4}\/\d{4}$/;

const AcademicYearSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      minlength: 9,
      maxlength: 9,
      match: [
        ACADEMIC_YEAR_FORMAT,
        "academicYear formati noto'g'ri (YYYY/YYYY kutiladi, masalan: 2024/2025)",
      ],
      unique: true,
      index: true,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

AcademicYearSchema.plugin(mongoosePaginate);
AcademicYearSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("academicYear", AcademicYearSchema);
module.exports.ACADEMIC_YEAR_FORMAT = ACADEMIC_YEAR_FORMAT;
