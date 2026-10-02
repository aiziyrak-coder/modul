const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const authenticate = require("#shared/authenticate");
const winston = require("#shared/winston.logger");
const { apiUserLimiter } = require("#shared/rateLimiter");

router.use("/auth", require("./modules/4.01-auth/auth/auth.routes"));

router.use(
  "/public/admission",
  require("./modules/4.08-internationalAdmission/public/public.routes"),
);

router.use(
  "/public/science-council",
  require("./modules/4.06-scientificCouncil/public/public.routes"),
);

router.use(
  "/public/qualification-exam",
  require("./modules/4.10-scientificDept/publicExam/publicExam.routes"),
);

router.use(
  "/public/methodical",
  require("./modules/4.10-scientificDept/publicMethodical/publicMethodical.routes"),
);

router.use(
  "/qualification-listener-auth",
  require("./modules/4.04-qualification/listenerAuth/listenerAuth.routes"),
);

router.use(
  "/qualification-listener-sync",
  require("./modules/4.04-qualification/listenerSync/listenerSync.routes"),
);

router.use("/residency-sams", require("./modules/4.05-residency/samsIngest/samsIngest.routes"));

router.use((req, res, next) => {
  const isEventStream = (req.headers.accept || "").includes("text/event-stream");
  return isEventStream
    ? authenticate.stream(req, res, next)
    : authenticate(req, res, next);
});

router.use(apiUserLimiter);

const mount = (label, modulePath) => {
  try {
    router.use(require(modulePath));
  } catch (err) {
    winston.error(`[router] "${label}" yuklanmadi — SKIP: ${err.message}`);
  }
};

const modulesDir = path.join(__dirname, "modules");
fs.readdirSync(modulesDir)
  .filter((d) => fs.existsSync(path.join(modulesDir, d, "index.js")))
  .sort()
  .forEach((d) => mount(`modules/${d}`, path.join(modulesDir, d, "index.js")));

["references", "domain", "system", "app"].forEach((g) => {
  const idx = path.join(__dirname, g, "index.js");
  if (fs.existsSync(idx)) mount(g, idx);
});

module.exports = router;
