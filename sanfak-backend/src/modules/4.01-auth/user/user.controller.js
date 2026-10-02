const { ErrorHandler } = require("#shared/error");
const ObjectId = require("mongoose").Types.ObjectId;
const UserModel = require("./user.model");
const { translaterLanguage } = require("#shared/translate");
const { normalizePageParams } = require("#shared/paginate");
const fs = require("fs");
const path = require("path");
const userService = require("./user.service");

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const resolveUploadPath = (storedPath) => {
  const rel = String(storedPath || "").split("/files/")[1];
  if (!rel) return null;
  const abs = path.resolve(UPLOADS_DIR, rel);
  return abs.startsWith(UPLOADS_DIR + path.sep) ? abs : null;
};
const {
  assertCanAssignRole,
  assertUserEditable,
  assertCanChangePin,
} = require("#modules/4.01-auth/_shared/escalationGuard");
const authService = require("#modules/4.01-auth/auth/auth.service");
const TeacherProfileModel = require("#modules/4.03-teacher/teacher/teacher.model");

const REF_FIELDS = ["role", "position", "division", "department", "faculty", "academicTitle"];
const nullifyEmptyRefs = (body = {}) => {
  REF_FIELDS.forEach((f) => {
    if (body[f] === "" || body[f] === "null" || body[f] === "undefined") body[f] = null;
  });
  return body;
};

const normalizeRef = (v) =>
  v === null || v === undefined || v === "" || v === "null" || v === "undefined"
    ? ""
    : String(v);

module.exports = {
  addNew: async (req, res, next) => {
    try {
      await assertCanAssignRole(req.user, req.body?.role);

      const user = new UserModel(nullifyEmptyRefs(req.body));
      await user.save();

      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(new ErrorHandler(400, "Failed to add new user", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const { search, active, position, division, role } = req.query;
      let data = {};

      if (search)
        data["$or"] = [
          { firstName: { $regex: new RegExp(search, "i") } },
          { lastName: { $regex: new RegExp(search, "i") } },
        ];

      if (typeof active === "boolean") data["active"] = active;

      if (role) data["role"] = role;

      if (position) data["position"] = position;

      if (division) data["division"] = division;

      let docs = await UserModel.find(data, {
        createdAt: 0,
        updatedAt: 0,
        tokenVersion: 0,
      })
        .populate({
          path: "role",
          select: ["title", "permissions"],
          strictPopulate: false,
        })
        .populate({
          path: "position",
          select: ["title"],
          strictPopulate: false,
        })
        .populate({
          path: "division",
          select: ["title"],
          strictPopulate: false,
        })

        .exec();

      if (!docs) {
        return next(new ErrorHandler(404, "Users not found"));
      }

      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find users", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const {
        page,
        limit,
        search,
        position,
        division,
        active,
        role,
        language,
      } = req.query;
      let data = {};

      if (search)
        data["$or"] = [
          { firstName: { $regex: new RegExp(search, "i") } },
          { lastName: { $regex: new RegExp(search, "i") } },
        ];

      if (typeof active === "boolean") data["active"] = active;

      if (role) data["role"] = role;

      if (position) data["position"] = position;

      if (division) data["division"] = division;

      const { page: safePage, limit: safeLimit } = normalizePageParams({ page, limit });
      const options = {
        limit: safeLimit,
        page: safePage,
        select: ["-createdAt", "-updatedAt", "-tokenVersion"],
        lean: true,
        populate: [
          {
            path: "role",
            select: ["title", "permissions"],
            strictPopulate: false,
          },
          {
            path: "position",
            select: ["title"],
            strictPopulate: false,
          },
          {
            path: "division",
            select: ["title"],
            strictPopulate: false,
          },
          {
            path: "academicTitle",
            select: ["title"],
            strictPopulate: false,
          },
        ],
      };

      let doc = await UserModel.paginate(data, options);

      if (!doc) {
        return next(new ErrorHandler(404, "Users not found"));
      }
      if (language) {
        doc["docs"] = translaterLanguage(doc?.docs, language);
      }

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate users", err.message),
      );
    }
  },

  lookup: async (req, res, next) => {
    try {
      const { search, limit, role } = req.query;
      const docs = await userService.lookup({ search, limit, role });

      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to lookup users", err.message));
    }
  },

  findOne: async (req, res, next) => {
    try {
      let doc = await UserModel.findById(req.params.id, {
        createdAt: 0,
        updatedAt: 0,
        tokenVersion: 0,
      })
        .populate({
          path: "role",
          select: ["title", "permissions"],
          strictPopulate: false,
        })
        .populate({
          path: "position",
          select: ["title"],
          strictPopulate: false,
        })
        .populate({
          path: "division",
          select: ["title"],
          strictPopulate: false,
        })

        .exec();

      if (!doc) {
        return next(new ErrorHandler(404, "User not found"));
      }

      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find user", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      await assertCanAssignRole(req.user, req.body?.role, {
        targetUserId: req.params.id,
      });
      await assertUserEditable(req.user, req.params.id);
      await assertCanChangePin(req.user, req.params.id, req.body.oneIdPin);

      if (req.body?.position !== undefined) {
        const current = await UserModel.findById(req.params.id)
          .select("position")
          .lean();
        if (
          current &&
          normalizeRef(req.body.position) !== normalizeRef(current.position) &&
          (await TeacherProfileModel.exists({
            user: req.params.id,
            hrApprovalStatus: "approved",
          }))
        ) {
          return next(
            new ErrorHandler(
              409,
              "Lavozim kadrlar bo'limi tasdig'i orqali o'zgaradi. Profil tasdiqlash oqimidan foydalaning",
            ),
          );
        }
      }

      const doc = await UserModel.findByIdAndUpdate(req.params.id, nullifyEmptyRefs(req.body), {
        new: true,
      });

      if (!doc) {
        return next(new ErrorHandler(404, "User not found"));
      }

      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(new ErrorHandler(400, "Failed to update user", err.message));
    }
  },

  updateProfessor: async (req, res, next) => {
    try {
      await assertUserEditable(req.user, req.params.id);

      const { degrees, ...otherFields } = req.body;

      const updateQuery = { $set: otherFields };

      if (degrees) {
        Object.keys(degrees).forEach((degreeType) => {
          if (degrees[degreeType]?.length > 0) {
            updateQuery.$push = {
              ...updateQuery.$push,
              [`degrees.${degreeType}`]: { $each: degrees[degreeType] },
            };
          }
        });
      }

      const doc = await UserModel.findByIdAndUpdate(
        req.params.id,
        updateQuery,
        {
          new: true,
        },
      );

      if (!doc) {
        return next(new ErrorHandler(404, "User not found"));
      }

      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(new ErrorHandler(400, "Failed to update user", err.message));
    }
  },

  deleteFile: async (req, res, next) => {
    try {
      const { userId, degreeType, fileId } = req.body;

      const allowedTypes = [
        "bachelorDegree",
        "masterDegree",
        "scientificDegree",
        "scientificTitle",
      ];

      if (!allowedTypes.includes(degreeType)) {
        return next(new ErrorHandler(400, "Noto'g'ri degree turi"));
      }

      await assertUserEditable(req.user, userId);

      const user = await UserModel.findById(userId);

      if (!user) {
        return next(new ErrorHandler(404, "User not found"));
      }

      const degreeItem = user.degrees[degreeType].find(
        (item) => item._id.toString() === fileId,
      );

      if (!degreeItem) {
        return next(
          new ErrorHandler(404, "file not found or allready deleted"),
        );
      }

      const filePath = resolveUploadPath(degreeItem.path);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const doc = await UserModel.findByIdAndUpdate(
        userId,
        {
          $pull: {
            [`degrees.${degreeType}`]: { _id: fileId },
          },
        },
        { new: true },
      );

      if (!doc) {
        return next(new ErrorHandler(404, "User not found"));
      }

      return res.status(200).json({ message: "success" });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(new ErrorHandler(400, "Failed to delete user", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      await assertUserEditable(req.user, req.params.id);

      const doc = await UserModel.findByIdAndDelete(req.params.id);

      if (!doc) {
        return next(new ErrorHandler(404, "User not found"));
      }

      return res
        .status(200)
        .json({ message: "successfully deleted", _id: doc?._id });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(new ErrorHandler(400, "Failed to delete user", err.message));
    }
  },

  revokeSessions: async (req, res, next) => {
    try {
      await assertUserEditable(req.user, req.params.id);

      const tokenVersion = await authService.revokeAllSessions(
        req.params.id,
        `admin:${req.user?._id || "-"}`,
      );

      if (tokenVersion === null) {
        return next(new ErrorHandler(404, "Foydalanuvchi topilmadi"));
      }

      return res
        .status(200)
        .json({ message: "Barcha sessiyalar yopildi", tokenVersion });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(
        new ErrorHandler(400, "Sessiyalarni bekor qilishda xatolik", err.message),
      );
    }
  },

  changeStatus: async (req, res, next) => {
    try {
      const { active } = req.body;

      if (typeof active !== "boolean") {
        return next(
          new ErrorHandler(400, "Status must be either 'faol' or 'bloklangan'"),
        );
      }

      await assertUserEditable(req.user, req.params.id);

      const doc = await UserModel.findByIdAndUpdate(
        req.params.id,
        { active },
        { new: true },
      );

      if (!doc) {
        return next(new ErrorHandler(404, "User not found"));
      }

      return res.status(200).json({ message: "successfully changed status" });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(
        new ErrorHandler(400, "Failed to change user status", err.message),
      );
    }
  },
};
