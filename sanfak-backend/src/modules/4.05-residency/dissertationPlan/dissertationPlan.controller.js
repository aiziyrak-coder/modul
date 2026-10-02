const Model = require("./dissertationPlan.model");
const {
  DISSERTATION_STAGES,
} = require("#modules/4.05-residency/_services/workPlanSchemas");
const {
  makeController,
} = require("#modules/4.05-residency/_services/workPlanService");

module.exports = makeController(Model, {
  categories: DISSERTATION_STAGES,
  linkPrefix: "/residency/dissertatsiya",
  label: "Dissertatsiya rejasi",
});
