const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const AnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AnnouncementSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("eqAnnouncement", AnnouncementSchema);
