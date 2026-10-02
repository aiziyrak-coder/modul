const { ErrorHandler } = require("#shared/error");
const {
  applyScopedEquals,
} = require("#modules/4.05-residency/_services/scopeGuard");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");
const {
  guardResident,
  guardCreateResident,
  canCreateResident,
  supervisorScopeFor,
} = require("#modules/4.05-residency/_services/residentScope");
const User = require("#modules/4.01-auth/user/user.model");
const Resident = require("./resident.model");
const {
  onboardResident,
} = require("#modules/4.05-residency/_services/residentOnboarding");
const { importRoster } = require("#modules/4.05-residency/_services/rosterImport");
const {
  buildSampleRows,
} = require("#modules/4.05-residency/_services/rosterSample");
const {
  buildTemplateWorkbook,
} = require("#modules/4.05-residency/_services/rosterTemplate");
const {
  applySpecialtyDefaults,
  derivedWarnings,
} = require("#modules/4.05-residency/_services/specialtyDefaults");
const {
  syncAccount,
  syncAccountRole,
} = require("#modules/4.05-residency/_services/accountSync");
const {
  checkSupervisorEligible,
} = require("#modules/4.05-residency/_services/supervisorEligibility");
const {
  composeFullName,
} = require("#modules/4.05-residency/_services/residentAccount");
const {
  buildSupervisorCard,
} = require("#modules/4.05-residency/_services/supervisorCard");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const { searchOr } = require("#modules/4.05-residency/_services/searchTerm");
const {
  closeDraftForDeletedResident,
} = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const {
  changeStudyStatus,
  closeBeforeResidentDelete,
} = require("#modules/4.05-residency/_services/expulsionOrderGuards");
const winston = require("#shared/winston.logger");

const {
  preserveRefIds,
  preserveRefIdsAll,
  preservePaginated,
} = require("#modules/4.05-residency/_services/refIdPreserve");

const clean = (body) => {
  const out = { ...body };
  ["user", "jshshir", "passportSeria", "passportNumber", "specialty", "department", "group"].forEach(
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

const POP = [
  {
    path: "user",
    select: "firstName lastName middleName email phone photo position",
  },
  { path: "supervisor", select: "firstName lastName middleName position" },
  { path: "specialty", select: "title code program" },
  { path: "department", select: "title name" },
  { path: "group", select: "title name" },
];

function buildFilter(query, scope = {}) {
  const {
    search,
    program,
    fundingType,
    courseNumber,
    specialty,
    department,
    group,
    foreign,
    academicYear,
    active,
    status,
  } = query;
  const data = { ...scope };
  if (program) data.program = program;
  if (fundingType) data.fundingType = fundingType;
  if (courseNumber) data.courseNumber = Number(courseNumber);
  if (specialty) data.specialty = specialty;
  applyScopedEquals(data, scope, "department", department);
  if (group) data.group = group;
  applyAcademicYearFilter(data, academicYear);
  Object.entries({ foreign, active, status }).forEach(([k, v]) => {
    if (v !== undefined) data[k] = v;
  });
  const or = searchOr(search, ["fullName", "jshshir"]);
  if (or) data.$or = or;
  return data;
}


function programChange(body = {}, current = {}) {
  const changed =
    body.program !== undefined && body.program !== current.program;
  return { changed, blocked: changed && Boolean(current.supervisor) };
}

const PROGRAM_CHANGE_BLOCKED =
  "Dasturni o'zgartirishdan oldin ustoz biriktirishni bekor qiling " +
  "(biriktirilgan ustoz yangi dasturga mos kelmaydi)";

module.exports = {
  addResident: async (req, res, next) => {
    try {
      const body = clean(req.body);
      if (!guardCreateResident(req, res, body)) return undefined;

      const result = await onboardResident(body);

      if (!result.ok) {
        return res.status(400).json({ message: result.errors.join(" · ") });
      }

      const created = result.resident.status === "created";
      return res.status(created ? 201 : 200).json({
        message: created ? "successfully created" : "already exists",
        id: result.resident.id,
        resident: result.resident,
        account: result.account,
        warnings: result.warnings,
      });
    } catch (err) {
      const dup = dupMessage(err);
      if (dup) return next(new ErrorHandler(400, dup));
      return next(new ErrorHandler(400, "Failed to add resident", err.message));
    }
  },

  getSupervisorCard: async (req, res, next) => {
    try {
      const card = await buildSupervisorCard(req.params.id);
      if (!card) return res.status(404).json({ message: "not found" });
      return res.status(200).json(card);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to load supervisor card", err.message),
      );
    }
  },

  importResidents: async (req, res, next) => {
    try {
      const dryRun =
        String(req.query?.dryRun ?? req.body?.dryRun ?? "false") === "true";
      const report = await importRoster(req.file.buffer, {
        dryRun,
        canCreate: (payload) => canCreateResident(req.user, payload),
      });
      return res.status(200).json(report);
    } catch (err) {
      if (err instanceof ErrorHandler) return next(err);
      return next(new ErrorHandler(400, "Ro'yxatni yuklashda xato", err.message));
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
        `attachment; filename="kontingent-${withSample ? "namuna" : "shablon"}.xlsx"`,
      );
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      return next(new ErrorHandler(400, "Shablonni tayyorlashda xato", err.message));
    }
  },

  findAllResidents: async (req, res, next) => {
    try {
      const docs = await Resident.find(buildFilter(req.query, req.scope))
        .populate(POP)
        .sort({ createdAt: -1 });
      return res.status(200).json(preserveRefIdsAll(docs));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find residents", err.message),
      );
    }
  },

  paginateResidents: async (req, res, next) => {
    try {
      const { page, limit } = normalizePageParams(req.query);
      const doc = await Resident.paginate(buildFilter(req.query, req.scope), {
        page,
        limit,
        sort: withTiebreaker({ createdAt: -1 }),
        populate: POP,
      });
      return res.status(200).json(preservePaginated(doc));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate residents", err.message),
      );
    }
  },

  getMyResident: async (req, res, next) => {
    try {
      const doc = await Resident.findOne({ user: req.user._id }).populate(POP);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(preserveRefIds(doc));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find my resident record", err.message),
      );
    }
  },

  getMyResidents: async (req, res, next) => {
    try {
      const docs = await Resident.find(
        buildFilter(req.query, { supervisor: req.user._id }),
      )
        .populate(POP)
        .sort({ createdAt: -1 });
      return res.status(200).json(preserveRefIdsAll(docs));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find my residents", err.message),
      );
    }
  },

  findOneResident: async (req, res, next) => {
    try {
      const doc = await Resident.findById(req.params.id).populate(POP);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (!guardResident(req, res, doc, "read")) return undefined;
      return res.status(200).json(preserveRefIds(doc));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find resident", err.message),
      );
    }
  },

  changeResidentStatus: async (req, res, next) => {
    try {
      const current = await Resident.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "not found" });
      if (!guardResident(req, res, current, "write")) return undefined;

      const { status, reason } = req.body;
      const result = await changeStudyStatus({ residentId: current._id, to: status });
      if (!result.changed) {
        return res.status(200).json({ data: current, message: "o'zgarish yo'q" });
      }

      winston.info(
        `[4.5 resident] holat o'zgardi ${req.params.id}: ${result.from} → ${status} (${reason}) — ${req.user?._id}`,
      );
      return res.status(200).json({ data: result.doc });
    } catch (err) {
      return next(err);
    }
  },

  updateResident: async (req, res, next) => {
    try {
      const current = await Resident.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "not found" });
      if (!guardResident(req, res, current, "write")) return undefined;

      const { changed: programChanged, blocked } = programChange(req.body, current);
      if (blocked) {
        return res.status(400).json({ message: PROGRAM_CHANGE_BLOCKED });
      }

      const { body: patch, derived } = await applySpecialtyDefaults(
        req.body,
        current,
      );

      const nameParts = {
        lastName: patch.lastName,
        firstName: patch.firstName,
        middleName: patch.middleName,
      };
      const hasNameParts = !!(nameParts.lastName || nameParts.firstName);
      if (hasNameParts) {
        patch.fullName = composeFullName(nameParts);
      }
      delete patch.lastName;
      delete patch.firstName;
      delete patch.middleName;

      const doc = await Resident.findByIdAndUpdate(req.params.id, patch, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });

      const accountSync = await syncAccount(
        doc.user,
        hasNameParts ? { ...req.body, ...nameParts } : req.body,
      );

      const accountRoleSync = programChanged
        ? await syncAccountRole(doc.user, doc.program)
        : { status: "skipped" };

      const warnings = derivedWarnings(derived, patch);

      if (accountRoleSync.reason) warnings.push(accountRoleSync.reason);

      return res
        .status(200)
        .json({
          message: "successfully updated",
          accountSync,
          accountRoleSync,
          warnings,
        });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update resident", err.message),
      );
    }
  },

  assignSupervisor: async (req, res, next) => {
    try {
      const current = await Resident.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "not found" });
      if (!guardResident(req, res, current, "write")) return undefined;

      let supervisorName = null;
      if (req.body.supervisor) {
        const sup = await User.findById(req.body.supervisor)
          .select("firstName lastName middleName active role department")
          .populate("role", "title");
        if (!sup)
          return res.status(400).json({ message: "Ustoz (foydalanuvchi) topilmadi" });
        const verdict = checkSupervisorEligible(
          sup,
          current.program,
          supervisorScopeFor(req.user),
        );
        if (!verdict.ok)
          return res.status(400).json({ message: verdict.message });
        supervisorName = composeFullName(sup) || null;
      }

      const update = {
        supervisor: req.body.supervisor || null,
        supervisorName,
        assignedAt: new Date(),
      };
      for (const k of [
        "teachingLocation",
        "practiceLocation",
        "scheduleText",
        "weeklyHours",
      ]) {
        if (req.body[k] !== undefined) update[k] = req.body[k];
      }
      const doc = await Resident.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully assigned" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to assign supervisor", err.message),
      );
    }
  },

  deleteResident: async (req, res, next) => {
    try {
      const doc = await Resident.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (!guardResident(req, res, doc, "write")) return undefined;
      await doc.validate();
      await closeBeforeResidentDelete(doc._id, req.user);
      await doc.softDelete(req.user?._id, req.body?.reason);
      await closeDraftForDeletedResident(doc._id, req.user);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      if (err instanceof ErrorHandler) return next(err);
      return next(
        new ErrorHandler(400, "Failed to delete resident", err.message),
      );
    }
  },
};

module.exports.programChange = programChange;
module.exports.PROGRAM_CHANGE_BLOCKED = PROGRAM_CHANGE_BLOCKED;
