const mongoose = require("mongoose");
const { listenerDb } = require("#shared/db");
const { LISTENER_ROLE_TITLE } = require("#config/constants");

let _model = null;

function Listener() {
  if (_model) return _model;

  const schema = new mongoose.Schema(
    {
      passport: { type: String, required: true, unique: true, index: true },
      fullName: { type: String, default: null },
      role: { type: String, default: LISTENER_ROLE_TITLE, index: true },
      userId: { type: String, default: null },
      listenerId: { type: String, default: null },
      active: { type: Boolean, default: true },
      firstName: { type: String, default: null },
      lastName: { type: String, default: null },
      middleName: { type: String, default: null },
      passportSeria: { type: String, default: null },
      passportNumber: { type: String, default: null },
      email: { type: String, default: null },
      phone: { type: String, default: null },
      lastLoginAt: { type: Date, default: null },
      loginCount: { type: Number, default: 0 },
      syncedAt: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false, strict: true },
  );

  _model = listenerDb().model("Listener", schema, "listeners");
  return _model;
}

module.exports = { Listener };
