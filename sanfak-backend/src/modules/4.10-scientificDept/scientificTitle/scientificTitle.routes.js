const { MODULES } = require("#config/constants");
const Model = require("./scientificTitle.model");
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
const { createTitleSchema, updateTitleSchema } = require("./scientificTitle.validation");

const service = createAchievementService(Model, {
  label: "Ilmiy unvon",
  fields: ["titleType", "specialty", "diplomaSeries", "diplomaNumber", "date", "academicYear"],
  searchFields: ["specialty", "diplomaNumber"],
});

const controller = createAchievementController(service, "Ilmiy unvon");

module.exports = createAchievementRoutes({
  moduleKey: MODULES.SCIENTIFIC_TITLE,
  controller,
  createSchema: createTitleSchema,
  updateSchema: updateTitleSchema,
  rejectSchema: rejectAchievementSchema,
  querySchema: achievementQuerySchema,
  paginateSchema: achievementPaginateSchema,
});
