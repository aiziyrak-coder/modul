const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const AnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    recipientGroup: {
      type: String,
      enum: ["all", "professors", "dotsents", "deptHeads"],
      required: true,
    },
    recipientCount: { type: Number },
    fileUrl: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AnnouncementSchema.plugin(mongoosePaginate);
AnnouncementSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("councilAnnouncement", AnnouncementSchema);
