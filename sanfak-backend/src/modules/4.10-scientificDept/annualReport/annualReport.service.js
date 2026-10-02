const {
  createThreeStagePlanService,
} = require("#modules/4.10-scientificDept/_shared/threeStagePlan.service");
const AnnualReport = require("./annualReport.model");

module.exports = createThreeStagePlanService(AnnualReport, {
  label: "Yillik hisobot",
});
