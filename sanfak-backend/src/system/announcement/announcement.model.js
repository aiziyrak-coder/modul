const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const AnnouncementSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true },
    body:    { type: String, required: true },
    fileUrl: { type: String },

    module: {
      type: String,
      enum: [
        "residency",
        "instituteCouncil",
        "scientificDept",
        "qualityAssurance",
        "general",
      ],
      default: "general",
    },

    targetCourses:     [{ type: mongoose.Schema.Types.ObjectId, ref: "course" }],
    targetDirections:  [{ type: mongoose.Schema.Types.ObjectId, ref: "direction" }],
    targetUsers:       [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],

    readBy: [
      {
        user:   { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        readAt: { type: Date, default: Date.now },
      },
    ],

    expiresAt: { type: Date },

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AnnouncementSchema.plugin(mongoosePaginate);
AnnouncementSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("announcement", AnnouncementSchema);
