const path = require("path");
const nodeFs = require("fs");
const archiver = require("archiver");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const ObjectId = require("mongoose").Types.ObjectId;
const { ROLES } = require("#config/constants");
const { escapeRegex } = require("#shared/searchFilter");
const IndicatorSubmission = require("./indicatorSubmission.model");
const Indicator = require("#modules/4.12-qualityAssurance/indicator/indicator.model");
const {
  safeDispatch,
  safeDispatchMany,
  getSifatBolimiUserIds,
} = require("#modules/4.12-qualityAssurance/_shared/qualityNotify");

const FULL_ACCESS_ROLES = new Set([
  ROLES.SIFAT_BOLIMI,
  ROLES.TALIM_SIFATI_NAZORATI,
  ROLES.SUPER_ADMIN,
]);

const oid = (v) => (v && ObjectId.isValid(v) ? new ObjectId(v) : null);

const SUBMISSION_STATUSES = ["pending", "approved", "rejected"];

const submissionMatch = (q = {}, { anyStatus = false } = {}) => {
  const match = {};
  if (!anyStatus) match.status = "approved";
  else if (SUBMISSION_STATUSES.includes(q.status)) match.status = q.status;
  const ay = oid(q.academicYear);
  if (ay) match.academicYear = ay;
  const ind = oid(q.indicator);
  if (ind) match.indicator = ind;
  const sem = Number(q.semester);
  if (sem === 1 || sem === 2) match.semester = sem;
  const teacher = oid(q.teacher);
  if (teacher) match.teacher = teacher;
  return match;
};

const TEACHER_SCOPE_STAGES = [
  {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      as: "teacherInfo",
    },
  },
  { $unwind: "$teacherInfo" },
  {
    $lookup: {
      from: "departments",
      localField: "teacherInfo.department",
      foreignField: "_id",
      as: "deptDirect",
    },
  },
  {
    $lookup: {
      from: "divisions",
      localField: "teacherInfo.division",
      foreignField: "_id",
      as: "deptFallback",
    },
  },
  {
    $addFields: {
      dept: {
        $ifNull: [
          { $arrayElemAt: ["$deptDirect", 0] },
          { $arrayElemAt: ["$deptFallback", 0] },
        ],
      },
    },
  },
  {
    $lookup: {
      from: "faculties",
      localField: "teacherInfo.faculty",
      foreignField: "_id",
      as: "facDirect",
    },
  },
  {
    $lookup: {
      from: "faculties",
      localField: "dept.faculty",
      foreignField: "_id",
      as: "facFallback",
    },
  },
  {
    $addFields: {
      fac: {
        $ifNull: [
          { $arrayElemAt: ["$facDirect", 0] },
          { $arrayElemAt: ["$facFallback", 0] },
        ],
      },
    },
  },
];

const TEACHER_SCOPE_STAGES_FOR_SUBMISSION = [
  { ...TEACHER_SCOPE_STAGES[0], $lookup: { ...TEACHER_SCOPE_STAGES[0].$lookup, localField: "teacher" } },
  ...TEACHER_SCOPE_STAGES.slice(1),
];

const EMPLOYMENT_TYPES = ["asosiy", "orindosh"];

const scopeMatch = (q = {}) => {
  const match = {};

  if (EMPLOYMENT_TYPES.includes(q.employmentType)) {
    match["teacherInfo.employmentType"] = q.employmentType;
  }
  const fac = oid(q.faculty);
  if (fac) match["fac._id"] = fac;
  const dep = oid(q.department);
  if (dep) match["dept._id"] = dep;

  const term = String(q.search || "").trim();
  if (term) {
    const words = term.split(" ").filter(Boolean);
    match.$and = words.map((word) => {
      const rx = new RegExp(escapeRegex(word), "i");
      return {
        $or: [
          { "teacherInfo.firstName": rx },
          { "teacherInfo.lastName": rx },
          { "teacherInfo.middleName": rx },
        ],
      };
    });
  }
  return match;
};

const PERIOD_MIN_SCORE = 25;

const refTitle = (path) => ({
  $ifNull: [
    "$" + path + ".title",
    { $ifNull: ["$" + path + ".name", "Noma'lum"] },
  ],
});

const TEACHER_POPULATE = {
  path: "teacher",
  populate: [
    {
      path: "department",
      select: "title faculty",
      populate: { path: "faculty", select: "title" },
    },
    { path: "faculty", select: "title" },
    {
      path: "division",
      select: "title faculty",
      populate: { path: "faculty", select: "title" },
    },
  ],
};

function canReadSubmission(user, submission) {
  if (FULL_ACCESS_ROLES.has(user?.role?.title)) return true;
  const ownerId = submission.teacher?._id || submission.teacher;
  return String(ownerId) === String(user._id);
}

function translateScope(scope) {
  if (scope && scope.user) return { teacher: scope.user };
  return scope || {};
}

module.exports = {
  addSubmission: async (req, res, next) => {
    try {
      if (!req.body.teacher) {
        req.body.teacher = req.user._id;
      }

      const indicator = await Indicator.findById(req.body.indicator);
      if (!indicator) {
        return res.status(404).json({ message: "Indikator topilmadi" });
      }
      if (!indicator.active) {
        return res
          .status(400)
          .json({ message: "Nofaol indikatorga ma'lumot yuborib bo'lmaydi" });
      }

      const doc = await new IndicatorSubmission(req.body).save();
      if (!doc) return res.status(404).json({ message: "Failed to save" });

      const bolim = await getSifatBolimiUserIds();
      await safeDispatchMany({
        userIds: bolim,
        eventType: "eq_submission_created",
        title: "Yangi ma'lumot tekshirish uchun yuborildi",
        link: "/education-quality/verification",
        metadata: { submissionId: doc._id, indicatorId: doc.indicator },
      });

      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add submission", err.message),
      );
    }
  },

  findAllSubmissions: async (req, res, next) => {
    try {
      const { teacher, indicator, active, academicYear, status, semester } =
        req.query;
      let data = translateScope(req.scope);
      if (teacher) data["teacher"] = teacher;
      if (indicator) data["indicator"] = indicator;
      if (active) data["active"] = active;
      if (academicYear) data["academicYear"] = academicYear;
      if (status) data["status"] = status;
      if (semester) data["semester"] = Number(semester);

      const docs = await IndicatorSubmission.find(data)
        .populate(TEACHER_POPULATE)
        .populate("indicator")
        .populate("reviewedBy")
        .populate("academicYear", "title")
        .exec();
      if (!docs) return res.status(404).json({ message: "not found" });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find submissions", err.message),
      );
    }
  },

  paginateSubmissions: async (req, res, next) => {
    try {
      const { teacher, indicator, active, academicYear, status, semester, page, limit } =
        req.query;
      let data = translateScope(req.scope);
      if (teacher) data["teacher"] = teacher;
      if (indicator) data["indicator"] = indicator;
      if (active) data["active"] = active;
      if (academicYear) data["academicYear"] = academicYear;
      if (status) data["status"] = status;
      if (semester) data["semester"] = Number(semester);

      const options = {
        limit: parseInt(limit),
        page: parseInt(page),
        populate: [
          TEACHER_POPULATE,
          "indicator",
          "reviewedBy",
          { path: "academicYear", select: "title" },
        ],
      };
      const doc = await IndicatorSubmission.paginate(data, options);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate submissions", err.message),
      );
    }
  },

  findOneSubmission: async (req, res, next) => {
    try {
      let doc = await IndicatorSubmission.findById(req.params.id, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate(TEACHER_POPULATE)
        .populate("indicator")
        .populate("reviewedBy")
        .populate("academicYear", "title")
        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });

      if (!canReadSubmission(req.user, doc)) {
        return res.status(404).json({ message: "not found" });
      }

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find submission", err.message),
      );
    }
  },

  updateSubmission: async (req, res, next) => {
    try {
      const doc = await IndicatorSubmission.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update submission", err.message),
      );
    }
  },

  reviewSubmission: async (req, res, next) => {
    try {
      const { status, comment, authorShare } = req.body;

      const submission = await IndicatorSubmission.findById(
        req.params.id,
      ).populate("indicator");
      if (!submission) return res.status(404).json({ message: "not found" });

      if (String(submission.teacher) === String(req.user._id)) {
        return res
          .status(403)
          .json({ message: "O'z ma'lumotingizni o'zingiz tasdiqlay olmaysiz" });
      }

      const update = {
        status,
        comment: comment || "",
        reviewedBy: req.user._id,
      };

      if (status === "approved") {
        const share =
          authorShare !== undefined ? authorShare : submission.authorShare;
        const coefficient = submission.indicator?.coefficient || 0;
        update.authorShare = share;
        update.score = coefficient * (share / 100);
      }

      const doc = await IndicatorSubmission.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });

      const statusLabel =
        status === "approved" ? "tasdiqlandi" : status === "rejected" ? "rad etildi" : status;
      await safeDispatch({
        userId: doc.teacher,
        eventType: "eq_submission_reviewed",
        title: `Yuborgan ma'lumotingiz ${statusLabel}`,
        link: "/education-quality/my-data",
        metadata: { submissionId: doc._id, status: doc.status },
      });

      return res.status(200).json({ message: "successfully reviewed" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to review submission", err.message),
      );
    }
  },

  getReportByFaculty: async (req, res, next) => {
    try {
      const submissions = await IndicatorSubmission.aggregate([
        { $match: submissionMatch(req.query) },
        {
          $group: {
            _id: "$teacher",
            totalScore: { $sum: "$score" },
            submissionCount: { $sum: 1 },
            indicators: { $addToSet: "$indicator" },
          },
        },
        ...TEACHER_SCOPE_STAGES,
        { $match: scopeMatch(req.query) },
        {
          $group: {
            _id: { $ifNull: ["$fac._id", null] },
            facultyName: { $first: refTitle("fac") },
            totalScore: { $sum: "$totalScore" },
            teacherCount: { $sum: 1 },
            redCount: {
              $sum: { $cond: [{ $lt: ["$totalScore", PERIOD_MIN_SCORE] }, 1, 0] },
            },
            departmentIds: { $addToSet: "$dept._id" },
          },
        },
        {
          $project: {
            facultyId: "$_id",
            facultyName: 1,
            totalScore: 1,
            teacherCount: 1,
            redCount: 1,
            departmentCount: { $size: "$departmentIds" },
            redShare: {
              $cond: [
                { $gt: ["$teacherCount", 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: ["$redCount", "$teacherCount"] }, 100] },
                    0,
                  ],
                },
                0,
              ],
            },
            avgScore: {
              $cond: [
                { $gt: ["$teacherCount", 0] },
                { $divide: ["$totalScore", "$teacherCount"] },
                0,
              ],
            },
          },
        },
        { $sort: { totalScore: -1 } },
      ]);
      return res.status(200).json(submissions);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Fakultet hisobotida xato", err.message),
      );
    }
  },

  getReportByDepartment: async (req, res, next) => {
    try {
      const submissions = await IndicatorSubmission.aggregate([
        { $match: submissionMatch(req.query) },
        {
          $group: {
            _id: "$teacher",
            totalScore: { $sum: "$score" },
            submissionCount: { $sum: 1 },
            indicators: { $addToSet: "$indicator" },
          },
        },
        ...TEACHER_SCOPE_STAGES,
        { $match: scopeMatch(req.query) },
        {
          $group: {
            _id: { $ifNull: ["$dept._id", null] },
            departmentName: { $first: refTitle("dept") },
            facultyId: { $first: "$fac._id" },
            facultyName: { $first: refTitle("fac") },
            totalScore: { $sum: "$totalScore" },
            teacherCount: { $sum: 1 },
            redCount: {
              $sum: { $cond: [{ $lt: ["$totalScore", PERIOD_MIN_SCORE] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            departmentId: "$_id",
            departmentName: 1,
            facultyId: 1,
            facultyName: 1,
            totalScore: 1,
            teacherCount: 1,
            redCount: 1,
            redShare: {
              $cond: [
                { $gt: ["$teacherCount", 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: ["$redCount", "$teacherCount"] }, 100] },
                    0,
                  ],
                },
                0,
              ],
            },
            avgScore: {
              $cond: [
                { $gt: ["$teacherCount", 0] },
                { $divide: ["$totalScore", "$teacherCount"] },
                0,
              ],
            },
          },
        },
        { $sort: { totalScore: -1 } },
      ]);
      return res.status(200).json(submissions);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Kafedra hisobotida xato", err.message),
      );
    }
  },

  getReportByTeachers: async (req, res, next) => {
    try {
      const submissions = await IndicatorSubmission.aggregate([
        { $match: submissionMatch(req.query) },
        {
          $group: {
            _id: "$teacher",
            totalScore: { $sum: "$score" },
            submissionCount: { $sum: 1 },
            indicators: { $addToSet: "$indicator" },
          },
        },
        ...TEACHER_SCOPE_STAGES,
        { $match: scopeMatch(req.query) },
        {
          $project: {
            teacherId: "$_id",
            firstName: "$teacherInfo.firstName",
            lastName: "$teacherInfo.lastName",
            middleName: "$teacherInfo.middleName",
            departmentId: "$dept._id",
            departmentName: refTitle("dept"),
            facultyId: "$fac._id",
            facultyName: refTitle("fac"),
            employmentType: "$teacherInfo.employmentType",
            totalScore: 1,
            submissionCount: 1,
            indicatorCount: { $size: "$indicators" },
          },
        },
        { $sort: { totalScore: -1 } },
      ]);
      return res.status(200).json(submissions);
    } catch (err) {
      return next(
        new ErrorHandler(400, "O'qituvchi hisobotida xato", err.message),
      );
    }
  },

  getSubmissionFilesZip: async (req, res, next) => {
    try {
      const rows = await IndicatorSubmission.aggregate([
        { $match: submissionMatch(req.query, { anyStatus: true }) },
        ...TEACHER_SCOPE_STAGES_FOR_SUBMISSION,
        { $match: scopeMatch(req.query) },
        {
          $project: {
            data: 1,
            firstName: "$teacherInfo.firstName",
            lastName: "$teacherInfo.lastName",
            middleName: "$teacherInfo.middleName",
          },
        },
      ]);

      const folderPath = process.env.FILEPATH;
      if (!folderPath) {
        return next(new ErrorHandler(500, "FILEPATH muhit o'zgaruvchisi sozlanmagan"));
      }
      const baseDir = `${folderPath}uploads/file/submissions`;

      const entries = [];
      const usedNames = new Map();
      for (const row of rows) {
        const folder =
          [row.lastName, row.firstName, row.middleName].filter(Boolean).join(" ") ||
          "Nomalum";
        for (const value of Object.values(row.data || {})) {
          if (!value || typeof value !== "object" || !value.fileUrl) continue;
          const diskName = String(value.fileUrl).split("/").pop().split("?")[0];
          const diskPath = path.join(baseDir, diskName);
          if (!nodeFs.existsSync(diskPath)) continue;

          const taken = usedNames.get(folder) || new Set();
          let name = value.fileName || diskName;
          if (taken.has(name)) {
            const dot = name.lastIndexOf(".");
            const stem = dot === -1 ? name : name.slice(0, dot);
            const ext = dot === -1 ? "" : name.slice(dot);
            let i = 2;
            while (taken.has(`${stem} (${i})${ext}`)) i += 1;
            name = `${stem} (${i})${ext}`;
          }
          taken.add(name);
          usedNames.set(folder, taken);
          entries.push({ diskPath, zipPath: `${folder}/${name}` });
        }
      }

      if (entries.length === 0) {
        return res.status(404).json({ message: "Yuklangan fayl topilmadi" });
      }

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="submission-files.zip"`,
      );

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", (err) => {
        winston.error(`[4.12] ZIP xatosi: ${err.message}`);
        res.destroy();
      });
      archive.pipe(res);
      for (const e of entries) archive.file(e.diskPath, { name: e.zipPath });
      return archive.finalize();
    } catch (err) {
      return next(new ErrorHandler(400, "Fayllarni arxivlashda xato", err.message));
    }
  },

  getTeacherScore: async (req, res, next) => {
    try {
      const { teacher } = req.params;
      const result = await IndicatorSubmission.aggregate([
        {
          $match: {
            teacher: new ObjectId(teacher),
            status: "approved",
          },
        },
        {
          $group: {
            _id: "$teacher",
            totalScore: { $sum: "$score" },
            count: { $sum: 1 },
          },
        },
      ]);
      return res.status(200).json(result[0] || { totalScore: 0, count: 0 });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get teacher score", err.message),
      );
    }
  },
};
