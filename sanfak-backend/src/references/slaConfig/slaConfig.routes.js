const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./slaConfig.controller");

router.use(authenticate);

const permitAdd = permit(MODULES.SLA_CONFIG, [ACTIONS.CREATE]);
const permitRead = permit(MODULES.SLA_CONFIG, [ACTIONS.READ, ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.SLA_CONFIG, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.SLA_CONFIG, [ACTIONS.DELETE]);

router.route("/")
  .post(permitAdd, Controller.add)
  .get(permitRead, Controller.findAll);

router.route("/:id")
  .get(permitRead, Controller.findOne)
  .put(permitUpdate, Controller.update)
  .delete(permitDelete, Controller.delete);

module.exports = router;
