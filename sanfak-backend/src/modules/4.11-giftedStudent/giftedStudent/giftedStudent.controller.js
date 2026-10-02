const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const {
  applyAcademicYearFilter,
  isUnset,
} = require("../_services/academicYearFilter");
const { applyCourseFilter } = require("../_services/courseFilter");
const { applyFreshTitles } = require("../_services/freshTitles");
const { applyFacultyFilter } = require("../_services/facultyFilter");
const { checkGroupDirection } = require("../_services/hierarchyCheck");
const { onboardStudent } = require("../_services/studentOnboarding");
const { importRoster } = require("../_services/rosterImport");
const { buildSampleRows } = require("../_services/rosterSample");
const { buildTemplateWorkbook } = require("../_services/rosterTemplate");
const { denyStudentAccess } = require("../_services/studentAccess");
const { stripStudentPii } = require("../_services/studentPii");
const { syncAccount } = require("../_services/accountSync");
const { rolesGranting } = require("../_services/roleEligibility");
const { usersWithRoles } = require("../_services/userCandidates");
const { searchRegex } = require("../_services/searchTerm");
const { ADVISOR, STUDENT } = require("../_services/moduleRoles");
const {
  yearScoreOf,
  rankingSort,
  resolveScoreYear,
} = require("../_services/yearScore");
const GiftedStudentModel = require("./giftedStudent.model");

const ADVISOR_POP = { path: "advisor", select: "lastName firstName middleName" };

const clean = (body) => {
  const out = { ...body };
  ["user", "passportSeria", "passportNumber", "jshshir", "facultyId", "directionId", "groupId"].forEach(
    (k) => {
      if (out[k] === "") out[k] = null;
    },
  );
  return out;
};

const dupMessage = (err) => {
  if (err?.code !== 11000) return null;
  const k = err.keyPattern || {};
  if (k.user) return "Bu OneID akkaunt boshqa talabaga biriktirilgan";
  if (k.passportSeria || k.passportNumber)
    return "Bu pasport (seriya va raqam) bilan talaba allaqachon mavjud";
  if (k.jshshir) return "Bu JSHSHIR bilan talaba allaqachon mavjud";
  return "Bunday talaba allaqachon mavjud (takroriy ma'lumot)";
};

const buildFilter = (q) => {
  const f = {};
  applyFacultyFilter(f, q.faculty);
  applyCourseFilter(f, q.course);
  applyAcademicYearFilter(f, q.academicYear);
  if (q.active !== undefined) f.active = q.active;
  const rx = searchRegex(q.search);
  if (rx) f.fullName = rx;
  return { ...f, ...(q.scope || {}) };
};

module.exports = {
  exportRanking: async (req, res, next) => {
    try {
      const { academicYear, scoreYear, faculty, course, search, active } = req.query;
      const filter = {};
      applyAcademicYearFilter(filter, academicYear);
      applyFacultyFilter(filter, faculty);
      applyCourseFilter(filter, course);
      if (active === true || active === "true") filter.active = true;
      else if (active === false || active === "false") filter.active = false;
      const rx = searchRegex(search);
      if (rx) filter.fullName = rx;
      Object.assign(filter, req.scope || {});

      const year = resolveScoreYear(scoreYear);
      const students = await applyFreshTitles(
        await GiftedStudentModel.find(filter).sort(rankingSort(year)).lean(),
      );

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Reyting");
      ws.columns = [
        { header: "#", key: "rank", width: 6 },
        { header: "F.I.SH", key: "fullName", width: 32 },
        { header: "Fakultet", key: "faculty", width: 24 },
        { header: "Yo'nalish", key: "direction", width: 24 },
        { header: "Kurs", key: "course", width: 8 },
        { header: "Guruh", key: "group", width: 12 },
        { header: "O'quv yili", key: "academicYear", width: 14 },
        { header: `Yil bali (${year})`, key: "yearScore", width: 16 },
        { header: "Jami ball", key: "totalScore", width: 12 },
      ];
      ws.getRow(1).font = { bold: true };
      students.forEach((s, i) => {
        ws.addRow({
          rank: i + 1,
          fullName: s.fullName || "",
          faculty: s.faculty || "",
          direction: s.direction || "",
          course: s.course ?? "",
          group: s.group || "",
          academicYear: s.academicYear || "",
          yearScore: yearScoreOf(s, year),
          totalScore: s.totalScore ?? 0,
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="iqtidorli-talabalar-reyting.xlsx"',
      );
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      return next(
        new ErrorHandler(400, "Reytingni eksport qilishda xato", err.message),
      );
    }
  },

  findMyStudent: async (req, res, next) => {
    try {
      const doc = await applyFreshTitles(
        await GiftedStudentModel.findOne({ user: req.user._id }).lean(),
      );
      return res.status(200).json(doc || null);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to fetch own profile", err.message));
    }
  },

  findMyAdvisor: async (req, res, next) => {
    try {
      const gs = await GiftedStudentModel.findOne({ user: req.user._id })
        .select("advisor advisorId advisorName")
        .lean();
      const advisorId = gs?.advisor || gs?.advisorId;
      if (!advisorId || !mongoose.isValidObjectId(advisorId)) {
        return res.status(200).json(gs?.advisorName ? { fullName: gs.advisorName } : null);
      }
      const u = await mongoose
        .model("user")
        .findById(advisorId)
        .select(
          "firstName lastName middleName email phone photo publications hIndex workingHours office",
        )
        .populate("department", "title")
        .populate("academicTitle", "title")
        .lean();
      if (!u) {
        return res.status(200).json(gs?.advisorName ? { fullName: gs.advisorName } : null);
      }
      const fullName =
        [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") ||
        gs.advisorName ||
        "";
      return res.status(200).json({
        fullName,
        degree: u.academicTitle?.title ?? null,
        department: u.department?.title ?? null,
        email: u.email ?? null,
        phone: u.phone ?? null,
        photo: u.photo ?? null,
        publications: u.publications ?? null,
        hIndex: u.hIndex ?? null,
        workingHours: u.workingHours ?? null,
        office: u.office ?? null,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to fetch advisor", err.message));
    }
  },

  addStudent: async (req, res, next) => {
    try {
      const result = await onboardStudent(clean(req.body), {
        conflictIsError: true,
      });

      if (!result.ok) {
        return res.status(400).json({ message: result.errors.join(" · ") });
      }

      const created = result.student.status === "created";
      return res.status(created ? 201 : 200).json({
        message: created ? "successfully created" : "already exists",
        id: result.student.id,
        student: result.student,
        account: result.account,
        warnings: result.warnings,
      });
    } catch (err) {
      const dup = dupMessage(err);
      if (dup) return next(new ErrorHandler(400, dup));
      return next(new ErrorHandler(400, "Failed to add gifted student", err.message));
    }
  },

  importStudents: async (req, res, next) => {
    try {
      const dryRun =
        String(req.query?.dryRun ?? req.body?.dryRun ?? "false") === "true";
      const report = await importRoster(req.file.buffer, { dryRun });
      return res.status(200).json(report);
    } catch (err) {
      if (err instanceof ErrorHandler) return next(err);
      return next(
        new ErrorHandler(400, "Ro'yxatni yuklashda xato", err.message),
      );
    }
  },

  importTemplate: async (req, res, next) => {
    try {
      const withSample = String(req.query?.sample ?? "false") === "true";

      const sampleRows = withSample ? await buildSampleRows() : [];

      const wb = buildTemplateWorkbook(sampleRows);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="iqtidorli-talabalar-${withSample ? "namuna" : "shablon"}.xlsx"`,
      );
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      return next(
        new ErrorHandler(400, "Shablonni tayyorlashda xato", err.message),
      );
    }
  },

  findMyAdvisees: async (req, res, next) => {
    try {
      const docs = await GiftedStudentModel.find(
        { advisorId: String(req.user._id) },
        { updatedAt: 0 },
      )
        .sort(rankingSort())
        .lean();
      return res
        .status(200)
        .json(stripStudentPii(await applyFreshTitles(docs), req.user));
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find advisees", err.message));
    }
  },

  advisorCandidates: async (req, res, next) => {
    try {
      const roleIds = await rolesGranting(ADVISOR.required, ADVISOR);
      return res.status(200).json(await usersWithRoles(roleIds));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to list advisor candidates", err.message),
      );
    }
  },

  accountCandidates: async (req, res, next) => {
    try {
      const roleIds = await rolesGranting(STUDENT.required, STUDENT);
      return res.status(200).json(await usersWithRoles(roleIds));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to list account candidates", err.message),
      );
    }
  },

  findAllStudents: async (req, res, next) => {
    try {
      const filter = buildFilter({ ...req.query, scope: req.scope });
      const docs = await GiftedStudentModel.find(filter, { updatedAt: 0 })
        .populate(ADVISOR_POP)
        .sort(rankingSort())
        .lean();
      return res
        .status(200)
        .json(stripStudentPii(await applyFreshTitles(docs), req.user));
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find gifted students", err.message));
    }
  },

  paginateStudents: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const filter = buildFilter({ ...req.query, scope: req.scope });
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        select: ["-updatedAt"],
        sort: rankingSort(),
        lean: true,
        populate: [ADVISOR_POP],
      };
      const doc = await GiftedStudentModel.paginate(filter, options);
      await applyFreshTitles(doc.docs);
      stripStudentPii(doc.docs, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to paginate gifted students", err.message));
    }
  },

  findOneStudent: async (req, res, next) => {
    try {
      if (await denyStudentAccess(req, res, req.params.id)) return undefined;
      const doc = await GiftedStudentModel.findById(req.params.id, { updatedAt: 0 })
        .populate(ADVISOR_POP)
        .lean();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json(stripStudentPii(await applyFreshTitles(doc), req.user));
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find gifted student", err.message));
    }
  },

  updateStudent: async (req, res, next) => {
    try {
      const current = await GiftedStudentModel.findById(req.params.id)
        .select("groupId directionId")
        .lean();
      if (!current) return res.status(404).json({ message: "not found" });
      const clash = await checkGroupDirection({
        groupId: Object.hasOwn(req.body, "groupId") ? req.body.groupId : current.groupId,
        directionId: Object.hasOwn(req.body, "directionId")
          ? req.body.directionId
          : current.directionId,
      });
      if (clash) return res.status(400).json(clash);

      const doc = await GiftedStudentModel.findByIdAndUpdate(req.params.id, clean(req.body), {
        new: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });

      const accountSync = await syncAccount(doc.user, req.body);

      return res.status(200).json({ message: "successfully updated", accountSync });
    } catch (err) {
      const dup = dupMessage(err);
      if (dup) return next(new ErrorHandler(400, dup));
      return next(new ErrorHandler(400, "Failed to update gifted student", err.message));
    }
  },

  deleteStudent: async (req, res, next) => {
    try {
      const doc = await GiftedStudentModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to delete gifted student", err.message));
    }
  },

  getRanking: async (req, res, next) => {
    try {
      const docs = await GiftedStudentModel.find(
        { active: true, ...(req.scope || {}) },
        { updatedAt: 0 },
      )
        .sort(rankingSort())
        .lean();
      return res.status(200).json(stripStudentPii(docs, req.user));
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to get ranking", err.message));
    }
  },
};
