const { ErrorHandler } = require("#shared/error");
const {
  getAcademicYearTitle,
} = require("#references/_services/academicYearResolver");
const service = require("./residencyReport.service");

const HEX24 = /^[0-9a-fA-F]{24}$/;

const resolveYear = async (query) => {
  const raw = query.academicYear;
  if (!raw || !HEX24.test(String(raw))) return query;

  const title = await getAcademicYearTitle(String(raw));
  if (!title) {
    throw new ErrorHandler(400, "O'quv yili topilmadi", "ACADEMIC_YEAR_NOT_FOUND");
  }
  return { ...query, academicYearTitle: title };
};

module.exports = {
  getFullReport: async (req, res, next) => {
    try {
      const query = await resolveYear(req.query);
      const data = await service.fullReport(query);
      return res.status(200).json(data);
    } catch (err) {
      return next(new ErrorHandler(400, "Hisobotni hisoblashda xato", err.message));
    }
  },

  getSummary: async (req, res, next) => {
    try {
      const query = await resolveYear(req.query);
      const data = await service.summary(query);
      return res.status(200).json(data);
    } catch (err) {
      return next(new ErrorHandler(400, "Statistikani hisoblashda xato", err.message));
    }
  },

  getAttendance: async (req, res, next) => {
    try {
      const query = await resolveYear(req.query);
      const [monthly, breakdown] = await Promise.all([
        service.attendanceMonthly(query),
        service.attendanceBreakdown(query),
      ]);
      return res.status(200).json({ monthly, breakdown });
    } catch (err) {
      return next(new ErrorHandler(400, "Davomat hisobotida xato", err.message));
    }
  },

  getScores: async (req, res, next) => {
    try {
      const query = await resolveYear(req.query);
      const [byScience, distribution] = await Promise.all([
        service.scoreByScience(query),
        service.scoreDistribution(query),
      ]);
      return res.status(200).json({ byScience, distribution });
    } catch (err) {
      return next(new ErrorHandler(400, "Ball hisobotida xato", err.message));
    }
  },

  getContingent: async (req, res, next) => {
    try {
      const query = await resolveYear(req.query);
      const [specialties, funding, studyPeriods] = await Promise.all([
        service.specialtyDistribution(query),
        service.fundingDistribution(query),
        service.studyPeriodDistribution(query),
      ]);
      return res.status(200).json({ specialties, funding, studyPeriods });
    } catch (err) {
      return next(new ErrorHandler(400, "Kontingent hisobotida xato", err.message));
    }
  },
};
