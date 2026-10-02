const express = require("express");
const bodyParser = require("body-parser");
const { handleError } = require("#shared/error");

const buildTestApp = () => {
  const app = express();
  app.use(bodyParser.json());

  app.use(
    "/api/distributions",
    require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.routes"),
  );

  app.use(
    "/api/workloads",
    require("#modules/4.02-studyLoad/workload/workload.routes"),
  );

  app.use(
    "/api/approval-inbox",
    require("#modules/4.02-studyLoad/approvalInbox/approvalInbox.routes"),
  );

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => handleError(err, res));

  return app;
};

module.exports = { buildTestApp };
