const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const ChatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    message: { type: String, required: true },
    fileUrl: { type: String },
    fileType: { type: String },
    readAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ChatMessageSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("chatMessage", ChatMessageSchema);
