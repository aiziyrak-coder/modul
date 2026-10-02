const {
  createThreeStagePlanService,
} = require("#modules/4.10-scientificDept/_shared/threeStagePlan.service");
const DepartmentWorkPlan = require("./departmentWorkPlan.model");

module.exports = createThreeStagePlanService(DepartmentWorkPlan, {
  label: "Ish reja",
});
