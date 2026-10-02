"use strict";

const User = require("#modules/4.01-auth/user/user.model");
const { ErrorHandler } = require("#shared/error");
const { DEGREE_TYPES } = require("./teacher.validation");

module.exports = {
  DEGREE_TYPES,

  profileDefaultsFromUser: async (userId) => {
    const user = await User.findById(userId)
      .select("department faculty position")
      .lean();
    return {
      department: user?.department || null,
      faculty: user?.faculty || null,
      position: user?.position || null,
    };
  },

  addMyDegrees: async (userId, degrees) => {
    const push = {};
    DEGREE_TYPES.forEach((type) => {
      if (degrees?.[type]?.length > 0) {
        push[`degrees.${type}`] = { $each: degrees[type] };
      }
    });

    if (Object.keys(push).length === 0) {
      throw new ErrorHandler(400, "Kamida bitta fayl yuklanishi kerak");
    }

    const doc = await User.findByIdAndUpdate(
      userId,
      { $push: push },
      { new: true },
    ).select("degrees");
    if (!doc) throw new ErrorHandler(404, "Foydalanuvchi topilmadi");
    return doc;
  },

  removeMyDegree: async (userId, type, fileId) => {
    if (!DEGREE_TYPES.includes(type)) {
      throw new ErrorHandler(400, "Noto'g'ri hujjat turi");
    }

    const doc = await User.findOneAndUpdate(
      { _id: userId },
      { $pull: { [`degrees.${type}`]: { _id: fileId } } },
      { new: true },
    ).select("degrees");
    if (!doc) throw new ErrorHandler(404, "Foydalanuvchi topilmadi");
    return doc;
  },

  syncApprovedPositionToUser: async (userId, positionId) => {
    if (!userId || !positionId) return { changed: false, from: null, to: null };

    const current = await User.findById(userId).select("position").lean();
    if (!current) return { changed: false, from: null, to: null };

    const from = current.position ? String(current.position) : null;
    const to = String(positionId);
    if (from === to) return { changed: false, from, to };

    await User.updateOne({ _id: userId }, { position: positionId });
    return { changed: true, from, to };
  },

  syncApprovedContactToUser: async (userId, contactInfo) => {
    const phone = (contactInfo?.phone || "").trim();
    const email = (contactInfo?.email || "").trim();
    if (!userId || (!phone && !email)) return { changed: false, fields: [] };

    const current = await User.findById(userId).select("phone email").lean();
    if (!current) return { changed: false, fields: [] };

    const patch = {};
    if (phone && phone !== (current.phone || "")) patch.phone = phone;
    if (email && email !== (current.email || "")) patch.email = email;
    const fields = Object.keys(patch);
    if (fields.length === 0) return { changed: false, fields };

    await User.updateOne({ _id: userId }, patch);
    return { changed: true, fields };
  },
};
