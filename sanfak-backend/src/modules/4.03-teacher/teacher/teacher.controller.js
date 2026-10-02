const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const TeacherProfileModel = require("./teacher.model");
const { translaterLanguage } = require("#shared/translate");
const {
  redactProfile,
  redactProfiles,
} = require("#modules/4.03-teacher/_shared/profilePrivacy");
const {
  computeChangedFields,
} = require("#modules/4.03-teacher/_shared/changedFields");
const service = require("./teacher.service");
const { safeDispatch } = require("#modules/4.03-teacher/_shared/chainNotify");
const winston = require("#shared/winston.logger");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const isOwner = (profile, userId) =>
  Boolean(profile?.user) && profile.user.toString() === String(userId);

const DENY_NOT_OWNER = "Bu profil sizga tegishli emas";
const DENY_SELF_APPROVAL = "O'z profilingizni tasdiqlay/rad eta olmaysiz";

const isSelfQuery = (req, user) =>
  Boolean(user) && Boolean(req.user?._id) && String(user) === String(req.user._id);

const DUPLICATE_PROFILE =
  "Sizda profil allaqachon mavjud — «Mening profilim» sahifasida tahrirlang";
const isDuplicateKey = (err) =>
  err?.code === 11000 || /E11000/.test(String(err?.message || ""));

module.exports = {
  addProfile: async (req, res, next) => {
    try {
      const { user: _u, ...profileData } = req.body;
      const defaults = await service.profileDefaultsFromUser(req.user._id);
      if (!profileData.department) {
        if (defaults.department) profileData.department = defaults.department;
        if (!profileData.faculty && defaults.faculty) {
          profileData.faculty = defaults.faculty;
        }
      }
      if (!profileData.position && defaults.position) {
        profileData.position = defaults.position;
      }
      const doc = await new TeacherProfileModel({
        ...profileData,
        user: req.user._id,
        hrApprovalStatus: "pending",
      }).save();
      if (!doc) return res.status(404).json({ message: "Saqlanmadi" });
      return res
        .status(201)
        .json({ message: "Profil yaratildi", _id: doc._id });
    } catch (err) {
      if (isDuplicateKey(err)) {
        return next(new ErrorHandler(409, DUPLICATE_PROFILE));
      }
      return next(
        new ErrorHandler(400, "Profil yaratishda xatolik", err.message),
      );
    }
  },

  findAllProfiles: async (req, res, next) => {
    try {
      const { search, hrApprovalStatus, department, faculty, user, language } =
        req.query;
      const filter = { active: true, ...(isSelfQuery(req, user) ? {} : req.scope) };
      if (hrApprovalStatus) filter.hrApprovalStatus = hrApprovalStatus;
      if (department && !req.scope?.department) filter.department = department;
      if (faculty && !req.scope?.faculty) filter.faculty = faculty;
      if (user) filter.user = user;

      let docs = await TeacherProfileModel.find(filter, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate("user", "firstName lastName middleName photo phone email degrees")
        .populate("department", "title")
        .populate("faculty", "title")
        .populate("position", "title")
        .populate("hrApprovedBy", "firstName lastName")
        .exec();

      if (language) docs = translaterLanguage(docs, language);
      return res.status(200).json(redactProfiles(req, docs));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Profillarni olishda xatolik", err.message),
      );
    }
  },

  paginateProfiles: async (req, res, next) => {
    try {
      const {
        hrApprovalStatus,
        department,
        faculty,
        user,
        page = 1,
        limit = 20,
        language,
      } = req.query;
      const filter = { active: true, ...(isSelfQuery(req, user) ? {} : req.scope) };
      if (hrApprovalStatus) filter.hrApprovalStatus = hrApprovalStatus;
      if (department && !req.scope?.department) filter.department = department;
      if (faculty && !req.scope?.faculty) filter.faculty = faculty;
      if (user) filter.user = user;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        select: "-createdAt",
        populate: [
          {
            path: "user",
            select: "firstName lastName middleName photo phone email degrees",
          },
          { path: "department", select: "title" },
          { path: "faculty", select: "title" },
          { path: "position", select: "title" },
          { path: "hrApprovedBy", select: "firstName lastName" },
        ],
        lean: true,
      };

      let doc = await TeacherProfileModel.paginate(filter, options);
      if (language) doc = translaterLanguage(doc, language);
      if (doc?.docs) doc.docs = redactProfiles(req, doc.docs);
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xatolik", err.message));
    }
  },

  findOneProfile: async (req, res, next) => {
    try {
      const doc = await TeacherProfileModel.findOne(
        { _id: req.params.id, ...req.scope },
        { createdAt: 0, updatedAt: 0 },
      )
        .populate("user", "firstName lastName middleName photo phone email degrees")
        .populate("department", "title")
        .populate("faculty", "title")
        .populate("position", "title")
        .populate("hrApprovedBy", "firstName lastName")
        .exec();

      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(redactProfile(req, doc));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Profilni olishda xatolik", err.message),
      );
    }
  },

  updateProfile: async (req, res, next) => {
    try {
      const {
        hrApprovalStatus: _h,
        hrApprovedBy: _hb,
        changedFields: _cf,
        ...updateData
      } = req.body;

      const existing = await TeacherProfileModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!existing) return res.status(404).json({ message: "Topilmadi" });

      if (
        req.user?.role?.title === ROLES.OQITUVCHI &&
        !isOwner(existing, req.user._id)
      ) {
        return res.status(403).json({ message: DENY_NOT_OWNER });
      }

      const newlyChanged = computeChangedFields(existing, updateData);
      const changedFields = [
        ...new Set([...(existing.changedFields || []), ...newlyChanged]),
      ].sort();

      const doc = await TeacherProfileModel.findOneAndUpdate(
        { _id: req.params.id, ...req.scope },
        {
          ...updateData,
          hrApprovalStatus: "pending",
          hrApprovalDate: null,
          hrComment: null,
          changedFields,
        },
        { new: true, runValidators: true },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "Profil yangilandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  deleteProfile: async (req, res, next) => {
    try {
      const doc = await TeacherProfileModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      if (
        req.user?.role?.title === ROLES.OQITUVCHI &&
        !isOwner(doc, req.user._id)
      ) {
        return res.status(403).json({ message: DENY_NOT_OWNER });
      }
      await TeacherProfileModel.deleteOne({ _id: doc._id });
      return res
        .status(200)
        .json({ message: "Profil o'chirildi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xatolik", err.message));
    }
  },

  approveProfile: async (req, res, next) => {
    try {
      const { comment } = req.body;
      const existing = await TeacherProfileModel.findOne(
        { _id: req.params.id, ...req.scope },
        "user",
      );
      if (!existing) return res.status(404).json({ message: "Topilmadi" });
      if (isOwner(existing, req.user?._id)) {
        return res.status(403).json({ message: DENY_SELF_APPROVAL });
      }

      const doc = await TeacherProfileModel.findOneAndUpdate(
        { _id: req.params.id, ...req.scope },
        {
          hrApprovalStatus: "approved",
          hrApprovedBy: req.user?._id || null,
          hrApprovalDate: new Date(),
          hrComment: comment || null,
          changedFields: [],
        },
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      try {
        await service.syncApprovedPositionToUser(doc.user, doc.position);
      } catch (err) {
        winston.warn(
          `[4.03-teacher] position sync xato (profil ${doc._id}): ${err.message}`,
        );
      }
      try {
        await service.syncApprovedContactToUser(doc.user, doc.contactInfo);
      } catch (err) {
        winston.warn(
          `[4.03-teacher] contact sync xato (profil ${doc._id}): ${err.message}`,
        );
      }

      await safeDispatch({
        userId: doc.user,
        eventType: "teacherProfile_approved",
        title: "Profil tasdiqlandi",
        body: "Kadrlar bo'limi profil ma'lumotlaringizni tasdiqladi.",
        link: "/teacher/profile",
        metadata: { profileId: doc._id },
      });

      return res.status(200).json({ message: "Profil tasdiqlandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Tasdiqlashda xatolik", err.message));
    }
  },

  rejectProfile: async (req, res, next) => {
    try {
      const { comment } = req.body;
      if (!comment)
        return res.status(400).json({ message: "comment majburiy" });

      const existing = await TeacherProfileModel.findOne(
        { _id: req.params.id, ...req.scope },
        "user",
      );
      if (!existing) return res.status(404).json({ message: "Topilmadi" });
      if (isOwner(existing, req.user?._id)) {
        return res.status(403).json({ message: DENY_SELF_APPROVAL });
      }

      const doc = await TeacherProfileModel.findOneAndUpdate(
        { _id: req.params.id, ...req.scope },
        {
          hrApprovalStatus: "rejected",
          hrApprovedBy: req.user?._id || null,
          hrApprovalDate: new Date(),
          hrComment: comment,
          changedFields: [],
        },
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      await safeDispatch({
        userId: doc.user,
        eventType: "teacherProfile_rejected",
        title: "Profil rad etildi",
        body: `Kadrlar bo'limi profil ma'lumotlaringizni qaytardi. Sabab: ${comment}`,
        link: "/teacher/profile",
        metadata: { profileId: doc._id },
      });
      return res.status(200).json({ message: "Profil rad etildi", comment });
    } catch (err) {
      return next(new ErrorHandler(400, "Rad etishda xatolik", err.message));
    }
  },

  uploadMyDegrees: async (req, res, next) => {
    try {
      const doc = await service.addMyDegrees(req.user._id, req.body.degrees);
      return res
        .status(200)
        .json({ message: "Hujjatlar yuklandi", data: doc.degrees });
    } catch (err) {
      return next(wrapErr(err, "Hujjatlarni yuklashda xatolik"));
    }
  },

  removeMyDegree: async (req, res, next) => {
    try {
      const doc = await service.removeMyDegree(
        req.user._id,
        req.params.type,
        req.params.fileId,
      );
      return res
        .status(200)
        .json({ message: "Hujjat o'chirildi", data: doc.degrees });
    } catch (err) {
      return next(wrapErr(err, "Hujjatni o'chirishda xatolik"));
    }
  },
};
