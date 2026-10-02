const { ErrorHandler } = require("#shared/error");
const Skill = require("./residencySkill.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const DailyLog = require("#modules/4.05-residency/dailyLog/dailyLog.model");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const {
  residentIdsFor,
} = require("#modules/4.05-residency/_services/residentScope");
const { searchRegex } = require("../_services/searchTerm");

const POP = [
  { path: "specialty", select: "title code program" },
  { path: "theoryTopic", select: "title active" },
];

function buildFilter(query) {
  const { search, specialty, semester, active } = query;
  const data = {};
  if (specialty) data.specialty = specialty;
  if (semester) data.semester = semester;
  if (active !== undefined) data.active = active;
  const rx = searchRegex(search);
  if (rx) data.practicalSkill = rx;
  return data;
}

const norm = (s) => String(s || "").trim().toLowerCase();

module.exports = {
  buildFilter,
  addSkill: async (req, res, next) => {
    try {
      await new Skill(req.body).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "Ko'nikma qo'shishda xato", err.message));
    }
  },

  findAllSkills: async (req, res, next) => {
    try {
      const docs = await Skill.find(buildFilter(req.query))
        .populate(POP)
        .sort({ semester: 1, practicalSkill: 1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Ko'nikma ro'yxati xatosi", err.message));
    }
  },

  paginateSkills: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const doc = await Skill.paginate(buildFilter(req.query), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { semester: 1, practicalSkill: 1 },
        populate: POP,
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Ko'nikma sahifalash xatosi", err.message));
    }
  },

  updateSkill: async (req, res, next) => {
    try {
      const doc = await Skill.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Ko'nikmani yangilashda xato", err.message));
    }
  },

  deleteSkill: async (req, res, next) => {
    try {
      const doc = await Skill.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Ko'nikmani o'chirishda xato", err.message));
    }
  },

  progress: async (req, res, next) => {
    try {
      const { academicYear, specialty, semester, courseNumber, group, program } =
        req.query;

      const skillFilter = { active: true };
      if (specialty) skillFilter.specialty = specialty;
      if (semester) skillFilter.semester = semester;
      const skills = await Skill.find(skillFilter).lean();
      if (!skills.length) return res.status(200).json([]);

      const resFilter = { active: true };
      if (specialty) resFilter.specialty = specialty;
      if (courseNumber) resFilter.courseNumber = Number(courseNumber);
      if (group) resFilter.group = group;
      applyAcademicYearFilter(resFilter, academicYear);
      if (program) resFilter.program = program;

      const ids = await residentIdsFor(req.user);
      if (ids !== null) resFilter._id = { $in: ids };

      const residents = await Resident.find(resFilter)
        .select("fullName courseNumber groupTitle specialty specialtyTitle")
        .populate({ path: "specialty", select: "title code program" })
        .lean();
      if (!residents.length) return res.status(200).json([]);

      const logs = await DailyLog.find({
        resident: { $in: residents.map((r) => r._id) },
        status: "tasdiqlangan",
        active: true,
      })
        .select("resident skills")
        .lean();

      const tally = new Map();
      for (const log of logs) {
        const key = String(log.resident);
        if (!tally.has(key)) tally.set(key, { byId: new Map(), byName: new Map() });
        const t = tally.get(key);
        for (const s of log.skills || []) {
          const c = Number(s.count) || 1;
          if (s.skillId) {
            const k = String(s.skillId);
            t.byId.set(k, (t.byId.get(k) || 0) + c);
          } else if (s.skill) {
            const k = norm(s.skill);
            t.byName.set(k, (t.byName.get(k) || 0) + c);
          }
        }
      }

      const rows = [];
      for (const r of residents) {
        const t = tally.get(String(r._id));
        const residentSpecialtyId = r.specialty?._id || r.specialty || null;
        for (const sk of skills) {
          if (
            residentSpecialtyId &&
            String(sk.specialty) !== String(residentSpecialtyId)
          )
            continue;
          const completed = t
            ? (t.byId.get(String(sk._id)) || 0) +
              (t.byName.get(norm(sk.practicalSkill)) || 0)
            : 0;
          const target = sk.patientCount || 1;
          rows.push({
            residentId: r._id,
            fullName: r.fullName,
            courseNumber: r.courseNumber,
            groupTitle: r.groupTitle,
            specialtyTitle: r.specialtyTitle,
            specialty: r.specialty || null,
            skillId: sk._id,
            semester: sk.semester,
            theoryTopicTitle: sk.theoryTopicTitle,
            practicalSkill: sk.practicalSkill,
            target,
            completed,
            done: completed >= target,
          });
        }
      }
      return res.status(200).json(rows);
    } catch (err) {
      return next(new ErrorHandler(400, "Ko'nikma progressida xato", err.message));
    }
  },
};
