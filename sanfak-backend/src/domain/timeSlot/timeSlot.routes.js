const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./timeSlot.controller");
const { createTimeSlotSchema } = require("./timeSlot.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.TIME_SLOT, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.TIME_SLOT, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.TIME_SLOT, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.TIME_SLOT, [ACTIONS.DELETE]);

router
  .route("/time-slots")
  .post(permitAdd, validator.body(createTimeSlotSchema), Controller.addTimeSlot)
  .get(permitReadAll, Controller.findAllTimeSlots);

router
  .route("/time-slots/:id")
  .put(permitUpdate, Controller.updateTimeSlot)
  .delete(permitDelete, Controller.deleteTimeSlot);

module.exports = router;
