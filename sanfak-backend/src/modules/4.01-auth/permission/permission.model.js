const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const PermissionSchema = new mongoose.Schema(
  {
    title: {
      type: String
    },
    section: {
      type: String,
      required: true,
      unique: true,
    },
    actionKeys: {
      type: [String],
    },
    groups: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "permissionGroup",
      }],
      default: [],
      index: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

PermissionSchema.plugin(mongoosePaginate);
PermissionSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("permission", PermissionSchema);
