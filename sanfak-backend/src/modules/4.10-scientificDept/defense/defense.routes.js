const { MODULES } = require("#config/constants");
const Model = require("./defense.model");
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
const { createDefenseSchema, updateDefenseSchema } = require("./defense.validation");

const service = createAchievementService(Model, {
  label: "Himoya",
  fields: [
    "degreeType",
    "scienceBranch",
    "specialty",
    "diplomaSeries",
    "diplomaNumber",
    "defenseDate",
    "councilName",
    "councilNumber",
    "academicYear",
  ],
  searchFields: ["specialty", "scienceBranch", "councilName"],
});

const controller = createAchievementController(service, "Himoya");

module.exports = createAchievementRoutes({
  moduleKey: MODULES.DEFENSE,
  controller,
  createSchema: createDefenseSchema,
  updateSchema: updateDefenseSchema,
  rejectSchema: rejectAchievementSchema,
  querySchema: achievementQuerySchema,
  paginateSchema: achievementPaginateSchema,
});
