const { MODULES } = require("#config/constants");
const Model = require("./scientificDegree.model");
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
const { createDegreeSchema, updateDegreeSchema } = require("./scientificDegree.validation");

const service = createAchievementService(Model, {
  label: "Ilmiy daraja",
  fields: [
    "degreeType",
    "specialty",
    "dissertationTopic",
    "awardedDate",
    "defenseDate",
    "councilName",
    "councilNumber",
    "academicYear",
  ],
  searchFields: ["specialty", "dissertationTopic"],
});

const controller = createAchievementController(service, "Ilmiy daraja");

module.exports = createAchievementRoutes({
  moduleKey: MODULES.SCIENTIFIC_DEGREE,
  controller,
  createSchema: createDegreeSchema,
  updateSchema: updateDegreeSchema,
  rejectSchema: rejectAchievementSchema,
  querySchema: achievementQuerySchema,
  paginateSchema: achievementPaginateSchema,
});
