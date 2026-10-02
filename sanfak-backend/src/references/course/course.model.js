const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const COURSE_TITLE_FORMAT = /^([1-9]|10)-kurs$/;

const CourseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      match: [
        COURSE_TITLE_FORMAT,
        "Kurs nomi formati noto'g'ri (N-kurs kutiladi, masalan: 1-kurs)",
      ],
    },
    desc: { type: String, default: null },
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

CourseSchema.plugin(mongoosePaginate);
CourseSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("course", CourseSchema);
module.exports.COURSE_TITLE_FORMAT = COURSE_TITLE_FORMAT;
