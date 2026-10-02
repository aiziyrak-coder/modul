const mongoose = require("mongoose");

const TeacherAccessSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
      index: true,
    },
    active: { type: Boolean, default: true },
    activeFrom: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("eqTeacherAccess", TeacherAccessSchema);
