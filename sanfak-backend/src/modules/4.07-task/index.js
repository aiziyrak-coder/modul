const router = require("express").Router();
const { initTaskBot } = require("./_services/taskBot");
const { initPoller, stopPoller } = require("./_services/telegramQueuePoller");

router.use("/tasks", require("./task/task.routes"));
router.use("/task-categories", require("./taskCategory/taskCategory.routes"));
router.use("/task-assignee-grants", require("./taskAssigneeGrant/taskAssigneeGrant.routes"));
router.use("/task-statistics", require("./taskStatistics/taskStatistics.routes"));

initTaskBot();

initPoller().catch((err) =>
  require("#shared/winston.logger").error(`[Task:TgQueue] poller init xato: ${err.message}`),
);

process.once("SIGINT",  stopPoller);
process.once("SIGTERM", stopPoller);

module.exports = router;
