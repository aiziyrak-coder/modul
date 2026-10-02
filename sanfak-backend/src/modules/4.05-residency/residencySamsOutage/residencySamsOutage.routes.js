"use strict";

const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencySamsOutage.controller");
const V = require("./residencySamsOutage.validation");

router.use(authenticate);

const permitRead = permit(MODULES.RESIDENT_ATTENDANCE, [ACTIONS.READ_ALL]);
const permitWrite = permit(MODULES.RESIDENCY_LESSON, [ACTIONS.UPDATE]);

router.route("/paginate").get(permitRead, validator.query(V.paginateQuery), C.paginate);

router.route("/").post(permitWrite, validator.body(V.createSchema), C.create);

router
  .route("/:id/cancel")
  .put(permitWrite, validator.params(V.idSchema), validator.body(V.cancelSchema), C.cancel);

module.exports = router;
