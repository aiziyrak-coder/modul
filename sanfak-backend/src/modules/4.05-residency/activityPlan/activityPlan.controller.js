const Model = require("./activityPlan.model");
const {
  ACTIVITY_CATEGORIES,
} = require("#modules/4.05-residency/_services/workPlanSchemas");
const {
  makeController,
} = require("#modules/4.05-residency/_services/workPlanService");

module.exports = makeController(Model, {
  categories: ACTIVITY_CATEGORIES,
  linkPrefix: "/residency/faoliyat-rejasi",
  label: "Faoliyat rejasi",
});
