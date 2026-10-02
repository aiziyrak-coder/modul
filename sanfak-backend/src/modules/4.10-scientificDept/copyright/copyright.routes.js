const { MODULES } = require("#config/constants");
const Model = require("./copyright.model");
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
const {
  createCopyrightSchema,
  updateCopyrightSchema,
} = require("./copyright.validation");

const service = createAchievementService(Model, {
  label: "AKT guvohnomasi",
  fields: ["title", "authors", "institutionName", "registrationNumber", "date", "academicYear"],
  searchFields: ["title", "authors", "registrationNumber"],
});

const controller = createAchievementController(service, "AKT guvohnomasi");

module.exports = createAchievementRoutes({
  moduleKey: MODULES.COPYRIGHT,
  controller,
  createSchema: createCopyrightSchema,
  updateSchema: updateCopyrightSchema,
  rejectSchema: rejectAchievementSchema,
  querySchema: achievementQuerySchema,
  paginateSchema: achievementPaginateSchema,
});
