const router = require("express").Router();
const Joi = require("joi");
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const winston = require("#shared/winston.logger");

const FacultyModel = require("#references/faculty/faculty.model");
const DepartmentModel = require("#references/department/department.model");
const DivisionModel = require("#references/division/division.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const AcademicTitleModel = require("#references/academicTitle/academicTitle.model");
const AcademicLevelModel = require("#references/academicLevel/academicLevel.model");

const permitDict = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.READ]);
const permitStaff = permit(MODULES.SCIENCE_COUNCIL, [
  ACTIONS.MANAGE_MEMBERS,
  ACTIONS.SUBMIT_WORK,
]);

const facultyQuery = Joi.object({
  faculty: Joi.string().optional(),
});

const STAFF_DEFAULT_LIMIT = 50;
const STAFF_MAX_LIMIT = 200;

const staffQuery = Joi.object({
  search: Joi.string().allow("").optional(),
  limit: Joi.number().integer().min(1).max(STAFF_MAX_LIMIT).optional(),
});

router.use(authenticate);

router.get("/academic-titles", permitDict, async (req, res, next) => {
  try {
    const docs = await AcademicTitleModel.find({ active: true }, { title: 1 })
      .sort({ title: 1 })
      .lean();
    return res.json(docs);
  } catch (err) {
    winston.error("[sc-ref] academic-titles error:", err.message);
    return next(err);
  }
});

router.get("/academic-levels", permitDict, async (req, res, next) => {
  try {
    const docs = await AcademicLevelModel.find({ active: true }, { title: 1 })
      .sort({ title: 1 })
      .lean();
    return res.json(docs);
  } catch (err) {
    winston.error("[sc-ref] academic-levels error:", err.message);
    return next(err);
  }
});

router.get("/faculties", permitDict, async (req, res, next) => {
  try {
    const filter = { active: true };
    const docs = await FacultyModel.find(filter, { title: 1 }).lean();
    return res.json(docs);
  } catch (err) {
    winston.error("[sc-ref] faculties error:", err.message);
    return next(err);
  }
});

router.get(
  "/departments",
  permitDict,
  validator.query(facultyQuery),
  async (req, res, next) => {
    try {
      const filter = { active: true };
      if (req.query.faculty) filter.faculty = req.query.faculty;
      const docs = await DepartmentModel.find(filter, { title: 1, faculty: 1 }).lean();
      return res.json(docs);
    } catch (err) {
      winston.error("[sc-ref] departments error:", err.message);
      return next(err);
    }
  },
);

router.get("/divisions", permitDict, async (req, res, next) => {
  try {
    const filter = { active: true };
    const docs = await DivisionModel.find(filter, { title: 1 }).lean();
    return res.json(docs);
  } catch (err) {
    winston.error("[sc-ref] divisions error:", err.message);
    return next(err);
  }
});

router.get(
  "/staff",
  permitStaff,
  validator.query(staffQuery),
  async (req, res, next) => {
    try {
      const filter = { active: true };
      if (req.query.search) {
        const rx = new RegExp(req.query.search, "i");
        filter.$or = [{ firstName: rx }, { lastName: rx }, { middleName: rx }];
      }
      const limit = Math.min(
        Number(req.query.limit) || STAFF_DEFAULT_LIMIT,
        STAFF_MAX_LIMIT,
      );
      const docs = await UserModel.find(filter, {
        firstName: 1, lastName: 1, middleName: 1, fullName: 1,
        department: 1, division: 1, position: 1,
      })
        .populate("position", "title")
        .populate("department", "title")
        .populate("division", "title")
        .limit(limit)
        .lean();
      return res.json(docs);
    } catch (err) {
      winston.error("[sc-ref] staff error:", err.message);
      return next(err);
    }
  },
);

module.exports = router;
