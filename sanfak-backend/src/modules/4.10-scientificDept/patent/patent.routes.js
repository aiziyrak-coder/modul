const { MODULES } = require("#config/constants");
const Model = require("./patent.model");
const {
  createAchievementService,
} = require("#modules/4.10-scientificDept/_shared/achievement.service");
const {
  createAchievementController,
} = require("#modules/4.10-scientificDept/_shared/achievement.controller");
const {
  createAchievementRoutes,
} = require("#modules/4.10-scientificDept/_shared/achievement.routes");
const {
  achievementQuerySchema,
  achievementPaginateSchema,
  rejectAchievementSchema,
} = require("#modules/4.10-scientificDept/_shared/achievement.validation");
const { createPatentSchema, updatePatentSchema } = require("./patent.validation");

const service = createAchievementService(Model, {
  label: "Patent",
  fields: ["title", "patentType", "registrationNumber", "date", "academicYear"],
  searchFields: ["title", "registrationNumber"],
});

const controller = createAchievementController(service, "Patent");

module.exports = createAchievementRoutes({
  moduleKey: MODULES.PATENT,
  controller,
  createSchema: createPatentSchema,
  updateSchema: updatePatentSchema,
  rejectSchema: rejectAchievementSchema,
  querySchema: achievementQuerySchema,
  paginateSchema: achievementPaginateSchema,
});
